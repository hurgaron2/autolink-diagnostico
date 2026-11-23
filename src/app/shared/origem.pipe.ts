import { Pipe, PipeTransform } from '@angular/core';
import { Origem } from '../core/models';

@Pipe({ name: 'origem', standalone: false })
export class OrigemPipe implements PipeTransform {
  transform(valor: Origem | undefined | null): string {
    switch (valor) {
      case 'api':
        return 'API';
      case 'log':
        return 'Log importado';
      case 'manual':
        return 'Manual';
      case 'indisponivel':
        return 'Indisponível';
      default:
        return '—';
    }
  }
}
