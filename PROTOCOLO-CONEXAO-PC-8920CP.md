# Protocolo de avaliação PC ↔ Vision 8920CP antes de qualquer conexão

Status: **investigação parada na análise do que já foi capturado**. Não há autorização para nova coleta nem para conexão PC–central. Nenhuma operação foi executada na central.

## Objetivo e limite desta etapa

Para descobrir se há dados e protocolo de serviço, o que importa é **observar o tráfego**, não fotografar o conector. Fotos são **opcionais** e servem apenas à triagem física — tipo de porta, rótulos e cabos já instalados, para evitar ligar no lugar errado. Elas não provam a função elétrica da porta, se a central pode operar como USB device, nem se existe método de leitura.

Nos testes com telefone, o handshake é consistente com o papel de host do acessório no Android Open Accessory: o acessório externo atua como host e o telefone como dispositivo (`https://source.android.com/docs/core/interaction/accessories/protocol`). Isso não estabelece um modo de serviço PC–central. Tráfego normal de projeção também pode não conter firmware recuperável.

## Sequência de investigação — sem execução agora

1. Identificar a interface e a direção do barramento a partir dos registros já capturados: bugreports e logs das capturas A, Onex e DHU/Wi-Fi, com hashes preservados conforme a `NOTA-TECNICA-8920CP.md`. Uma captura nova só entraria aqui se explicitamente autorizada.
2. Só depois de confirmar uma ligação segura, fazer **enumeração USB passiva** e registrar VID/PID, fabricante, classes, descritores, interfaces e endpoints. Enumeração mostra o que está conectado; **não equivale a ler a flash**.
3. Se aparecer uma interface de serviço documentada para este modelo/revisão, avaliar o protocolo e se ele permite leitura.
4. Não enviar comandos desconhecidos, inclusive vendor-specific.

## Premissas de segurança

- **Não usar cabo USB-A macho–macho comum** entre duas portas host: há risco de curto entre alimentações e retorno de corrente. Cabos host–host especiais têm ligações diferentes e ainda assim não transformam a central em leitor de firmware. Referência: `https://www.digikey.com/en/blog/usb-3-0-type-a-to-type-a-cable-wiring-options`.
- Adaptadores para “fazer encaixar” não provam compatibilidade elétrica nem de protocolo.
- Não presumir ADB na central.
- Não presumir que aceitar atualização por pendrive permite devolver o firmware ao computador.
- Documentação Sunplus sobre ISP em SP7350 ou outra plataforma não se aplica por causa do descritor `Sunplus, Inc. | DVD | Autolink`. Referência: `https://sunplus.atlassian.net/wiki/spaces/C3/pages/1994621039/In-system+Programming+Flash+Devices`.

## Etapas distintas — não confundir

| Etapa | Resultado possível | Garante a próxima? |
|---|---|---|
| Identificação USB | VID/PID, fabricante, classe, interfaces | Não |
| Acesso de serviço | Protocolo específico do fabricante | Não |
| Leitura da memória | Backup de regiões da flash, se o protocolo permitir | — |

## Fotos opcionais — apenas triagem física

Se você enviar, sem desmontar a placa:

1. Conectores acessíveis da central e inscrições próximas.
2. Cabos que já saem da central, com etiquetas e marcadores.
3. Etiqueta externa da central e, se houver, da caixa/manual/nota fiscal.
4. Tela de versões, se ainda não capturada: APP, MCU, IC, Radio.

## O que verificar em fontes documentais

1. Indicação de porta USB de serviço / device / OTG para este modelo.
2. Modo de diagnóstico documentado.
3. Protocolo de leitura de memória documentado.
4. Ferramenta com função explícita de **readback/backup**.
5. Distinção entre documentação desta unidade/modelo/revisão e documentação genérica Sunplus ou de outro produto.
6. Porta, cabo, alimentação e identificadores USB esperados, se existirem.

## Regras durante a avaliação

- Não recomendarei cabo USB-A macho–macho comum, adaptadores improvisados nem modificação de fios.
- Não recomendarei combinações de botões, bootloader, fechar pontos da placa ou ferramenta ISP por tentativa.
- Não enviarei comandos vendor-specific, carregarei loaders, executarei flash/erase/update nem instalarei drivers automaticamente.
- Primeira operação eventualmente autorizada: **apenas enumeração USB**, depois de porta, cabo e procedimento confirmados.
- Se não houver documentação suficiente: informar o que falta, parar antes da conexão e indicar quando a avaliação depende de assistência técnica.

## Se existir método comprovadamente correspondente

Só então apresentar:

- Fonte documental com modelo/revisão compatíveis.
- Porta e cabo necessários.
- Alimentação exigida.
- Identificadores USB esperados.
- Comandos exclusivamente de identificação.
- Evidência de que a leitura não apaga nem grava memória.
- Regiões que poderiam ser copiadas.
- Limitações do backup e da restauração.

## Alcance do eventual backup

Um backup serviria para identificar componentes e preservar o estado atual. **Não corrigiria, por si só, o SSL obsoleto**: seria base para análise e eventual recuperação, não firmware atualizado.

Todo o material já coletado permanece preservado. Sem nova autorização, não propor captura, conexão nem comando: a avaliação continua documental e baseada no material existente.
