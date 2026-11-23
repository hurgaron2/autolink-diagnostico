import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import JSZip from 'jszip';
import { AppLogService } from './app-log.service';
import { CentralService } from './central.service';
import { DeviceInfoService } from './device-info.service';
import { LogImportService } from './log-import.service';
import { PhoneInfo, SCHEMA_VERSION, Sessao, UsbSnapshot } from './models';
import { AVISO_SANITIZACAO, sanitizar } from './sanitize';
import { SessionService } from './session.service';
import { StorageService } from './storage.service';
import { UsbService } from './usb.service';

const APP_NOME = 'AutoLink Diagnóstico';
const APP_ID = 'com.autolink.diagnostico';
const APP_VERSAO = '0.0.1';

export interface OpcoesExport {
  incluirLogs: boolean;
  sanitizar: boolean;
}

export interface ArquivosExport {
  arquivos: Record<string, string>;
  avisos: string[];
}

/**
 * Montagem do pacote de diagnóstico. Tudo local: sem servidor, sem
 * analytics, sem upload. Compartilhamento apenas por ação explícita.
 */
@Injectable({ providedIn: 'root' })
export class ExportService {
  constructor(
    private device: DeviceInfoService,
    private central: CentralService,
    private session: SessionService,
    private usb: UsbService,
    private logs: LogImportService,
    private appLog: AppLogService,
    private storage: StorageService
  ) {}

  /** Constrói os arquivos do ZIP (testável sem compartilhamento). */
  async construirArquivos(opcoes: OpcoesExport): Promise<ArquivosExport> {
    const avisos: string[] = [
      'Dados da central e do adaptador foram informados manualmente e NÃO foram confirmados por USB.',
      AVISO_SANITIZACAO,
      'Ausência de dispositivo/acessório visível para o aplicativo não é defeito de hardware.',
      'Este pacote é evidência de coleta, não um diagnóstico automático da causa do erro.',
    ];

    let phone: PhoneInfo | null = null;
    try {
      phone = await this.device.coletar();
    } catch {
      phone = null;
      avisos.push('Falha ao coletar o painel do telefone para o export.');
    }

    const sessao: Sessao | null = this.session.sessaoParaExport();
    if (!sessao) {
      avisos.push('Nenhuma sessão de diagnóstico registrada.');
    }

    const snapshots: UsbSnapshot[] = this.usb.snapshots;
    if (snapshots.length === 0) {
      avisos.push('Nenhuma enumeração USB registrada.');
    }

    const arquivos: Record<string, string> = {};

    arquivos['manifest.json'] = JSON.stringify(
      {
        schemaVersion: SCHEMA_VERSION,
        geradoEm: new Date().toISOString(),
        app: { nome: APP_NOME, appId: APP_ID, versao: APP_VERSAO },
        incluiLogs: opcoes.incluirLogs,
        sanitizado: opcoes.sanitizar,
        avisos,
      },
      null,
      2
    );

    arquivos['device.json'] = JSON.stringify(
      {
        origem: 'coletado por API pública no telefone (Build + PackageManager)',
        coletadoEm: new Date().toISOString(),
        painel: phone,
        observacao: 'Nenhum dado de firmware da central foi lido por USB.',
      },
      null,
      2
    );

    const c = this.central.obter();
    arquivos['central.json'] = JSON.stringify(
      {
        origem: 'informado manualmente pelo usuário',
        confirmadoPorUsb: false,
        identificadorAppAviso:
          'Identificador APP transcrito de foto — informado manualmente, não confirmado por USB.',
        central: c,
      },
      null,
      2
    );

    arquivos['usb-snapshots.json'] = JSON.stringify(
      {
        origem: 'coletado por API pública (UsbManager), modo somente leitura',
        observacoes: [
          'Nenhum acessório foi aberto, nenhuma interface reivindicada, nenhum transfer enviado.',
          'Seriais não são coletados por padrão.',
          'Sem filtros de intent no manifest: o app não disputa o Android Auto.',
        ],
        quantidade: snapshots.length,
        snapshots,
      },
      null,
      2
    );

    arquivos['timeline.json'] = JSON.stringify(
      {
        sessaoAtiva: this.session.sessao !== null,
        sessao,
        historicoRecente: this.session.historico.slice(0, 5),
        nota: 'monotonicMs ordena eventos mesmo com mudança de relógio; timezoneOffsetMin indica o fuso local.',
      },
      null,
      2
    );

    arquivos['app-events.txt'] = this.appLog.texto() + '\n';

    arquivos['resumo.txt'] = this.resumoLegivel(phone, sessao, snapshots, opcoes, avisos);

    if (opcoes.incluirLogs) {
      const selecionados = this.logs.logsSelecionados();
      if (selecionados.length === 0) {
        avisos.push('Exportação de logs marcada, mas nenhum log foi marcado para inclusão.');
      }
      for (const meta of selecionados) {
        const texto = await this.logs.conteudo(meta.id);
        if (texto === null) {
          avisos.push(`Log "${meta.nome}" não pôde ser lido e ficou de fora.`);
          continue;
        }
        const final = opcoes.sanitizar ? sanitizar(texto).texto : texto;
        if (!opcoes.sanitizar) {
          avisos.push(`"${meta.nome}" incluído SEM sanitização — contém dados pessoais.`);
        }
        const base = nomeSeguro(meta.nome);
        const chave = `logs/${/\.(txt|log)$/i.test(base) ? base : `${base}.txt`}`;
        arquivos[chave] = final + (final.endsWith('\n') ? '' : '\n');
      }
    }

    return { arquivos, avisos };
  }

  private resumoLegivel(
    phone: PhoneInfo | null,
    sessao: Sessao | null,
    snapshots: UsbSnapshot[],
    opcoes: OpcoesExport,
    avisos: string[]
  ): string {
    const l: string[] = [];
    l.push(`${APP_NOME} — pacote de diagnóstico`);
    l.push(`Gerado em: ${new Date().toISOString()}`);
    l.push(`Esquema: v${SCHEMA_VERSION} | Logs incluídos: ${opcoes.incluirLogs ? 'sim' : 'não'} | Sanitizado: ${opcoes.sanitizar ? 'sim' : 'NÃO'}`);
    l.push('');
    l.push('== TELEFONE (origem: API) ==');
    if (phone) {
      l.push(`Fabricante/modelo: ${phone.fabricante.valor ?? '?'} ${phone.modelo.valor ?? '?'}`);
      l.push(`Android: ${phone.android.valor ?? '?'} (SDK ${phone.sdk.valor ?? '?'})`);
      l.push(`Build: ${phone.build.valor ?? '?'} | Patch: ${phone.patch.valor ?? 'indisponível'}`);
      l.push(
        `Play Services: ${
          phone.gms?.presente
            ? `${phone.gms.versionName.valor ?? '?'} (${phone.gms.versionCode.valor ?? '?'})`
            : `ausente/indisponível — ${phone.gms?.observacao ?? ''}`
        }`
      );
      l.push(
        `Android Auto: ${
          phone.gearhead?.presente
            ? `${phone.gearhead.versionName.valor ?? '?'} (${phone.gearhead.versionCode.valor ?? '?'})`
            : `ausente/indisponível — ${phone.gearhead?.observacao ?? ''}`
        }`
      );
      if (phone.erroGeral) {
        l.push(`Erro na coleta: ${phone.erroGeral}`);
      }
    } else {
      l.push('indisponível');
    }
    l.push('');
    l.push('== CENTRAL E ADAPTADOR (origem: manual, não confirmado por USB) ==');
    const c = this.central.obter();
    l.push(`Central: ${c.modelo.valor} | APP: ${c.app.valor} | MCU: ${c.mcu.valor} | Radio: ${c.radio.valor}`);
    l.push(`Adaptador: ${c.adaptadorModelo.valor} | APP ${c.adaptadorApp.valor} | System ${c.adaptadorSystem.valor} | BT ${c.adaptadorBt.valor}`);
    l.push('');
    l.push('== USB (origem: API, modo somente leitura) ==');
    const ultimo = snapshots[0];
    l.push(ultimo ? `Última enumeração: ${ultimo.capturadoEm}` : 'Nenhuma enumeração registrada.');
    if (ultimo) {
      l.push(
        ultimo.dispositivos.length === 0 && ultimo.acessorios.length === 0
          ? 'Sem dispositivo/acessório visível para este aplicativo (não é conclusão sobre a central).'
          : `Dispositivos: ${ultimo.dispositivos.length} | Acessórios: ${ultimo.acessorios.length}`
      );
      for (const d of ultimo.dispositivos) {
        l.push(`  - VID ${d.vid} PID ${d.pid} ${d.produto ?? ''} ${d.fabricante ?? ''}`.trim());
      }
      for (const a of ultimo.acessorios) {
        l.push(`  - Acessório ${a.fabricante ?? ''} ${a.modelo ?? ''} ${a.versao ?? ''}`.trim());
      }
    }
    l.push('');
    l.push('== LINHA DO TEMPO ==');
    if (sessao) {
      l.push(`Sessão ${sessao.id} | iniciada ${sessao.iniciadaEm} | encerrada ${sessao.encerradaEm ?? 'EM ANDAMENTO'}`);
      for (const e of sessao.eventos) {
        l.push(
          `  ${e.timestampIso} [${e.origem}] ${e.rotulo}${e.detalhe ? ` — ${e.detalhe}` : ''} (mono ${e.monotonicMs} ms)`
        );
      }
      if (sessao.lacunas.length > 0) {
        l.push('  Lacunas de observação:');
        for (const g of sessao.lacunas) {
          l.push(`    ${g.inicioIso} → ${g.fimIso ?? '(em aberto)'} — ${g.motivo}`);
        }
      }
    } else {
      l.push('Nenhuma sessão registrada.');
    }
    l.push('');
    l.push('== AVISOS ==');
    for (const a of avisos) {
      l.push(`  - ${a}`);
    }
    l.push('');
    return l.join('\n');
  }

  /** Gera o ZIP e abre o compartilhamento nativo (ou download no navegador). */
  async gerar(opcoes: OpcoesExport): Promise<{ ok: boolean; mensagem: string }> {
    try {
      const { arquivos } = await this.construirArquivos(opcoes);
      const zip = new JSZip();
      for (const [nome, conteudo] of Object.entries(arquivos)) {
        zip.file(nome, conteudo);
      }
      const bytes = await zip.generateAsync({ type: 'uint8array' });
      const nomeArquivo = `autolink-diagnostico-${compactarData()}.zip`;

      if (Capacitor.isNativePlatform()) {
        const uri = await this.storage.salvarCacheBase64(nomeArquivo, bytesToBase64(bytes));
        if (!uri) {
          return { ok: false, mensagem: 'Falha ao gravar o ZIP no cache do dispositivo.' };
        }
        await Share.share({
          files: [uri],
          title: 'Exportar diagnóstico AutoLink',
          dialogTitle: 'Compartilhar pacote de diagnóstico',
        });
        this.appLog.log(`diagnóstico exportado (${nomeArquivo}, ${bytes.length} bytes)`, 'info');
        return { ok: true, mensagem: `Pacote gerado: ${nomeArquivo}` };
      }

      // Navegador (dev): compartilhar via Web Share API ou baixar.
      const file = new File([bytes as unknown as BlobPart], nomeArquivo, { type: 'application/zip' });
      const nav = navigator as Navigator & {
        canShare?: (d: ShareData) => boolean;
        share?: (d: ShareData) => Promise<void>;
      };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: 'Exportar diagnóstico AutoLink' });
        this.appLog.log(`diagnóstico compartilhado via navegador (${nomeArquivo})`, 'info');
        return { ok: true, mensagem: `Pacote gerado: ${nomeArquivo}` };
      }
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeArquivo;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      this.appLog.log(`diagnóstico baixado via navegador (${nomeArquivo})`, 'info');
      return { ok: true, mensagem: `Pacote gerado: ${nomeArquivo}` };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.appLog.log(`falha ao exportar: ${msg}`, 'erro');
      return { ok: false, mensagem: `Falha ao exportar: ${msg}` };
    }
  }
}

export function nomeSeguro(nome: string): string {
  return nome.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 120) || 'log';
}

export function compactarData(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}
