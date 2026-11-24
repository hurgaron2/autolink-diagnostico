# Levantamento de identificação e procedência — Vision 8920CP

Data da pesquisa: 24/11/2026. Escopo: somente identificação e procedência. Nenhum firmware ou APK foi baixado, executado, instalado ou aplicado. Foram lidos páginas públicas, a base oficial da Anatel e um manual PDF público de outro modelo da mesma marca. Nenhum log privado foi enviado a sites.

## 1. APP nas fotos originais disponíveis

Fotos locais disponíveis: `tela2.png` e `tela_atual.png`.

- `tela2.png`: OCR local mostra apenas a tela do app AutoLink Diagnóstico (`Registre o que acontece ao conectar seu celular ao carro`, `INICIAR DIAGNÓSTICO`, histórico). Não há tela de “informações da central”.
- `tela_atual.png`: imagem em branco (desvio padrão 0 nos canais RGB).
- Não há, entre as fotos disponíveis, captura da tela de versão de APP/MCU.

**Resultado:** a APP informada `ZCDP0UIN08_2022/08/04 11:18:52_` **não pôde ser conferida nas fotos originais disponíveis**. Ela permanece como transcrição informada pelo usuário, com caracteres ambíguos:

- `0` / `O` em `ZCDP0...`
- `I` / `1` em `...UIN...`

Leituras possíveis incluem `ZCDPOUIN08`, `ZCDP0U1N08` e `ZCDPOU1N08`. **Variantes de transcrição não são modelos equivalentes** e não devem ser usadas como se fossem a mesma revisão. A MCU `ZCD_2021/11/16 10:23`, o `IC: SY` e o `Radio: ZT0811` também não aparecem nas fotos disponíveis.

Para fechar a identificação é necessária foto original, legível, da tela de informações/versões da unidade e da etiqueta externa da central.

## 2. Homologação Anatel — consulta oficial

Base oficial consultada: `https://www.anatel.gov.br/dadosabertos/paineis_de_dados/certificacao_de_produtos/produtos_certificados.zip` (arquivo `Produtos_Homologados_Anatel.csv`). Painel público: `https://informacoes.anatel.gov.br/paineis/certificacao-de-produtos/consulta-de-produtos`.

Consulta pelo código completo `173262215053` / `17326-22-15053` retornou exatamente um registro:

| Campo | Valor oficial |
|---|---|
| Data da homologação | 21/10/2022 |
| Número de homologação | 173262215053 (`17326-22-15053`) |
| Solicitante | Roadstar Brasil Comércio de Eletrônicos Ltda |
| CNPJ do solicitante | 00.702.557/0001-74 |
| Certificado de Conformidade Técnica | NCC 23819/22 |
| Data do certificado | 05/10/2022 |
| Validade do certificado | 05/10/2024 |
| Situação do certificado | Suspenso |
| Situação do requerimento | Homologação Suspensa |
| Fabricante | Meizhou Votops Electronics Technology Co., Ltd. |
| País do fabricante | China |
| Modelo | 312-C200S-A-V1.2 |
| Nome comercial | (vazio) |
| Categoria / tipo | 2 / Transceptor de Radiação Restrita |
| IC_ANTENA / IC_ATIVO | N / S |

Classificação: **A para o registro público da homologação**. Isso **não** é confirmação de que a unidade em mãos é esse modelo, nem confirmação de firmware compatível.

## 3. Combinação APP + MCU e variantes

| Consulta | Resultado | Classificação |
|---|---|---|
| `ZCDP0UIN08` exato + `ZCD_2021/11/16 10:23` | Nenhum resultado indexado | — |
| Variantes `ZCDPOUIN08`, `ZCDP0U1N08`, `ZCDPOU1N08` | Nenhum resultado indexado | — |
| MCU exata `ZCD_2021/11/16 10:23` | Tópico XDA com APP diferente: `ZCDP0U04_2022/06/15 13:48:02`, mesmo MCU, erro 7 de Android Auto | C |
| `ZCDP0UI04` (variante de outra leitura) | Relato em Reddit/ArAutos sobre procura de firmware para `app ver zcdp0ui04` | C |
| `AUTH_FAILED_OBSOLETE_SSL` associado a 8920CP / ZCD / Votops | Nenhum resultado que vincule o erro a este modelo/revisão | — |

O tópico XDA (`Need Firmware for Autolink MP5 (ZCD MCU) - Android Auto Error 7 - Came with Used Car`, 28/09/2025) é um **relato de usuário**: o autor diz ter o mesmo MCU e APP `ZCDP0U04_2022/06/15 13:48:02`, pede `update.zip` e não apresenta pacote compatível verificado. Outros participantes relatam erro 7 e citam `UNSUPPORTED_PROTOCOL`, mas também não fornecem firmware com modelo/revisão declarados.

A APP do XDA é diferente da APP informada para a unidade. Mesmo com MCU idêntica, **não se trata da mesma revisão** e não autoriza reaproveitamento de firmware.

## 4. Vínculos e procedência

| Fonte | Tipo | O que sustenta | O que não sustenta |
|---|---|---|---|
| Anatel — base oficial e painel | Oficial | Código `173262215053`, modelo `312-C200S-A-V1.2`, solicitante Roadstar, fabricante Meizhou Votops, certificado NCC 23819/22 | Que a unidade física é esse modelo; firmware compatível |
| `roadstarbrasil.com.br/rs700brplus.php` | Oficial (site da marca/solicitante) | Página do RS-700BR Plus CarPlay, especificações, link para manual em PDF e contatos | Que a unidade chamada Vision 8920CP é este produto; firmware |
| `roadstarbrasil.com.br/manuais/rs700brplus.pdf` | Oficial (documentação) | Manual em PDF, 17 páginas, digitalizado sem texto pesquisável extraível | Instrução de recuperação ou firmware — nada foi encontrado no texto acessível |
| `roadstarbrasil.com.br/downloads.php` | Oficial (suporte) | Contatos e downloads de GPS RS-707MP7BR e visualizador RS-898BR/RS900BR | Nenhum firmware listado para 8920CP, RS-700BR ou 312-C200S-A-V1.2 |
| Nivalmix — anúncio do RS-700BR | Anúncio de varejo | "Anatel: 17326-22-15053" / `173262215053` associado ao Roadstar RS-700BR | Identidade da unidade em mãos; compatibilidade de firmware |
| Radar da Telecom `.../173262215053` | Fonte secundária | Espelho dos dados oficiais da Anatel, sincronizado em 24/11/2026 | Não é fonte primária nem prova de compatibilidade |
| FCC ID `.../ANATEL/17326-22-15053` | Fonte secundária | Espelho dos dados oficiais da Anatel | Não é fonte primária nem prova de compatibilidade |
| XDA thread 4761332 | Relato de usuário | Mesmo MCU, APP diferente, erro 7, handshake/SSL como tema | Modelo/revisão confirmados; firmware seguro |
| Reddit r/ArAutos `1pwhd0a` | Relato de usuário | Procura de firmware para `zcdp0ui04` | Modelo/revisão confirmados; firmware seguro |
| Jaycar `QM3793 Android Auto Connection Issues` | Documentação oficial de outro produto | Erro 7 e instrução de atualização para QM3793 | Aplicabilidade à Vision 8920CP/312-C200S-A-V1.2 |

Nesta passagem não foi obtido resultado indexado que associe diretamente o nome `Vision 8920CP` ao código `173262215053`. A associação prévia com anúncio de varejo permanece como pista de varejo, não como confirmação por etiqueta/documentação da unidade.

`Sunplus, Inc. | DVD | Autolink` continua registrado apenas como **descritor USB observado**; nenhuma fonte consultada liga esse descritor a SoC, revisão de placa ou firmware desta unidade.

## 5. Fabricante/importador, suporte e recuperação

- Solicitante/homologado: **Roadstar Brasil Comércio de Eletrônicos Ltda**, CNPJ `00.702.557/0001-74`.
- Fabricante declarado na homologação: **Meizhou Votops Electronics Technology Co., Ltd.**, China.
- Página oficial do RS-700BR Plus: `https://roadstarbrasil.com.br/rs700brplus.php`.
- Manual oficial: `https://roadstarbrasil.com.br/manuais/rs700brplus.pdf`.
- Downloads: `https://roadstarbrasil.com.br/downloads.php` — sem firmware para os modelos aqui considerados.
- Contatos públicos no site oficial: telefone `(45) 3572-7472`; WhatsApp Comercial `(11) 95094-3636`; WhatsApp SAC `(45) 9106 6494`; WhatsApp Suporte Avançado `(45) 99947 0315`; e-mail comercial `comercial@roadstarvendas.com.br`.
- Instrução de recuperação específica para 8920CP / 312-C200S-A-V1.2: **não localizada**.

A etiqueta da caixa/manual/nota fiscal, o importador real da unidade e o contato do vendedor ainda são necessários para confirmar se a unidade corresponde ao registro Anatel.

## 6. Pacote encontrado — registro de metadados

Foi localizado um arquivo de atualização apenas no contexto de **outro produto**:

| Campo | Registro |
|---|---|
| URL da página | `https://help.jaycar.com.au/hc/en-us/articles/50355885912217-QM3793-Android-Auto-Connection-Issues` |
| Domínio de origem | `help.jaycar.com.au` |
| Responsável pela publicação | Jaycar Electronics — artigo de suporte, atualizado em 24/09/2025 |
| Arquivo | `ISP_UPDT.BIN` (20 MB, link de download na página) |
| Modelo/revisão explicitamente declarados | `QM3793` 7in Bluetooth Media Player Head Unit; revisão não declarada |
| Instruções disponíveis | FAT32; copiar somente o BIN; remover SD; ligar veículo e aparelho; inserir USB na entrada frontal inferior esquerda; tocar no ícone USB vermelho; confirmar OK se perguntado; aguardar atualização e reinício. Se falhar: garantir 12 V com motor ligado, outro pendrive FAT32, factory reset pelo menu, desconectar chicote por 30 s; se ainda falhar, trocar na loja |
| Changelog | Não publicado |
| `AUTH_FAILED_OBSOLETE_SSL` citado? | Não. O artigo cita `Communication Error 7` e falha das verificações de segurança do Android Auto |
| Evidência de compatibilidade com 8920CP / 312-C200S-A-V1.2 | Nenhuma |
| Classificação | **D** — sem procedência para este modelo; não é candidato a gravação |

Nenhum `update.zip`, pacote oficial da Roadstar/Votops ou pacote declarado para `ZCDP0UIN08`/`312-C200S-A-V1.2` foi localizado. Sites genéricos de firmware encontrados na busca não declaram este modelo/revisão e também entram como **D**.

## 7. Classificação consolidada

| Classe | O que foi encontrado |
|---|---|
| **A — compatibilidade confirmada pelo fabricante/importador** | Nada para firmware. O registro Anatel é oficial, mas apenas de homologação; não prova a unidade em mãos nem firmware |
| **B — compatibilidade sustentada por documentação verificável** | Nada |
| **C — relato de usuário** | XDA (MCU igual, APP diferente) e Reddit/ArAutos (`zcdp0ui04`) |
| **D — sem procedência ou apenas semelhança de nome** | Jaycar `ISP_UPDT.BIN` (QM3793), Nivalmix/Radar/FCCID como varejo ou espelhos, diretórios genéricos de firmware |

Nenhum resultado **B, C ou D** deve ser tratado como seguro para gravar. A homologação compartilhada é indício de cadeia de fornecimento, não autorização de cross-flash.

## 8. Conclusão

Como nenhuma fonte confirma a revisão exata da unidade — e a APP informada sequer pôde ser lida nas fotos disponíveis — a conclusão é: **nenhum firmware verificável localizado**.

Próxima informação necessária, sem desmontagem: foto legível da tela de versões, etiqueta da caixa/manual/nota fiscal, importador/CNPJ/contato do vendedor e etiqueta externa da central. Se o fornecedor enviar arquivo, registrar origem e compatibilidade declarada, pedir autorização antes de baixar/inspecionar, verificar modelo/revisão/instruções/recuperação antes de qualquer gravação e não executar nem enviar o arquivo à central.
