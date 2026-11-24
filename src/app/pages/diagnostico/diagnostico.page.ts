import { Component } from '@angular/core';
import { DiagnosticoService } from '../../core/diagnostico.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-diagnostico',
  templateUrl: './diagnostico.page.html',
  styleUrls: ['./diagnostico.page.scss'],
  standalone: false,
})
export class DiagnosticoPage {
  constructor(public diagnostico: DiagnosticoService, private router: Router) {}

  get tempoDecorrido(): string {
    return this.formatarDuracao(this.diagnostico.duracaoSegundos);
  }

  get orientacao(): string {
    if (!this.diagnostico.sessao) {
      return 'Inicie o diagnóstico.';
    }
    return 'Agora conecte o celular à central. Continue o teste normalmente. Estamos registrando os eventos disponíveis.';
  }

  get simulacaoAtiva(): boolean {
    return !!this.diagnostico.sessao?.simulacao;
  }

  get temFalhaColeta(): boolean {
    return this.diagnostico.sessao?.eventos.some((e) => e.tipo === 'erro_coleta') ?? false;
  }

  get eventosConexao(): number {
    return this.diagnostico.sessao?.eventos.filter(
      (e) => e.tipo === 'usb_conectado' || e.tipo === 'usb_desconectado'
    ).length ?? 0;
  }

  private formatarDuracao(seg: number): string {
    if (seg < 60) {
      return `${seg} s`;
    }
    const min = Math.floor(seg / 60);
    return `${min} min ${seg % 60} s`;
  }

  async encerrarDiagnostico(): Promise<void> {
    // Captura o ID ANTES de encerrar: encerrar() define this.diagnostico.sessao = null.
    const id = this.diagnostico.sessao?.id;
    if (!id) {
      return;
    }
    await this.diagnostico.encerrar();
    await this.router.navigate(['/resultado', id]);
  }

  async verDetalhesTecnicos(): Promise<void> {
    await this.router.navigate(['/detalhes-tecnicos']);
  }
}
