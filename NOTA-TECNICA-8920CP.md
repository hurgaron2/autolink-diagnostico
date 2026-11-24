# Vision 8920CP — nota técnica e rastreio de fornecedor/firmware

Data: 24/11/2026. Sem nova coleta no veículo; apenas leitura local do material já capturado e pesquisa pública.

## 1. Nota curta para suporte

A central Vision 8920CP falha ao autenticar o Android Auto com o Motorola usado no teste. A mesma falha apareceu no cabo USB direto e com o adaptador Onex no meio. Os registros do Google Play Services mostram, em sequência, `PROTOCOL_AUTH_FAILED(7)`, `AUTH_FAILED_OBSOLETE_SSL(75)` e `SSL_NEGOTIATION_FAILED_OBSOLETE_SSL_USB` / `SSL_NEGOTIATION_FAILED_OBSOLETE_SSL_WIFI`, com `SSLHandshakeException: Read error`, `Failure in SSL library, usually a protocol error`, `OPENSSL_internal:UNSUPPORTED_PROTOCOL` e `Caused by: SSLProtocolException`. O Android Auto exibe: “O Android Auto não pode se conectar ao seu carro devido a um problema de segurança com a tela do veículo. Solution: Entre em contato com o fabricante do carro para atualizar o software dele. ProjectionErrorDetails: AUTH_FAILED_OBSOLETE_SSL”.

Como controle, uma sessão DHU/Wi-Fi com o mesmo aparelho, as mesmas versões do Android Auto (`18.0.664284-release`) e do Play Services (`26.45.31`) completou `VERSION_NEGOTIATION_SUCCESS`, negociação TLS com cipher suite, `SSL_SUCCESS` e `AUTHORIZATION_COMPLETE`. Isso mostra que essa combinação específica de telefone, conta, Play Services e Android Auto consegue autenticar contra o peer DHU. **Não elimina completamente o telefone/Play Services como variável**: não foi testado outro aparelho, outra conta ou outra combinação de versões, e o DHU não é a central física. O que a comparação permite dizer é que a falha aparece no caminho usado com a central, onde a negociação para em `SSL_FAILED` / `SSL_NEGOTIATION_FAILED_OBSOLETE_SSL_*`.

Não há no bugreport `CertificateException`, certificado expirado, certificado ainda não válido, `bad_certificate`, `WRONG_VERSION_NUMBER` na projeção ou alerta TLS recebido. A versão TLS usada pelo peer não foi registrada, então não é correto afirmar que a central usa TLS 1.0 ou 1.1. O que está provado é a rejeição do cliente com `OBSOLETE_SSL` / `UNSUPPORTED_PROTOCOL`; a causa exata no firmware da central não foi identificada. O downgrade do Play Services citado anteriormente é apenas histórico: a versão antiga não foi registrada com precisão e não é recomendação.

O bugreport A foi gerado com autorização, preservado e lido localmente; não foi enviado a serviços externos. Nenhuma configuração, cache, pareamento, rede ou firmware foi alterado nesta etapa.

## 2. Fornecedor / importador — evidências encontradas

### 2.1 Pista mais forte: homologação ANATEL `17326-22-15053` / `173262215053`

- Modelo declarado na ANATEL: `312-C200S-A-V1.2`.
- Solicitante: **Roadstar Brasil Comércio de Eletrônicos Ltda**, CNPJ **00.702.557/0001-74**.
- Fabricante: **Meizhou Votops Electronics Technology Co., Ltd.**, China.
- Certificado `NCC 23819/22`, emitido em 05/10/2022; homologação em 21/10/2022; validade até 05/10/2024; Situação hoje: suspensa/expirada.
- Fontes: painel replicado da ANATEL em `https://www.radardatelecom.com/certificacoes/173262215053` e `https://fccid.io/ANATEL/17326-22-15053`.
- O mesmo número de homologação aparece em anúncio de central **Vision 8920CP** no Mercado Livre (`MLBU3148313636`, campo “Fabricante: Vision”, “Modelo alfanumérico: 8920CP”) e em anúncio da **Roadstar RS-700BR Plus CarPlay** na MadeiraMadeira. Também aparece como código `8920cp` em página da Fullsize.

Grau de evidência: **forte como pista de importador/OEM**, **médio como identificação da unidade específica**, porque a associação Vision 8920CP ↔ homologação vem de anúncio de varejo, não da etiqueta física do aparelho. Isso é compatível com um mesmo projeto vendido sob marcas diferentes, mas não prova que a unidade em mãos seja exatamente aquele modelo homologado.

Contato público da Roadstar para essa linha (site oficial do produto RS-700BR Plus): telefone `(45) 3572-7472`, WhatsApp SAC `(45) 99106-6494`, WhatsApp Suporte Avançado `(45) 99947-0315`, e-mail `sac@roadstarvendas.com.br`. A página de downloads oficial não lista firmware para RS-700BR/8920CP; só traz atualização de GPS de outro modelo e visualizador de câmera.

### 2.2 Sunplus / Autolink

A Sunplus descreve oficialmente o desenvolvimento do Autolink para espelhamento por USB e soluções de CarPlay/Android Auto (`https://w3.sunplus.com/products/sphe8268K.asp` e relatório ESG 2021). O descritor USB antigo observado foi `Sunplus, Inc. | DVD | Autolink`.

Grau de evidência: **pista tecnológica/OEM apenas**. O descritor não confirma SoC, revisão de placa nem firmware, e não autoriza aplicar pacote de outro equipamento. A reanálise local dos registros (`ANALISE-PROTOCOLO-LOCAL-8920CP.md`) não encontrou VID/PID, descritores completos, interfaces/endpoints nem captura de pacotes USB; a string continua sendo apenas metadado AOA informado pelo acessório.

### 2.3 Jaycar / DigiTech QM3793

O artigo oficial da Jaycar sobre `QM3793` diz que problemas de Android Auto foram corrigidos por atualização de firmware da central. É modelo e varejo diferentes.

Grau de evidência: **baixa; referência técnica apenas**. Não há indício de que o firmware QM3793 seja aplicável à Vision 8920CP.

### 2.4 Relatos com a mesma família MCU

- XDA: “Need Firmware for Autolink MP5 (ZCD MCU) - Android Auto Error 7”, com trecho público contendo `ZCD_2021/11/16 10:23` e pedido de `update.zip`.
- Reddit `r/ArAutos`: “Ayuda para encontrar Firmware - APP Ver: ZCDP0UI04 / MCU Ver: ZCD”, também com `ZCD_2021/11/16 10:23`.

Grau de evidência: **relato de usuário**, sem pacote verificado. XDA e Reddit retornaram 403 na leitura direta; só foi possível ver trechos de resultados de busca. Esses relatos reforçam que a falha/error 7 aparece nessa família, mas não fornecem firmware compatível comprovado.

## 3. Firmware candidato

**Nenhum pacote comprovadamente compatível com a Vision 8920CP foi localizado.** Não há URL de fornecedor com modelo/revisão declarados, versão atual, changelog, problema corrigido ou evidência de compatibilidade. Nenhum pacote foi baixado; nenhuma inspeção estática foi feita; nenhum SHA-256 foi calculado porque não há original para isso.

A transcrição visível do app, `ZCDP0UIN08_2022/08/04 11:18:52_`, tem ambiguidade entre `0/O` e `I/1`. Na ausência das fotos originais da tela, variantes como `ZCDPOUIN08` ou `ZCDP0UIN08` não devem ser tratadas como modelos equivalentes.

## 4. Dados que ainda faltam

Para fechar a identificação sem abrir o equipamento, pedir apenas:

1. Foto ou texto da etiqueta da caixa, manual ou nota fiscal com fabricante/importador, CNPJ e número de homologação Anatel.
2. Foto da etiqueta externa da central com modelo, revisão e serial.
3. Contato do vendedor/nota fiscal (nome, CNPJ e telefone).

Com isso é possível confirmar se a unidade é a `312-C200S-A-V1.2` homologada pela Roadstar/Votops e consultar o fabricante por modelo/revisão. Não propor desmontagem como próximo passo automático; qualquer intervenção interna depende de assistência técnica.

## 5. Limites

Não foi possível confirmar a compatibilidade de nenhum firmware; não há evidência de que firmware de QM3793, de outro Sunplus/Autolink ou de outra revisão MCU funcione nesta central. A associação Roadstar/Votops permanece **pendente de confirmação pela etiqueta/documentação da unidade**. Sunplus é apenas o descritor USB observado (`Sunplus, Inc. | DVD | Autolink`), não identificação de SoC, placa ou firmware. A homologação compartilhada é indício, não autorização de cross-flash.

## 6. Materiais para consulta ao fornecedor

- Resumo curto: `RESUMO-SUPORTE-8920CP.md`.
- Anexo técnico com erros e referências locais: `ANEXO-TECNICO-8920CP.md`.
- Identificação e procedência: `LEVANTAMENTO-IDENTIFICACAO-8920CP.md`.
- Avaliação PC ↔ central antes de qualquer conexão: `PROTOCOLO-CONEXAO-PC-8920CP.md`.
- Reanálise local de A, Onex e DHU (inventário, evidência direta/inferência e lacunas): `ANALISE-PROTOCOLO-LOCAL-8920CP.md`.
- Viabilidade separada para observar a projeção e para ler o firmware: `AVALIACAO-VIABILIDADE-8920CP.md`.
- Esta nota permanece como versão completa. Bugreport bruto e dados pessoais não são incluídos nos materiais de envio.

## 7. Se o fornecedor enviar um arquivo

1. Não executar e não enviar à central.
2. Registrar origem (remetente, data, URL/identificador) e a confirmação de compatibilidade por modelo/revisão.
3. Pedir autorização explícita antes de baixar e inspecionar.
4. Antes de qualquer gravação, verificar modelo/revisão declarados, instruções de atualização e caminho de recuperação.

## 8. Preservação das capturas

Nenhuma captura original foi alterada nesta etapa. Os registros de integridade continuam nos `hashes.txt` de cada diretório:

- `captura-VISION-A-20261124-104617/hashes.txt`: bugreport `E800A9BDC1D97A57`, `logcat-continuo.txt` `967B0B445C9C6958`, `sessao-exportada.zip` `E214595D0D232EE3`.
- `captura-VISION-BT-20261124-110042/hashes.txt`: `logcat-continuo.txt` `E920AA04A52F3D73`, `sessao-exportada.zip` `27D0583F24EA9D50`.
- `captura-DHU-ADB-WIFI-20261124-092400/hashes.txt`: `logcat-continuo.txt` `B6ACC0E82CD88087`, `relatorio-publico.zip` `6B0B87EE89899EA2`.

Os valores acima são os registrados nos arquivos locais. A divergência já conhecida em `eventos.txt` da captura A veio de linhas acrescentadas após a geração do `hashes.txt`; não houve nova reescrita agora.
