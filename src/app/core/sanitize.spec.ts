import { sanitizar } from './sanitize';

describe('sanitize', () => {
  it('oculta e-mails', () => {
    const r = sanitizar('contato joao.silva@exemplo.com enviou');
    expect(r.texto).toContain('[EMAIL]');
    expect(r.texto).not.toContain('joao.silva@exemplo.com');
    expect(r.aplicadas).toContain('email');
  });

  it('oculta endereços MAC', () => {
    const r = sanitizar('MAC 7C:B1:5C:20:0C:92 detectado');
    expect(r.texto).toContain('[MAC]');
    expect(r.texto).not.toContain('7C:B1:5C:20:0C:92');
  });

  it('oculta IPs', () => {
    const r = sanitizar('servidor em 192.168.5.1 respondeu');
    expect(r.texto).toContain('[IP]');
    expect(r.texto).not.toContain('192.168.5.1');
  });

  it('oculta números longos (IMEI/serial numérico)', () => {
    const r = sanitizar('imei 123456789012345 registrado');
    expect(r.texto).toContain('[NUMERO_LONGO]');
    expect(r.texto).not.toContain('123456789012345');
  });

  it('mantém texto sem identificadores intacto', () => {
    const r = sanitizar('Android Auto erro 7 durante a tentativa de conexão');
    expect(r.texto).toBe('Android Auto erro 7 durante a tentativa de conexão');
    expect(r.aplicadas).toEqual([]);
  });

  it('aplica várias regras no mesmo texto', () => {
    const r = sanitizar('de a@b.com com IP 10.0.0.1 e MAC 00:11:22:33:44:55');
    expect(r.aplicadas).toEqual(expect.arrayContaining(['email', 'ipv4', 'mac']));
  });
});
