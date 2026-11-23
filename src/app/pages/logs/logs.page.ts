import { Component } from '@angular/core';
import { AppLogService } from '../../core/app-log.service';
import { LogImportService } from '../../core/log-import.service';
import { LogImportado, LogMatch } from '../../core/models';

const MAX_EXIBIDOS = 100;

@Component({
  selector: 'app-logs',
  templateUrl: './logs.page.html',
  styleUrls: ['./logs.page.scss'],
  standalone: false,
})
export class LogsPage {
  mensagem: string | null = null;
  erro: string | null = null;
  processando = false;
  analisando = false;

  constructor(public logs: LogImportService, public appLog: AppLogService) {}

  get internos(): string[] {
    return this.appLog
      .obter()
      .slice(-60)
      .map((l) => `${l.ts} [${l.nivel.toUpperCase()}] ${l.msg}`);
  }

  get matchesExibidos(): LogMatch[] {
    return this.logs.matches.slice(0, MAX_EXIBIDOS);
  }

  get resumoTermos(): { termo: string; total: number }[] {
    const m = new Map<string, number>();
    for (const x of this.logs.matches) {
      m.set(x.termo, (m.get(x.termo) ?? 0) + 1);
    }
    return [...m.entries()]
      .map(([termo, total]) => ({ termo, total }))
      .sort((a, b) => b.total - a.total);
  }

  async onArquivo(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) {
      return;
    }
    this.processando = true;
    this.erro = null;
    this.mensagem = null;
    try {
      const resultados: string[] = [];
      for (const file of Array.from(files)) {
        const r = await this.logs.importarArquivo(file);
        resultados.push(r.mensagem);
        if (!r.ok) {
          this.erro = resultados.join(' | ');
        }
      }
      if (!this.erro) {
        this.mensagem = resultados.join(' | ');
      }
    } finally {
      this.processando = false;
      input.value = '';
    }
  }

  async analisar(): Promise<void> {
    this.analisando = true;
    try {
      await this.logs.analisarTodos();
      this.mensagem = `Análise concluída: ${this.logs.matches.length} ocorrência(s). Evidência, não diagnóstico.`;
    } finally {
      this.analisando = false;
    }
  }

  alternarInclusao(id: string): void {
    this.logs.alternarInclusao(id);
  }

  async excluir(log: LogImportado): Promise<void> {
    await this.logs.excluir(log.id);
    this.mensagem = `"${log.nome}" excluído do dispositivo.`;
  }

  trackLog(_: number, l: LogImportado): string {
    return l.id;
  }

  trackMatch(_: number, m: LogMatch): string {
    return `${m.arquivoId}:${m.linha}:${m.termo}`;
  }
}
