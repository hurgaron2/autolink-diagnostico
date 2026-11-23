import { Component } from '@angular/core';
import { DiagnosticoService } from '../../core/diagnostico.service';
import { IdentificacaoService } from '../../core/identificacao.service';
import { UsbService } from '../../core/usb.service';
import { Sessao, UsbSnapshot } from '../../core/models';
import { Router } from '@angular/router';
import { AppLogService } from '../../core/app-log.service';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-detalhes-tecnicos',
  templateUrl: './detalhes-tecnicos.page.html',
  styleUrls: ['./detalhes-tecnicos.page.scss'],
  standalone: false,
})
export class DetalhesTecnicosPage {
  sessao: Sessao | null = null;
  snapshot: UsbSnapshot | null = null;
  expandido = true;

  constructor(
    public diagnostico: DiagnosticoService,
    public identificacao: IdentificacaoService,
    public usb: UsbService,
    private appLog: AppLogService,
    private router: Router
  ) {}

  async ionViewWillEnter(): Promise<void> {
    this.sessao = this.diagnostico.sessao ?? null;
    this.snapshot = this.usb.snapshotAtual;
  }

  formatarDuracao(seg: number): string {
    if (seg < 60) {
      return `${seg} s`;
    }
    const min = Math.floor(seg / 60);
    return `${min} min ${seg % 60} s`;
  }

  private duracaoSegundos(s: Sessao): number {
    if (!s) return 0;
    const fim = s.encerradaEm ?? new Date().toISOString();
    const a = Date.parse(s.iniciadaEm);
    const b = Date.parse(fim);
    if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
    return Math.round((b - a) / 1000);
  }

  get telefones(): any[] {
    if (!this.sessao?.phoneSnapshot) return [];
    const p = this.sessao.phoneSnapshot;
    const campos: any[] = [];
    if (p.fabricante) campos.push({ label: 'Fabricante', valor: p.fabricante.valor ?? '—', origem: p.fabricante.origem });
    if (p.modelo) campos.push({ label: 'Modelo', valor: p.modelo.valor ?? '—', origem: p.modelo.origem });
    if (p.android) campos.push({ label: 'Android', valor: p.android.valor ?? '—', origem: p.android.origem });
    if (p.sdk) campos.push({ label: 'SDK', valor: p.sdk.valor?.toString() ?? '—', origem: p.sdk.origem });
    if (p.build) campos.push({ label: 'Build', valor: p.build.valor ?? '—', origem: p.build.origem });
    if (p.patch) campos.push({ label: 'Patch', valor: p.patch.valor ?? '—', origem: p.patch.origem });
    return campos;
  }

  get pacotes(): any[] {
    if (!this.sessao?.phoneSnapshot) return [];
    const p = this.sessao.phoneSnapshot;
    const campos: any[] = [];
    if (p.gms) {
      campos.push({ label: 'Google Play Services', valor: p.gms.presente ? (p.gms.versionName.valor ?? 'presente') : 'ausente', origem: p.gms.versionName.origem });
    }
    if (p.gearhead) {
      campos.push({ label: 'Android Auto', valor: p.gearhead.presente ? (p.gearhead.versionName.valor ?? 'presente') : 'ausente', origem: p.gearhead.versionName.origem });
    }
    return campos;
  }

  get eventos(): any[] {
    return this.sessao?.eventos ?? [];
  }

  trackById(_: number, item: any): string {
    return item.id;
  }

  corOrigem(origem: string): string {
    switch (origem) {
      case 'api': return 'success';
      case 'manual': return 'warning';
      case 'log': return 'primary';
      case 'indisponivel': return 'medium';
      default: return 'primary';
    }
  }

  async copiarEventos(): Promise<void> {
    const texto = this.eventos.map((e) => `${e.timestampIso} [${e.origem}] ${e.tipo} — ${e.rotulo}`).join('\n');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(texto);
      }
    } catch {
      // ignora
    }
  }

  async compartilharArquivos(): Promise<void> {
    const texto = JSON.stringify({
      sessao: this.sessao,
      equipamentos: this.identificacao.exportar(),
    }, null, 2);
    const file = new File([texto], `autolink-detalhes-tecnicos-${this.sessao?.id ?? 'sem-id'}.json`, { type: 'application/json' });
    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          text: texto,
          title: 'Detalhes técnicos AutoLink',
          dialogTitle: 'Compartilhar detalhes técnicos',
        });
      } else {
        const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
        if (nav.share) {
          await nav.share({ files: [file], title: 'Detalhes técnicos AutoLink' });
        } else {
          const url = URL.createObjectURL(file);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.name;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.appLog.log(`falha ao compartilhar detalhes: ${msg}`, 'erro');
    }
  }

  origemLabel(origem: string): string {
    const map: Record<string, string> = {
      api: 'Coletado por API',
      manual: 'Informado pelo usuário',
      log: 'Importado de arquivo',
      indisponivel: 'Não disponível',
    };
    return map[origem] ?? origem;
  }

  evidenciaLabel(evidencia: string): string {
    const map: Record<string, string> = {
      observado: 'Observado',
      derivado: 'Derivado',
      indisponivel: 'Indisponível',
    };
    return map[evidencia] ?? evidencia;
  }

  novoDiagnostico(): void {
    this.router.navigate(['/inicio']);
  }
}
