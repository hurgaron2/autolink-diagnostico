import { Injectable } from '@angular/core';
import { AppLogService } from './app-log.service';
import { DeviceInfoService } from './device-info.service';
import { Evento, EventoTipo, Origem, PhoneInfo, Sessao, UsbSnapshot } from './models';
import { AutoLink, pluginNativoDisponivel } from './plugin';
import { UsbService } from './usb.service';
import { IdentificacaoService } from './identificacao.service';

const CHAVE_ATIVA = 'diagnostico.sessao.ativa';

function gerarId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  return `d-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Sessão de diagnóstico automático: linha do tempo com eventos observados
 * (USB, Bluetooth, rede, app), snapshot inicial e dados do telefone.
 * Persistida em localStorage durante a reprodução.
 */
@Injectable({ providedIn: 'root' })
export class DiagnosticoService {
  sessao: Sessao | null = null;
  processando = false;
  erro: string | null = null;
  observando = false;

  constructor(
    private usb: UsbService,
    private device: DeviceInfoService,
    private appLog: AppLogService,
    private identificacao: IdentificacaoService
  ) {}

  /** Inicia o diagnóstico: snapshot inicial + dados do telefone + primeiro evento. */
  async iniciar(): Promise<void> {
    if (this.sessao) {
      return;
    }
    this.processando = true;
    this.erro = null;
    try {
      const snapshot = await this.executarComTimeout(
        () => this.usb.enumerar(),
        'enumeração USB'
      );
      // Registra equipamentos USB identificados
      if (snapshot) {
        for (const d of snapshot.dispositivos) {
          this.identificacao.registrarUsbDispositivo(d);
        }
        for (const a of snapshot.acessorios) {
          this.identificacao.registrarUsbAcessorio(a);
        }
      }
      let phone: PhoneInfo | null = null;
      try {
        phone = await this.device.coletar();
      } catch {
        phone = null;
      }
      const agora = new Date().toISOString();
      this.sessao = {
        id: gerarId(),
        iniciadaEm: agora,
        encerradaEm: null,
        snapshotInicial: snapshot,
        phoneSnapshot: phone,
        eventos: [],
        lacunas: [],
        ultimaAtividadeIso: agora,
      };
      this.sessao.eventos.push(
        this.criarEvento(
          'diagnostico_iniciado',
          'Diagnóstico iniciado',
          this.usb.resumo(snapshot),
          'api'
        )
      );
      this.appLog.log(`diagnóstico ${this.sessao.id} iniciado`, 'info');
      this.persistir();

      // Inicia observação de mudanças USB (se nativo disponível)
      if (pluginNativoDisponivel() && !this.observando) {
        try {
          await this.usb.iniciarObservacao();
          this.observando = true;
          this.usb.mudancas.subscribe((m) => {
            void this.registrarMudancaUsb(m);
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          this.appLog.log(`não foi possível iniciar observação USB: ${msg}`, 'aviso');
          this.registrarEvento('erro_coleta', 'observação USB indisponível', msg, 'api', 'aviso');
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.erro = `Falha ao iniciar diagnóstico: ${msg}`;
      this.appLog.log(this.erro, 'erro');
      throw e;
    } finally {
      this.processando = false;
    }
  }

  /** Registra uma mudança de conexão USB observada automaticamente. */
  private async registrarMudancaUsb(m: { tipo: string; rotulo: string; detalhe: string }): Promise<void> {
    if (!this.sessao) {
      return;
    }
    await this.registrarEvento(
      m.tipo === 'usb_conectado' ? 'usb_conectado' : 'usb_desconectado',
      m.rotulo,
      m.detalhe,
      'api',
      m.tipo === 'usb_conectado' ? 'info' : 'aviso'
    );
    // Re-enumera para refletir novo estado e identificar equipamento
    try {
      const snapshot = await this.usb.enumerar();
      if (snapshot) {
        for (const d of snapshot.dispositivos) {
          this.identificacao.registrarUsbDispositivo(d);
        }
        for (const a of snapshot.acessorios) {
          this.identificacao.registrarUsbAcessorio(a);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.appLog.log(`falha ao re-enumerar USB após mudança: ${msg}`, 'aviso');
    }
  }

  /** Encerra o diagnóstico, para observadores e salva no histórico local. */
  async encerrar(): Promise<void> {
    if (!this.sessao) {
      return;
    }
    this.processando = true;
    this.erro = null;
    try {
      // Para observação USB
      if (this.observando && pluginNativoDisponivel()) {
        try {
          await this.usb.pararObservacao();
          this.observando = false;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          this.appLog.log(`falha ao parar observação USB: ${msg}`, 'aviso');
        }
      }

      this.sessao.encerradaEm = new Date().toISOString();
      this.sessao.ultimaAtividadeIso = this.sessao.encerradaEm;
      this.sessao.eventos.push(
        this.criarEvento('diagnostico_encerrado', 'Diagnóstico encerrado', undefined, 'api')
      );
      const encerrada = this.sessao;
      const salvo = lerJson<Sessao[]>('diagnostico.historico', []);
      const historico = [encerrada, ...salvo].slice(0, 50);
      try {
        localStorage.setItem(`autolink.${'diagnostico.historico'}`, JSON.stringify(historico));
      } catch {
        // sem espaço: sessão segue em memória
      }
      this.appLog.log(`diagnóstico ${encerrada.id} encerrado`, 'info');
      this.sessao = null;
      try {
        localStorage.removeItem(`autolink.${CHAVE_ATIVA}`);
      } catch {
        // ignora
      }
    } finally {
      this.processando = false;
    }
  }

  /** Registra um evento observado na linha do tempo da sessão. */
  async registrarEvento(
    tipo: EventoTipo,
    rotulo: string,
    detalhe?: string,
    origem: Origem = 'api',
    severidade: 'info' | 'aviso' | 'erro' = 'info'
  ): Promise<void> {
    if (!this.sessao) {
      return;
    }
    const evento = this.criarEvento(tipo, rotulo, detalhe, origem);
    this.sessao.eventos.push(evento);
    this.sessao.ultimaAtividadeIso = new Date().toISOString();
    this.appLog.log(`evento ${tipo}: ${rotulo}`, severidade);
    this.persistir();
  }

  /** Registra que uma permissão foi negada ou uma observação falhou. */
  async registrarFalhaObservacao(fonte: string, motivo: string): Promise<void> {
    await this.registrarEvento(
      'erro_coleta',
      `falha de observação: ${fonte}`,
      motivo,
      'api',
      'erro'
    );
    this.appLog.log(`falha de observação ${fonte}: ${motivo}`, 'erro');
  }

  /** Observação livre do usuário (recurso secundário). */
  async observacao(texto: string): Promise<void> {
    const t = texto.trim();
    if (!t) {
      return;
    }
    await this.registrarEvento('observacao', 'Observação', t, 'manual', 'aviso');
  }

  /** Reenumerar interfaces ao voltar do segundo plano (indica lacunas). */
  async reenumerarAoRetornar(): Promise<void> {
    if (!this.sessao) {
      return;
    }
    try {
      const snapshot = await this.usb.enumerar();
      if (snapshot) {
        for (const d of snapshot.dispositivos) {
          this.identificacao.registrarUsbDispositivo(d);
        }
        for (const a of snapshot.acessorios) {
          this.identificacao.registrarUsbAcessorio(a);
        }
      }
      await this.registrarEvento(
        'app_evento',
        'aplicativo voltou ao primeiro plano',
        'interfaces re-enumeradas',
        'api',
        'info'
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.registrarFalhaObservacao('reenumerar ao retornar', msg);
    }
  }

  private criarEvento(
    tipo: EventoTipo,
    rotulo: string,
    detalhe: string | undefined,
    origem: Origem,
    severidade?: 'info' | 'aviso' | 'erro',
    monotonicMs?: number
  ): Evento {
    const d = new Date();
    return {
      id: gerarId(),
      tipo,
      rotulo,
      detalhe,
      origem,
      timestampIso: d.toISOString(),
      timezoneOffsetMin: -d.getTimezoneOffset(),
      monotonicMs: monotonicMs ?? Math.round(performance.now()),
    };
  }

  private persistir(): void {
    if (!this.sessao) {
      return;
    }
    try {
      localStorage.setItem(`autolink.${CHAVE_ATIVA}`, JSON.stringify(this.sessao));
    } catch {
      // sem espaço
    }
  }

  /** Executa uma ação com timeout para não travar a interface indefinidamente. */
  private async executarComTimeout<T>(acao: () => Promise<T>, nome: string): Promise<T> {
    const timeout = 15_000;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const promTimeout = new Promise<never>((_resolve, rejeitar) => {
      timer = setTimeout(() => rejeitar(new Error(`timeout após ${timeout / 1000} s: ${nome}`)), timeout);
    });
    try {
      return await Promise.race([acao(), promTimeout]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  get duracaoSegundos(): number {
    if (!this.sessao) {
      return 0;
    }
    const fim = this.sessao.encerradaEm ?? new Date().toISOString();
    const a = Date.parse(this.sessao.iniciadaEm);
    const b = Date.parse(fim);
    if (Number.isNaN(a) || Number.isNaN(b) || b <= a) {
      return 0;
    }
    return Math.round((b - a) / 1000);
  }
}

function lerJson<T>(chave: string, padrao: T): T {
  try {
    const raw = localStorage.getItem(`autolink.${chave}`);
    return raw ? (JSON.parse(raw) as T) : padrao;
  } catch {
    return padrao;
  }
}
