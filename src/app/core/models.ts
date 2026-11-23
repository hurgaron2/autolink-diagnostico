/**
 * Tipos centrais do AutoLink Diagnóstico.
 *
 * Toda informação carrega a origem: 'api' (coletada por API pública),
 * 'log' (importada de arquivo), 'manual' (informada pelo usuário) ou
 * 'indisponível' (não foi possível obter).
 */

export type Origem = 'api' | 'log' | 'manual' | 'indisponivel';

export interface Campo<T> {
  valor: T | null;
  origem: Origem;
  detalhe?: string;
}

export interface PacoteInfo {
  pacote: string;
  presente: boolean;
  versionName: Campo<string>;
  versionCode: Campo<number>;
  observacao?: string;
}

export interface PhoneInfo {
  fabricante: Campo<string>;
  modelo: Campo<string>;
  android: Campo<string>;
  sdk: Campo<number>;
  build: Campo<string>;
  patch: Campo<string>;
  gms: PacoteInfo | null;
  gearhead: PacoteInfo | null;
  coletadoEm: string | null;
  erroGeral: string | null;
}

export interface UsbEndpointInfo {
  address: number;
  direcao: 'entrada' | 'saida';
  tipo: string;
  maxPacketSize: number;
  interval: number;
}

export interface UsbInterfaceInfo {
  id: number;
  nome: string | null;
  classe: number;
  subclasse: number;
  protocolo: number;
  endpoints: UsbEndpointInfo[];
}

export interface UsbDeviceInfo {
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
  interfaces: UsbInterfaceInfo[];
}

export interface UsbAccessoryInfo {
  key: string;
  fabricante: string | null;
  modelo: string | null;
  descricao: string | null;
  versao: string | null;
  uri: string | null;
}

export interface UsbSnapshot {
  capturadoEm: string;
  monotonicMs: number;
  origem: 'api';
  dispositivos: UsbDeviceInfo[];
  acessorios: UsbAccessoryInfo[];
  notas: string[];
  erro: string | null;
}

export interface UsbEvento {
  action: string;
  timestampMs: number;
  monotonicMs: number;
  vid?: number;
  pid?: number;
  produto?: string | null;
  fabricante?: string | null;
  acessorioModelo?: string | null;
  acessorioFabricante?: string | null;
}

export type EventoTipo =
  | 'sessao_iniciada'
  | 'tentativa_conexao'
  | 'erro7'
  | 'observacao'
  | 'usb_conectado'
  | 'usb_desconectado'
  | 'lacuna_inicio'
  | 'lacuna_fim'
  | 'sessao_encerrada'
  | 'erro_coleta'
  | 'app_evento';

export interface Evento {
  id: string;
  tipo: EventoTipo;
  rotulo: string;
  detalhe?: string;
  origem: Origem;
  timestampIso: string;
  timezoneOffsetMin: number;
  monotonicMs: number;
}

export interface Lacuna {
  inicioIso: string;
  fimIso: string | null;
  motivo: string;
}

export interface Sessao {
  id: string;
  iniciadaEm: string;
  encerradaEm: string | null;
  snapshotInicial: UsbSnapshot | null;
  phoneSnapshot: PhoneInfo | null;
  eventos: Evento[];
  lacunas: Lacuna[];
  ultimaAtividadeIso: string;
}

export interface CampoCentral {
  valor: string;
  origem: Origem;
  /** Sempre false para a central: nenhum destes valores foi lido por USB. */
  confirmadoPorUsb: false;
}

export interface Central {
  modelo: CampoCentral;
  app: CampoCentral;
  cfg: CampoCentral;
  mcu: CampoCentral;
  ic: CampoCentral;
  radio: CampoCentral;
  adaptadorModelo: CampoCentral;
  adaptadorApp: CampoCentral;
  adaptadorSystem: CampoCentral;
  adaptadorBt: CampoCentral;
  /** Data URL da foto opcional escolhida pelo usuário (cópia local). */
  foto: string | null;
  fotoNome: string | null;
  atualizadoEm: string;
}

export interface LogLine {
  num: number;
  bruto: string;
  timestamp: string | null;
  pid: string | null;
  tid: string | null;
  nivel: string | null;
  tag: string | null;
  mensagem: string;
}

export type LogOrigemArquivo = 'logcat_txt' | 'bugreport_zip';

export interface LogImportado {
  id: string;
  nome: string;
  origemArquivo: LogOrigemArquivo;
  importadoEm: string;
  bytes: number;
  linhas: number;
  incluirNaExportacao: boolean;
  armazenadoEm: 'nativo' | 'memoria';
  caminho: string | null;
}

export interface LogMatch {
  arquivo: string;
  arquivoId: string;
  linha: number;
  termo: string;
  timestamp: string | null;
  tag: string | null;
  trecho: string;
  contexto: { num: number; texto: string }[];
}

export interface AppLogLinha {
  ts: string;
  nivel: 'info' | 'aviso' | 'erro';
  msg: string;
}

export const SCHEMA_VERSION = 1;

export const TERMOS_PADRAO = [
  'gearhead',
  'projection',
  'androidauto',
  'android auto',
  'certificate',
  'authentication',
  'ssl',
  'tls',
  'handshake',
  'verification',
  'security',
  'disconnect',
  'error',
];
