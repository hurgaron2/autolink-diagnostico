import { Component } from '@angular/core';
import { AppLogService } from '../../core/app-log.service';
import { Router } from '@angular/router';
import { StoragePublicService } from '../../core/storage-public.service';
import { CenarioSimulacao, SimulacaoService } from '../../core/simulacao.service';

@Component({
  selector: 'app-ajustes',
  templateUrl: './ajustes.page.html',
  styleUrls: ['./ajustes.page.scss'],
  standalone: false,
})
export class AjustesPage {
  versao = '1.5';
  sanitizar = true;
  ultimaSimulacao: string | null = null;

  readonly cenarios: Array<{ id: CenarioSimulacao; rotulo: string }> = [
    { id: 'usb_conectado', rotulo: 'USB/acessório conectado (metadados sintéticos)' },
    { id: 'usb_desconectado', rotulo: 'Desconexão USB' },
    { id: 'lista_vazia', rotulo: 'Lista de acessórios vazia' },
    { id: 'bluetooth_sem_projecao', rotulo: 'Bluetooth sem projeção' },
    { id: 'rede_sem_projecao', rotulo: 'Rede sem projeção' },
    { id: 'permissao_negada', rotulo: 'Permissão negada' },
    { id: 'falha_coletor', rotulo: 'Falha de inicialização de coletor' },
    { id: 'sessao_interrompida', rotulo: 'Sessão interrompida' },
    { id: 'erro_sintetico', rotulo: 'Erro sintético (teste de processamento)' },
  ];

  constructor(
    private appLog: AppLogService,
    private router: Router,
    private storagePublic: StoragePublicService,
    private simulacao: SimulacaoService
  ) {}

  get modoDesenvolvimento(): boolean {
    return this.simulacao.disponivel;
  }

  get simulacaoAtiva(): boolean {
    return this.simulacao.sessaoSimuladaAtiva;
  }

  async iniciarSimulacao(): Promise<void> {
    try {
      const id = await this.simulacao.iniciar();
      this.ultimaSimulacao = `Sessão sintética ${id} iniciada.`;
    } catch (e) {
      this.ultimaSimulacao = e instanceof Error ? e.message : String(e);
    }
  }

  async executarCenario(id: CenarioSimulacao): Promise<void> {
    try {
      const r = await this.simulacao.executar(id);
      this.ultimaSimulacao = r.mensagem;
    } catch (e) {
      this.ultimaSimulacao = e instanceof Error ? e.message : String(e);
    }
  }

  async encerrarSimulacao(): Promise<void> {
    try {
      const id = await this.simulacao.encerrar();
      if (id) {
        await this.router.navigate(['/resultado', id]);
      }
    } catch (e) {
      this.ultimaSimulacao = e instanceof Error ? e.message : String(e);
    }
  }

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
