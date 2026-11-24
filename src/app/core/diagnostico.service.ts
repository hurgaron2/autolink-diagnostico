import { Injectable } from '@angular/core';
import { AppLogService } from './app-log.service';
import { DeviceInfoService } from './device-info.service';
import {
  Evento,
  EventoTipo,
  Lacuna,
  Origem,
  PhoneInfo,
  Sessao,
  UsbSnapshot,
} from './models';
import { AutoLink, pluginNativoDisponivel } from './plugin';
import { UsbService } from './usb.service';
import { IdentificacaoService } from './identificacao.service';

const CHAVE_ATIVA = 'diagnostico.sessao.ativa';
const CHAVE_HISTORICO = 'diagnostico.historico';
const MAX_HISTORICO = 50;

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
 * Persistida em localStorage durante a reprodução; sem serviço em segundo plano.
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
  ) {
    // Única assinatura: mudanças vêm da enumeração real ou da simulação de desenvolvimento.
    this.usb.mudancas.subscribe((m) => {
      void this.registrarMudancaUsb(m);
    });
  }

  /**
   * Inicia o diagnóstico com snapshot e resultado individual de cada coletor.
   * Modos diferentes nunca compartilham a mesma sessão.
   */
  async iniciar(modo: 'real' | 'simulacao' = 'real'): Promise<void> {
    const simulacao = modo === 'simulacao';
    if (this.processando) {
      throw new Error('Inicialização de diagnóstico já em andamento.');
    }
    if (this.sessao) {
      if (!!this.sessao.simulacao !== simulacao) {
        throw new Error('Sessão ativa de origem diferente: não é permitido misturar simulação e captura real.');
      }
      return;
    }
    this.processando = true;
    this.erro = null;
    const id = gerarId();
    this.identificacao.sessaoIdAtiva = id;
    const agora = new Date().toISOString();
    // Cada sessão começa com diff limpo e passa a receber só os próprios snapshots.
    this.usb.resetarDiff();
    this.usb.sessaoIdAtiva = id;
    let snapshot: UsbSnapshot | null = null;
    let usbOk = false;

    try {
      // 1. Snapshot inicial de USB — persistido mesmo vazio ou com erro.
      try {
        if (simulacao) {
          // Nunca enumera USB real dentro de uma sessão sintética.
          snapshot = this.usb.snapshotVazio(null, true);
          this.usb.ingestarSnapshot(snapshot, true);
        } else {
          snapshot = await this.executarComTimeout(
            () => this.usb.enumerar(),
            'enumeração USB'
          );
        }
        usbOk = snapshot !== null && snapshot.erro === null;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.appLog.log(`USB: falha na enumeração inicial — ${msg}`, 'erro');
      }

      // 2. Dados do telefone
      let phone: PhoneInfo | null = null;
      try {
        phone = await this.device.coletar();
      } catch {
        phone = null;
      }

      // 3. Cria a sessão com startedAt válido ANTES de qualquer coleta posterior
      this.sessao = {
        id,
        iniciadaEm: agora,
        encerradaEm: null,
        snapshotInicial: snapshot,
        phoneSnapshot: phone,
        eventos: [],
        lacunas: [],
        ultimaAtividadeIso: agora,
        equipamentos: [],
        simulacao,
      };
      this.identificacao.sessaoAtiva = this.sessao;
      this.identificacao.aoRegistrar = () => this.persistir();

      // 3b. Só agora, com a sessão existente, registra o que o snapshot inicial viu.
      if (snapshot) {
        for (const d of snapshot.dispositivos) {
          this.identificacao.registrarUsbDispositivo(d);
        }
        for (const a of snapshot.acessorios) {
          this.identificacao.registrarUsbAcessorio(a);
        }
      }

      // 4. Resultado individual de cada coletor disponível
      this.sessao.eventos.push(
        this.criarEvento(
          'session_started',
          'Sessão de diagnóstico iniciada',
          usbOk ? this.usb.resumo(snapshot) : (snapshot?.erro ?? 'Sem enumeração USB disponível'),
          'api',
          'info'
        )
      );
      this.sessao.eventos.push(
        this.criarEvento(
          usbOk ? 'collector_started' : 'collector_failed',
          usbOk ? 'Coletor USB iniciado' : 'Coletor USB não iniciado',
          simulacao
            ? 'enumeração: snapshot sintético vazio (simulation=true) — nenhuma API USB real foi lida'
            : `enumeração: ${usbOk ? 'UsbManager getDeviceList + getAccessoryList (somente leitura)' : (snapshot?.erro ?? 'plugin nativo indisponível')}`,
          'api',
          usbOk ? 'info' : 'erro'
        )
      );
      if (snapshot) {
        this.sessao.eventos.push(
          this.criarEvento(
            'initial_snapshot',
            'Snapshot inicial persistido',
            `${snapshot.dispositivos.length} dispositivo(s), ${snapshot.acessorios.length} acessório(s)${snapshot.erro ? ` — ${snapshot.erro}` : ''}`,
            'api',
            snapshot.erro ? 'aviso' : 'info'
          )
        );
      }

      this.appLog.log(`diagnóstico ${this.sessao.id} iniciado`, 'info');
      this.persistir();

      // 5. Coletor de eventos USB: só a captura real registra o receiver.
      // Simulação nunca toca o plugin nativo nem lê USB real.
      let observadorOk = false;
      let motivoObservador = simulacao
        ? 'não aplicável — simulação não registra receiver nativo'
        : 'plugin nativo indisponível';
      try {
        if (!simulacao && pluginNativoDisponivel() && !this.usb.observando) {
          await this.usb.iniciarObservacao();
        }
        observadorOk = !simulacao && this.usb.observando;
        if (!simulacao) {
          motivoObservador = observadorOk
            ? 'receiver dinâmico registrado para ACTION_USB_*_ATTACHED/DETACHED'
            : 'receiver dinâmico NÃO registrado — eventos de hotplug não serão observados';
        }
      } catch (e) {
        motivoObservador = e instanceof Error ? e.message : String(e);
        this.appLog.log(`não foi possível iniciar observação USB: ${motivoObservador}`, 'erro');
      }
      this.observando = observadorOk;
      this.sessao.eventos.push(
        this.criarEvento(
          observadorOk ? 'collector_started' : 'collector_failed',
          simulacao
            ? 'Coletor de eventos USB não aplicável (simulação)'
            : (observadorOk ? 'Coletor de eventos USB iniciado' : 'Coletor de eventos USB não iniciado'),
          `observação: ${motivoObservador}`,
          'api',
          simulacao ? 'aviso' : (observadorOk ? 'info' : 'erro')
        )
      );
      this.persistir();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!this.sessao) {
        this.usb.sessaoIdAtiva = null;
        this.identificacao.sessaoIdAtiva = null;
        this.identificacao.sessaoAtiva = null;
        this.identificacao.aoRegistrar = null;
      }
      this.erro = `Falha ao iniciar diagnóstico: ${msg}`;
      this.appLog.log(this.erro, 'erro');
      if (this.sessao) {
        await this.registrarFalhaObservacao('inicialização da sessão', msg);
      }
      throw e;
    } finally {
      this.processando = false;
    }
  }

  /** Registra uma mudança de conexão USB observada automaticamente. */
  private async registrarMudancaUsb(m: {
    tipo: string;
    rotulo: string;
    detalhe: string;
    simulacao?: boolean;
  }): Promise<void> {
    const sessao = this.sessao;
    if (!sessao) {
      return;
    }
    if (!!m.simulacao !== !!sessao.simulacao) {
      this.appLog.log('mudança USB ignorada: origem diferente da sessão ativa', 'aviso');
      return;
    }
    await this.registrarEvento(
      m.tipo === 'usb_conectado' ? 'usb_conectado' : 'usb_desconectado',
      m.rotulo,
      m.detalhe,
      'api',
      m.tipo === 'usb_conectado' ? 'info' : 'aviso',
      !!sessao.simulacao
    );
    // Re-enumera para refletir novo estado e identificar equipamento.
    // Em simulação isso leria USB real: nunca misturar fontes na mesma sessão.
    try {
      if (sessao.simulacao) {
        return;
      }
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
      for (const lacuna of this.sessao.lacunas) {
        if (lacuna.fimIso === null) {
          lacuna.fimIso = this.sessao.encerradaEm;
          this.sessao.eventos.push(
            this.criarEvento('lacuna_fim', 'Lacuna encerrada com a sessão', lacuna.motivo, 'api', 'aviso')
          );
        }
      }
      this.sessao.eventos.push(
        this.criarEvento('session_ended', 'Diagnóstico encerrado', undefined, 'api')
      );

      // Salva no histórico (origem da verdade para o relatório)
      const encerrada = this.sessao;
      const salvo = lerJson<Sessao[]>(CHAVE_HISTORICO, []);
      const historico = [encerrada, ...salvo].slice(0, MAX_HISTORICO);
      let gravado = false;
      try {
        localStorage.setItem(`autolink.${CHAVE_HISTORICO}`, JSON.stringify(historico));
        gravado = true;
      } catch {
        // sem espaço: sessão segue apenas em memória
      }

      this.appLog.log(
        `diagnóstico ${encerrada.id} encerrado${gravado ? ', persistido' : ', sem persistência'}`, 'info'
      );

      // Limpa sessão ativa apenas APÓS persistir no histórico
      this.sessao = null;
      this.usb.sessaoIdAtiva = null;
      this.identificacao.sessaoIdAtiva = null;
      this.identificacao.sessaoAtiva = null;
      this.identificacao.aoRegistrar = null;
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
    severidade: 'info' | 'aviso' | 'erro' = 'info',
    simulacao?: boolean
  ): Promise<void> {
    if (!this.sessao) {
      return;
    }
    // Chamadas internas omitem o parâmetro e herdam a origem da sessão;
    // só uma origem explicitamente diferente é rejeitada.
    if (simulacao !== undefined && simulacao !== !!this.sessao.simulacao) {
      this.appLog.log('evento ignorado: origem diferente da sessão ativa', 'aviso');
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

  /** Registra honestamente a perda de observação ao sair do primeiro plano. */
  async registrarSaidaParaSegundoPlano(): Promise<void> {
    if (!this.sessao || this.sessao.encerradaEm) {
      return;
    }
    if (this.sessao.lacunas.some((l) => l.fimIso === null)) {
      return;
    }
    this.sessao.lacunas.push({
      inicioIso: new Date().toISOString(),
      fimIso: null,
      motivo: 'aplicativo em segundo plano — coleta contínua não garantida',
    });
    await this.registrarEvento(
      'lacuna_inicio',
      'Aplicativo em segundo plano',
      'Android Auto pode assumir a tela; eventos durante a pausa podem não ser observados',
      'api',
      'aviso'
    );
  }

  /** Reenumerar interfaces ao voltar do primeiro plano e fechar a lacuna. */
  async reenumerarAoRetornar(): Promise<void> {
    if (!this.sessao || this.sessao.encerradaEm) {
      return;
    }
    try {
      if (!this.sessao.simulacao) {
        const snapshot = await this.usb.enumerar();
        if (snapshot) {
          for (const d of snapshot.dispositivos) {
            this.identificacao.registrarUsbDispositivo(d);
          }
          for (const a of snapshot.acessorios) {
            this.identificacao.registrarUsbAcessorio(a);
          }
        }
      }
      const abertas = this.sessao.lacunas.filter((l) => l.fimIso === null);
      const fimIso = new Date().toISOString();
      for (const lacuna of abertas) {
        lacuna.fimIso = fimIso;
      }
      const detalhe = this.sessao.simulacao
        ? 'lacuna encerrada; nenhuma interface real foi re-enumerada nesta simulação'
        : (abertas.length > 0
          ? `${abertas.length} lacuna(s) encerrada(s); interfaces re-enumeradas`
          : 'interfaces re-enumeradas');
      await this.registrarEvento('lacuna_fim', 'Aplicativo voltou ao primeiro plano', detalhe, 'api', 'info');
      await this.registrarEvento('app_evento', 'aplicativo voltou ao primeiro plano', detalhe, 'api', 'info');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.registrarFalhaObservacao('reenumerar ao retornar', msg);
    }
  }

  /** Retorna a sessão para exportação: ativa ou a última encerrada no histórico. */
  sessaoParaExport(): Sessao | null {
    if (this.sessao) {
      return this.sessao;
    }
    try {
      const salvo = lerJson<Sessao[]>(CHAVE_HISTORICO, []);
      return salvo.length > 0 ? salvo[0] : null;
    } catch {
      return null;
    }
  }

  /** Resolve exatamente a sessão pedida; sem ID mantém o comportamento antigo. */
  obterSessao(id?: string): Sessao | null {
    if (!id) {
      return this.sessaoParaExport();
    }
    if (this.sessao?.id === id) {
      return this.sessao;
    }
    return this.historicoParaExport().find((s) => s.id === id) ?? null;
  }

  /** Retorna todo o histórico de sessões. */
  historicoParaExport(): Sessao[] {
    try {
      return lerJson<Sessao[]>(CHAVE_HISTORICO, []);
    } catch {
      return [];
    }
  }

  /** Exclui uma sessão do histórico pelo ID. */
  async excluirSessao(id: string): Promise<void> {
    try {
      const salvo = lerJson<Sessao[]>(CHAVE_HISTORICO, []);
      const filtrada = salvo.filter((s) => s.id !== id);
      localStorage.setItem(`autolink.${CHAVE_HISTORICO}`, JSON.stringify(filtrada));
      this.appLog.log(`sessão ${id} excluída do histórico`, 'info');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.appLog.log(`falha ao excluir sessão ${id}: ${msg}`, 'erro');
      throw e;
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
      simulacao: !!this.sessao?.simulacao,
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
