import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DiagnosticoService } from '../../core/diagnostico.service';
import { ExportService } from '../../core/export.service';
import { Sessao } from '../../core/models';
import { AppLogService } from '../../core/app-log.service';

@Component({
  selector: 'app-resultado',
  templateUrl: './resultado.page.html',
  styleUrls: ['./resultado.page.scss'],
  standalone: false,
})
export class ResultadoPage implements OnInit {
  sessao: Sessao | null = null;
  carregando = false;
  erroCarregamento: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public diagnostico: DiagnosticoService,
    private exportService: ExportService,
    private appLog: AppLogService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    void this.ionViewWillEnter();
  }

  async ionViewWillEnter(): Promise<void> {
    this.erroCarregamento = null;
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id.length > 0) {
      await this.carregarResultado(id);
    } else {
      // Sem id na rota: tenta usar a sessão ativa ou a última do histórico.
      if (this.diagnostico.sessao) {
        this.sessao = this.diagnostico.sessao;
      } else {
        const historico = this.diagnostico.historicoParaExport();
        if (historico.length > 0) {
          this.sessao = historico[0];
        } else {
          this.erroCarregamento =
            'Nenhum diagnóstico encontrado. Inicie um novo diagnóstico na tela Início.';
        }
      }
    }
  }

  async carregarResultado(id: string): Promise<void> {
    this.carregando = true;
    this.erroCarregamento = null;
    try {
      const historico = this.diagnostico.historicoParaExport();
      this.sessao = historico.find((s) => s.id === id) ?? null;
      if (!this.sessao) {
        this.erroCarregamento = 'Diagnóstico não encontrado no histórico.';
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.erroCarregamento = `Falha ao carregar diagnóstico: ${msg}`;
      this.appLog.log(`falha ao carregar diagnóstico: ${msg}`, 'erro');
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

  get temColetores(): boolean {
    if (!this.sessao) return false;
    return this.sessao.eventos.some(
      (e) => e.tipo === 'collector_started' || e.tipo === 'collector_failed'
    );
  }

  get temSnapshot(): boolean {
    if (!this.sessao) return false;
    return this.sessao.eventos.some((e) => e.tipo === 'initial_snapshot');
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

  get dataFormatada(): string {
    if (!this.sessao) return '—';
    return this.sessao.iniciadaEm.slice(0, 16).replace('T', ' ');
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
    if (!this.sessao) {
      this.erroCarregamento = 'Não há diagnóstico para compartilhar.';
      return;
    }
    this.carregando = true;
    this.erroCarregamento = null;
    try {
      const r = await this.exportService.gerar({
        incluirLogs: false,
        sanitizar: true,
      });
      if (r.ok) {
        this.appLog.log(`relatório compartilhado: ${r.mensagem}`, 'info');
      } else {
        this.erroCarregamento = r.mensagem;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.erroCarregamento = `Falha ao gerar relatório: ${msg}`;
      this.appLog.log(`falha ao gerar relatório: ${msg}`, 'erro');
    } finally {
      this.carregando = false;
      this.cdr.detectChanges();
    }
  }

  novoDiagnostico(): void {
    this.router.navigate(['/inicio']);
  }

  verDetalhes(): void {
    this.router.navigate(['/detalhes-tecnicos']);
  }
}
