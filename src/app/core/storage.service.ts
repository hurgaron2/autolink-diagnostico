import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';

const LOG_DIR = 'autolink/logs';

export interface LogArquivoMeta {
  nome: string;
  bytes: number;
}

/**
 * Armazenamento local:
 *  - JSON estruturado: localStorage (sessão, central, metadados de logs).
 *  - Conteúdo bruto dos logs importados: armazenamento privado nativo
 *    (Directory.Data). No navegador (dev), cai para memória, com aviso.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  readonly nativo = Capacitor.isNativePlatform();
  private memoria = new Map<string, string>();

  get<T>(chave: string, padrao: T): T {
    try {
      const raw = localStorage.getItem(`autolink.${chave}`);
      return raw ? (JSON.parse(raw) as T) : padrao;
    } catch {
      return padrao;
    }
  }

  set(chave: string, valor: unknown): void {
    try {
      localStorage.setItem(`autolink.${chave}`, JSON.stringify(valor));
    } catch {
      // quota estourada ou modo privado: registra apenas em memória
    }
  }

  remover(chave: string): void {
    try {
      localStorage.removeItem(`autolink.${chave}`);
    } catch {
      // ignora
    }
  }

  private caminho(id: string): string {
    return `${LOG_DIR}/${id}.txt`;
  }

  async salvarLog(id: string, conteudo: string): Promise<{ armazenadoEm: 'nativo' | 'memoria'; caminho: string | null }> {
    if (!this.nativo) {
      this.memoria.set(id, conteudo);
      return { armazenadoEm: 'memoria', caminho: null };
    }
    try {
      await Filesystem.mkdir({ path: LOG_DIR, directory: Directory.Data, recursive: true });
      await Filesystem.writeFile({
        path: this.caminho(id),
        data: conteudo,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      return { armazenadoEm: 'nativo', caminho: this.caminho(id) };
    } catch {
      this.memoria.set(id, conteudo);
      return { armazenadoEm: 'memoria', caminho: null };
    }
  }

  async lerLog(id: string, caminho: string | null): Promise<string | null> {
    const mem = this.memoria.get(id);
    if (mem !== undefined) {
      return mem;
    }
    if (this.nativo && caminho) {
      try {
        const r = await Filesystem.readFile({ path: caminho, directory: Directory.Data, encoding: Encoding.UTF8 });
        return typeof r.data === 'string' ? r.data : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  async removerLog(id: string, caminho: string | null): Promise<void> {
    this.memoria.delete(id);
    if (this.nativo && caminho) {
      try {
        await Filesystem.deleteFile({ path: caminho, directory: Directory.Data });
      } catch {
        // já removido ou inexistente
      }
    }
  }

  async listarLogs(): Promise<LogArquivoMeta[]> {
    const metas: LogArquivoMeta[] = [];
    if (this.nativo) {
      try {
        const r = await Filesystem.readdir({ path: LOG_DIR, directory: Directory.Data });
        for (const f of r.files) {
          if (f.type === 'file') {
            metas.push({ nome: f.name, bytes: f.size ?? 0 });
          }
        }
      } catch {
        // diretório ainda não existe
      }
    }
    for (const [id, conteudo] of this.memoria) {
      metas.push({ nome: `${id}.txt`, bytes: conteudo.length });
    }
    return metas;
  }

  /** Escreve bytes (base64) no cache — usado pelo export para compartilhar. */
  async salvarCacheBase64(nome: string, base64: string): Promise<string | null> {
    if (!this.nativo) {
      return null;
    }
    try {
      await Filesystem.writeFile({
        path: `autolink/export/${nome}`,
        data: base64,
        directory: Directory.Cache,
      });
      const stat = await Filesystem.stat({ path: `autolink/export/${nome}`, directory: Directory.Cache });
      return (stat as { uri?: string }).uri ?? null;
    } catch {
      return null;
    }
  }
}
