import { TestBed } from '@angular/core/testing';
import { ExportService } from './export.service';
import { LogImportService } from './log-import.service';
import { StorageService } from './storage.service';
import { IdentificacaoService } from './identificacao.service';

describe('ExportService', () => {
  let service: ExportService;
  let storage: StorageService;
  let logs: LogImportService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ExportService);
    storage = TestBed.inject(StorageService);
    logs = TestBed.inject(LogImportService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('gera todos os arquivos do esquema v1', async () => {
    const { arquivos } = await service.construirArquivos({ incluirLogs: false, sanitizar: true });

    expect(Object.keys(arquivos)).toEqual(
      expect.arrayContaining([
        'manifest.json',
        'device.json',
        'central.json',
        'usb-snapshots.json',
        'timeline.json',
        'app-events.txt',
        'resumo.txt',
      ])
    );

    const manifest = JSON.parse(arquivos['manifest.json']) as {
      schemaVersion: number;
      incluiLogs: boolean;
      sanitizado: boolean;
      avisos: string[];
    };
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.incluiLogs).toBe(false);
    expect(manifest.sanitizado).toBe(true);
    expect(manifest.avisos.length).toBeGreaterThan(0);
  });

  it('não inclui logs por padrão', async () => {
    const { arquivos } = await service.construirArquivos({ incluirLogs: false, sanitizar: true });
    const chavesLogs = Object.keys(arquivos).filter((k) => k.startsWith('logs/'));
    expect(chavesLogs).toEqual([]);
  });

  it('inclui apenas logs marcados pelo usuário e sanitiza o conteúdo', async () => {
    await storage.salvarLog('t1', 'contato joao@exemplo.com em 192.168.5.1');
    logs.logs.unshift({
      id: 't1',
      nome: 'main.txt',
      origemArquivo: 'logcat_txt',
      importadoEm: new Date().toISOString(),
      bytes: 40,
      linhas: 1,
      incluirNaExportacao: true,
      armazenadoEm: 'memoria',
      caminho: null,
    });

    const { arquivos } = await service.construirArquivos({ incluirLogs: true, sanitizar: true });
    expect(arquivos['logs/main.txt']).toBeDefined();
    expect(arquivos['logs/main.txt']).toContain('[EMAIL]');
    expect(arquivos['logs/main.txt']).toContain('[IP]');
    expect(arquivos['logs/main.txt']).not.toContain('joao@exemplo.com');
    expect(arquivos['logs/main.txt']).not.toContain('192.168.5.1');
  });

  it('omite logs não marcados mesmo com a inclusão habilitada', async () => {
    await storage.salvarLog('t2', 'linha qualquer');
    logs.logs.unshift({
      id: 't2',
      nome: 'privado.txt',
      origemArquivo: 'logcat_txt',
      importadoEm: new Date().toISOString(),
      bytes: 10,
      linhas: 1,
      incluirNaExportacao: false,
      armazenadoEm: 'memoria',
      caminho: null,
    });

    const { arquivos } = await service.construirArquivos({ incluirLogs: true, sanitizar: true });
    expect(Object.keys(arquivos).filter((k) => k.startsWith('logs/'))).toEqual([]);
  });

  it('marca a central como manual e não confirmada por USB', async () => {
    const { arquivos } = await service.construirArquivos({ incluirLogs: false, sanitizar: true });
    const central = JSON.parse(arquivos['central.json']) as {
      confirmadoPorUsb: boolean;
      central: { modelo: { origem: string; confirmadoPorUsb: boolean } };
    };
    expect(central.confirmadoPorUsb).toBe(false);
    expect(central.central.modelo.origem).toBe('manual');
    expect(central.central.modelo.confirmadoPorUsb).toBe(false);
  });

  it('marca o painel do telefone como indisponível no modo sem plugin nativo', async () => {
    const { arquivos } = await service.construirArquivos({ incluirLogs: false, sanitizar: true });
    const device = JSON.parse(arquivos['device.json']) as {
      painel: { modelo: { origem: string }; gms: { presente: boolean } | null };
      origem: string;
    };
    // Em ambiente sem plugin nativo (testes), nada é inventado:
    expect(device.painel.modelo.origem).toBe('indisponivel');
    expect(device.origem).toContain('API pública');
  });

  it('avisa quando não há sessão nem enumeração USB', async () => {
    const { avisos } = await service.construirArquivos({ incluirLogs: false, sanitizar: true });
    expect(avisos.some((a) => a.includes('Nenhuma sessão'))).toBe(true);
    expect(avisos.some((a) => a.includes('Nenhuma enumeração USB'))).toBe(true);
  });

  it('inclui detected-equipment.json com equipamentos observados', async () => {
    const identificacao = TestBed.inject(IdentificacaoService);
    identificacao.registrarUsbDispositivo({
      key: 'vid:111:pid:222',
      vid: 111,
      pid: 222,
      classe: 0,
      subclasse: 0,
      protocolo: 0,
      fabricante: 'Fab',
      produto: 'Prod',
      versao: '1.0',
      serial: null,
      interfaces: [],
    });
    const { arquivos } = await service.construirArquivos({ incluirLogs: false, sanitizar: true });
    const equip = JSON.parse(arquivos['detected-equipment.json']) as {
      equipamentos: Array<{ tipo: string; origem: string; evidencia: string }>;
    };
    expect(equip.equipamentos.length).toBe(1);
    expect(equip.equipamentos[0].tipo).toBe('usb_dispositivo');
    expect(equip.equipamentos[0].origem).toBe('api');
    expect(equip.equipamentos[0].evidencia).toBe('observado');
  });

  it('inclui conexões.jsonl com eventos de conexão da sessão', async () => {
    const { arquivos } = await service.construirArquivos({ incluirLogs: false, sanitizar: true });
    // conexoes.jsonl sempre deve estar presente (vazio se não houver eventos)
    expect(arquivos['conexoes.jsonl']).toBeDefined();
    expect(typeof arquivos['conexoes.jsonl']).toBe('string');
  });

  it('manifesto lista detected-equipment.json e conexões.jsonl', async () => {
    const { arquivos } = await service.construirArquivos({ incluirLogs: false, sanitizar: true });
    const manifest = JSON.parse(arquivos['manifest.json']) as { arquivos: string[] };
    expect(manifest.arquivos).toContain('detected-equipment.json');
    expect(manifest.arquivos).toContain('conexoes.jsonl');
  });
});
