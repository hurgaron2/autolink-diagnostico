import { Injectable } from '@angular/core';
import { AppLogLinha } from './models';

const CHAVE = 'autolink.applog';
const MAX = 1000;

/**
 * Log interno do próprio aplicativo (identificado como tal nos exports).
 * Somente eventos deste app — não é log do sistema nem de outros apps.
 */
@Injectable({ providedIn: 'root' })
export class AppLogService {
  private linhas: AppLogLinha[] = [];

  constructor() {
    try {
      const raw = localStorage.getItem(CHAVE);
      if (raw) {
        this.linhas = JSON.parse(raw) as AppLogLinha[];
      }
    } catch {
      this.linhas = [];
    }
    this.log('app iniciado', 'info');
  }

  log(msg: string, nivel: AppLogLinha['nivel'] = 'info'): void {
    this.linhas.push({ ts: new Date().toISOString(), nivel, msg });
    if (this.linhas.length > MAX) {
      this.linhas = this.linhas.slice(-MAX);
    }
    try {
      localStorage.setItem(CHAVE, JSON.stringify(this.linhas));
    } catch {
      // sem espaço no localStorage: mantém apenas em memória
    }
  }

  obter(): AppLogLinha[] {
    return [...this.linhas];
  }

  texto(): string {
    return this.linhas.map((l) => `${l.ts} [${l.nivel.toUpperCase()}] ${l.msg}`).join('\n');
  }

  limpar(): void {
    this.linhas = [];
    try {
      localStorage.removeItem(CHAVE);
    } catch {
      // ignora
    }
  }
}
