import { ehTextoImportavel, LIMITES_PADRAO, montarPlanoDeExtracao, revisarNomeEntrada } from './zip-guard';

describe('zip-guard', () => {
  describe('revisarNomeEntrada', () => {
    it('aceita caminho normal', () => {
      expect(revisarNomeEntrada('FS/data/log/main.txt').aceito).toBe(true);
    });

    it('recusa path traversal com ../', () => {
      expect(revisarNomeEntrada('../../etc/passwd').aceito).toBe(false);
      expect(revisarNomeEntrada('../../etc/passwd').motivo).toBe('path_traversal');
    });

    it('recusa path traversal com barra invertida', () => {
      expect(revisarNomeEntrada('..\\..\\windows\\system32').aceito).toBe(false);
      expect(revisarNomeEntrada('a\\..\\..\\b').aceito).toBe(false);
    });

    it('recusa caminho absoluto (unix e windows)', () => {
      expect(revisarNomeEntrada('/etc/shadow').motivo).toBe('caminho_absoluto');
      expect(revisarNomeEntrada('C:/arquivo.txt').motivo).toBe('caminho_absoluto');
    });

    it('recusa nome vazio e nome longo demais', () => {
      expect(revisarNomeEntrada('').motivo).toBe('nome_vazio');
      expect(revisarNomeEntrada('a'.repeat(300)).motivo).toBe('nome_excede_limite');
    });

    it('recusa profundidade excessiva', () => {
      const profundo = Array.from({ length: 20 }, (_, i) => `d${i}`).join('/') + '/f.txt';
      expect(revisarNomeEntrada(profundo).motivo).toBe('profundidade_excessiva');
    });
  });

  describe('montarPlanoDeExtracao', () => {
    it('monta plano com entradas seguras', () => {
      const plano = montarPlanoDeExtracao([
        { nome: 'a.txt', tamanho: 100 },
        { nome: 'b/c.log', tamanho: 200 },
      ]);
      expect(plano.aceitos).toEqual(['a.txt', 'b/c.log']);
      expect(plano.recusados).toEqual([]);
      expect(plano.bytesPlanejados).toBe(300);
    });

    it('separa entradas maliciosas sem aceitá-las', () => {
      const plano = montarPlanoDeExtracao([
        { nome: 'ok.txt', tamanho: 10 },
        { nome: '../escape.txt', tamanho: 10 },
        { nome: '/abs.txt', tamanho: 10 },
      ]);
      expect(plano.aceitos).toEqual(['ok.txt']);
      expect(plano.recusados.map((r) => r.motivo)).toEqual(['path_traversal', 'caminho_absoluto']);
    });

    it('respeita o limite de entradas', () => {
      const entradas = Array.from({ length: LIMITES_PADRAO.maxEntradas + 5 }, (_, i) => ({
        nome: `f${i}.txt`,
        tamanho: 1,
      }));
      const plano = montarPlanoDeExtracao(entradas);
      expect(plano.aceitos.length).toBe(LIMITES_PADRAO.maxEntradas);
      expect(plano.excedeuEntradas).toBe(true);
    });

    it('recusa entrada maior que o limite por entrada', () => {
      const plano = montarPlanoDeExtracao([
        { nome: 'grande.txt', tamanho: LIMITES_PADRAO.maxBytesEntrada + 1 },
      ]);
      expect(plano.aceitos).toEqual([]);
      expect(plano.recusados[0].motivo).toBe('entrada_grande_demais');
    });

    it('para no limite total de bytes', () => {
      const porEntrada = LIMITES_PADRAO.maxBytesEntrada;
      const plano = montarPlanoDeExtracao([
        { nome: 'a.txt', tamanho: porEntrada },
        { nome: 'b.txt', tamanho: porEntrada },
        { nome: 'c.txt', tamanho: 1 },
      ]);
      expect(plano.aceitos).toEqual(['a.txt', 'b.txt']);
      expect(plano.excedeuTotal).toBe(true);
    });
  });

  describe('ehTextoImportavel', () => {
    it('aceita extensões de texto', () => {
      expect(ehTextoImportavel('bugreport-2026.txt')).toBe(true);
      expect(ehTextoImportavel('FS/data/log/main.log')).toBe(true);
      expect(ehTextoImportavel('meta.json')).toBe(true);
    });

    it('rejeita binários', () => {
      expect(ehTextoImportavel('imagens/capa.png')).toBe(false);
      expect(ehTextoImportavel('libs/libc.so')).toBe(false);
      expect(ehTextoImportavel('dump.gz')).toBe(false);
    });
  });
});
