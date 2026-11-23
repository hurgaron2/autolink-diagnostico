import { Injectable } from '@angular/core';
import { CampoCentral, Central, Origem } from './models';

const CHAVE = 'autolink.central';

function campo(valor: string, origem: Origem = 'manual'): CampoCentral {
  return { valor, origem, confirmadoPorUsb: false };
}

function centralPadrao(): Central {
  return {
    modelo: campo('Vision 8920CP'),
    app: campo('ZCDP0UIN08_2022/08/04 11:18:52_'),
    cfg: campo('2022/09/08 16:38:25'),
    mcu: campo('ZCD_2021/11/16 10:23'),
    ic: campo('SY'),
    radio: campo('ZT0811'),
    adaptadorModelo: campo('Onex CAR-6517 / HW501'),
    adaptadorApp: campo('code 131 — 2026081801'),
    adaptadorSystem: campo('20251112'),
    adaptadorBt: campo('20240910'),
    foto: null,
    fotoNome: null,
    atualizadoEm: new Date().toISOString(),
  };
}

/** Cadastro manual da central e do adaptador (origem: manual, nunca USB). */
@Injectable({ providedIn: 'root' })
export class CentralService {
  private central: Central;

  constructor() {
    const salvo = this.ler();
    this.central = salvo ?? centralPadrao();
  }

  private ler(): Central | null {
    try {
      const raw = localStorage.getItem(CHAVE);
      if (!raw) {
        return null;
      }
      const obj = JSON.parse(raw) as Central;
      // garante a marcação de origem mesmo com dados antigos
      for (const k of Object.keys(obj) as (keyof Central)[]) {
        const v = obj[k] as unknown;
        if (v && typeof v === 'object' && 'valor' in (v as object)) {
          (v as CampoCentral).confirmadoPorUsb = false;
        }
      }
      return obj;
    } catch {
      return null;
    }
  }

  obter(): Central {
    return this.central;
  }

  atualizar(parcial: Partial<Central>): void {
    this.central = { ...this.central, ...parcial, atualizadoEm: new Date().toISOString() };
    try {
      localStorage.setItem(CHAVE, JSON.stringify(this.central));
    } catch {
      // sem persistência; mantém em memória
    }
  }

  restaurarPadrao(): void {
    this.central = centralPadrao();
    this.atualizar({});
  }
}
