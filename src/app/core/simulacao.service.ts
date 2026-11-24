import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { AppLogService } from './app-log.service';
import { DiagnosticoService } from './diagnostico.service';
import { EventoTipo, UsbAccessoryInfo, UsbDeviceInfo, UsbSnapshot } from './models';
import { UsbService } from './usb.service';

export type CenarioSimulacao =
  | 'usb_conectado'
  | 'usb_desconectado'
  | 'lista_vazia'
  | 'bluetooth_sem_projecao'
  | 'rede_sem_projecao'
  | 'permissao_negada'
  | 'falha_coletor'
  | 'sessao_interrompida'
  | 'erro_sintetico';

export const BANNER_SIMULACAO = 'SIMULAÇÃO — não representa conexão física';

/**
 * Cenários sintéticos para validar software. Usa exatamente os mesmos serviços
 * de persistência, tela e exportador da captura real; apenas a fonte do evento
 * é substituída. Nunca é exposto em build de produção.
 */
@Injectable({ providedIn: 'root' })
export class SimulacaoService {
  constructor(
    private diagnostico: DiagnosticoService,
    private usb: UsbService,
    private appLog: AppLogService
  ) {}

  get disponivel(): boolean {
    return environment.permitirSimulacao;
  }

  get sessaoSimuladaAtiva(): boolean {
    return !!this.diagnostico.sessao?.simulacao;
  }

  async iniciar(): Promise<string> {
    this.exigirDesenvolvimento();
    await this.diagnostico.iniciar('simulacao');
    return this.diagnostico.sessao!.id;
  }

  async encerrar(): Promise<string | null> {
    this.exigirDesenvolvimento();
    const id = this.diagnostico.sessao?.simulacao ? this.diagnostico.sessao.id : null;
    if (id) {
      await this.diagnostico.encerrar();
    }
    return id;
  }

  async executar(cenario: CenarioSimulacao): Promise<{ ok: boolean; mensagem: string }> {
    this.exigirDesenvolvimento();
    if (!this.diagnostico.sessao) {
      await this.iniciar();
    }
    if (!this.sessaoSimuladaAtiva) {
      return {
        ok: false,
        mensagem: 'Há uma sessão real ativa. Encerre-a antes de iniciar uma simulação.',
      };
    }

    let mensagem: string;
    if (cenario === 'usb_conectado' || cenario === 'usb_desconectado' || cenario === 'lista_vazia') {
      const dispositivos: UsbDeviceInfo[] = cenario === 'usb_conectado'
        ? [{
            key: 'vid:6353:pid:53263',
            vid: 0x18d1,
            pid: 0xd00d,
            classe: 0,
            subclasse: 0,
            protocolo: 0,
            fabricante: 'Sintético',
            produto: 'Acessório DHU (dados inventados)',
            versao: '1.0',
            serial: null,
            interfaces: [],
          }]
        : [];
      const acessorios: UsbAccessoryInfo[] = cenario === 'usb_conectado'
        ? [{
            key: 'acc:sintetico:dhu',
            fabricante: 'Sintético',
            modelo: 'Acessório DHU (dados inventados)',
            descricao: 'metadados sintéticos — nenhuma conexão física',
            versao: '1.0',
            uri: 'sim://dhu',
          }]
        : [];
      // Mesma ingressão usada pela enumeração nativa: dispara o mesmo diff e a
      // mesma persistência de mudanças USB.
      this.usb.ingestarSnapshot(this.snapshotSintetico(dispositivos, acessorios), true);
      mensagem = `${cenario}: snapshot sintético ingressado pelo caminho real de enumeração`;
    } else {
      const evento = this.eventos(cenario);
      await this.diagnostico.registrarEvento(
        evento.tipo,
        `${BANNER_SIMULACAO} — ${evento.rotulo}`,
        `simulation=true; ${evento.detalhe}`,
        'api',
        evento.severidade,
        true
      );
      mensagem = `${cenario}: evento sintético registrado pelo serviço real de sessão`;
    }

    this.appLog.log(`simulação ${cenario}: ${mensagem}`, 'aviso');
    return { ok: true, mensagem };
  }

  private eventos(cenario: Exclude<CenarioSimulacao, 'usb_conectado' | 'usb_desconectado' | 'lista_vazia'>): {
    tipo: EventoTipo;
    rotulo: string;
    detalhe: string;
    severidade: 'info' | 'aviso' | 'erro';
  } {
    switch (cenario) {
      case 'bluetooth_sem_projecao':
        return {
          tipo: 'app_evento',
          rotulo: 'Bluetooth conectado sem projeção Android Auto',
          detalhe: 'estado Bluetooth sintético; não implica projeção nem conexão física',
          severidade: 'info',
        };
      case 'rede_sem_projecao':
        return {
          tipo: 'app_evento',
          rotulo: 'Rede disponível sem projeção Android Auto',
          detalhe: 'estado de rede sintético; não implica projeção nem conexão física',
          severidade: 'info',
        };
      case 'permissao_negada':
        return {
          tipo: 'erro_coleta',
          rotulo: 'Permissão negada (sintético)',
          detalhe: 'simulação de permissão recusada para testar registro de falha',
          severidade: 'erro',
        };
      case 'falha_coletor':
        return {
          tipo: 'collector_failed',
          rotulo: 'Falha de inicialização de coletor (sintético)',
          detalhe: 'simulação de falha de inicialização para testar registro de limitação',
          severidade: 'erro',
        };
      case 'sessao_interrompida':
        return {
          tipo: 'erro_coleta',
          rotulo: 'Sessão interrompida (sintético)',
          detalhe: 'simulação de interrupção para testar preservação parcial',
          severidade: 'aviso',
        };
      case 'erro_sintetico':
        return {
          tipo: 'erro_coleta',
          rotulo: 'Erro sintético — apenas teste de processamento',
          detalhe: 'evento inventado para provar que o pipeline registra e exporta erros',
          severidade: 'erro',
        };
    }
  }

  private snapshotSintetico(dispositivos: UsbDeviceInfo[], acessorios: UsbAccessoryInfo[]): UsbSnapshot {
    return {
      capturadoEm: new Date().toISOString(),
      monotonicMs: Math.round(performance.now()),
      origem: 'api',
      dispositivos,
      acessorios,
      notas: [`${BANNER_SIMULACAO}; simulation=true; metadados inventados`],
      erro: null,
    };
  }

  private exigirDesenvolvimento(): void {
    if (!this.disponivel) {
      throw new Error('Simulação disponível apenas em build de desenvolvimento.');
    }
  }
}
