import { Injectable } from '@angular/core';
import { AppLogService } from './app-log.service';
import { Campo, PacoteInfo, PhoneInfo } from './models';
import { AutoLink, pluginNativoDisponivel, RawAppVersions, RawPacote, RawPhoneInfo } from './plugin';

const PACOTES = ['com.google.android.gms', 'com.google.android.projection.gearhead'];

function indisponivel<T>(detalhe: string): Campo<T> {
  return { valor: null, origem: 'indisponivel', detalhe };
}

/**
 * Painel do telefone: coleta por APIs públicas (Build + PackageManager).
 * Falha de consulta, pacote ausente e modo navegador viram 'indisponivel'
 * com o motivo explícito — nunca é inventado valor.
 */
@Injectable({ providedIn: 'root' })
export class DeviceInfoService {
  constructor(private appLog: AppLogService) {}

  async coletar(): Promise<PhoneInfo> {
    const base: PhoneInfo = {
      fabricante: indisponivel('não coletado'),
      modelo: indisponivel('não coletado'),
      android: indisponivel('não coletado'),
      sdk: indisponivel('não coletado'),
      build: indisponivel('não coletado'),
      patch: indisponivel('não coletado'),
      gms: null,
      gearhead: null,
      coletadoEm: null,
      erroGeral: null,
    };

    if (!pluginNativoDisponivel()) {
      base.erroGeral = 'Plugin nativo indisponível no navegador — abra o app instalado no Android.';
      this.appLog.log('painel do telefone: plugin nativo indisponível', 'aviso');
      return base;
    }

    try {
      const raw: RawPhoneInfo = await AutoLink.getPhoneInfo();
      base.fabricante = campoApi(raw.fabricante, 'Build.MANUFACTURER');
      base.modelo = campoApi(raw.modelo, 'Build.MODEL');
      base.android = campoApi(raw.android, 'Build.VERSION.RELEASE');
      base.sdk = raw.sdk !== undefined && raw.sdk !== null
        ? { valor: raw.sdk, origem: 'api', detalhe: 'Build.VERSION.SDK_INT' }
        : indisponivel('SDK não retornado');
      base.build = campoApi(raw.build, 'Build.DISPLAY');
      base.patch = raw.patch
        ? { valor: raw.patch, origem: 'api', detalhe: 'Build.VERSION.SECURITY_PATCH' }
        : indisponivel('patch indisponível nesta versão do Android');
      base.coletadoEm = raw.coletadoEm ? new Date(raw.coletadoEm).toISOString() : new Date().toISOString();
    } catch (e) {
      base.erroGeral = `Falha ao coletar dados do telefone: ${mensagemErro(e)}`;
      this.appLog.log(`painel do telefone: ${base.erroGeral}`, 'erro');
    }

    try {
      const versoes: RawAppVersions = await AutoLink.getAppVersions({ pacotes: PACOTES });
      base.gms = mapearPacote(versoes.pacotes.find((p) => p.pacote === PACOTES[0]));
      base.gearhead = mapearPacote(versoes.pacotes.find((p) => p.pacote === PACOTES[1]));
    } catch (e) {
      const obs = `Falha ao consultar pacotes: ${mensagemErro(e)}`;
      base.gms = pacoteErro(PACOTES[0], obs);
      base.gearhead = pacoteErro(PACOTES[1], obs);
      this.appLog.log(`painel do telefone: ${obs}`, 'erro');
    }

    return base;
  }
}

function campoApi(valor: string | undefined | null, fonte: string): Campo<string> {
  return valor
    ? { valor, origem: 'api', detalhe: fonte }
    : { valor: null, origem: 'indisponivel', detalhe: `${fonte} não retornou valor` };
}

function mapearPacote(raw: RawPacote | undefined): PacoteInfo | null {
  if (!raw) {
    return pacoteErro('', 'pacote não retornado pela consulta');
  }
  if (!raw.presente) {
    const obs = raw.erro === 'pacote_ausente'
      ? 'pacote ausente neste aparelho'
      : raw.erro ?? 'consulta não retornou o pacote';
    return {
      pacote: raw.pacote,
      presente: false,
      versionName: { valor: null, origem: 'indisponivel', detalhe: obs },
      versionCode: { valor: null, origem: 'indisponivel', detalhe: obs },
      observacao: obs,
    };
  }
  return {
    pacote: raw.pacote,
    presente: true,
    versionName: raw.versionName
      ? { valor: raw.versionName, origem: 'api', detalhe: 'PackageManager' }
      : { valor: null, origem: 'indisponivel', detalhe: 'versionName não informado' },
    versionCode:
      raw.versionCode !== undefined && raw.versionCode !== null
        ? { valor: raw.versionCode, origem: 'api', detalhe: 'PackageManager' }
        : { valor: null, origem: 'indisponivel', detalhe: 'versionCode não informado' },
  };
}

function pacoteErro(pacote: string, obs: string): PacoteInfo {
  return {
    pacote,
    presente: false,
    versionName: { valor: null, origem: 'indisponivel', detalhe: obs },
    versionCode: { valor: null, origem: 'indisponivel', detalhe: obs },
    observacao: obs,
  };
}

function mensagemErro(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
