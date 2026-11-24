import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { AppLogService } from './app-log.service';
import { UsbAccessoryInfo, UsbDeviceInfo, UsbEvento, UsbSnapshot } from './models';
import { AutoLink, pluginNativoDisponivel, RawUsbSnapshot } from './plugin';
import { PluginListenerHandle } from '@capacitor/core';

interface RawEndpoint {
  address: number;
  direcao: 'entrada' | 'saida';
  tipo: string;
  maxPacketSize: number;
  interval: number;
}

interface RawInterface {
  id: number;
  nome: string | null;
  classe: number;
  subclasse: number;
  protocolo: number;
  endpoints: RawEndpoint[];
}

interface RawDevice {
  key: string;
  vid: number;
  pid: number;
  classe: number;
  subclasse: number;
  protocolo: number;
  fabricante: string | null;
  produto: string | null;
  versao: string | null;
  serial: string | null;
  interfaces: RawInterface[];
}

interface RawAccessory {
  key: string;
  fabricante: string | null;
  modelo: string | null;
  descricao: string | null;
  versao: string | null;
  uri: string | null;
}

export interface MudancaUsb {
  tipo: 'usb_conectado' | 'usb_desconectado';
  rotulo: string;
  detalhe: string;
  simulacao?: boolean;
}

const MAX_SNAPSHOTS = 30;

/**
 * Diagnóstico USB passivo: enumeração e observação de eventos públicos.
 * Nunca abre acessório, nunca reivindica interface, nunca transfere dados.
 */
@Injectable({ providedIn: 'root' })
export class UsbService {
  snapshotAtual: UsbSnapshot | null = null;
  snapshots: UsbSnapshot[] = [];
  /** Mudanças detectadas entre enumerações (para a linha do tempo). */
  mudancas = new Subject<MudancaUsb>();
  observando = false;
  /** Sessão que recebe os snapshots; impede mistura entre sessões no mesmo processo. */
  sessaoIdAtiva: string | null = null;

  private listener: PluginListenerHandle | null = null;
  private chavesAnteriores = new Set<string>();
  private primeiraLeitura = true;

  constructor(private appLog: AppLogService) {}

  async enumerar(): Promise<UsbSnapshot> {
    if (!pluginNativoDisponivel()) {
      const vazio = this.snapshotVazio('Plugin nativo indisponível no navegador — abra o app instalado no Android.');
      this.appLog.log('USB: plugin nativo indisponível no navegador — enumeração vazia', 'aviso');
      this.ingestarSnapshot(vazio);
      return vazio;
    }

    try {
      const raw = (await AutoLink.getUsbSnapshot({ includeSerial: false })) as unknown as RawUsbSnapshot;
      const snapshot: UsbSnapshot = {
        capturadoEm: new Date(raw.capturadoEm ?? Date.now()).toISOString(),
        monotonicMs: raw.monotonicMs ?? 0,
        origem: 'api',
        dispositivos: (raw.dispositivos ?? []) as unknown as UsbDeviceInfo[],
        acessorios: (raw.acessorios ?? []) as unknown as UsbAccessoryInfo[],
        notas: raw.notas ?? [],
        erro: null,
      };
      this.ingestarSnapshot(snapshot);
      return snapshot;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const vazio = this.snapshotVazio(`Falha ao enumerar USB: ${msg}`);
      this.appLog.log(`USB: falha na enumeração — ${msg}`, 'erro');
      this.ingestarSnapshot(vazio);
      return vazio;
    }
  }

  snapshotVazio(erro: string | null, simulacao = false): UsbSnapshot {
    return {
      capturadoEm: new Date().toISOString(),
      monotonicMs: 0,
      origem: 'api',
      dispositivos: [],
      acessorios: [],
      notas: simulacao
        ? ['SIMULAÇÃO — não representa conexão física; lista vazia sintética', 'simulation=true']
        : ['ausência de visibilidade não significa defeito de hardware nem "central desconectada"'],
      erro,
      simulacao,
    };
  }

  /** Zera o diff entre sessões para que chaves de uma não apareçam em outra. */
  resetarDiff(): void {
    this.chavesAnteriores = new Set<string>();
    this.primeiraLeitura = true;
    this.snapshotAtual = null;
    this.sessaoIdAtiva = null;
  }

  /** Único ponto de entrada de snapshots (enumeração real ou simulação de desenvolvimento). */
  ingestarSnapshot(snapshot: UsbSnapshot, simulacao = false): void {
    snapshot.simulacao = simulacao;
    snapshot.sessaoId = this.sessaoIdAtiva;
    const novasChaves = new Set<string>([
      ...snapshot.dispositivos.map((d) => chaveDevice(d)),
      ...snapshot.acessorios.map((a) => chaveAccessory(a)),
    ]);

    if (!this.primeiraLeitura) {
      for (const k of novasChaves) {
        if (!this.chavesAnteriores.has(k)) {
          this.emitirMudanca('usb_conectado', k, simulacao);
        }
      }
      for (const k of this.chavesAnteriores) {
        if (!novasChaves.has(k)) {
          this.emitirMudanca('usb_desconectado', k, simulacao);
        }
      }
    }

    this.primeiraLeitura = false;
    this.chavesAnteriores = novasChaves;
    this.snapshotAtual = snapshot;
    this.snapshots.unshift(snapshot);
    if (this.snapshots.length > MAX_SNAPSHOTS) {
      this.snapshots = this.snapshots.slice(0, MAX_SNAPSHOTS);
    }
  }

  private emitirMudanca(tipo: MudancaUsb['tipo'], chave: string, simulacao: boolean): void {
    const rotulo = tipo === 'usb_conectado' ? 'USB conectado' : 'USB desconectado';
    this.mudancas.next({ tipo, rotulo, detalhe: chave, simulacao });
    this.appLog.log(`USB: ${rotulo} (${chave})${simulacao ? ' [SIMULAÇÃO]' : ''}`, 'info');
  }

  async iniciarObservacao(): Promise<void> {
    if (this.observando || !pluginNativoDisponivel()) {
      return;
    }
    let iniciado = false;
    try {
      await AutoLink.startObserving();
      iniciado = true;
      this.listener = await AutoLink.addListener('usbEvent', (ev) => {
        const evento = ev as unknown as UsbEvento;
        this.appLog.log(
          `evento USB: ${evento.action} ${evento.produto ?? evento.acessorioModelo ?? ''}`.trim(),
          'info'
        );
        // reenumera para refletir o novo estado
        void this.enumerar();
      });
      this.observando = true;
      this.appLog.log('observador USB público registrado (somente leitura)', 'info');
    } catch (e) {
      // startObserving pode ter sucedido antes de addListener falhar: desfaz para
      // não deixar o receiver nativo ativo sem listener e sem estado observando.
      if (iniciado) {
        try {
          await AutoLink.stopObserving();
        } catch {
          // ignora
        }
      }
      const msg = e instanceof Error ? e.message : String(e);
      this.appLog.log(`não foi possível observar eventos USB: ${msg}`, 'erro');
      this.observando = false;
      throw e;
    }
  }

  async pararObservacao(): Promise<void> {
    if (this.listener) {
      try {
        await this.listener.remove();
      } catch {
        // ignora
      }
      this.listener = null;
    }
    if (this.observando && pluginNativoDisponivel()) {
      try {
        await AutoLink.stopObserving();
      } catch {
        // ignora
      }
    }
    this.observando = false;
  }

  /** Resumo legível para a linha do tempo. */
  resumo(snapshot: UsbSnapshot | null): string {
    if (!snapshot) {
      return 'sem enumeração';
    }
    const d = snapshot.dispositivos.length;
    const a = snapshot.acessorios.length;
    if (d === 0 && a === 0) {
      return 'Sem dispositivo/acessório visível para este aplicativo';
    }
    return `${d} dispositivo(s), ${a} acessório(s) visível(eis) para este aplicativo`;
  }
}

export function chaveDevice(d: UsbDeviceInfo): string {
  return `vid:${d.vid}:pid:${d.pid}`;
}

export function chaveAccessory(a: UsbAccessoryInfo): string {
  return `acc:${a.fabricante ?? ''}:${a.modelo ?? ''}:${a.uri ?? ''}`;
}
