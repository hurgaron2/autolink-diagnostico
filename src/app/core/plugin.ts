import { Capacitor, registerPlugin, PluginListenerHandle } from '@capacitor/core';

/** Forma crua retornada pelo plugin Kotlin (antes do mapeio para os modelos). */
export interface RawPhoneInfo {
  fabricante?: string;
  modelo?: string;
  marca?: string;
  android?: string;
  sdk?: number;
  build?: string;
  patch?: string | null;
  coletadoEm?: number;
  monotonicMs?: number;
}

export interface RawPacote {
  pacote: string;
  presente: boolean;
  versionName?: string;
  versionCode?: number;
  erro?: string;
}

export interface RawAppVersions {
  pacotes: RawPacote[];
  coletadoEm?: number;
}

export interface RawUsbSnapshot {
  capturadoEm?: number;
  monotonicMs?: number;
  dispositivos: unknown[];
  acessorios: unknown[];
  notas?: string[];
}

export interface AutoLinkPluginInterface {
  getPhoneInfo(): Promise<RawPhoneInfo>;
  getAppVersions(options: { pacotes: string[] }): Promise<RawAppVersions>;
  getUsbSnapshot(options: { includeSerial: boolean }): Promise<RawUsbSnapshot>;
  startObserving(): Promise<void>;
  stopObserving(): Promise<void>;
  getMonotonicMillis(): Promise<{ monotonicMs: number; wallClockMs: number }>;
  addListener(
    eventName: 'usbEvent',
    listenerFunc: (event: Record<string, unknown>) => void
  ): Promise<PluginListenerHandle>;
}

/** Plugin local registrado em MainActivity (Kotlin). */
export const AutoLink = registerPlugin<AutoLinkPluginInterface>('AutoLink');

export function pluginNativoDisponivel(): boolean {
  return Capacitor.isNativePlatform();
}
