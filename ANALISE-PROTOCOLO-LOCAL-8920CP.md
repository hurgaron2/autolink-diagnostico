# Reanálise local dos registros preservados — A, Onex e DHU

Data: 24/11/2026. Escopo autorizado: **somente leitura local** dos arquivos já preservados. Não houve nova coleta, conexão PC–central, instalação, envio de arquivo, alteração de configuração nem comunicação com a central. Nenhum arquivo original foi alterado.

## 1. Inventário do que existe

| Categoria | Arquivos preservados | O que são | O que não são |
|---|---|---|---|
| Logs de aplicativo | A e Onex: `sessao-exportada.zip`; DHU: `relatorio-publico.zip` → `app-events.txt`, `timeline.json`, `conexoes.jsonl`, `usb-snapshots.json`, `central.json`, `device.json`, `detected-equipment.json`, `resumo.txt`, `manifest.json` (extraídos em `reanalise-protocolo/`) | Registros do app AutoLink Diagnóstico: sessões, eventos de UI/USB, enumeração passiva via `UsbManager`, dados informados manualmente | Leitura de firmware da central; captura de tráfego USB |
| Logs de sistema | `logcat-continuo.txt`, `logcat-tail-buffer.txt`, `analise-logcat.txt`, `analise-detalhada.txt`, `eventos.txt`, `correlacao-horarios.txt`, `dumpsys-usb-*`, `dumpsys-connectivity-*`, `dumpsys-bluetooth_manager-*`, `package-*` | Logs do **telefone** e estados do Android (`UsbDeviceManager`, GMS/Android Auto, conectividade, Bluetooth) | Logs da central; captura de pacotes USB |
| Bugreport | `bugreport.txt.zip` (captura A) e cópia local em `analise-auth-local/bugreport-copia.txt` | Bugreport do telefone, gerado com autorização | BUGreport da central; não é tráfego USB |
| Eventos de conexão | `conexoes.jsonl` (A: 5 linhas; Onex e DHU: 0 bytes), `app-events.txt`, USB Event Log dentro de `dumpsys-usb-*`, `GH.ConnLoggerV2` no logcat | Anexar/desanexar AOA, mudanças `USB_STATE`, marcos de handshake AOA do Android Auto | Protocolo de serviço da central; leitura de memória |
| Descritores USB | `usb-snapshots.json`, `dumpsys-usb-*`, `central-sysfs-usb.txt` (A) | Identificação AOA informada pelo acessório e estado do lado telefone | Descritores completos de dispositivo USB: não há VID/PID, classes, interfaces nem endpoints registrados |
| Captura de pacotes | **Nenhuma** | Não existem `.pcap`, `.pcapng`, `.cap` nem captura `usbmon` salva nas três pastas, no diretório temporário de análise ou no repositório | `logcat` não é captura de tráfego USB. A linha `usbmon 53248 0` em `analise-auth-local/bugreport-copia.txt:86726` é apenas lista de módulos do kernel do telefone, com 0 usuários; não é captura |

Observação importante: apesar do nome, `central-dumpsys-usb.txt` e `central-sysfs-usb.txt` foram coletados **no telefone**. O primeiro começa com `USB MANAGER STATE (dumpsys usb)` (`central-dumpsys-usb.txt:1`) e o segundo registra `INDISPONIVEL` para todos os caminhos consultados (`central-sysfs-usb.txt:1-12`). Eles não são uma inspeção da central.

## 2. Evidência por caminho

Legenda: **D** = evidência direta no arquivo; **I** = inferência, com o limite indicado.

### Caminho A — USB direto telefone → Vision

| Arquivo:linha | Trecho | Leitura |
|---|---|---|
| `eventos.txt:1` | `INICIO tentativa=... caminho=A (Motorola USB direto a Vision 8920CP; PC e Motorola via ADB Wi-Fi)` | **D**: define o caminho físico testado |
| `eventos.txt:15` | `SESSAO no app iniciada ... USB do telefone ja conectado a Vision antes do inicio da captura` | **D**: USB já estava ligado antes da sessão do app |
| `logcat-continuo.txt:12640` | `applyOemOverride usbfunctions=accessory,adb bootmode=normal` | **D**: o **telefone** entrou em função de acessório USB + ADB |
| `logcat-continuo.txt:12723` | `entering USB accessory mode: UsbAccessory[mManufacturer=Sunplus, Inc., mModel=DVD, mDescription=Autolink, mVersion=2.0, mUri=http://developer.autolink.top/Autolink.apk, ...]` | **D**: identidade AOA informada pelo acessório. **I**: é a única pista com o nome Sunplus; não é VID/PID, SoC, placa, revisão ou firmware |
| `logcat-continuo.txt:13404` | `entering USB accessory mode: UsbAccessory[mManufacturer=Android, mModel=Android Auto, ... mUri=http://www.android.com/auto, ...]` | **D**: segunda identidade AOA, diferente da anterior |
| `dumpsys-usb-antes.txt:5-24` | `current_functions=ACCESSORY`; `current_accessory={ manufacturer=Android, model=Android Auto ... serial=0000000012345678 }`; `host_connected=false`; `sink_power=true`; `kernel_state=CONFIGURED` | **D**: os campos acima. **I**: pelo uso da função `ACCESSORY`, o telefone é o device da sessão AOA; o `serial` exibido pertence à identidade Android Auto e não foi registrado como serial da central |
| `usb-snapshots.json:2-6` | `origem: coletado por API pública (UsbManager), modo somente leitura`; `Nenhum acessório foi aberto, nenhuma interface reivindicada, nenhum transfer enviado` | **D**: enumeração passiva; não houve acesso a interface de serviço |
| `usb-snapshots.json:14-23` | `"dispositivos": []`; `"acessorios": [{ "fabricante": "Android", "modelo": "Android Auto" ... }]` | **D**: a lista de dispositivos via `UsbManager` está vazia; a lista de acessórios traz o AOA Android Auto. **I**: nenhum USB device foi enumerado pelo telefone nessa janela |
| `conexoes.jsonl:1-5` | `usb_conectado` / `usb_desconectado` com `acc:Android:Android Auto:http://www.android.com/auto` | **D**: cinco transições AOA na sessão do app |
| `app-events.txt:189-197` | `acessório USB observado: DVD` → `USB desconectado (acc:Sunplus, Inc.:DVD:...)` → `USB conectado (acc:Android:Android Auto:...)` | **D**: histórico do app mostra as duas identidades em momentos distintos. **I**: os arquivos não provam qual caixa/elemento físico gerou cada uma (`detected-equipment.json:21`: `equipamentoPertence: "desconhecido"`) |
| `central-sysfs-usb.txt:1-12` | `idVendor`, `idProduct`, `iManufacturer`, `iProduct`, `functions`, `state` — todos `INDISPONIVEL` | **D**: não há VID/PID nem descritor USB capturado |
| `detected-equipment.json:4` | `Nenhum dado de firmware da central foi lido por USB. Adaptador não é confundido com central.` | **D**: registro explícito do limite da coleta |
| `analise-auth-local/excecoes-bugreport.txt:73` | `L282416 \| extras: Bundle[{accessory=UsbAccessory[mManufacturer=Sunplus, Inc., mModel=DVD, mDescription=Autolink, ...]}]` | **D**: o mesmo AOA Sunplus aparece no bugreport do telefone, como extras de intent |

**Direção do barramento — evidência x inferência.** É direto que o telefone estava em `current_functions=ACCESSORY`, `host_connected=false` e `sink_power=true`. A conclusão de que o parceiro externo atuava como host vem da regra do Android Open Accessory (o acessório externo é host, o telefone é device) aplicada a essa função, não de um descritor lido na central. Logo, a sessão é compatível com AOA, mas não demonstra porta de serviço PC–central.

### Caminho Onex/Bluetooth

| Arquivo:linha | Trecho | Leitura |
|---|---|---|
| `eventos.txt:4` | `CAPTURA iniciada via Bluetooth (transporte ADB USB ...).` | **D**: o transporte de captura era ADB no PC; a ligação com a central era Bluetooth via adaptador |
| `eventos.txt:24` | `28x 'GH.ConnBroadcast: Got USB_ACCESSORY_HANDSHAKE event' (AOA) a cada ciclo, mesmo com BT no meio; nao prova projecao ativa` | **D**: há marcos de handshake AOA no log, mas o próprio registro nega que isso prove projeção ativa |
| `eventos.txt:28` | `detected-equipment.json: disponivel=true, 0 equipamentos ... USB do telefone ligado ao PC (ADB), nao a Vision; nenhum UsbManager accessory da central` | **D**: nenhum acessório da central foi visto neste caminho |
| `usb-snapshots.json:8,14-15` | `"quantidade": 3`; `dispositivos: []`, `acessorios: []` | **D**: três enumerações vazias |
| `conexoes.jsonl` | arquivo com 0 bytes | **D**: nenhum evento de conexão USB registrado pelo app |
| `analise-logcat.txt:10` | `=== Sunplus : 0 ocorrencias ===` | **D**: a identidade Sunplus não reapareceu nesta captura |
| `logcat-continuo.txt:19529` | `Got USB_ACCESSORY_HANDSHAKE event. GETPROTOCOL started ... STRING_COUNT=6, ACCESSORY_START=true ...` | **D**: contabilidade do handshake AOA. **I**: `GETPROTOCOL`/`STRING_COUNT` são do protocolo AOA padrão; não são protocolo de serviço, diagnóstico ou leitura da central |
| `dumpsys-usb-depois.txt:21-33` | `ACCESSORY=GETPROTOCOL`, vários `ACCESSORY=SENDSTRING`, `ACCESSORY=START`, depois `USB_STATE=DISCONNECTED/CONNECTED/CONFIGURED` | **D**: eventos no dispositivo virtual `usb_accessory` do telefone; não são tráfego capturado nem acesso à flash |

### Caminho DHU / ADB Wi-Fi

| Arquivo:linha | Trecho | Leitura |
|---|---|---|
| `eventos.txt:1-2` | `INICIO tentativa=DHU-ADB-WIFI...`; `ADB confirmado: ...` | **D**: caminho de rede/ADB, não USB para a central |
| `dhu-conexao-1.err.txt:4-7` | `Starting link. Requested protocol version: 1.7`; `Connecting over ADB to localhost:5277`; `connected.`; `Phone reported protocol version 1.7` | **D**: protocolo 1.7 é o do Android Auto entre DHU e telefone. **I**: não é protocolo de serviço da central nem comando de leitura |
| `usb-snapshots.json:8,14-15` | `"quantidade": 2`; `dispositivos: []`, `acessorios: []` | **D**: enumerações vazias |
| `conexoes.jsonl` | arquivo com 0 bytes | **D**: nenhum evento USB no app |
| `dumpsys-usb-depois.txt:5-15` | `connected=false`; `configured=false`; `host_connected=false`; `kernel_state=DISCONNECTED` | **D**: telefone sem sessão USB ativa ao final |
| `resumo.txt:18` | `Sem dispositivo/acessório visível para este aplicativo (não é conclusão sobre a central).` | **D**: ausência de visibilidade USB para o app |
| `logcat-dhu-capturado.txt:732` (arquivo local anterior, fora das três pastas) | `UsbAccessory[mManufacturer=Android, mModel=Android Open Automotive Protocol, ...]` | **D**: outra identidade AOA em 11/11/23 22:53. **I**: também é metadado AOA, sem VID/PID ou firmware |

## 3. Interface de serviço, diagnóstico, atualização ou leitura de memória

Não há nenhum achado que sustente a existência de interface de serviço, modo de diagnóstico, protocolo de atualização ou readback nesta unidade. O que aparece com palavras parecidas é teleologia de outro sistema:

| Arquivo:linha | Trecho | Por que não serve |
|---|---|---|
| `logcat-continuo.txt:27196` (A) | `CAR.SETUP.SERVICE.LITE: onStartCommand (id=1): Intent { act=android.hardware.usb.action.USB_ACCESSORY_ATTACHED ... CarSetupServiceImpl ... }` | Serviço do **GMS/Android Auto no telefone**, não da central |
| `central-dumpsys-usb.txt:342` (A) | `class_name=com.google.android.gms.backup.component.D2dSourceActivity` | Activity de backup do **telefone**, não leitura de flash da central |
| `dumpsys-l-antes.txt:82` (A) | `backup` | Item da lista de serviços do Android, não ferramenta de backup da central |
| `dumpsys-usb-depois.txt:21-28` (Onex) | `ACCESSORY=GETPROTOCOL` / `SENDSTRING` / `START` | Handshake padrão AOA; não é comando vendor-specific |
| `dhu-conexao-1.err.txt:4-7` | `protocol version: 1.7` | Protocolo Android Auto sobre ADB/DHU, não protocolo de gravação ou leitura |

Buscas locais por `readback`, `update.zip`, `ISP_UPDT`, `bootloader`, `fastboot`, `dd if=` e `/dev/block` não retornaram ocorrências nos três `logcat-continuo.txt`. As ocorrências de `firmware` encontradas são alheias à central: parâmetro de URL do app Amazon em `captura-VISION-BT-20261124-110042/logcat-continuo.txt:32340` e arquivos `/vendor/firmware_mnt/image/*.mbn` carregados pelo processo `ssgtzd` do telefone em `captura-DHU-ADB-WIFI-20261124-092400/logcat-continuo.txt:45957-46066`.

## 4. Resposta objetiva

**Não.** O material existente não revela caminho concreto para identificar melhor o hardware além da string AOA `Sunplus, Inc. | DVD | Autolink`, nem qualquer caminho para ler o firmware. Essa string é metadado fornecido pelo acessório durante o handshake AOA; ela não identifica SoC, placa, revisão, VID/PID ou firmware. Nenhum pacote, comando, modo de serviço ou capacidade de leitura foi inventado a partir dela. Isso mantém a classificação A/B/C/D já registrada em `LEVANTAMENTO-IDENTIFICACAO-8920CP.md`: B/C/D não são seguros para gravação, e a conclusão permanece “nenhum firmware verificável localizado” até confirmação da revisão exata.

O que está ausente, exatamente:

1. **Captura de pacotes USB**: nenhum `pcap`/`pcapng`/`cap` e nenhuma captura `usbmon` salva. O módulo `usbmon` aparece apenas como lista de kernel em `bugreport-copia.txt:86726`, com 0 usuários. `logcat` registra eventos do Android; não é tráfego USB.
2. **Descritores USB completos**: não há VID/PID, classes, subclasses, interfaces nem endpoints em nenhum arquivo. Os caminhos sysfs/configfs correspondentes estão `INDISPONIVEL` (`central-sysfs-usb.txt:1-12`) e o `UsbManager` em modo acessório não expôs esses campos na coleta.
3. **Serial do acessório**: não foi coletado por padrão (`usb-snapshots.json:5,26`); o `serial` visível no `dumpsys` pertence à identidade Android Auto e não foi registrado como serial da central.
4. **Atribuição física das identidades AOA**: os registros não provam qual dispositivo gerou `Sunplus/DVD/Autolink`, `Android Auto` ou `Android Open Automotive Protocol` (`detected-equipment.json:21`: `equipamentoPertence: desconhecido`).
5. **Documentação ou ferramenta do fabricante** com porta de serviço/device/OTG, protocolo de leitura ou função explícita de `readback/backup` para `8920CP` / `312-C200S-A-V1.2`.
6. **Leitura da APP/MCU diretamente da central**: os valores em `central.json` são informados manualmente e marcados `confirmadoPorUsb: false` (`central.json:2-4`).

O ADB presente nos registros é do telefone/PC via Wi-Fi ou USB de transporte; não há evidência de ADB na central.

Todos os arquivos originais e hashes permanecem preservados; esta reanálise foi somente leitura e não produziu nova coleta.
