# Resumo para suporte — Vision 8920CP

Assunto: falha de autenticação do Android Auto na central Vision 8920CP; solicitação de confirmação de modelo/revisão e firmware compatível.

## Sintoma

Com o Motorola usado no teste, a projeção falha tanto no cabo USB direto quanto com o adaptador Onex no meio. O Play Services registra `PROTOCOL_AUTH_FAILED(7)`, `AUTH_FAILED_OBSOLETE_SSL(75)` e `SSL_NEGOTIATION_FAILED_OBSOLETE_SSL_USB` / `SSL_NEGOTIATION_FAILED_OBSOLETE_SSL_WIFI`. A tela informa que o Android Auto não pode conectar por problema de segurança com a tela do veículo e orienta contatar o fabricante para atualizar o software.

## Diagnóstico diferencial

Uma sessão de controle DHU/Wi-Fi com o mesmo telefone, Android Auto `18.0.664284-release` e Play Services `26.45.31` completou negociação de versão, cipher suite, `SSL_SUCCESS` e autorização. Isso mostra que essa combinação específica funciona contra o peer DHU, mas **não elimina completamente telefone/Play Services como variável**: não houve teste com outro aparelho, conta ou versões diferentes, e o DHU não é a central física. A falha observada está no handshake TLS da sessão com a central; a versão TLS do peer não foi registrada e não há evidência de certificado expirado.

## Identificação pendente

A homologação Anatel `173262215053` aparece em anúncio da Vision 8920CP e em anúncio da Roadstar RS700BR. Os dados públicos indicam solicitante Roadstar Brasil Comércio de Eletrônicos Ltda (CNPJ `00.702.557/0001-74`) e fabricante Meizhou Votops Electronics Technology Co., Ltd. **Isso é uma associação pendente de confirmação pela etiqueta/documentação da unidade**, não fabricante confirmado do equipamento em mãos. O descritor USB `Sunplus, Inc. | DVD | Autolink` foi observado, mas não identifica SoC, placa ou firmware.

## Pedido ao fornecedor

1. Confirmar fabricante/importador, modelo e revisão a partir da etiqueta ou da documentação da unidade.
2. Informar se existe firmware compatível com essa revisão que corrija `AUTH_FAILED_OBSOLETE_SSL` / erro 7.
3. Informar versão atual e nova, changelog, procedimento de atualização e caminho de recuperação.

Não foi localizado pacote comprovadamente compatível. Não solicitamos cross-flash nem aplicação de firmware de outro modelo.

## Entrega

O anexo técnico `ANEXO-TECNICO-8920CP.md` contém os erros exatos e as referências locais. Bugreport bruto e dados pessoais não acompanham este resumo.
