import { Injectable } from '@angular/core';
import { AppLogService } from './app-log.service';
import { UsbDeviceInfo, UsbAccessoryInfo } from './models';

export interface EquipamentoDetectado {
  id: string;
  tipo: 'usb_dispositivo' | 'usb_acessorio' | 'bluetooth' | 'rede' | 'adaptador';
  origem: 'api' | 'manual' | 'indisponivel';
  valor: any;
  detalhe?: string;
  horario: string;
  equipamentoPertence: 'telefone' | 'central' | 'adaptador' | 'desconhecido';
  evidencia: 'observado' | 'derivado' | 'indisponivel';
}

/**
 * Provedor de identificação de equipamentos.
 * Apenas registra o que as APIs públicas expõem — nunca inventa dados,
 * nunca presume que MP5 é Android, nunca confunde adaptador com central.
 */
@Injectable({ providedIn: 'root' })
export class IdentificacaoService {
  equipamentos: EquipamentoDetectado[] = [];

  constructor(private appLog: AppLogService) {}

  /** Registra um dispositivo USB enumerado publicamente. */
  registrarUsbDispositivo(d: UsbDeviceInfo): void {
    const equip: EquipamentoDetectado = {
      id: `usb:${d.vid}:${d.pid}`,
      tipo: 'usb_dispositivo',
      origem: 'api',
      valor: {
        vid: d.vid,
        pid: d.pid,
        produto: d.produto,
        fabricante: d.fabricante,
        classe: d.classe,
        subclasse: d.subclasse,
        protocolo: d.protocolo,
        versao: d.versao,
        serial: d.serial,
        interfaces: d.interfaces?.map((i) => ({
          id: i.id,
          classe: i.classe,
          subclasse: i.subclasse,
          protocolo: i.protocolo,
          endpoints: i.endpoints.length,
        })),
      },
      detalhe: `Dispositivo USB enumerado via UsbManager (somente leitura).`,
      horario: new Date().toISOString(),
      equipamentoPertence: 'desconhecido',
      evidencia: 'observado',
    };
    this.equipamentos.push(equip);
    this.appLog.log(`equipamento USB observado: VID ${d.vid} / PID ${d.pid}`, 'info');
  }

  /** Registra um acessório USB enumerado publicamente. */
  registrarUsbAcessorio(a: UsbAccessoryInfo): void {
    const equip: EquipamentoDetectado = {
      id: `usb-acessorio:${a.fabricante ?? ''}|${a.modelo ?? ''}`,
      tipo: 'usb_acessorio',
      origem: 'api',
      valor: {
        fabricante: a.fabricante,
        modelo: a.modelo,
        descricao: a.descricao,
        versao: a.versao,
        uri: a.uri,
      },
      detalhe: 'Acessório USB listado via UsbManager (somente leitura).',
      horario: new Date().toISOString(),
      equipamentoPertence: 'desconhecido',
      evidencia: 'observado',
    };
    this.equipamentos.push(equip);
    this.appLog.log(`acessório USB observado: ${a.modelo ?? 'sem nome'}`, 'info');
  }

  /** Registra um adaptador intermediário (ex: Onex, Vision). Não confunde com central. */
  registrarAdaptador(nome: string, tipo: 'bluetooth' | 'rede', detalhe: string): void {
    const equip: EquipamentoDetectado = {
      id: `adaptador:${nome}`,
      tipo: tipo === 'bluetooth' ? 'bluetooth' : 'rede',
      origem: 'api',
      valor: { nome, tipo, detalhe },
      detalhe,
      horario: new Date().toISOString(),
      equipamentoPertence: 'adaptador',
      evidencia: 'observado',
    };
    this.equipamentos.push(equip);
    this.appLog.log(`adaptador observado: ${nome} (${tipo})`, 'info');
  }

  /** Registra que um campo não está exposto pela conexão atual. */
  registrarIndisponivel(campo: string, motivo: string): void {
    const equip: EquipamentoDetectado = {
      id: `indisponivel:${campo}`,
      tipo: 'rede',
      origem: 'indisponivel',
      valor: null,
      detalhe: `Não exposto pela conexão atual: ${motivo}`,
      horario: new Date().toISOString(),
      equipamentoPertence: 'desconhecido',
      evidencia: 'indisponivel',
    };
    this.equipamentos.push(equip);
    this.appLog.log(`campo indisponível: ${campo} — ${motivo}`, 'aviso');
  }

  /** Equipamentos agrupados por tipo de pertinência. */
  get porCentral(): EquipamentoDetectado[] {
    return this.equipamentos.filter((e) => e.equipamentoPertence === 'central');
  }

  get porAdaptador(): EquipamentoDetectado[] {
    return this.equipamentos.filter((e) => e.equipamentoPertence === 'adaptador');
  }

  get porTelefone(): EquipamentoDetectado[] {
    return this.equipamentos.filter((e) => e.equipamentoPertence === 'telefone');
  }

  get desconhecidos(): EquipamentoDetectado[] {
    return this.equipamentos.filter((e) => e.equipamentoPertence === 'desconhecido');
  }

  limpar(): void {
    this.equipamentos = [];
  }

  /** Exporta para serialização em detected-equipment.json. */
  exportar(): EquipamentoDetectado[] {
    return [...this.equipamentos];
  }
}
