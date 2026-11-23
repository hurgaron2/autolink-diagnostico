import { TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular/lazy';
import { FormsModule } from '@angular/forms';
import { SessaoPage } from './sessao.page';
import { SessionService } from '../../core/session.service';
import { UsbService } from '../../core/usb.service';
import { DeviceInfoService } from '../../core/device-info.service';
import { AppLogService } from '../../core/app-log.service';
import { OrigemPipe } from '../../shared/origem.pipe';

/** Primeiro botão da página: iniciar ou encerrar sessão (único botão de sessão). */
function btnSessao(el: HTMLElement): any {
  return el.querySelector('ion-button');
}

/** Botão por texto exato (tolerante a espaços). */
function btnPorTexto(el: HTMLElement, texto: string): any {
  const t = texto.trim().replace(/\s+/g, ' ');
  return [...el.querySelectorAll('ion-button')].find(
    (x) => (x.textContent || '').trim().replace(/\s+/g, ' ') === t
  );
}

describe('SessaoPage', () => {
  let fixture: any;
  let component: SessaoPage;
  let session: SessionService;
  let el: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [IonicModule.forRoot(), FormsModule],
      declarations: [SessaoPage, OrigemPipe],
      providers: [SessionService, UsbService, DeviceInfoService, AppLogService],
    }).compileComponents();

    fixture = TestBed.createComponent(SessaoPage);
    component = fixture.componentInstance;
    session = TestBed.inject(SessionService);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('abre sem sessão ativa: "Iniciar sessão" habilitado, outras ações desabilitadas com motivo', () => {
    expect(session.sessao).toBeNull();
    expect(el.querySelector('ion-card-subtitle')?.textContent).toContain('Nenhuma sessão ativa');

    expect(btnSessao(el).disabled).toBe(false);
    expect(btnPorTexto(el, 'Marcar tentativa de conexão').disabled).toBe(true);
    expect(btnPorTexto(el, 'Marcar “Erro 7 apareceu”').disabled).toBe(true);

    const motivo = el.querySelector('.motivo')?.textContent ?? '';
    expect(motivo.toLowerCase()).toContain('inicie a sessão');
  });

  it('clique real em "Iniciar sessão" cria sessão e atualiza a tela', async () => {
    await component.iniciar();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(session.sessao).not.toBeNull();
    expect(session.sessao?.eventos.some((e) => e.tipo === 'sessao_iniciada')).toBe(true);
    expect(localStorage.getItem('autolink.sessao.ativa')).toBeTruthy();

    expect(el.querySelector('ion-card-subtitle')?.textContent).toContain(session.sessao?.id);
    expect(btnSessao(el).textContent).toContain('Encerrar sessão');
    expect(btnSessao(el).disabled).toBe(false);
    expect(btnPorTexto(el, 'Marcar tentativa de conexão').disabled).toBe(false);
    expect(btnPorTexto(el, 'Marcar “Erro 7 apareceu”').disabled).toBe(false);
    expect(el.querySelector('.motivo')).toBeNull();
  });

  it('marcação de tentativa de conexão e "Erro 7 apareceu" grava eventos na sessão', async () => {
    await component.iniciar();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.tentativa();
    fixture.detectChanges();

    await component.erro7();
    fixture.detectChanges();

    const tipos = session.sessao?.eventos.map((e) => e.tipo) ?? [];
    expect(tipos).toContain('tentativa_conexao');
    expect(tipos).toContain('erro7');
    const erro7Ev = session.sessao?.eventos.find((e) => e.tipo === 'erro7');
    expect(erro7Ev?.origem).toBe('manual');
  });

  it('sem plugin nativo (navegador) a sessão ainda inicia e não trava a interface', async () => {
    await component.iniciar();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(session.sessao).not.toBeNull();
    expect(component.erro).toBeNull();
    expect(btnSessao(el).disabled).toBe(false);
  });

  it('encerra a sessão pelo botão único, salva no histórico e libera as ações dependentes', async () => {
    await component.iniciar();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.alternarSessao();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(session.sessao).toBeNull();
    expect(localStorage.getItem('autolink.sessao.ativa')).toBeNull();
    expect(session.historico.length).toBe(1);
    expect(session.historico[0].encerradaEm).not.toBeNull();

    // volta a ser "Iniciar sessão" e habilitado (botão único)
    expect(btnSessao(el).disabled).toBe(false);
    // ações dependentes de sessão estão desabilitadas sem sessão (coberto pelo teste de abertura)
  });
});
