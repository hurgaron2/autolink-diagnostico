import { registerPlugin } from '@capacitor/core';

export interface StoragePublicPluginInterface {
  salvarEmDownloadsPublico(opcoes: {
    nomeArquivo: string;
    dadosBase64: string;
    idSessao: string;
  }): Promise<{ uri: string; caminho: string }>;
  abrirPasta(): Promise<{ caminho: string }>;
  compartilhar(opcoes: { uri: string }): Promise<void>;
}

/** Plugin nativo para gravação em Downloads público (MediaStore). */
export const StoragePublic = registerPlugin<StoragePublicPluginInterface>('StoragePublic');
