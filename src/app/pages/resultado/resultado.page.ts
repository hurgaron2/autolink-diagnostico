import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DiagnosticoService } from '../../core/diagnostico.service';
import { Sessao } from '../../core/models';
import { AppLogService } from '../../core/app-log.service';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-resultado',
  templateUrl: './resultado.page.html',
  styleUrls: ['./resultado.page.scss'],
  standalone: false,
})
export class ResultadoPage {
  sessao: Sessao | null = null;
  carregando = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public diagnostico: DiagnosticoService,
    private appLog: AppLogService
  ) {}

  async ionViewWillEnter(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      await this.carregarResultado(id);
    } else if (this.diagnostico.sessao) {
      // Sessão ainda em memória (não foi encerrada)
      this.sessao = this.diagnostico.sessao;
    }
  }

  async carregarResultado(id: string): Promise<void> {
    this.carregando = true;
    try {
      const raw = localStorage.getItem('autolink.diagnostico.historico');
      if (raw) {
        const lista = JSON.parse(raw) as Sessao[];
        this.sessao = lista.find((s) => s.id === id) ?? null;
      }
    } catch {
      this.sessao = null;
    } finally {
      this.carregando = false;
    }
  }

  get concluido(): boolean {
    return this.sessao?.encerradaEm !== null;
  }

  get temLimitacoes(): boolean {
    return this.sessao?.eventos.some((e) => e.tipo === 'erro_coleta') ?? false;
  }

  formatarDuracao(seg: number): string {
    if (seg < 60) {
      return `${seg} s`;
    }
    const min = Math.floor(seg / 60);
    return `${min} min ${seg % 60} s`;
  }

  get duracaoFormatada(): string {
    if (!this.sessao) return '—';
    return this.formatarDuracao(this.duracaoSegundos(this.sessao));
  }

  private duracaoSegundos(s: Sessao): number {
    if (!s) return 0;
    const fim = s.encerradaEm ?? new Date().toISOString();
    const a = Date.parse(s.iniciadaEm);
    const b = Date.parse(fim);
    if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
    return Math.round((b - a) / 1000);
  }

  async compartilhar(): Promise<void> {
    this.carregando = true;
    try {
      const texto = [
        `AutoLink Diagnóstico — Relatório`,
        `Data: ${this.sessao?.iniciadaEm}`,
        `Duração: ${this.duracaoFormatada}`,
        `Eventos: ${this.sessao?.eventos.length ?? 0}`,
        `Estado: ${this.concluido ? 'concluído' : 'interrompido'}`,
        '',
        'Eventos:',
        ...(this.sessao?.eventos.map((e) => `  - ${e.timestampIso} [${e.origem}] ${e.rotulo}`) ?? []),
      ].join('\n');

      const file = new File([texto], `autolink-diagnostico-${this.sessao?.id}.txt`, { type: 'text/plain' });

      if (Capacitor.isNativePlatform()) {
        await Share.share({
          text: texto,
          title: 'Relatório de diagnóstico AutoLink',
          dialogTitle: 'Compartilhar relatório',
        });
      } else {
        const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
        if (nav.share) {
          await nav.share({ files: [file], title: 'Relatório de diagnóstico AutoLink' });
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
      this.appLog.log(`falha ao compartilhar: ${msg}`, 'erro');
    } finally {
      this.carregando = false;
    }
  }

  novoDiagnostico(): void {
    this.router.navigate(['/inicio']);
  }

  verDetalhes(): void {
    this.router.navigate(['/detalhes-tecnicos']);
  }
}
