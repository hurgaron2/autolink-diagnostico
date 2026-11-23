import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { AppLogService } from '../../core/app-log.service';
import { DeviceInfoService } from '../../core/device-info.service';
import { LogImportService } from '../../core/log-import.service';
import { Origem, PhoneInfo, Sessao } from '../../core/models';
import { SessionService } from '../../core/session.service';
import { UsbService } from '../../core/usb.service';

export interface LinhaInfo {
  rotulo: string;
  valor: string;
  origem: Origem;
  detalhe?: string;
}

@Component({
  selector: 'app-visao-geral',
  templateUrl: './visao-geral.page.html',
  styleUrls: ['./visao-geral.page.scss'],
  standalone: false,
})
export class VisaoGeralPage implements OnInit {
  phone: PhoneInfo | null = null;
  carregando = false;
  aviso: string | null = null;

  constructor(
    private device: DeviceInfoService,
    public session: SessionService,
    public usb: UsbService,
    public logs: LogImportService,
    public appLog: AppLogService,
    // Sem zone.js o app é zoneless: uma conclusão assíncrona fora de um evento
    // Angular não agenda nova verificação de mudanças (botão ficaria em "Coletando…" para sempre).
    private cdr: ChangeDetectorRef
  ) {}

  get sessaoAtiva(): Sessao | null {
    return this.session.sessao;
  }

  get resumoUsb(): string {
    return this.usb.resumo(this.usb.snapshotAtual);
  }

  ngOnInit(): void {
    void this.atualizar();
  }

  async atualizar(): Promise<void> {
    this.carregando = true;
    this.aviso = null;
    try {
      this.phone = await this.device.coletar();
      this.aviso = this.phone.erroGeral;
    } catch (e) {
      this.aviso = `Falha na coleta: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      this.carregando = false;
      this.cdr.markForCheck();
    }
  }

  get linhas(): LinhaInfo[] {
    const p = this.phone;
    if (!p) {
      return [];
    }
    return [
      {
        rotulo: 'Fabricante / modelo',
        valor: `${p.fabricante.valor ?? '—'} ${p.modelo.valor ?? '—'}`.trim(),
        origem: p.modelo.origem,
        detalhe: p.modelo.detalhe,
      },
      {
        rotulo: 'Android / SDK',
        valor: `${p.android.valor ?? '—'} (SDK ${p.sdk.valor ?? '—'})`,
        origem: p.android.origem,
        detalhe: p.android.detalhe,
      },
      { rotulo: 'Build', valor: p.build.valor ?? '—', origem: p.build.origem, detalhe: p.build.detalhe },
      {
        rotulo: 'Patch de segurança',
        valor: p.patch.valor ?? 'indisponível',
        origem: p.patch.origem,
        detalhe: p.patch.detalhe,
      },
      {
        rotulo: 'Google Play Services',
        valor: formatarPacote(p.gms),
        origem: p.gms?.versionName.origem ?? 'indisponivel',
        detalhe: p.gms?.observacao ?? p.gms?.versionName.detalhe,
      },
      {
        rotulo: 'Android Auto',
        valor: formatarPacote(p.gearhead),
        origem: p.gearhead?.versionName.origem ?? 'indisponivel',
        detalhe: p.gearhead?.observacao ?? p.gearhead?.versionName.detalhe,
      },
    ];
  }

  get ultimaColeta(): string | null {
    return this.phone?.coletadoEm ?? null;
  }
}

function formatarPacote(p: { presente: boolean; versionName: { valor: string | null }; versionCode: { valor: number | null } } | null): string {
  if (!p) {
    return 'não coletado';
  }
  if (!p.presente) {
    return 'pacote ausente neste aparelho';
  }
  const vn = p.versionName.valor ?? '?';
  const vc = p.versionCode.valor;
  return vc !== null && vc !== undefined ? `${vn} (code ${vc})` : vn;
}
