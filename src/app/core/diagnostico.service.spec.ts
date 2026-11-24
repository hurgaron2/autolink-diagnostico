import { TestBed } from '@angular/core/testing';
import { DiagnosticoService } from './diagnostico.service';
import { UsbService } from './usb.service';
import { DeviceInfoService } from './device-info.service';
import { AppLogService } from './app-log.service';
import { IdentificacaoService } from './identificacao.service';

describe('DiagnosticoService', () => {
  let service: DiagnosticoService;
  let appLog: AppLogService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(DiagnosticoService);
    appLog = TestBed.inject(AppLogService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('inicia sessão com evento session_started e collector_started/failed', async () => {
    await service.iniciar();
    expect(service.sessao).not.toBeNull();
    expect(service.sessao?.eventos.some((e) => e.tipo === 'session_started')).toBe(true);
    // Um coletor USB sempre deve ser reportado (started ou failed)
    expect(
      service.sessao?.eventos.some(
        (e) => e.tipo === 'collector_started' || e.tipo === 'collector_failed'
      )
    ).toBe(true);
    expect(localStorage.getItem('autolink.diagnostico.sessao.ativa')).toBeTruthy();
    expect(service.sessao?.iniciadaEm).toBeTruthy();
    expect(Date.parse(service.sessao!.iniciadaEm)).not.toBeNaN();
  });

  it('registra initial_snapshot quando a enumeração USB tem sucesso, ou collector_failed quando falha', async () => {
    await service.iniciar();
    const temSucesso = service.sessao?.eventos.some((e) => e.tipo === 'initial_snapshot');
    const temFalha = service.sessao?.eventos.some((e) => e.tipo === 'collector_failed');
    // Pelo menos um dos dois deve estar presente: snapshot capturado ou coletor falhou
    expect(temSucesso || temFalha).toBe(true);
  });

  it('registra eventos na linha do tempo da sessão', async () => {
    await service.iniciar();
    await service.registrarEvento('usb_conectado', 'USB conectado', 'vid:111:pid:222', 'api', 'info');
    expect(service.sessao?.eventos.some((e) => e.tipo === 'usb_conectado')).toBe(true);
  });

  it('encerra sessão, salva no histórico e limpa sessão ativa', async () => {
    await service.iniciar();
    await service.encerrar();
    expect(service.sessao).toBeNull();
    expect(localStorage.getItem('autolink.diagnostico.sessao.ativa')).toBeNull();
    const historico = lerJson('diagnostico.historico', [] as any[]);
    expect(historico.length).toBe(1);
    expect((historico[0] as any).encerradaEm).not.toBeNull();
    expect((historico[0] as any).eventos.some((e: any) => e.tipo === 'session_ended')).toBe(true);
  });

  it('não permite iniciar sessão duplicada', async () => {
    await service.iniciar();
    const id1 = service.sessao?.id;
    await service.iniciar();
    expect(service.sessao?.id).toBe(id1);
  });

  it('duracaoSegundos retorna 0 sem sessão', () => {
    expect(service.duracaoSegundos).toBe(0);
  });

  it('registra o resultado de cada coletor e persiste o snapshot mesmo vazio', async () => {
    await service.iniciar();
    const eventos = service.sessao!.eventos;
    const coletores = eventos.filter(
      (e) => e.tipo === 'collector_started' || e.tipo === 'collector_failed'
    );
    expect(coletores.length).toBe(2);
    expect(coletores.some((e) => (e.detalhe ?? '').startsWith('enumeração:'))).toBe(true);
    expect(coletores.some((e) => (e.detalhe ?? '').startsWith('observação:'))).toBe(true);
    expect(service.sessao!.snapshotInicial).not.toBeNull();
    expect(eventos.some((e) => e.tipo === 'initial_snapshot')).toBe(true);
  });

  it('não marca o coletor de eventos como ativo sem receiver registrado', async () => {
    await service.iniciar();
    const observador = service.sessao!.eventos.find((e) =>
      (e.detalhe ?? '').startsWith('observação:')
    );
    expect(observador?.tipo).toBe('collector_failed');
    expect(service.observando).toBe(false);
  });

  it('impede misturar eventos reais em sessão simulada', async () => {
    await service.iniciar('simulacao');
    await service.registrarEvento('usb_conectado', 'evento real', 'x', 'api', 'info', false);
    await service.registrarEvento('app_evento', 'SIMULAÇÃO — evento sintético', 'y', 'api', 'info', true);
    const eventos = service.sessao!.eventos;
    expect(eventos.some((e) => e.rotulo === 'evento real')).toBe(false);
    expect(eventos.some((e) => e.rotulo === 'SIMULAÇÃO — evento sintético')).toBe(true);
    expect(eventos.every((e) => e.simulacao === true)).toBe(true);
  });

  it('impede alternar entre simulação e captura real com sessão ativa', async () => {
    await service.iniciar('simulacao');
    await expect(service.iniciar('real')).rejects.toThrow();
  });

  it('sessaoParaExport retorna a última sessão encerrada quando não há ativa', async () => {
    expect(service.sessaoParaExport()).toBeNull();
    await service.iniciar();
    await service.encerrar();
    const exportada = service.sessaoParaExport();
    expect(exportada).not.toBeNull();
    expect(exportada?.encerradaEm).not.toBeNull();
  });
});

function lerJson<T>(chave: string, padrao: T): T {
  try {
    const raw = localStorage.getItem(`autolink.${chave}`);
    return raw ? (JSON.parse(raw) as T) : padrao;
  } catch {
    return padrao;
  }
}
