import { Injectable } from '@angular/core';
import JSZip from 'jszip';
import { AppLogService } from './app-log.service';
import { LogImportado, LogLine, LogMatch } from './models';
import { analisar, parseLogcat } from './log-parser';
import { StorageService } from './storage.service';
import { ehTextoImportavel, LIMITES_PADRAO, montarPlanoDeExtracao, RevisaoEntrada } from './zip-guard';

const CHAVE_META = 'logs.meta';
const LIMITE_ARQUIVO_TXT = 32 * 1024 * 1024; // 32 MB para TXT solto

export interface ResultadoImportacao {
  ok: boolean;
  mensagem: string;
}

/**
 * Importação de logs reais (logcat TXT / bugreport ZIP) com análise local.
 * Não há botão que finja coletar logs do sistema: só importação de arquivo
 * já obtido pelo usuário (ADB, opções do desenvolvedor etc.).
 */
@Injectable({ providedIn: 'root' })
export class LogImportService {
  logs: LogImportado[] = [];
  matches: LogMatch[] = [];
  analiseConcluida = false;
  avisoAnalise: string | null = null;
  recusados: RevisaoEntrada[] = [];

  private cache = new Map<string, LogLine[]>();

  constructor(private storage: StorageService, private appLog: AppLogService) {
    this.logs = this.storage.get<LogImportado[]>(CHAVE_META, []);
  }

  async importarArquivo(file: File): Promise<ResultadoImportacao> {
    if (file.size === 0) {
      return { ok: false, mensagem: `${file.name}: arquivo vazio.` };
    }
    const nome = file.name.toLowerCase();
    if (nome.endsWith('.zip')) {
      return this.importarZip(file);
    }
    if (file.size > LIMITE_ARQUIVO_TXT) {
      return {
        ok: false,
        mensagem: `${file.name}: ${formatarBytes(file.size)} excede o limite de ${formatarBytes(LIMITE_ARQUIVO_TXT)}. Converta para ZIP com menos arquivos ou divida o log.`,
      };
    }
    return this.importarTexto(file);
  }

  private async importarTexto(file: File): Promise<ResultadoImportacao> {
    try {
      const conteudo = await file.text();
      const linhas = conteudo.split(/\r?\n/).length;
      const id = gerarId();
      const armazenado = await this.storage.salvarLog(id, conteudo);
      const meta: LogImportado = {
        id,
        nome: file.name,
        origemArquivo: 'logcat_txt',
        importadoEm: new Date().toISOString(),
        bytes: file.size,
        linhas,
        incluirNaExportacao: false,
        ...armazenado,
      };
      this.logs.unshift(meta);
      this.persistir();
      this.cache.set(id, parseLogcat(conteudo));
      this.appLog.log(`log importado: ${file.name} (${linhas} linhas)`, 'info');
      return { ok: true, mensagem: `${file.name}: ${linhas} linha(s) importada(s).` };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.appLog.log(`falha ao importar ${file.name}: ${msg}`, 'erro');
      return { ok: false, mensagem: `${file.name}: falha ao ler (${msg}).` };
    }
  }

  private async importarZip(file: File): Promise<ResultadoImportacao> {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(file);
    } catch {
      return { ok: false, mensagem: `${file.name}: ZIP inválido ou corrompido.` };
    }

    const entradas = Object.values(zip.files)
      .filter((f) => !f.dir)
      .map((f) => ({ nome: f.name, tamanho: tamanhoConhecido(f) }));

    const plano = montarPlanoDeExtracao(entradas, LIMITES_PADRAO);
    this.recusados = plano.recusados;

    if (plano.aceitos.length === 0) {
      return {
        ok: false,
        mensagem: `${file.name}: nenhuma entrada segura para extrair (${plano.recusados.length} recusada(s)).`,
      };
    }

    let extraidos = 0;
    let bytes = 0;
    const avisos: string[] = [];

    for (const nome of plano.aceitos) {
      if (!ehTextoImportavel(nome)) {
        continue;
      }
      const entrada = zip.files[nome];
      if (!entrada) {
        continue;
      }
      try {
        const buf = await entrada.async('uint8array');
        if (bytes + buf.length > LIMITES_PADRAO.maxBytesTotal) {
          avisos.push('extração interrompida no limite total de bytes');
          break;
        }
        bytes += buf.length;
        const conteudo = new TextDecoder('utf-8', { fatal: false }).decode(buf);
        const id = gerarId();
        const armazenado = await this.storage.salvarLog(id, conteudo);
        const linhas = conteudo.split(/\r?\n/).length;
        this.logs.unshift({
          id,
          nome: `${file.name} :: ${nome}`,
          origemArquivo: 'bugreport_zip',
          importadoEm: new Date().toISOString(),
          bytes: buf.length,
          linhas,
          incluirNaExportacao: false,
          ...armazenado,
        });
        this.cache.set(id, parseLogcat(conteudo));
        extraidos++;
      } catch (e) {
        avisos.push(`falha ao extrair ${nome}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    this.persistir();

    if (plano.excedeuEntradas) {
      avisos.push(`limite de ${LIMITES_PADRAO.maxEntradas} entradas por ZIP atingido`);
    }
    if (plano.excedeuTotal) {
      avisos.push(`limite total de ${formatarBytes(LIMITES_PADRAO.maxBytesTotal)} atingido`);
    }

    const recusas = plano.recusados.length;
    const detalhe = [
      `${extraidos} arquivo(s) de texto importado(s)`,
      recusas > 0 ? `${recusas} entrada(s) recusada(s) por segurança/limite` : null,
      ...avisos,
    ]
      .filter(Boolean)
      .join('; ');

    this.appLog.log(`ZIP importado: ${file.name} — ${detalhe}`, recusas > 0 ? 'aviso' : 'info');
    return { ok: extraidos > 0, mensagem: `${file.name}: ${detalhe}.` };
  }

  async conteudo(id: string): Promise<string | null> {
    const meta = this.logs.find((l) => l.id === id);
    const cacheado = this.cache.get(id);
    if (cacheado) {
      return cacheado.map((l) => l.bruto).join('\n');
    }
    return this.storage.lerLog(id, meta?.caminho ?? null);
  }

  async analisarTodos(): Promise<void> {
    this.matches = [];
    this.recusados = [];
    this.analiseConcluida = false;
    this.avisoAnalise = null;

    if (this.logs.length === 0) {
      this.avisoAnalise = 'Nenhum log importado.';
      this.analiseConcluida = true;
      return;
    }

    for (const meta of this.logs) {
      const texto = await this.conteudo(meta.id);
      if (texto === null) {
        this.avisoAnalise = `Conteúdo de "${meta.nome}" não está mais disponível neste dispositivo.`;
        continue;
      }
      let lines = this.cache.get(meta.id);
      if (!lines) {
        lines = parseLogcat(texto);
        this.cache.set(meta.id, lines);
      }
      const achados = analisar(lines, meta.nome, meta.id);
      this.matches.push(...achados);
    }

    this.matches = this.matches.slice(0, 500);
    this.analiseConcluida = true;
    this.appLog.log(
      `análise local: ${this.matches.length} ocorrência(s) em ${this.logs.length} arquivo(s)`,
      'info'
    );
  }

  async excluir(id: string): Promise<void> {
    const meta = this.logs.find((l) => l.id === id);
    if (!meta) {
      return;
    }
    await this.storage.removerLog(id, meta.caminho);
    this.cache.delete(id);
    this.logs = this.logs.filter((l) => l.id !== id);
    this.matches = this.matches.filter((m) => m.arquivoId !== id);
    this.persistir();
    this.appLog.log(`log excluído: ${meta.nome}`, 'info');
  }

  alternarInclusao(id: string): void {
    const meta = this.logs.find((l) => l.id === id);
    if (meta) {
      meta.incluirNaExportacao = !meta.incluirNaExportacao;
      this.persistir();
    }
  }

  logsSelecionados(): LogImportado[] {
    return this.logs.filter((l) => l.incluirNaExportacao);
  }

  private persistir(): void {
    this.storage.set(CHAVE_META, this.logs);
  }
}

function tamanhoConhecido(f: JSZip.JSZipObject): number | null {
  const d = (f as unknown as { _data?: { uncompressedSize?: number } })._data;
  return typeof d?.uncompressedSize === 'number' ? d.uncompressedSize : null;
}

function gerarId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  return `l-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function formatarBytes(n: number): string {
  if (n < 1024) {
    return `${n} B`;
  }
  if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(1)} KB`;
  }
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
