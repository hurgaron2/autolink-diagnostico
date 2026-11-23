import { LogLine, LogMatch, TERMOS_PADRAO } from './models';

/**
 * Parser de logs (logcat TXT / trechos de bugreport ZIP).
 * Funções puras, testáveis sem Angular.
 *
 * Formatos suportados:
 *  - threadtime:  "01-15 10:20:30.123  1234  5678 I Tag     : mensagem"
 *  - pid/tid:     "01-15 10:20:30.123 1234/5678 I Tag ( Tag): mensagem"
 *  - ISO/data:    "2026-11-23 10:20:30.123 mensagem" ou "2026-11-23T10:20:30Z ..."
 *  - demais linhas são preservadas sem metadados (nunca descartadas).
 */

const THREADTIME =
  /^(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEFS])\s+(.+?)\s*:\s?(.*)$/;

const PID_TID =
  /^(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\/(\d+)\s+([VDIWEFS])\s+([^:(]+?)\s*(?:\([^)]*\))?\s*:\s?(.*)$/;

const ISO_LINHA =
  /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})?)\s+(.*)$/;

const LINHA_VAZIA = /^\s*$/;

export function parseLinha(raw: string, num: number): LogLine {
  const bruto = raw.replace(/\r$/, '');

  let m = THREADTIME.exec(bruto);
  if (m) {
    return {
      num,
      bruto,
      timestamp: normalizarTimestamp(m[1]),
      pid: m[2],
      tid: m[3],
      nivel: m[4],
      tag: m[5].trim(),
      mensagem: m[6],
    };
  }

  m = PID_TID.exec(bruto);
  if (m) {
    return {
      num,
      bruto,
      timestamp: normalizarTimestamp(m[1]),
      pid: m[2],
      tid: m[3],
      nivel: m[4],
      tag: m[5].trim(),
      mensagem: m[6],
    };
  }

  m = ISO_LINHA.exec(bruto);
  if (m) {
    return {
      num,
      bruto,
      timestamp: normalizarTimestamp(m[1]),
      pid: null,
      tid: null,
      nivel: null,
      tag: null,
      mensagem: m[2],
    };
  }

  return {
    num,
    bruto,
    timestamp: null,
    pid: null,
    tid: null,
    nivel: null,
    tag: null,
    mensagem: bruto,
  };
}

function normalizarTimestamp(ts: string): string {
  // "01-15 10:20:30.123" -> "01-15 10:20:30.123" (sem ano: mantido como está)
  return ts.replace(',', '.');
}

export function parseLogcat(texto: string): LogLine[] {
  const linhas = texto.split(/\r?\n/);
  const out: LogLine[] = [];
  for (let i = 0; i < linhas.length; i++) {
    const raw = linhas[i];
    if (LINHA_VAZIA.test(raw) && i === linhas.length - 1) {
      continue; // ignora só o \n final
    }
    out.push(parseLinha(raw, i + 1));
  }
  return out;
}

export interface OpcoesAnalise {
  termos?: string[];
  contextoLinhas?: number;
  maxMatches?: number;
}

/**
 * Busca termos nas linhas já parseadas e devolve as ocorrências com
 * contexto. A função NÃO conclui causa: devolve apenas evidência.
 */
export function analisar(lines: LogLine[], arquivo: string, arquivoId: string, opcoes: OpcoesAnalise = {}): LogMatch[] {
  const termos = (opcoes.termos ?? TERMOS_PADRAO).map((t) => t.toLowerCase());
  const contexto = opcoes.contextoLinhas ?? 2;
  const max = opcoes.maxMatches ?? 300;
  const matches: LogMatch[] = [];

  for (let i = 0; i < lines.length && matches.length < max; i++) {
    const alvo = (lines[i].bruto + ' ' + lines[i].mensagem).toLowerCase();
    const achado = termos.find((t) => alvo.includes(t));
    if (!achado) {
      continue;
    }
    const inicio = Math.max(0, i - contexto);
    const fim = Math.min(lines.length - 1, i + contexto);
    const vizinhas: { num: number; texto: string }[] = [];
    for (let j = inicio; j <= fim; j++) {
      if (j === i) {
        continue;
      }
      vizinhas.push({ num: lines[j].num, texto: lines[j].bruto });
    }
    matches.push({
      arquivo,
      arquivoId,
      linha: lines[i].num,
      termo: achado,
      timestamp: lines[i].timestamp,
      tag: lines[i].tag,
      trecho: lines[i].bruto,
      contexto: vizinhas,
    });
  }

  return matches;
}

export function resumoTermos(matches: LogMatch[]): { termo: string; total: number }[] {
  const contagem = new Map<string, number>();
  for (const m of matches) {
    contagem.set(m.termo, (contagem.get(m.termo) ?? 0) + 1);
  }
  return [...contagem.entries()]
    .map(([termo, total]) => ({ termo, total }))
    .sort((a, b) => b.total - a.total);
}

/** Extrai o timestamp no formato threadtime de uma linha crua, se houver. */
export function extrairTimestamp(linha: string): string | null {
  const m = THREADTIME.exec(linha) ?? PID_TID.exec(linha) ?? ISO_LINHA.exec(linha);
  return m ? normalizarTimestamp(m[1]) : null;
}
