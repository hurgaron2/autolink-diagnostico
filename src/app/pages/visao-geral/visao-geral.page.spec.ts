import { TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular/lazy';
import { FormsModule } from '@angular/forms';
import { VisaoGeralPage } from './visao-geral.page';
import { SessionService } from '../../core/session.service';
import { UsbService } from '../../core/usb.service';
import { DeviceInfoService } from '../../core/device-info.service';
import { AppLogService } from '../../core/app-log.service';
import { LogImportService } from '../../core/log-import.service';
import { OrigemPipe } from '../../shared/origem.pipe';

describe('VisaoGeralPage', () => {
  let fixture: any;
  let component: VisaoGeralPage;
  let el: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [IonicModule.forRoot(), FormsModule],
      declarations: [VisaoGeralPage, OrigemPipe],
      providers: [SessionService, UsbService, DeviceInfoService, AppLogService, LogImportService],
    }).compileComponents();

    fixture = TestBed.createComponent(VisaoGeralPage);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('abre sem sessão ativa: nenhuma ação depende de sessão, carregando não fica permanente', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.session.sessao).toBeNull();
    // loading é liberado após a coleta assíncrona (plugin indisponível no navegador)
    expect(component.carregando).toBe(false);

    const btn: any = el.querySelector('ion-button');
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toContain('Atualizar coleta');

    // visão geral funciona sem sessão
    const status = el.textContent;
    expect(status).toContain('Sessão: não iniciada');
    expect(status).toContain('USB: sem enumeração');
  });

  it('clique real em "Atualizar coleta" repete a operação e nunca deixa loading travado', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    const btn: any = el.querySelector('ion-button');

    btn.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.carregando).toBe(false);
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toContain('Atualizar coleta');

    // repetir: loading nunca fica travado
    btn.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.carregando).toBe(false);
    expect(btn.disabled).toBe(false);
  });

  it('falha de persistência não trava a tela: carregando é liberado mesmo quando localStorage falha', async () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    const btn: any = el.querySelector('ion-button');
    btn.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // coleta concluída, loading liberado, tela seguindo utilizável
    expect(component.carregando).toBe(false);
    expect(btn.disabled).toBe(false);
  });
});
