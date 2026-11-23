/**
 * Proteções de extração de ZIP (relatórios de bugs importados).
 * Funções puras: path traversal, caminhos absolutos, limites de contagem
 * e de tamanho. Testadas em zip-guard.spec.ts.
 */

export interface LimitesZip {
  maxEntradas: number;
  maxBytesEntrada: number;
  maxBytesTotal: number;
  maxProfundidade: number;
  maxNome: number;
}

export const LIMITES_PADRAO: LimitesZip = {
  maxEntradas: 300,
  maxBytesEntrada: 48 * 1024 * 1024, // 48 MB por entrada
  maxBytesTotal: 96 * 1024 * 1024, // 96 MB somados
  maxProfundidade: 8,
  maxNome: 240,
};

export interface RevisaoEntrada {
  nome: string;
  aceito: boolean;
  motivo?: string;
}

export function revisarNomeEntrada(nome: string, limites: LimitesZip = LIMITES_PADRAO): RevisaoEntrada {
  if (!nome || nome.trim().length === 0) {
    return { nome, aceito: false, motivo: 'nome_vazio' };
  }
  if (nome.includes('\0')) {
    return { nome, aceito: false, motivo: 'caractere_invalido' };
  }
  if (nome.length > limites.maxNome) {
    return { nome, aceito: false, motivo: 'nome_excede_limite' };
  }

  // Zips maliciosos usam "\" e "C:\" para escapar do diretório de extração.
  const normalizado = nome.replace(/\\/g, '/');

  if (normalizado.startsWith('/')) {
    return { nome, aceito: false, motivo: 'caminho_absoluto' };
  }
  if (/^[A-Za-z]:/.test(normalizado)) {
    return { nome, aceito: false, motivo: 'caminho_absoluto' };
  }

  const segmentos = normalizado.split('/').filter((s) => s.length > 0);
  if (segmentos.some((s) => s === '..')) {
    return { nome, aceito: false, motivo: 'path_traversal' };
  }
  if (segmentos.length > limites.maxProfundidade) {
    return { nome, aceito: false, motivo: 'profundidade_excessiva' };
  }

  return { nome, aceito: true };
}

export interface PlanoExtracao {
  aceitos: string[];
  recusados: RevisaoEntrada[];
  excedeuEntradas: boolean;
  excedeuTotal: boolean;
  bytesPlanejados: number;
}

/**
 * Monta o plano de extração: só entram entradas seguras, dentro dos
 * limites de contagem e de bytes. Tamanho desconhecido (null) é aceito
 * aqui e verificado de novo durante a extração (o chamador aborta se o
 * total acumulado estourar).
 */
export function montarPlanoDeExtracao(
  entradas: { nome: string; tamanho: number | null }[],
  limites: LimitesZip = LIMITES_PADRAO
): PlanoExtracao {
  const aceitos: string[] = [];
  const recusados: RevisaoEntrada[] = [];
  let bytes = 0;
  let excedeuEntradas = false;
  let excedeuTotal = false;

  for (const e of entradas) {
    const revisao = revisarNomeEntrada(e.nome, limites);
    if (!revisao.aceito) {
      recusados.push(revisao);
      continue;
    }
    if (aceitos.length >= limites.maxEntradas) {
      excedeuEntradas = true;
      recusados.push({ nome: e.nome, aceito: false, motivo: 'limite_de_entradas' });
      continue;
    }
    if (e.tamanho !== null && e.tamanho > limites.maxBytesEntrada) {
      recusados.push({ nome: e.nome, aceito: false, motivo: 'entrada_grande_demais' });
      continue;
    }
    if (e.tamanho !== null && bytes + e.tamanho > limites.maxBytesTotal) {
      excedeuTotal = true;
      recusados.push({ nome: e.nome, aceito: false, motivo: 'total_grande_demais' });
      continue;
    }
    if (e.tamanho !== null) {
      bytes += e.tamanho;
    }
    aceitos.push(e.nome);
  }

  return { aceitos, recusados, excedeuEntradas, excedeuTotal, bytesPlanejados: bytes };
}

/** Extensões tratadas como texto no relatório de bugs. */
export function ehTextoImportavel(nome: string): boolean {
  const alvo = nome.replace(/\\/g, '/').toLowerCase();
  const ultimo = alvo.split('/').pop() ?? '';
  if (/\.(txt|log|xml|json|csv|md)$/.test(ultimo)) {
    return true;
  }
  // bugreport-*.txt sem extensão explícita já coberto acima; binários ficam de fora
  return false;
}
