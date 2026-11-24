import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import JSZip from 'jszip';
import { AppLogService } from './app-log.service';
import { CentralService } from './central.service';
import { DeviceInfoService } from './device-info.service';
import { Evento, PhoneInfo, SCHEMA_VERSION, Sessao, UsbSnapshot } from './models';
import { DiagnosticoService } from './diagnostico.service';
import { IdentificacaoService } from './identificacao.service';
import { LogImportService } from './log-import.service';
import { AVISO_SANITIZACAO, sanitizar } from './sanitize';
import { StorageService } from './storage.service';
import { StoragePublicService } from './storage-public.service';
import { UsbService } from './usb.service';

const APP_NOME = 'AutoLink Diagnóstico';
const APP_ID = 'com.autolink.diagnostico';
const APP_VERSAO = '1.5';

export interface OpcoesExport {
  incluirLogs: boolean;
  sanitizar: boolean;
  /** ID da sessão aberta na tela; quando ausente usa a ativa/última (legado). */
  idSessao?: string;
}

export interface ArquivosExport {
  arquivos: Record<string, string>;
  avisos: string[];
}

export type EtapaExport = 'snapshot' | 'serializacao' | 'compactacao' | 'gravacao' | 'compartilhamento';

export interface RegistroEtapa {
  etapa: EtapaExport;
  inicioEm: string;
  fimEm: string | null;
  duracaoMs: number | null;
  ok: boolean;
  falha: string | null;
}

export interface EstadoExport {
  etapaAtual: EtapaExport | null;
  registros: RegistroEtapa[];
  gerando: boolean;
  erro: string | null;
  arquivoGerado: string | null;
  uri: string | null;
}

/**
 * Montagem do pacote de diagnóstico. Tudo local: sem servidor, sem
 * analytics, sem upload. Compartilhamento apenas por ação explícita.
 */
@Injectable({ providedIn: 'root' })
export class ExportService {
  estado: EstadoExport = {
    etapaAtual: null,
    registros: [],
    gerando: false,
    erro: null,
    arquivoGerado: null,
    uri: null,
  };

  private readonly TIMEOUT_ETAPA_MS = 30_000;

  constructor(
    private device: DeviceInfoService,
    private central: CentralService,
    private diagnostico: DiagnosticoService,
    private usb: UsbService,
    private logs: LogImportService,
    private appLog: AppLogService,
    private storage: StorageService,
    private identificacao: IdentificacaoService,
    private storagePublic: StoragePublicService
  ) {}

  /** Constrói os arquivos do ZIP (testável sem compartilhamento). */
  async construirArquivos(opcoes: OpcoesExport): Promise<ArquivosExport> {
    const avisos: string[] = [
      'Dados da central e do adaptador foram informados manualmente e NÃO foram confirmados por USB.',
      AVISO_SANITIZACAO,
      'Ausência de dispositivo/acessório visível para o aplicativo não é defeito de hardware.',
      'Este pacote é evidência de coleta, não um diagnóstico automático da causa do erro.',
    ];

    if (opcoes.idSessao && !this.diagnostico.obterSessao(opcoes.idSessao)) {
      throw new Error(`Sessão ${opcoes.idSessao} não encontrada no histórico nem entre as sessões ativas.`);
    }

    let phone: PhoneInfo | null = null;
    try {
      phone = await this.device.coletar();
    } catch {
      phone = null;
      avisos.push('Falha ao coletar o painel do telefone para o export.');
    }

    const sessao: Sessao | null = this.diagnostico.obterSessao(opcoes.idSessao);
    if (!sessao) {
      avisos.push('Nenhuma sessão de diagnóstico registrada.');
    }
    if (sessao?.simulacao) {
      avisos.push('SIMULAÇÃO — não representa conexão física. Dados sintéticos de teste de software.');
    }

    const snapshots: UsbSnapshot[] = sessao
      ? this.usb.snapshots.filter((s) => s.sessaoId === sessao.id)
      : this.usb.snapshots;
    // Sessão vinda do histórico pode não ter snapshots em memória (app reiniciado):
    // o snapshotInicial viaja dentro da própria sessão persistida.
    if (sessao && snapshots.length === 0 && sessao.snapshotInicial) {
      snapshots.push(sessao.snapshotInicial);
    }
    if (snapshots.length === 0) {
      avisos.push('Nenhuma enumeração USB registrada.');
    }

    const arquivos: Record<string, string> = {};

    arquivos['manifest.json'] = JSON.stringify(
      {
        schemaVersion: SCHEMA_VERSION,
        geradoEm: new Date().toISOString(),
        app: { nome: APP_NOME, appId: APP_ID, versao: APP_VERSAO },
        sessaoId: sessao?.id ?? null,
        simulacao: !!sessao?.simulacao,
        incluiLogs: opcoes.incluirLogs,
        sanitizado: opcoes.sanitizar,
        avisos,
        arquivos: [
          'manifest.json',
          'device.json',
          'central.json',
          'usb-snapshots.json',
          'timeline.json',
          'app-events.txt',
          'detected-equipment.json',
          'conexoes.jsonl',
          'resumo.txt',
          ...(opcoes.incluirLogs ? ['logs/'] : []),
        ],
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
        sessaoAtiva: this.diagnostico.sessao !== null,
        sessao,
        historicoRecente: this.diagnostico
          .historicoParaExport()
          .filter((s) => !!s.simulacao === !!sessao?.simulacao)
          .slice(0, 5),
        nota: 'monotonicMs ordena eventos mesmo com mudança de relógio; timezoneOffsetMin indica o fuso local.',
      },
      null,
      2
    );

    arquivos['app-events.txt'] = this.appLog.texto() + '\n';

    // detected-equipment.json — equipamentos observados com origem e evidência
    arquivos['detected-equipment.json'] = JSON.stringify(
      {
        origem: 'coletado por API pública (UsbManager) e observação do aplicativo',
        coletadoEm: new Date().toISOString(),
        observacao: 'Equipamentos identificados apenas a partir de metadados públicos disponíveis. '
          + 'Nenhum dado de firmware da central foi lido por USB. Adaptador não é confundido com central.',
        equipamentos: this.identificacao.exportar(),
      },
      null,
      2
    );

    // conexoes.jsonl — linha do tempo de eventos de conexão (USB, Bluetooth, rede, app)
    const conexoes: string[] = [];
    const todosEventos: Evento[] = sessao ? [...sessao.eventos] : [];
    for (const e of todosEventos) {
      if (
        e.tipo === 'usb_conectado' ||
        e.tipo === 'usb_desconectado' ||
        e.tipo === 'diagnostico_iniciado' ||
        e.tipo === 'diagnostico_encerrado' ||
        e.tipo === 'erro_coleta'
      ) {
        conexoes.push(JSON.stringify({
          timestampIso: e.timestampIso,
          tipo: e.tipo,
          rotulo: e.rotulo,
          detalhe: e.detalhe,
          origem: e.origem,
          monotonicMs: e.monotonicMs,
        }));
      }
    }
    arquivos['conexoes.jsonl'] = conexoes.join('\n') + (conexoes.length > 0 ? '\n' : '');

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

  /** Executa uma etapa com registro de duração, timeout e liberação garantida de erro. */
  private async executarEtapa<T>(etapa: EtapaExport, acao: () => Promise<T>): Promise<{ ok: boolean; valor?: T; erro?: string }> {
    const registro: RegistroEtapa = {
      etapa,
      inicioEm: new Date().toISOString(),
      fimEm: null,
      duracaoMs: null,
      ok: false,
      falha: null,
    };
    this.estado.etapaAtual = etapa;
    this.estado.registros.push(registro);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_resolve, rejeitar) => {
      timer = setTimeout(() => rejeitar(new Error(`timeout após ${this.TIMEOUT_ETAPA_MS / 1000} s`)), this.TIMEOUT_ETAPA_MS);
    });
    try {
      const valor = await Promise.race([acao(), timeoutPromise]);
      registro.ok = true;
      return { ok: true, valor };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      registro.falha = msg;
      this.appLog.log(`exportação etapa ${etapa} falhou: ${msg}`, 'erro');
      return { ok: false, erro: msg };
    } finally {
      registro.fimEm = new Date().toISOString();
      registro.duracaoMs = Date.parse(registro.fimEm) - Date.parse(registro.inicioEm);
      if (timer) clearTimeout(timer);
    }
  }

  /** Gera o ZIP e abre o compartilhamento nativo (ou download no navegador). */
  async gerar(opcoes: OpcoesExport): Promise<{ ok: boolean; mensagem: string }> {
    this.estado.gerando = true;
    this.estado.erro = null;
    this.estado.arquivoGerado = null;
    this.estado.uri = null;
    this.estado.registros = [];

    try {
      // 1. Snapshot / montagem dos arquivos
      const r1 = await this.executarEtapa('snapshot', () => this.construirArquivos(opcoes));
      if (!r1.ok) {
        this.estado.erro = `Falha na montagem dos arquivos: ${r1.erro}`;
        return { ok: false, mensagem: this.estado.erro };
      }
      const arquivos = r1.valor?.arquivos ?? {};

      // 2. Serialização / compactação (ZIP)
      const r2 = await this.executarEtapa('compactacao', async () => {
        const zip = new JSZip();
        for (const [nome, conteudo] of Object.entries(arquivos)) {
          zip.file(nome, conteudo as string);
        }
        return zip.generateAsync({ type: 'uint8array' });
      });
      if (!r2.ok || !r2.valor) {
        this.estado.erro = `Falha na compactação do ZIP: ${r2.erro ?? 'sem bytes gerados'}`;
        return { ok: false, mensagem: this.estado.erro };
      }
      const bytes: Uint8Array = r2.valor;
      const nomeArquivo = `autolink-diagnostico-${compactarData()}.zip`;

      // 3. Gravação em Downloads público (apenas nativo)
      let uriPublico: string | null = null;
      let caminhoPublico: string | null = null;
      if (Capacitor.isNativePlatform()) {
        const idSessao = pastaPublicaSessao(this.diagnostico.obterSessao(opcoes.idSessao));
        const dadosBase64 = bytesToBase64(bytes);
        const r3 = await this.executarEtapa('gravacao', () =>
          this.storagePublic.salvar(nomeArquivo, dadosBase64, idSessao)
        );
        if (!r3.ok || !r3.valor) {
          // Falha na gravação pública: preserva ZIP em memória e avisa, mas não bloqueia
          this.appLog.log(`gravação pública falhou: ${r3.valor?.erro ?? r3.erro}`, 'aviso');
          this.estado.erro = `Falha ao gravar em Downloads público: ${r3.valor?.erro ?? r3.erro}`;
          return { ok: false, mensagem: this.estado.erro };
        }
        uriPublico = r3.valor.uri ?? null;
        caminhoPublico = r3.valor.caminho ?? null;
      }

      this.estado.arquivoGerado = nomeArquivo;
      this.estado.uri = uriPublico;

      // 4. Compartilhamento (opcional: se cancelado, não é perda do arquivo)
      if (Capacitor.isNativePlatform() && uriPublico) {
        const r4 = await this.executarEtapa('compartilhamento', () =>
          this.storagePublic.compartilhar(uriPublico)
        );
        if (!r4.ok) {
          // Usuário cancelou ou falha no share: o arquivo continua disponível em Downloads público
          this.appLog.log(`compartilhamento não concluído: ${r4.erro}`, 'aviso');
          this.estado.erro = null;
          return {
            ok: true,
            mensagem: `Pacote gerado em ${caminhoPublico ?? nomeArquivo} (compartilhamento não concluído, arquivo disponível)`,
          };
        }
        this.appLog.log(`diagnóstico exportado (${nomeArquivo}, ${bytes.length} bytes)`, 'info');
        return { ok: true, mensagem: `Pacote gerado e compartilhado: ${nomeArquivo}` };
      }

      // Navegador (dev): compartilhar via Web Share API ou baixar.
      if (!Capacitor.isNativePlatform()) {
        const r5 = await this.executarEtapa('compartilhamento', async () => {
          const file = new File([bytes as unknown as BlobPart], nomeArquivo, { type: 'application/zip' });
          const nav = navigator as Navigator & {
            canShare?: (d: ShareData) => boolean;
            share?: (d: ShareData) => Promise<void>;
          };
          if (nav.share && nav.canShare?.({ files: [file] })) {
            await nav.share({ files: [file], title: 'Exportar diagnóstico AutoLink' });
            return 'compartilhado';
          }
          const url = URL.createObjectURL(file);
          const a = document.createElement('a');
          a.href = url;
          a.download = nomeArquivo;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          return 'baixado';
        });
        if (!r5.ok) {
          this.appLog.log(`compartilhamento não concluído no navegador: ${r5.erro}`, 'aviso');
          return {
            ok: true,
            mensagem: `Pacote gerado: ${nomeArquivo} (compartilhamento não concluído, arquivo disponível)`,
          };
        }

        this.appLog.log(
          `diagnóstico ${r5.valor === 'baixado' ? 'baixado' : 'compartilhado'} via navegador (${nomeArquivo})`,
          'info'
        );
        return { ok: true, mensagem: `Pacote gerado: ${nomeArquivo}` };
      }

      // Sem plataforma nativa e sem URI pública: arquivo só existe em memória
      return {
        ok: true,
        mensagem: `Pacote gerado em memória: ${nomeArquivo} (sem gravação pública nesta plataforma)`,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.estado.erro = msg;
      this.appLog.log(`falha ao exportar: ${msg}`, 'erro');
      return { ok: false, mensagem: `Falha ao exportar: ${msg}` };
    } finally {
      this.estado.gerando = false;
    }
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
    if (sessao?.simulacao) {
      l.push('SIMULAÇÃO — não representa conexão física. Dados sintéticos de teste de software.');
    }
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
}

/** Simulação e captura real nunca compartilham a mesma subpasta pública. */
export function pastaPublicaSessao(sessao: Sessao | null): string {
  if (!sessao) {
    return 'sem-sessao';
  }
  return sessao.simulacao ? `SIMULACAO/${sessao.id}` : sessao.id;
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
