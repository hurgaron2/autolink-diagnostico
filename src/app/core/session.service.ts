import { Injectable, OnDestroy } from '@angular/core';
import { AppLogService } from './app-log.service';
import { DeviceInfoService } from './device-info.service';
import { Evento, EventoTipo, Lacuna, Origem, PhoneInfo, Sessao } from './models';
import { AutoLink, pluginNativoDisponivel } from './plugin';
import { UsbService } from './usb.service';

const CHAVE_ATIVA = 'sessao.ativa';
const CHAVE_HISTORICO = 'sessoes';
const MAX_HISTORICO = 20;

function gerarId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Sessão de diagnóstico: linha do tempo com marcações manuais, eventos USB,
 * eventos do app e lacunas de observação. Persistida em localStorage durante
 * a reprodução; sem serviço em segundo plano.
 */
@Injectable({ providedIn: 'root' })
export class SessionService implements OnDestroy {
  sessao: Sessao | null = null;
  historico: Sessao[] = [];

  private gapAberta = false;

  constructor(
    private usb: UsbService,
    private device: DeviceInfoService,
    private appLog: AppLogService
  ) {
    this.historico = lerJson<Sessao[]>(CHAVE_HISTORICO, []);
    this.restaurarAtiva();

    this.usb.mudancas.subscribe((m) => {
      this.registrarAutomatico(m.tipo, m.rotulo, m.detalhe);
    });

    document.addEventListener('visibilitychange', this.onVisibility);
  }

  ngOnDestroy(): void {
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  private onVisibility = (): void => {
    if (document.hidden) {
      this.lacunaInicio('aplicativo saiu do primeiro plano');
    } else {
      this.lacunaFim('aplicativo voltou ao primeiro plano');
    }
  };

  private restaurarAtiva(): void {
    const salva = lerJson<Sessao | null>(CHAVE_ATIVA, null);
    if (!salva || salva.encerradaEm) {
      return;
    }
    this.sessao = salva;
    // Lacuna entre a última gravação conhecida e a reabertura do app.
    const inicio = salva.ultimaAtividadeIso;
    const fim = new Date().toISOString();
    salva.lacunas.push({
      inicioIso: inicio,
      fimIso: fim,
      motivo: 'possível encerramento ou segundo plano do aplicativo entre a última gravação e a reabertura',
    });
    salva.eventos.push(
      this.criarEvento(
        'app_evento',
        'Sessão restaurada após reabertura do aplicativo',
        `lacuna de ${formatarDuracao(inicio, fim)} não observada`,
        'api',
        0
      )
    );
    this.appLog.log('sessão ativa restaurada; lacuna de observação registrada', 'aviso');
    this.persistir();
  }

  async iniciar(): Promise<void> {
    if (this.sessao) {
      return;
    }
    const snapshot = await this.usb.enumerar();
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
      this.criarEvento('sessao_iniciada', 'Sessão de diagnóstico iniciada', this.usb.resumo(snapshot), 'api')
    );
    this.appLog.log(`sessão ${this.sessao.id} iniciada`, 'info');
    this.persistir();
  }

  async tentativaConexao(): Promise<void> {
    this.registrarAutomatico('tentativa_conexao', 'Tentativa de conexão registrada', undefined, 'manual');
  }

  async erro7(): Promise<void> {
    this.registrarAutomatico('erro7', 'Erro 7 apareceu', undefined, 'manual');
    this.appLog.log('marcação manual: erro 7 apareceu', 'aviso');
  }

  async observacao(texto: string): Promise<void> {
    const t = texto.trim();
    if (!t) {
      return;
    }
    this.registrarAutomatico('observacao', 'Observação', t, 'manual');
  }

  async encerrar(): Promise<void> {
    if (!this.sessao) {
      return;
    }
    if (this.gapAberta) {
      this.lacunaFim('sessão encerrada com lacuna em aberto');
    }
    this.sessao.encerradaEm = new Date().toISOString();
    this.sessao.ultimaAtividadeIso = this.sessao.encerradaEm;
    this.sessao.eventos.push(
      this.criarEvento('sessao_encerrada', 'Sessão encerrada', undefined, 'api')
    );
    const encerrada = this.sessao;
    this.historico = [encerrada, ...this.historico].slice(0, MAX_HISTORICO);
    localStorage.setItem(`autolink.${CHAVE_HISTORICO}`, JSON.stringify(this.historico));
    this.appLog.log(`sessão ${encerrada.id} encerrada`, 'info');
    this.sessao = null;
    try {
      localStorage.removeItem(`autolink.${CHAVE_ATIVA}`);
    } catch {
      // ignora
    }
  }

  lacunaInicio(motivo: string): void {
    if (!this.sessao || this.gapAberta) {
      return;
    }
    this.gapAberta = true;
    this.sessao.lacunas.push({ inicioIso: new Date().toISOString(), fimIso: null, motivo });
    this.sessao.eventos.push(
      this.criarEvento('lacuna_inicio', 'Lacuna de observação iniciada', motivo, 'api')
    );
    this.persistir();
  }

  lacunaFim(motivo: string): void {
    if (!this.sessao || !this.gapAberta) {
      return;
    }
    this.gapAberta = false;
    const lacuna = [...this.sessao.lacunas].reverse().find((l) => l.fimIso === null);
    const fim = new Date().toISOString();
    if (lacuna) {
      lacuna.fimIso = fim;
    }
    this.sessao.eventos.push(
      this.criarEvento(
        'lacuna_fim',
        'Lacuna de observação encerrada',
        `${motivo} — duração ${formatarDuracao(lacuna?.inicioIso ?? fim, fim)}`,
        'api'
      )
    );
    this.persistir();
  }

  /** Eventos automático/manual com timestamp e referência monotônica. */
  private async registrarAutomatico(
    tipo: EventoTipo,
    rotulo: string,
    detalhe?: string,
    origem: Origem = 'api'
  ): Promise<void> {
    if (!this.sessao) {
      this.appLog.log(`evento ignorado (sem sessão ativa): ${rotulo}`, 'info');
      return;
    }
    const mono = await this.monotonic();
    this.sessao.eventos.push(this.criarEvento(tipo, rotulo, detalhe, origem, mono));
    this.sessao.ultimaAtividadeIso = new Date().toISOString();
    this.persistir();
  }

  private criarEvento(
    tipo: EventoTipo,
    rotulo: string,
    detalhe: string | undefined,
    origem: Origem,
    mono?: number
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
      monotonicMs: mono ?? Math.round(performance.now()),
    };
  }

  private async monotonic(): Promise<number> {
    if (pluginNativoDisponivel()) {
      try {
        const r = await AutoLink.getMonotonicMillis();
        return r.monotonicMs;
      } catch {
        // cai para performance.now()
      }
    }
    return Math.round(performance.now());
  }

  private persistir(): void {
    if (!this.sessao) {
      return;
    }
    this.sessao.ultimaAtividadeIso = new Date().toISOString();
    try {
      localStorage.setItem(`autolink.${CHAVE_ATIVA}`, JSON.stringify(this.sessao));
    } catch {
      // sem espaço: sessão segue apenas em memória (aviso no export)
    }
  }

  /** Dados para exportação: sessão ativa ou a última encerrada. */
  sessaoParaExport(): Sessao | null {
    if (this.sessao) {
      return this.sessao;
    }
    return this.historico[0] ?? null;
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

export function formatarDuracao(inicioIso: string, fimIso: string): string {
  const a = Date.parse(inicioIso);
  const b = Date.parse(fimIso);
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) {
    return '0 s';
  }
  const seg = Math.round((b - a) / 1000);
  if (seg < 60) {
    return `${seg} s`;
  }
  const min = Math.floor(seg / 60);
  return `${min} min ${seg % 60} s`;
}
