import { Component } from '@angular/core';
import { AppLogService } from '../../core/app-log.service';
import { Router } from '@angular/router';
import { StoragePublicService } from '../../core/storage-public.service';

@Component({
  selector: 'app-ajustes',
  templateUrl: './ajustes.page.html',
  styleUrls: ['./ajustes.page.scss'],
  standalone: false,
})
export class AjustesPage {
  versao = '1.5';
  sanitizar = true;

  constructor(
    private appLog: AppLogService,
    private router: Router,
    private storagePublic: StoragePublicService
  ) {}

  async abrirPasta(): Promise<void> {
    const r = await this.storagePublic.abrirPasta();
    if (!r.ok) {
      this.appLog.log(`falha ao abrir pasta de diagnósticos: ${r.erro}`, 'erro');
    }
  }

  async irComoUsar(): Promise<void> {
    await this.router.navigate(['/ajustes/como-usar']);
  }

  async irSobre(): Promise<void> {
    await this.router.navigate(['/ajustes/sobre']);
  }

  async alternarSanitizacao(): Promise<void> {
    this.sanitizar = !this.sanitizar;
    this.appLog.log(`sanitização ${this.sanitizar ? 'ativada' : 'desativada'}`, 'info');
  }
}
