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

  it('inicia sessão com snapshot e evento de diagnóstico iniciado', async () => {
    await service.iniciar();
    expect(service.sessao).not.toBeNull();
    expect(service.sessao?.eventos.some((e) => e.tipo === 'diagnostico_iniciado')).toBe(true);
    expect(localStorage.getItem('autolink.diagnostico.sessao.ativa')).toBeTruthy();
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
});

function lerJson<T>(chave: string, padrao: T): T {
  try {
    const raw = localStorage.getItem(`autolink.${chave}`);
    return raw ? (JSON.parse(raw) as T) : padrao;
  } catch {
    return padrao;
  }
}
