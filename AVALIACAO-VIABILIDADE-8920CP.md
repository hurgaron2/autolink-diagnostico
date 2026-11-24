# Viabilidade separada — observar projeção vs. ler firmware (Vision 8920CP)

Data: 24/11/2026. Avaliação documental, **sem execução**: sem nova captura, conexão PC–central, instalação, download, root, alteração de configuração ou repetição de buscas nos logs já analisados.

A reanálise dos arquivos existentes está encerrada. Este documento apenas corrige o escopo e separa dois objetivos que não são o mesmo:

- **A. Observar o handshake da projeção** — capturar bytes da sessão Vision–telefone.
- **B. Ler o firmware da central** — obter imagem/backup da memória da unidade.

A ausência de `pcap` explica por que os bytes da negociação ainda não foram vistos. **Não explica, por si só, a ausência de um método de extração de firmware.** Captura de projeção não é pré-requisito para readback, e readback não depende de ter capturado a projeção.

## 1. Correção de expectativa

No caminho A, o telefone esteve no papel de **dispositivo USB** (`current_functions=ACCESSORY`, `host_connected=false`, `sink_power=true` — `ANALISE-PROTOCOLO-LOCAL-8920CP.md:31`). A API `UsbAccessory` expõe os campos informados pelo acessório AOA — `manufacturer`, `model`, `description`, `version`, `uri` e `serial` —, não uma leitura da placa ou da memória da central (`https://developer.android.com/reference/android/hardware/usb/UsbAccessory`). O valor `Sunplus, Inc. | DVD | Autolink` aparece como identidade AOA (`ANALISE-PROTOCOLO-LOCAL-8920CP.md:29`), e a coleta foi passiva, sem abertura de interface ou transfer (`ANALISE-PROTOCOLO-LOCAL-8920CP.md:32`).

Portanto, descritores do **telefone**, mesmo que fossem capturados, descreveriam a configuração gadget/USB do telefone, não o hardware da Vision. A expectativa anterior de que conseguir VID/PID nesse caminho identificaria a central deve ser corrigida: não há evidência local de VID/PID, classes, interfaces ou endpoints da unidade (`ANALISE-PROTOCOLO-LOCAL-8920CP.md:36,88`).

O `usbmon` registra operações nos barramentos USB acompanhados pela pilha USB do sistema onde roda; não é observador remoto de qualquer conexão USB (`https://docs.kernel.org/usb/usbmon.html`). Um PC ligado ao telefone por ADB Wi-Fi não está no caminho elétrico Vision–telefone. No material preservado, `usbmon` aparece apenas como módulo do kernel do telefone com `0` usuários, não como captura salva (`ANALISE-PROTOCOLO-LOCAL-8920CP.md:14,87`).

## 2. Tabela de viabilidade

Legenda: **estabelecido** = há evidência/local de captura que sustenta o ponto; **não estabelecido** = não há método sustentado por evidência no material disponível.

| Objetivo | Método possível | Requisitos | Informação obtida | Limitações | Risco |
|---|---|---|---|---|---|
| A. Observar handshake Vision–telefone | Analisador/tap USB 2.0 high-speed inserido **entre** telefone e Vision | Autorização para manipular o cabo; equipamento de captura USB dedicado; inserção passiva que preserve o papel de host do acessório externo; decodificador do protocolo de projeção para interpretar payload | Control requests AOA (`GETPROTOCOL`, `SENDSTRING`, `START`) e frames de dados no trecho físico; eventualmente registros TLS se trafegarem ali | É o único ponto que enxerga efetivamente o link Vision–telefone; não está disponível entre os equipamentos atuais; bytes brutos podem ficar sem interpretação suficiente | Baixo se passivo; médio se o dispositivo inserido alterar enumeração; exige interrupção física do cabo |
| A. Observar handshake Vision–telefone | `usbmon`/Wireshark no PC por ADB Wi-Fi | PC e telefone já em ADB Wi-Fi; nada mais | Nenhuma sobre o barramento Vision–telefone; veria apenas tráfego IP/ADB do PC | PC não está no barramento USB; `usbmon` não é observador remoto; não enxerga D+/D- | Baixo na operação, alto de conclusão errada se tratado como captura USB |
| A. Observar handshake Vision–telefone | `usbmon` no PC por ADB USB (caminho Onex) | Cabo USB PC–telefone; `usbmon` no PC | Tráfego ADB PC–telefone; não a ligação Vision–telefone | No caminho Onex a ligação com a central é Bluetooth; o PC é outro host USB, não o link da pergunta | Baixo; irrelevante para esta sessão |
| A. Observar handshake Vision–telefone | Monitoramento no lado device do telefone (gadget/tracepoints/`usbmon` se a plataforma suportar) | Acesso elevado/debug, suporte do kernel e autorização explícita; nada foi executado | No máximo operações vistas pelo controlador gadget do telefone, não pelo host Vision | Não demonstrado no material: só há lista de módulo com `0` usuários; a API `UsbAccessory` não expõe pacotes; pode não capturar a sessão por completo | Médio: exigiria permissões/modificações não autorizadas e ainda poderia ser incompleto |
| A. Observar handshake da projeção | Exportações DHU/Bluetooth já preservadas | Nenhuma nova operação | Eventos AOA em `logcat` e handshake AOA via adaptador/BT; nenhum byte USB Vision–telefone | O ponto de observação é o telefone/PC, não o barramento USB da central | Nenhum; mas não responde à pergunta sobre bytes USB |
| B. Identificar hardware externamente | Etiqueta, caixa, manual, nota fiscal e homologação já consultada | Documentos fornecidos pelo usuário; sem abrir a unidade | Modelo, revisão, importador e serial, se presentes; permitiria refinar a busca por método | Não fornece interface de leitura nem firmware; `Sunplus/DVD/Autolink` não é SoC, placa ou revisão | Nenhum |
| B. Inspecionar a placa | Inspeção técnica por assistência (identificação de SoC, flash e pontos de teste) | Abertura da unidade por técnico qualificado; autorização; unidade em mãos | Possível identificação do chip e de interfaces físicas candidatas | Isso é inspeção, não leitura de memória; sem revisão confirmada não autoriza procedimento algum | Alto: dano físico, perda de garantia; não autorizado nesta etapa |
| B. Ler o firmware da central | Procedimento documentado pelo fabricante para a **revisão exata** | Modelo/revisão confirmados, instrução oficial, ferramenta própria, checksum/backup prévio e caminho de recuperação | Imagem de firmware ou backup, se o fabricante fornecer | **Não estabelecido**: nenhum método foi localizado até aqui; não se infere de AOA, homologação, modelo semelhante ou MCU compartilhado | Alto se aplicado sem compatibilidade; risco de bricking. B/C/D permanecem não seguros para gravação |
| B. Ler o firmware da central | Captura da projeção usada como substituto da leitura | — | **Não estabelecido** | Não há relação demonstrada entre bytes de projeção e acesso à memória; `pcap` não é pré-requisito nem substituto de readback | Risco de falsa correlação |
| B. Ler o firmware da central | Comandos, loaders ou gravação por tentativa | Não aceito | **Não estabelecido** | Sem evidência de interface, modo ou comando para esta unidade; explicitamente fora do escopo | Alto: destruição de firmware/dados; proibido pelas regras deste trabalho |

## 3. A captura esclareceria a versão TLS?

Só parcialmente e de forma condicional. Para que uma captura responda sobre versão TLS, todos os itens abaixo teriam de ser verdadeiros ao mesmo tempo:

1. o ponto de captura estar no trecho físico Vision–telefone;
2. os registros TLS relevantes trafegarem nesse trecho;
3. existir um decodificador para o encapsulation/framing da projeção;
4. os registros não estiverem protegidos por uma camada externa que os torne opacos.

Não há evidência local de que o handshake TLS apareça em claro no USB. Os logs preservados registram a rejeição no cliente, mas não a versão do peer (`ANEXO-TECNICO-8920CP.md`). Portanto: **não estabelecido** que uma captura, por si só, esclareça a versão TLS. Sem decodificador, ela mostraria dados sem interpretação suficiente.

## 4. Conclusão prática

- **A — observar projeção:** o ponto correto seria o link físico Vision–telefone, preferencialmente com analisador USB inline. Com os equipamentos e permissões já disponíveis, isso **não está estabelecido**. `usbmon` no PC por ADB Wi-Fi, `usbmon` no PC por ADB USB ou monitoramento remoto não resolvem o problema.
- **B — ler firmware:** método documentado para `8920CP` / `312-C200S-A-V1.2`: **não estabelecido**. Faltam modelo/revisão confirmados na unidade, identificação real da plataforma/flash por inspeção técnica e, sobretudo, um procedimento de leitura do fabricante. Isso é independente de existir ou não `pcap`.
- Não há evidência de que conectar o PC à porta usada pelo telefone forneça acesso de leitura à central. Nenhuma operação foi executada para testar qualquer uma das linhas acima.
