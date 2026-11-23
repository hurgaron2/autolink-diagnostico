import { Component } from '@angular/core';
import { UsbAccessoryInfo, UsbDeviceInfo, UsbSnapshot } from '../../core/models';
import { UsbService } from '../../core/usb.service';

@Component({
  selector: 'app-usb',
  templateUrl: './usb.page.html',
  styleUrls: ['./usb.page.scss'],
  standalone: false,
})
export class UsbPage {
  enumerando = false;
  expandido: string | null = null;

  constructor(public usb: UsbService) {}

  get snapshot(): UsbSnapshot | null {
    return this.usb.snapshotAtual;
  }

  get vazio(): boolean {
    const s = this.snapshot;
    return !!s && s.dispositivos.length === 0 && s.acessorios.length === 0;
  }

  async ionViewWillEnter(): Promise<void> {
    // Reenumeração a cada entrada/retomada da tela (modo somente leitura).
    await this.enumerar();
    await this.usb.iniciarObservacao();
  }

  async enumerar(): Promise<void> {
    this.enumerando = true;
    try {
      await this.usb.enumerar();
    } finally {
      this.enumerando = false;
    }
  }

  alternar(key: string): void {
    this.expandido = this.expandido === key ? null : key;
  }

  classeNome(c: number): string {
    const mapa: Record<number, string> = {
      0: 'por interface',
      1: 'áudio',
      2: 'CDC (comunicação)',
      3: 'HID',
      7: 'impressor',
      8: 'mass storage',
      9: 'hub',
      10: 'CDC-dados',
      14: 'vídeo',
      255: 'específico do fornecedor',
    };
    return mapa[c] ?? `classe ${c}`;
  }

  trackDevice(_: number, d: UsbDeviceInfo): string {
    return d.key;
  }

  trackAccessory(_: number, a: UsbAccessoryInfo): string {
    return a.key;
  }
}
