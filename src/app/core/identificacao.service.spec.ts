import { TestBed } from '@angular/core/testing';
import { IdentificacaoService } from './identificacao.service';
import { AppLogService } from './app-log.service';

describe('IdentificacaoService', () => {
  let service: IdentificacaoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IdentificacaoService);
  });

  it('registra dispositivo USB com origem api e evidência observado', () => {
    service.registrarUsbDispositivo({
      key: 'vid:111:pid:222',
      vid: 111,
      pid: 222,
      classe: 0,
      subclasse: 0,
      protocolo: 0,
      fabricante: 'Fabricante',
      produto: 'Produto',
      versao: '1.0',
      serial: null,
      interfaces: [],
    });
    expect(service.equipamentos.length).toBe(1);
    const eq = service.equipamentos[0];
    expect(eq.tipo).toBe('usb_dispositivo');
    expect(eq.origem).toBe('api');
    expect(eq.evidencia).toBe('observado');
    expect((eq.valor as any).vid).toBe(111);
    expect((eq.valor as any).pid).toBe(222);
  });

  it('registra acessório USB', () => {
    service.registrarUsbAcessorio({
      key: 'acc:Fab|Model|uri',
      fabricante: 'Fab',
      modelo: 'Model',
      descricao: 'Desc',
      versao: '1.0',
      uri: 'uri',
    });
    expect(service.equipamentos.length).toBe(1);
    expect(service.equipamentos[0].tipo).toBe('usb_acessorio');
  });

  it('registra adaptador como pertencente a adaptador (não central)', () => {
    service.registrarAdaptador('Onex', 'bluetooth', 'adaptador intermediário');
    expect(service.equipamentos.length).toBe(1);
    const eq = service.equipamentos[0];
    expect(eq.equipamentoPertence).toBe('adaptador');
    expect(eq.tipo).toBe('bluetooth');
  });

  it('registra campo indisponível com evidência indisponível', () => {
    service.registrarIndisponivel('firmware central', 'não exposto por USB');
    expect(service.equipamentos.length).toBe(1);
    expect(service.equipamentos[0].evidencia).toBe('indisponivel');
  });

  it('agrupa equipamentos por tipo de pertinência', () => {
    service.registrarAdaptador('Onex', 'bluetooth', 'detalhe');
    service.registrarIndisponivel('firmware', 'não exposto');
    expect(service.porAdaptador.length).toBe(1);
    expect(service.desconhecidos.length).toBe(1);
  });
});
