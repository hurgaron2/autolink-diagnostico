import { TestBed } from '@angular/core/testing';
import { AppLogService } from './app-log.service';
import { DeviceInfoService } from './device-info.service';
import { SessionService } from './session.service';
import { UsbService } from './usb.service';

describe('SessionService', () => {
  let service: SessionService;
  let usb: UsbService;
  let device: DeviceInfoService;
  let appLog: AppLogService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    usb = TestBed.inject(UsbService);
    device = TestBed.inject(DeviceInfoService);
    appLog = TestBed.inject(AppLogService);
    service = TestBed.inject(SessionService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('inicia sessão com snapshot inicial e evento de abertura', async () => {
    await service.iniciar();
    expect(service.sessao).not.toBeNull();
    expect(service.sessao?.eventos[0].tipo).toBe('sessao_iniciada');
    expect(service.sessao?.snapshotInicial).not.toBeNull();
    expect(service.sessao?.phoneSnapshot).not.toBeNull();
    // persistida localmente durante a reprodução
    expect(localStorage.getItem('autolink.sessao.ativa')).toBeTruthy();
  });

  it('registra marcações manuais com timestamp, fuso e monotônico', async () => {
    await service.iniciar();
    await service.tentativaConexao();
    await service.erro7();
    await service.observacao('tela da central mostrou erro após 5 s');

    const eventos = service.sessao?.eventos ?? [];
    expect(eventos.map((e) => e.tipo)).toEqual([
      'sessao_iniciada',
      'tentativa_conexao',
      'erro7',
      'observacao',
    ]);

    for (const e of eventos) {
      expect(Number.isNaN(Date.parse(e.timestampIso))).toBe(false);
      expect(typeof e.timezoneOffsetMin).toBe('number');
      expect(typeof e.monotonicMs).toBe('number');
      expect(e.origem === 'manual' || e.origem === 'api').toBe(true);
    }
    expect(eventos.find((e) => e.tipo === 'erro7')?.origem).toBe('manual');
    expect(eventos.find((e) => e.tipo === 'observacao')?.detalhe).toContain('erro após 5 s');
  });

  it('mantém a ordenação monotônica dos eventos', async () => {
    await service.iniciar();
    await service.tentativaConexao();
    await service.erro7();
    const eventos = service.sessao?.eventos ?? [];
    for (let i = 1; i < eventos.length; i++) {
      expect(eventos[i].monotonicMs).toBeGreaterThanOrEqual(eventos[i - 1].monotonicMs);
    }
  });

  it('registra lacunas de observação em aberto e fechadas', async () => {
    await service.iniciar();
    service.lacunaInicio('app em segundo plano');
    expect(service.sessao?.lacunas.length).toBe(1);
    expect(service.sessao?.lacunas[0].fimIso).toBeNull();

    service.lacunaFim('app voltou');
    expect(service.sessao?.lacunas[0].fimIso).not.toBeNull();
    const tipos = service.sessao?.eventos.map((e) => e.tipo) ?? [];
    expect(tipos).toContain('lacuna_inicio');
    expect(tipos).toContain('lacuna_fim');
  });

  it('ignora eventos sem sessão ativa sem lançar erro', async () => {
    expect(service.sessao).toBeNull();
    await service.erro7();
    expect(service.sessao).toBeNull();
  });

  it('encerra, salva no histórico e limpa a sessão ativa', async () => {
    await service.iniciar();
    await service.erro7();
    await service.encerrar();

    expect(service.sessao).toBeNull();
    expect(localStorage.getItem('autolink.sessao.ativa')).toBeNull();
    expect(service.historico.length).toBe(1);
    expect(service.historico[0].encerradaEm).not.toBeNull();
    expect(service.historico[0].eventos.some((e) => e.tipo === 'sessao_encerrada')).toBe(true);
    expect(service.sessaoParaExport()?.id).toBe(service.historico[0].id);
  });

  it('restaura sessão ativa e explicita a lacuna não observada', async () => {
    await service.iniciar();
    await service.erro7();
    const salva = localStorage.getItem('autolink.sessao.ativa');
    expect(salva).toBeTruthy();

    // simula reabertura do app com nova instância do serviço
    const nova = new SessionService(usb, device, appLog);
    expect(nova.sessao).not.toBeNull();
    expect(nova.sessao?.id).toBe(service.sessao?.id);
    expect(nova.sessao?.lacunas.length).toBe(1);
    expect(nova.sessao?.eventos.some((e) => e.tipo === 'app_evento')).toBe(true);
    expect(nova.sessao?.eventos.some((e) => e.tipo === 'erro7')).toBe(true);
  });

  it('recebe mudanças USB vindas do serviço de USB', async () => {
    await service.iniciar();
    usb.mudancas.next({ tipo: 'usb_conectado', rotulo: 'USB conectado', detalhe: 'vid:111:pid:222' });
    await new Promise((r) => setTimeout(r, 0)); // o registro é assíncrono (referência monotônica)
    const tipos = service.sessao?.eventos.map((e) => e.tipo) ?? [];
    expect(tipos).toContain('usb_conectado');
    const ev = service.sessao?.eventos.find((e) => e.tipo === 'usb_conectado');
    expect(ev?.origem).toBe('api');
  });
});
