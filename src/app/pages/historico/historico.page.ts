import { Component } from '@angular/core';
import { DiagnosticoService } from '../../core/diagnostico.service';
import { Sessao } from '../../core/models';
import { Router } from '@angular/router';
import { AppLogService } from '../../core/app-log.service';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { StorageService } from '../../core/storage.service';

@Component({
  selector: 'app-historico',
  templateUrl: './historico.page.html',
  styleUrls: ['./historico.page.scss'],
  standalone: false,
})
export class HistoricoPage {
  historico: Sessao[] = [];
  carregando = false;
  excluindoId: string | null = null;
  excluirConfirmado = false;

  constructor(
    public diagnostico: DiagnosticoService,
    private router: Router,
    private appLog: AppLogService,
    private storage: StorageService
  ) {}

  async ionViewWillEnter(): Promise<void> {
    await this.carregarHistorico();
  }

  async carregarHistorico(): Promise<void> {
    this.carregando = true;
    try {
      const raw = localStorage.getItem('autolink.diagnostico.historico');
      this.historico = raw ? (JSON.parse(raw) as Sessao[]) : [];
    } catch {
      this.historico = [];
    } finally {
      this.carregando = false;
    }
  }

  estadoDiagnostico(s: Sessao): string {
    if (s.encerradaEm) {
      return 'concluído';
    }
    return 'interrompido';
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

  async verDetalhes(sessao: Sessao): Promise<void> {
    await this.router.navigate(['/resultado', sessao.id]);
  }

  async compartilhar(sessao: Sessao): Promise<void> {
    this.carregando = true;
    try {
      const texto = [
        `AutoLink Diagnóstico — Relatório`,
        `Data: ${sessao.iniciadaEm}`,
        `Duração: ${this.formatarDuracao(this.duracaoSegundos(sessao))}`,
        `Eventos: ${sessao.eventos.length}`,
        `Estado: ${this.estadoDiagnostico(sessao)}`,
        '',
        'Eventos:',
        ...sessao.eventos.map((e) => `  - ${e.timestampIso} [${e.origem}] ${e.rotulo}`),
      ].join('\n');

      const file = new File([texto], `autolink-diagnostico-${sessao.id}.txt`, { type: 'text/plain' });

      if (Capacitor.isNativePlatform()) {
        // No Android, usa o plugin Share do Capacitor com URI do arquivo
        // Como não temos o arquivo salvo, usamos share simples
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

  async excluir(sessao: Sessao): Promise<void> {
    if (!confirm('Excluir este diagnóstico? Os arquivos salvos serão removidos.')) {
      return;
    }
    this.excluindoId = sessao.id;
    try {
      const raw = localStorage.getItem('autolink.diagnostico.historico');
      if (!raw) return;
      const lista = JSON.parse(raw) as Sessao[];
      const filtrada = lista.filter((s) => s.id !== sessao.id);
      localStorage.setItem('autolink.diagnostico.historico', JSON.stringify(filtrada));
      await this.carregarHistorico();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.appLog.log(`falha ao excluir: ${msg}`, 'erro');
    } finally {
      this.excluindoId = null;
    }
  }

  get dataFormatada(): (s: Sessao) => string {
    return (s: Sessao) => s.iniciadaEm.slice(0, 16).replace('T', ' ');
  }
}
