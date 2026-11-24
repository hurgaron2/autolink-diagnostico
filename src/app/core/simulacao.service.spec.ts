import { TestBed } from '@angular/core/testing';
import { DiagnosticoService } from './diagnostico.service';
import { ExportService, pastaPublicaSessao } from './export.service';
import { UsbDeviceInfo } from './models';
import { BANNER_SIMULACAO, CenarioSimulacao, SimulacaoService } from './simulacao.service';
import { UsbService } from './usb.service';

const CENARIOS: CenarioSimulacao[] = [
  'usb_conectado',
  'usb_desconectado',
  'lista_vazia',
  'bluetooth_sem_projecao',
  'rede_sem_projecao',
  'permissao_negada',
  'falha_coletor',
  'sessao_interrompida',
  'erro_sintetico',
];

describe('SimulacaoService (somente desenvolvimento)', () => {
  let service: SimulacaoService;
  let diagnostico: DiagnosticoService;
  let exportService: ExportService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(SimulacaoService);
    diagnostico = TestBed.inject(DiagnosticoService);
    exportService = TestBed.inject(ExportService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('executa todos os cenários usando persistência e serviços reais', async () => {
    expect(service.disponivel).toBe(true);
    await service.iniciar();

    for (const cenario of CENARIOS) {
      const r = await service.executar(cenario);
      expect(r.ok).toBe(true);
      expect(r.mensagem).toContain(cenario);
    }

    const sessao = diagnostico.sessao!;
    expect(sessao.simulacao).toBe(true);
    expect(sessao.eventos.every((e) => e.simulacao === true)).toBe(true);
    expect(sessao.eventos.every((e) => e.rotulo.includes(BANNER_SIMULACAO) || e.origem === 'api')).toBe(true);
    expect(sessao.eventos.some((e) => (e.detalhe ?? '').includes('simulation=true'))).toBe(true);
    expect(sessao.snapshotInicial?.simulacao).toBe(true);
  });

  it('registra conexão e desconexão sintéticas pelo caminho real de enumeração', async () => {
    await service.iniciar();
    await service.executar('usb_conectado');
    expect(diagnostico.sessao!.eventos.some((e) => e.tipo === 'usb_conectado' && e.simulacao)).toBe(true);

    await service.executar('usb_desconectado');
    expect(diagnostico.sessao!.eventos.some((e) => e.tipo === 'usb_desconectado' && e.simulacao)).toBe(true);
  });

  it('mantém histórico real e simulado separados', async () => {
    await diagnostico.iniciar();
    await diagnostico.encerrar();

    await service.iniciar();
    await service.executar('erro_sintetico');
    const idSimulada = diagnostico.sessao!.id;
    await service.encerrar();

    const historico = diagnostico.historicoParaExport();
    expect(historico.length).toBe(2);
    expect(historico.some((s) => s.id === idSimulada && s.simulacao === true)).toBe(true);
    expect(historico.some((s) => s.id !== idSimulada && !s.simulacao)).toBe(true);
    expect(pastaPublicaSessao(historico.find((s) => s.id === idSimulada)!)).toBe(`SIMULACAO/${idSimulada}`);
  });

  it('exporta exatamente a sessão simulada, com aviso e sem eventos reais', async () => {
    await diagnostico.iniciar();
    await diagnostico.registrarEvento('observacao', 'EVENTO_REAL', 'real', 'manual');
    const idReal = diagnostico.sessao!.id;
    await diagnostico.encerrar();

    await service.iniciar();
    await service.executar('erro_sintetico');
    const idSimulada = diagnostico.sessao!.id;
    await service.encerrar();
    expect(idSimulada).not.toBe(idReal);

    const { arquivos, avisos } = await exportService.construirArquivos({
      incluirLogs: false,
      sanitizar: true,
      idSessao: idSimulada,
    });
    const manifest = JSON.parse(arquivos['manifest.json']) as {
      sessaoId: string;
      simulacao: boolean;
      avisos: string[];
    };
    expect(manifest.sessaoId).toBe(idSimulada);
    expect(manifest.simulacao).toBe(true);
    expect(manifest.avisos.some((a) => a.includes('SIMULAÇÃO'))).toBe(true);
    expect(avisos.some((a) => a.includes('SIMULAÇÃO'))).toBe(true);
    expect(arquivos['resumo.txt']).toContain(BANNER_SIMULACAO);

    const timeline = JSON.parse(arquivos['timeline.json']) as {
      sessao: { eventos: Array<{ rotulo: string; simulacao?: boolean }> };
      historicoRecente: Array<{ id: string }>;
    };
    expect(timeline.sessao.eventos.some((e) => e.rotulo === 'EVENTO_REAL')).toBe(false);
    expect(timeline.sessao.eventos.every((e) => e.simulacao === true)).toBe(true);
    expect(timeline.historicoRecente.every((s) => s.id !== idReal)).toBe(true);
  });

  it('recusa simulação quando há sessão real ativa', async () => {
    await diagnostico.iniciar();
    const r = await service.executar('erro_sintetico');
    expect(r.ok).toBe(false);
    expect(r.mensagem).toContain('sessão real ativa');
    expect(diagnostico.sessao?.simulacao).not.toBe(true);
  });

  it('não registra receiver nativo nem afirma coleta real em simulação', async () => {
    await service.iniciar();
    const eventos = diagnostico.sessao!.eventos;
    const enumEvento = eventos.find((e) => (e.detalhe ?? '').startsWith('enumeração:'));
    expect(enumEvento?.detalhe).toContain('snapshot sintético vazio');
    expect(enumEvento?.detalhe).not.toContain('UsbManager');
    const obsEvento = eventos.find((e) => (e.detalhe ?? '').startsWith('observação:'));
    expect(obsEvento?.detalhe).toContain('não registra receiver nativo');
    expect(diagnostico.observando).toBe(false);
  });

  it('registra lacunas e eventos internos também na simulação', async () => {
    await service.iniciar();
    await diagnostico.registrarSaidaParaSegundoPlano();
    expect(diagnostico.sessao!.eventos.some((e) => e.tipo === 'lacuna_inicio' && e.simulacao)).toBe(true);

    await diagnostico.registrarSaidaParaSegundoPlano();
    expect(diagnostico.sessao!.lacunas.length).toBe(1);

    await diagnostico.reenumerarAoRetornar();
    expect(diagnostico.sessao!.eventos.some((e) => e.tipo === 'lacuna_fim' && e.simulacao)).toBe(true);
    expect(diagnostico.sessao!.lacunas.every((l) => l.fimIso !== null)).toBe(true);
  });

  it('não vaza chave de hardware real para eventos simulados', async () => {
    const usb = TestBed.inject(UsbService);
    await diagnostico.iniciar();
    const realKey = 'vid:9999:pid:8888';
    const dispositivoReal: UsbDeviceInfo = {
      key: realKey, vid: 0x9999, pid: 0x8888, classe: 0, subclasse: 0,
      protocolo: 0, fabricante: 'Real', produto: 'Real', versao: '1', serial: null, interfaces: [],
    };
    usb.ingestarSnapshot({
      capturadoEm: new Date().toISOString(), monotonicMs: 0, origem: 'api',
      dispositivos: [dispositivoReal], acessorios: [], notas: [], erro: null,
    });
    await diagnostico.encerrar();

    await service.iniciar();
    await service.executar('usb_conectado');
    await service.executar('usb_desconectado');
    const eventos = diagnostico.sessao!.eventos.filter(
      (e) => e.tipo === 'usb_conectado' || e.tipo === 'usb_desconectado'
    );
    expect(eventos.length).toBeGreaterThan(0);
    expect(eventos.every((e) => !(e.detalhe ?? '').includes(realKey))).toBe(true);
    expect(eventos.some((e) => (e.detalhe ?? '').includes('vid:6353:pid:53261'))).toBe(true);
  });

  it('exporta somente os snapshots da sessão pedida pelo ID', async () => {
    await diagnostico.iniciar();
    const idA = diagnostico.sessao!.id;
    await diagnostico.encerrar();

    await diagnostico.iniciar();
    const idB = diagnostico.sessao!.id;
    await diagnostico.encerrar();
    expect(idA).not.toBe(idB);

    const { arquivos } = await exportService.construirArquivos({
      incluirLogs: false,
      sanitizar: true,
      idSessao: idA,
    });
    const usb = JSON.parse(arquivos['usb-snapshots.json']) as {
      snapshots: Array<{ sessaoId: string | null }>;
    };
    expect(usb.snapshots.length).toBeGreaterThan(0);
    expect(usb.snapshots.every((s) => s.sessaoId === idA)).toBe(true);
    expect(usb.snapshots.some((s) => s.sessaoId === idB)).toBe(false);
  });

  it('bloqueia início simultâneo de sessões', async () => {
    const p1 = diagnostico.iniciar();
    await expect(diagnostico.iniciar('simulacao')).rejects.toThrow('já em andamento');
    await p1;
  });
});
