import { TestBed } from '@angular/core/testing';
import { AppLogService } from './app-log.service';
import { DeviceInfoService } from './device-info.service';
import { UsbService } from './usb.service';

describe('UsbService (enumeração vazia / sem plugin nativo)', () => {
  let service: UsbService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(UsbService);
  });

  it('retorna snapshot vazio com aviso em vez de inventar "central desconectada"', async () => {
    const snapshot = await service.enumerar();
    expect(snapshot.dispositivos).toEqual([]);
    expect(snapshot.acessorios).toEqual([]);
    expect(snapshot.erro).toContain('Plugin nativo indisponível');
    expect(service.resumo(snapshot)).toBe('Sem dispositivo/acessório visível para este aplicativo');
    expect(service.resumo(snapshot)).not.toContain('central desconectada');
  });

  it('guarda os snapshots observados', async () => {
    await service.enumerar();
    await service.enumerar();
    expect(service.snapshots.length).toBe(2);
    expect(service.snapshotAtual).not.toBeNull();
  });

  it('não inicia observação sem plugin nativo e não lança erro', async () => {
    await service.iniciarObservacao();
    expect(service.observando).toBe(false);
    await service.pararObservacao();
    expect(service.observando).toBe(false);
  });

  it('o painel do telefone marca tudo como indisponível sem inventar versões', async () => {
    const device = TestBed.inject(DeviceInfoService);
    const phone = await device.coletar();
    expect(phone.modelo.origem).toBe('indisponivel');
    expect(phone.gms).toBeNull();
    expect(phone.gearhead).toBeNull();
    expect(phone.erroGeral).toContain('Plugin nativo indisponível');
  });

  it('registra o erro no log interno do app', async () => {
    const appLog = TestBed.inject(AppLogService);
    await service.enumerar();
    expect(appLog.obter().some((l) => l.msg.includes('plugin nativo indisponível') || l.msg.includes('Plugin nativo'))).toBe(true);
  });
});
