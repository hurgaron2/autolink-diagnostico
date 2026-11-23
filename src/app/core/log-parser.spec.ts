import { analisar, extrairTimestamp, parseLinha, parseLogcat, resumoTermos } from './log-parser';

describe('log-parser', () => {
  it('faz parse do formato threadtime do logcat', () => {
    const l = parseLinha(
      '11-23 10:20:30.123  1234  5678 I GearheadService: connection lost',
      1
    );
    expect(l.timestamp).toBe('11-23 10:20:30.123');
    expect(l.pid).toBe('1234');
    expect(l.tid).toBe('5678');
    expect(l.nivel).toBe('I');
    expect(l.tag).toBe('GearheadService');
    expect(l.mensagem).toBe('connection lost');
  });

  it('faz parse do formato pid/tid com tag entre parênteses', () => {
    const l = parseLinha(
      '11-23 10:20:30.123 4321/99 F AndroidAuto ( ssl ): handshake failed',
      2
    );
    expect(l.pid).toBe('4321');
    expect(l.tid).toBe('99');
    expect(l.nivel).toBe('F');
    expect(l.tag).toBe('AndroidAuto');
    expect(l.mensagem).toBe('handshake failed');
  });

  it('faz parse de linha com timestamp ISO', () => {
    const l = parseLinha('2026-11-23T10:20:30.123Z projection certificate expired', 3);
    expect(l.timestamp).toBe('2026-11-23T10:20:30.123Z');
    expect(l.mensagem).toBe('projection certificate expired');
  });

  it('preserva linhas sem metadados sem descartá-las', () => {
    const l = parseLinha('------ SECTION: bugreport ------', 4);
    expect(l.bruto).toBe('------ SECTION: bugreport ------');
    expect(l.timestamp).toBeNull();
    expect(l.tag).toBeNull();
  });

  it('parseLogcat numera todas as linhas', () => {
    const texto = [
      '11-23 10:20:30.123  1  2 I Tag: a',
      'linha qualquer',
      '',
      '11-23 10:20:31.456  3  4 E Tag: b',
    ].join('\n');
    const linhas = parseLogcat(texto);
    expect(linhas.length).toBeGreaterThanOrEqual(3);
    expect(linhas[0].num).toBe(1);
    expect(linhas[1].mensagem).toBe('linha qualquer');
    expect(linhas[linhas.length - 1].nivel).toBe('E');
  });

  it('análise encontra termos com contexto e não inventa conclusão', () => {
    const texto = [
      '11-23 10:00:00.000  10  10 I Boot: start',
      '11-23 10:00:01.000  10  11 W GearheadService: projection disconnected',
      '11-23 10:00:02.000  10  12 I Boot: end',
      '11-23 10:00:03.000  10  13 E Ssl: certificate verification failed',
      '11-23 10:00:04.000  10  14 I Boot: done',
    ].join('\n');
    const matches = analisar(parseLogcat(texto), 'main.txt', 'id1');

    expect(matches.length).toBe(2);
    expect(matches[0].termo).toBe('gearhead');
    expect(matches[0].linha).toBe(2);
    expect(matches[0].timestamp).toBe('11-23 10:00:01.000');
    expect(matches[0].tag).toBe('GearheadService');
    // contexto: linhas vizinhas (1, 3 e 4), sem repetir a própria linha
    expect(matches[0].contexto.map((c) => c.num)).toEqual([1, 3, 4]);

    expect(matches[1].termo).toBe('certificate');
    expect(matches[1].tag).toBe('Ssl');

    const resumo = resumoTermos(matches);
    expect(resumo.find((r) => r.termo === 'gearhead')?.total).toBe(1);
    expect(resumo.find((r) => r.termo === 'certificate')?.total).toBe(1);
  });

  it('respeita o limite máximo de matches', () => {
    const texto = Array.from({ length: 50 }, (_, i) => `11-23 10:00:00.000  1  1 E error ${i}`).join('\n');
    const matches = analisar(parseLogcat(texto), 'x.txt', 'x', { maxMatches: 10 });
    expect(matches.length).toBe(10);
  });

  it('não retorna matches quando não há termos', () => {
    const matches = analisar(parseLogcat('11-23 10:00:00.000 1 1 I Ok: sem problema'), 'x.txt', 'x');
    expect(matches).toEqual([]);
  });

  it('extrai timestamp de linha crua', () => {
    expect(extrairTimestamp('11-23 10:20:30.123  1  2 I T: msg')).toBe('11-23 10:20:30.123');
    expect(extrairTimestamp('sem data')).toBeNull();
  });
});
