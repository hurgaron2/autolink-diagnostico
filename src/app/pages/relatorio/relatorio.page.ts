import { Component, OnInit } from '@angular/core';
import { CentralService } from '../../core/central.service';
import { AppLogService } from '../../core/app-log.service';
import { ExportService } from '../../core/export.service';
import { Central } from '../../core/models';

@Component({
  selector: 'app-relatorio',
  templateUrl: './relatorio.page.html',
  styleUrls: ['./relatorio.page.scss'],
  standalone: false,
})
export class RelatorioPage implements OnInit {
  modelo: string;
  app: string;
  cfg: string;
  mcu: string;
  ic: string;
  radio: string;
  adaptadorModelo: string;
  adaptadorApp: string;
  adaptadorSystem: string;
  adaptadorBt: string;

  incluirLogs = false;
  sanitizar = true;
  gerando = false;
  mensagem: string | null = null;
  erro: string | null = null;

  constructor(
    private centralService: CentralService,
    private exportService: ExportService,
    private appLog: AppLogService
  ) {
    const c = this.centralService.obter();
    this.modelo = c.modelo.valor;
    this.app = c.app.valor;
    this.cfg = c.cfg.valor;
    this.mcu = c.mcu.valor;
    this.ic = c.ic.valor;
    this.radio = c.radio.valor;
    this.adaptadorModelo = c.adaptadorModelo.valor;
    this.adaptadorApp = c.adaptadorApp.valor;
    this.adaptadorSystem = c.adaptadorSystem.valor;
    this.adaptadorBt = c.adaptadorBt.valor;
  }

  get central(): Central {
    return this.centralService.obter();
  }

  ngOnInit(): void {
    if (!this.sanitizar) {
      this.sanitizar = true;
    }
  }

  salvarCentral(): void {
    this.centralService.atualizar({
      modelo: this.campo(this.modelo),
      app: this.campo(this.app),
      cfg: this.campo(this.cfg),
      mcu: this.campo(this.mcu),
      ic: this.campo(this.ic),
      radio: this.campo(this.radio),
      adaptadorModelo: this.campo(this.adaptadorModelo),
      adaptadorApp: this.campo(this.adaptadorApp),
      adaptadorSystem: this.campo(this.adaptadorSystem),
      adaptadorBt: this.campo(this.adaptadorBt),
    });
    this.mensagem = 'Dados da central salvos (origem: manual, não confirmado por USB).';
    this.erro = null;
    this.appLog.log('dados da central atualizados manualmente', 'info');
  }

  restaurarPadrao(): void {
    this.centralService.restaurarPadrao();
    const c = this.centralService.obter();
    this.modelo = c.modelo.valor;
    this.app = c.app.valor;
    this.cfg = c.cfg.valor;
    this.mcu = c.mcu.valor;
    this.ic = c.ic.valor;
    this.radio = c.radio.valor;
    this.adaptadorModelo = c.adaptadorModelo.valor;
    this.adaptadorApp = c.adaptadorApp.valor;
    this.adaptadorSystem = c.adaptadorSystem.valor;
    this.adaptadorBt = c.adaptadorBt.valor;
    this.mensagem = 'Valores padrão restaurados.';
  }

  /** Foto opcional via seletor pontual (sem acesso amplo à galeria). */
  async onFoto(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    try {
      const dataUrl = await redimensionar(file, 1280, 0.72);
      this.centralService.atualizar({ foto: dataUrl, fotoNome: file.name });
      this.mensagem = `Foto "${file.name}" anexada localmente.`;
      this.erro = null;
    } catch {
      this.erro = 'Não foi possível processar a imagem escolhida.';
    } finally {
      input.value = '';
    }
  }

  async gerar(): Promise<void> {
    this.gerando = true;
    this.mensagem = null;
    this.erro = null;
    try {
      const r = await this.exportService.gerar({
        incluirLogs: this.incluirLogs,
        sanitizar: this.sanitizar,
      });
      if (r.ok) {
        this.mensagem = r.mensagem;
      } else {
        this.erro = r.mensagem;
      }
    } finally {
      this.gerando = false;
    }
  }

  private campo(valor: string): Central['modelo'] {
    return { valor, origem: 'manual', confirmadoPorUsb: false };
  }
}

/** Reduz a imagem para caber no armazenamento local (cópia privada). */
function redimensionar(file: File, maxLado: number, qualidade: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error('leitura falhou'));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decodificação falhou'));
      img.onload = () => {
        const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * escala));
        canvas.height = Math.max(1, Math.round(img.height * escala));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('canvas indisponível'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', qualidade));
      };
      img.src = String(leitor.result);
    };
    leitor.readAsDataURL(file);
  });
}
