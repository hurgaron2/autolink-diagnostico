import { TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular/lazy';
import { FormsModule } from '@angular/forms';
import { UsbPage } from './usb.page';
import { UsbService } from '../../core/usb.service';
import { AppLogService } from '../../core/app-log.service';
import { OrigemPipe } from '../../shared/origem.pipe';

describe('UsbPage', () => {
  let fixture: any;
  let component: UsbPage;
  let el: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [IonicModule.forRoot(), FormsModule],
      declarations: [UsbPage, OrigemPipe],
      providers: [UsbService, AppLogService],
    }).compileComponents();

    fixture = TestBed.createComponent(UsbPage);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('USB funciona sem sessão: enumeração não exige sessão ativa', async () => {
    await component.ionViewWillEnter();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.usb.snapshotAtual).not.toBeNull();
    expect(component.usb.snapshotAtual?.erro).toContain('Plugin nativo indisponível');

    const btn: any = el.querySelector('ion-button');
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toContain('Reenumerar');
  });

  it('clique real em "Enumerar" repete a operação sem deixar loading travado', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    const btn: any = el.querySelector('ion-button');
    btn.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.enumerando).toBe(false);
    expect(btn.disabled).toBe(false);
  });
});
