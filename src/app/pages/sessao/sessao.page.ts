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
  erro: string | null = null;
  processando = false;

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
    await this.executar(() => this.session.iniciar(), 'Sessão iniciada. A linha do tempo começa agora.');
  }

  async encerrar(): Promise<void> {
    await this.executar(() => this.session.encerrar(), 'Sessão encerrada e salva localmente.');
  }

  /** Um único botão que alterna entre iniciar e encerrar conforme o estado da sessão. */
  async alternarSessao(): Promise<void> {
    if (this.session.sessao) {
      await this.encerrar();
    } else {
      await this.iniciar();
    }
  }

  async tentativa(): Promise<void> {
    await this.executar(() => this.session.tentativaConexao(), 'Tentativa de conexão marcada.');
  }

  async erro7(): Promise<void> {
    await this.executar(() => this.session.erro7(), 'Instante do erro 7 marcado.');
  }

  async adicionarObservacao(): Promise<void> {
    const texto = this.novaObservacao;
    if (!texto.trim()) {
      this.mostrar('Escreva a observação antes de adicionar.');
      return;
    }
    await this.executar(
      async () => {
        await this.session.observacao(texto);
        this.novaObservacao = '';
      },
      'Observação adicionada.'
    );
  }

  /** Um toque por vez; o estado é sempre liberado, inclusive quando a chamada falha. */
  private async executar(acao: () => Promise<void>, ok: string): Promise<void> {
    if (this.processando) {
      return;
    }
    this.processando = true;
    try {
      await acao();
      this.erro = null;
      this.mostrar(ok);
    } catch (e) {
      this.erro = `Não foi possível concluir: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      this.processando = false;
    }
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
