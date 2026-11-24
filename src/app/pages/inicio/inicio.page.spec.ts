import { InicioPage } from './inicio.page';

describe('InicioPage', () => {
  afterEach(() => localStorage.clear());

  it('sem sessão ativa abre o relatório da última sessão', async () => {
    const rotas: string[][] = [];
    const router = { navigate: async (r: string[]) => { rotas.push(r); } } as any;
    const page = new InicioPage({ sessao: null } as any, router);
    localStorage.setItem('autolink.diagnostico.historico', JSON.stringify([{ id: 'abc' }]));

    await page.continuarDiagnostico();

    expect(rotas).toEqual([['/resultado', 'abc']]);
  });

  it('com sessão ativa continua no diagnóstico', async () => {
    const rotas: string[][] = [];
    const router = { navigate: async (r: string[]) => { rotas.push(r); } } as any;
    const page = new InicioPage({ sessao: { id: 'ativa' } } as any, router);

    await page.continuarDiagnostico();

    expect(rotas).toEqual([['/diagnostico']]);
  });
});
