# Anexo técnico — Vision 8920CP

Escopo: somente arquivos derivados já existentes, lidos localmente. Bugreport bruto, dados pessoais, APKs e pacotes de firmware não são incluídos. Os caminhos abaixo são relativos ao diretório de análise da sessão; o diretório do usuário foi omitido.

## 1. Erros e mensagens registradas

```text
PROTOCOL_AUTH_FAILED(7)
AUTH_FAILED_OBSOLETE_SSL(75)
SSL_NEGOTIATION_FAILED_OBSOLETE_SSL_USB
SSL_NEGOTIATION_FAILED_OBSOLETE_SSL_WIFI
javax.net.ssl.SSLHandshakeException: Read error: ... Failure in SSL library, usually a protocol error
error:100000f0:SSL routines:OPENSSL_internal:UNSUPPORTED_PROTOCOL (external/boringssl/src/ssl/ssl_versions.cc:342 ...)
Caused by: javax.net.ssl.SSLProtocolException
```

Mensagem exibida pelo Android Auto: “O Android Auto não pode se conectar ao seu carro devido a um problema de segurança com a tela do veículo. Solution: Entre em contato com o fabricante do carro para atualizar o software dele. ProjectionErrorDetails: AUTH_FAILED_OBSOLETE_SSL.”

Não afirmar TLS 1.0 ou 1.1 no peer. A versão TLS do peer não foi registrada. `TLSv1.2` aparece apenas como protocolo inicializado no cliente via `GmsCore_OpenSSL`.

## 2. Referências locais das evidências

| Evidência | Referência local |
|---|---|
| Stack do handshake na captura A | `analise-auth-local/excecao-logcat-A.txt:13-16` e `:32-36` |
| Contagens DHU / A / Onex por evento SSL | `analise-auth-local/detalhes-ssl.txt:1-15` |
| Mensagem de erro na tela | `analise-auth-local/mensagens-tela.txt:1-6` |
| Comparação de etapas por captura | `analise-auth-local/comparacao-etapas.txt:1-39` |
| Sequência até a primeira divergência | `analise-auth-local/divergencia-eventos.txt:1-14` (DHU), `:16-23` (A), `:25-31` (Onex) |
| Varredura de exceções no bugreport | `analise-auth-local/excecoes-bugreport.txt:4-8`, `:14-23`, `:30-40` |
| Contexto TLS do cliente | `analise-auth-local/excecoes-bugreport.txt:47-56` |
| Descritor USB observado | `analise-auth-local/excecoes-bugreport.txt:71-73` |
| Ausência das strings APP/MCU no bugreport | `analise-auth-local/excecoes-bugreport.txt:80-81` |
| Contagens cruzadas A / Onex | `analise-cruzada-A-BT.txt:1-13` e `:15-27` |

## 3. Comparação objetiva

- DHU (`detalhes-ssl.txt:1-5`, `comparacao-etapas.txt:1-12`): `SSL_SUCCESS` 1, `SSL_NEGOTIATION_CIPHER_SUITE` 1, `OBSOLETE_SSL` 0, `AUTH_FAILED_OBSOLETE_SSL` 0, `PROTOCOL_AUTH_FAILED` 0. A sequência chega a `AUTHORIZATION_COMPLETE` (`divergencia-eventos.txt:14`).
- A, USB direto (`detalhes-ssl.txt:6-10`): `SSL_FAILED` 3, `SSL_NEGOTIATION_FAILED_OBSOLETE_SSL_USB` 3, `AUTH_FAILED_OBSOLETE_SSL` 6, `UNSUPPORTED_PROTOCOL` 6. Após `VERSION_NEGOTIATION_SUCCESS`, a sequência para em `SSL_FAILED` (`divergencia-eventos.txt:20-23`).
- Onex (`detalhes-ssl.txt:11-15`): `SSL_FAILED` 28, `SSL_NEGOTIATION_FAILED_OBSOLETE_SSL_WIFI` 28, `AUTH_FAILED_OBSOLETE_SSL` 56, `UNSUPPORTED_PROTOCOL` 56. Mesmo padrão após `VERSION_NEGOTIATION_SUCCESS_WIFI` (`divergencia-eventos.txt:26-31`).
- O GMS rotulou a negociação Onex como `_WIFI`; a topologia documentada continua sendo USB para ADB no PC e Bluetooth celular → adaptador → Vision.
- `WRONG_VERSION_NUMBER`: 0 no bugreport (`excecoes-bugreport.txt:71`); 5 linhas na captura A foram verificadas como ADB Wi-Fi, não projeção (`analise-cruzada-A-BT.txt:12`).
- Sem `CertificateException`, `CertPathValidatorException`, `TrustAnchor`, `certificate_expired`, `not yet valid`, `bad_certificate`, `Received fatal alert` ou alerta TLS recebido (`excecoes-bugreport.txt:4-8`, `:30-40`).

Interpretação limitada: DHU/Wi-Fi prova que as versões em uso conseguem autenticar contra um peer DHU. Não prova que outro telefone, conta ou versões funcionariam com a central, nem elimina esses fatores como variável.

## 4. Preservação e integridade

Nenhuma captura original foi regravada nesta etapa. Os arquivos `hashes.txt` continuam autoritativos:

| Captura | Arquivo | Hash registrado |
|---|---|---|
| `captura-VISION-A-20261124-104617` | `bugreport.txt.zip` | `E800A9BDC1D97A57` |
| `captura-VISION-A-20261124-104617` | `logcat-continuo.txt` | `967B0B445C9C6958` |
| `captura-VISION-A-20261124-104617` | `sessao-exportada.zip` | `E214595D0D232EE3` |
| `captura-VISION-BT-20261124-110042` | `logcat-continuo.txt` | `E920AA04A52F3D73` |
| `captura-VISION-BT-20261124-110042` | `sessao-exportada.zip` | `27D0583F24EA9D50` |
| `captura-DHU-ADB-WIFI-20261124-092400` | `logcat-continuo.txt` | `B6ACC0E82CD88087` |
| `captura-DHU-ADB-WIFI-20261124-092400` | `relatorio-publico.zip` | `6B0B87EE89899EA2` |

Os valores são os registrados localmente. A divergência prévia em `eventos.txt` da captura A veio de linhas acrescentadas após a geração do `hashes.txt`; não houve nova alteração agora.

## 5. Se o fornecedor enviar arquivo

Não executar nem enviar à central. Registrar origem e confirmação de compatibilidade. Pedir autorização explícita para baixar e inspecionar. Antes de qualquer gravação, verificar modelo/revisão declarados, instruções e recuperação.
