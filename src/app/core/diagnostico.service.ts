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
  ) {}

  /** Inicia o diagnóstico: snapshot inicial + dados do telefone + primeiro evento. */
  async iniciar(): Promise<void> {
    if (this.sessao) {
      return;
    }
    this.processando = true;
    this.erro = null;
    let snapshot: UsbSnapshot | null = null;
    let usbOk = false;

    try {
      // 1. Snapshot inicial de USB
      try {
        snapshot = await this.executarComTimeout(
          () => this.usb.enumerar(),
          'enumeração USB'
        );
        usbOk = snapshot !== null && snapshot.erro === null;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.appLog.log(`USB: falha na enumeração inicial — ${msg}`, 'erro');
      }

      // Registra equipamentos USB identificados
      if (snapshot) {
        for (const d of snapshot.dispositivos) {
          this.identificacao.registrarUsbDispositivo(d);
        }
        for (const a of snapshot.acessorios) {
          this.identificacao.registrarUsbAcessorio(a);
        }
      }

      // 2. Dados do telefone
      let phone: PhoneInfo | null = null;
      try {
        phone = await this.device.coletar();
      } catch {
        phone = null;
      }

      // 3. Cria a sessão com startedAt válido ANTES de qualquer coleta posterior
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

      // 4. Eventos obrigatórios do ciclo de sessão
      this.sessao.eventos.push(
        this.criarEvento(
          'session_started',
          'Sessão de diagnóstico iniciada',
          usbOk
            ? this.usb.resumo(snapshot)
            : 'Sem enumeração USB disponível',
          'api',
          'info'
        )
      );

      if (usbOk) {
        this.sessao.eventos.push(
          this.criarEvento(
            'collector_started',
            'Coletor USB iniciado',
            'UsbManager getDeviceList + getAccessoryList (somente leitura)',
            'api',
            'info'
          )
        );
        this.sessao.eventos.push(
          this.criarEvento(
            'initial_snapshot',
            'Snapshot inicial de USB capturado',
            `${snapshot?.dispositivos.length ?? 0} dispositivo(s), ${snapshot?.acessorios.length ?? 0} acessório(s)`,
            'api',
            'info'
          )
        );
      } else {
        this.sessao.eventos.push(
          this.criarEvento(
            'collector_failed',
            'Coletor USB não iniciado',
            snapshot?.erro ?? 'Plugin nativo indisponível',
            'api',
            'erro'
          )
        );
      }

      this.appLog.log(`diagnóstico ${this.sessao.id} iniciado`, 'info');
      this.persistir();

      // 5. Inicia observação de mudanças USB (se nativo disponível)
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
          await this.registrarFalhaObservacao('observação USB', msg);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
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
  }): Promise<void> {
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

  /** Reenumerar interfaces ao voltar do primeiro plano (indica lacunas). */
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
