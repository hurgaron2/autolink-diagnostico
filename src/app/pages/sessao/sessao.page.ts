import { Component } from '@angular/core';
import { Evento, Sessao } from '../../core/models';
import { SessionService } from '../../core/session.service';

@Component({
  selector: 'app-sessao',
  templateUrl: './sessao.page.html',
  styleUrls: ['./sessao.page.scss'],
  standalone: false,
})
export class SessaoPage {
  novaObservacao = '';
  mensagem: string | null = null;

  constructor(public session: SessionService) {}

  get sessao(): Sessao | null {
    return this.session.sessao;
  }

  get eventos(): Evento[] {
    return this.session.sessao?.eventos ?? [];
  }

  get lacunas() {
    return this.session.sessao?.lacunas ?? [];
  }

  async iniciar(): Promise<void> {
    await this.session.iniciar();
    this.mostrar('Sessão iniciada. A linha do tempo começa agora.');
  }

  async encerrar(): Promise<void> {
    await this.session.encerrar();
    this.mostrar('Sessão encerrada e salva localmente.');
  }

  async tentativa(): Promise<void> {
    await this.session.tentativaConexao();
    this.mostrar('Tentativa de conexão marcada.');
  }

  async erro7(): Promise<void> {
    await this.session.erro7();
    this.mostrar('Instante do erro 7 marcado.');
  }

  async adicionarObservacao(): Promise<void> {
    const texto = this.novaObservacao;
    if (!texto.trim()) {
      this.mostrar('Escreva a observação antes de adicionar.');
      return;
    }
    await this.session.observacao(texto);
    this.novaObservacao = '';
    this.mostrar('Observação adicionada.');
  }

  corDoEvento(tipo: Evento['tipo']): string {
    switch (tipo) {
      case 'erro7':
        return 'danger';
      case 'tentativa_conexao':
        return 'warning';
      case 'usb_conectado':
        return 'success';
      case 'usb_desconectado':
        return 'medium';
      case 'lacuna_inicio':
      case 'lacuna_fim':
        return 'tertiary';
      default:
        return 'primary';
    }
  }

  trackEvento(_: number, e: Evento): string {
    return e.id;
  }

  private mostrar(msg: string): void {
    this.mensagem = msg;
    setTimeout(() => {
      if (this.mensagem === msg) {
        this.mensagem = null;
      }
    }, 3000);
  }
}
