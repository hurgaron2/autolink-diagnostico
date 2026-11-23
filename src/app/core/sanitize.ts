/**
 * Ocultação de identificadores nos arquivos derivados do export.
 * A sanitização NÃO é perfeita — o manifest.json sempre avisa isso.
 */

export interface ResultadoSanitizacao {
  texto: string;
  aplicadas: string[];
}

interface Regra {
  nome: string;
  re: RegExp;
  substituto: string;
}

const REGRAS: Regra[] = [
  { nome: 'email', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, substituto: '[EMAIL]' },
  { nome: 'mac', re: /\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g, substituto: '[MAC]' },
  { nome: 'imei', re: /\b\d{15,17}\b/g, substituto: '[NUMERO_LONGO]' },
  {
    nome: 'telefone',
    re: /(?:\+?55[\s.-]?)?(?:\(\d{2}\)\s?|\d{2}\s?)9?\d{4}[-.\s]?\d{4}\b/g,
    substituto: '[TELEFONE]',
  },
  { nome: 'ipv4', re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, substituto: '[IP]' },
  { nome: 'android_id', re: /\b[0-9a-f]{16}\b/gi, substituto: '[ANDROID_ID]' },
  {
    nome: 'serial',
    re: /\b(?:sn|s\/n|serial|imei)\s*[:=]\s*[A-Za-z0-9-]{6,}/gi,
    substituto: '[SERIAL]',
  },
];

export function sanitizar(texto: string): ResultadoSanitizacao {
  let saida = texto;
  const aplicadas: string[] = [];
  for (const regra of REGRAS) {
    regra.re.lastIndex = 0;
    if (regra.re.test(saida)) {
      regra.re.lastIndex = 0;
      saida = saida.replace(regra.re, regra.substituto);
      aplicadas.push(regra.nome);
    }
  }
  return { texto: saida, aplicadas };
}

export const AVISO_SANITIZACAO =
  'Sanitização aplicada, mas não é perfeita: padrões não previstos podem passar. ' +
  'Revise o conteúdo antes de compartilhar.';
