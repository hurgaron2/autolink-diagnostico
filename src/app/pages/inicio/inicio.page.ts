import { Component } from '@angular/core';
import { DiagnosticoService } from '../../core/diagnostico.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-inicio',
  templateUrl: './inicio.page.html',
  styleUrls: ['./inicio.page.scss'],
  standalone: false,
})
export class InicioPage {
  constructor(public diagnostico: DiagnosticoService, private router: Router) {}

  get temUltimoDiagnostico(): boolean {
    return this.diagnostico.sessao !== null || this.ultimoDiagnostico !== null;
  }

  get ultimoDiagnostico() {
    try {
      const raw = localStorage.getItem('autolink.diagnostico.historico');
      if (!raw) return null;
      const lista = JSON.parse(raw);
      return lista.length > 0 ? lista[0] : null;
    } catch {
      return null;
    }
  }

  async iniciarDiagnostico(): Promise<void> {
    if (this.diagnostico.sessao) {
      // Já tem sessão ativa, vai para tela de diagnóstico em andamento
      await this.router.navigate(['/diagnostico']);
      return;
    }
    await this.diagnostico.iniciar();
    await this.router.navigate(['/diagnostico']);
  }

  async continuarDiagnostico(): Promise<void> {
    if (this.diagnostico.sessao) {
      await this.router.navigate(['/diagnostico']);
      return;
    }
    const ultimo = this.ultimoDiagnostico;
    if (ultimo) {
      await this.router.navigate(['/resultado', ultimo.id]);
    }
  }

  formatarDuracao(seg: number): string {
    if (seg < 60) {
      return `${seg} s`;
    }
    const min = Math.floor(seg / 60);
    return `${min} min ${seg % 60} s`;
  }

  get ultimoDiagnosticoFormatado(): string {
    if (!this.ultimoDiagnostico) return '';
    const fim = this.ultimoDiagnostico.encerradaEm ?? this.ultimoDiagnostico.iniciadaEm;
    const dur = this.duracaoSegundos(this.ultimoDiagnostico);
    return `${this.ultimoDiagnostico.iniciadaEm.slice(0, 16)} · ${dur} s · ${this.ultimoDiagnostico.eventos.length} evento(s)`;
  }

  private duracaoSegundos(s: any): number {
    if (!s) return 0;
    const fim = s.encerradaEm ?? new Date().toISOString();
    const a = Date.parse(s.iniciadaEm);
    const b = Date.parse(fim);
    if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
    return Math.round((b - a) / 1000);
  }
}
