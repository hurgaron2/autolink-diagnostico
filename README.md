# AutoLink Diagnóstico

Aplicativo Android de diagnóstico **passivo** para investigar a incompatibilidade que gera o
**erro 7 do Android Auto** entre o **Motorola Edge 50 Pro** e a **central Vision 8920CP**,
usando o adaptador **Onex CAR-6517 / HW501**.

> **Isto não é um diagnóstico automático.** O app coleta evidências (painel do telefone, USB,
> linha do tempo, logs importados) e as empacota para análise. Ele **não** implementa Android Auto,
> **não** emula central, **não** intercepta tráfego e **não** contorna autenticação.

Stack: **Ionic 9 + Angular 22 + Capacitor 8**, plugin nativo **local em Kotlin**, sem root.

---

## 1. O que o app faz (MVP)

| Tela | Conteúdo |
|------|----------|
| **Visão geral** | Painel do telefone (Build + PackageManager), status da sessão/USB/logs, limitações da coleta |
| **USB** | Enumeração passiva de `UsbDevice`/`UsbAccessory`, interfaces/endpoints, eventos de conexão |
| **Sessão** | Iniciar/marcar "tentativa de conexão"/"Erro 7 apareceu"/observação/encerrar + linha do tempo + lacunas |
| **Logs** | Log interno do app, importação de logcat TXT e de bugreport ZIP, análise local com contexto |
| **Relatório** | Cadastro manual da central/adaptador, exportação do ZIP por compartilhamento nativo |

### Origem de cada informação (sempre visível na UI)

- **API** — coletado por APIs públicas (`Build`, `PackageManager`, `UsbManager`).
- **Log importado** — vem de arquivo que você mesmo obtveu (ADB ou opções do desenvolvedor).
- **Manual** — digitado por você (identificadores da central, observações).
- **Indisponível** — a coleta falhou ou não existe neste ambiente; **nada é inventado**.

### O que o plugin Kotlin faz (somente leitura)

- `getPhoneInfo()` — fabricante, modelo, Android, SDK, build, patch de segurança.
- `getAppVersions()` — `versionName`/`versionCode` de `com.google.android.gms` e
  `com.google.android.projection.gearhead` (com `<queries>` pontual; **sem** `QUERY_ALL_PACKAGES`;
  pacote ausente e falha de consulta viram `indisponivel` com o motivo).
- `getUsbSnapshot()` — `getDeviceList()` + `getAccessoryList()` com VID/PID, classe/subclasse/
  protocolo, fabricante/produto, interfaces e endpoints (direção, tipo, tamanho máximo de pacote),
  e fabricante/modelo/descrição/versão/URI do acessório. **Seriais omitidos por padrão.**
- `startObserving()/stopObserving()` — receiver **dinâmico** dos broadcasts públicos de
  attach/detach. **Não há intent-filter no manifest**, então o app **não disputa** o Android Auto
  como aplicativo padrão de acessório.

**O que o plugin NÃO faz:** abrir acessório, reivindicar interface, `controlTransfer`,
`bulkTransfer`, enviar payloads, ler firmware da central, registrar permissões extras.

---

## 2. Estrutura

```
autolink-diagnostico/
├── coletor-adb.ps1                 # Coletor Windows (PowerShell 5.1, somente leitura)
├── README.md
├── capacitor.config.ts
├── src/app/
│   ├── core/                       # Serviços e lógica pura (testada)
│   │   ├── models.ts               # Tipos + origem dos dados
│   │   ├── log-parser.ts           # Parser logcat + análise por termos (puro)
│   │   ├── zip-guard.ts            # Proteção contra path traversal/limites (puro)
│   │   ├── sanitize.ts             # Ocultação de identificadores (puro)
│   │   ├── plugin.ts               # Ponte Capacitor -> plugin Kotlin
│   │   ├── device-info.service.ts  # Painel do telefone
│   │   ├── usb.service.ts          # Enumeração + diff de mudanças
│   │   ├── session.service.ts      # Sessão, linha do tempo, lacunas
│   │   ├── log-import.service.ts   # Importação TXT/ZIP + análise local
│   │   ├── export.service.ts       # Montagem e compartilhamento do ZIP
│   │   ├── storage.service.ts      # localStorage + armazenamento privado
│   │   ├── central.service.ts      # Cadastro manual da central
│   │   └── app-log.service.ts      # Log interno do próprio app
│   ├── pages/                      # 5 telas (pt-BR)
│   └── shared/origem.pipe.ts
└── android/app/src/main/
    ├── java/com/autolink/diagnostico/
    │   ├── AutoLinkPlugin.kt       # Plugin local em Kotlin
    │   └── MainActivity.java       # registerPlugin() antes de super.onCreate()
    └── AndroidManifest.xml         # <queries> pontual; SEM filtros USB
```

---

## 3. Construir e testar

```powershell
cd C:\Users\o_hob\OneDrive\_ProjetoAuto\autolink-diagnostico

# Testes unitários (vitest, 49 testes)
npx ng test --configuration ci

# Build web (compila TypeScript + templates)
npx ng build

# Sincronizar web -> Android
npx cap sync android

# APK de debug
cd android
.\gradlew.bat assembleDebug --no-daemon
# -> android\app\build\outputs\apk\debug\app-debug.apk
```

Pré-requisitos usados neste ambiente: Node 24, npm 11, Ionic CLI 7, Java 22,
Android SDK (`platforms\android-36`, `build-tools\36.0.0`).

**APK debug gerado:** `android\app\build\outputs\apk\debug\app-debug.apk`
(~5,4 MB; instalação **não** realizada — aguardando confirmação do usuário).

---

## 4. Coleta de logs reais (sem mentira)

O app **não** tem botão de "coleta automática de logs do sistema": sem root/privilegiário isso
não existe. O caminho real é importar arquivos já obtidos:

### Procedimento 1 — buffer após reproduzir o erro (recomendado)

1. Conecte o telefone **à central** pelo USB e reproduza o erro 7.
2. Desconecte da central e reconecte **ao computador**.
3. Rode imediatamente: `.\coletor-adb.ps1` → opção **[3]**.
4. Importe o `.txt` gerado na aba **Logs** do app.

> **Limitação física:** o cabo é um só — com o telefone na central ele não está no computador.
> O ring buffer do logcat é circular: registros antigos **podem ter sido sobrescritos**.

### Procedimento 2 — depuração sem fio (opcional)

Se você configurar e parear **manualmente** a depuração sem fio (`adb pair`/`adb connect`) e
houver conectividade compatível, o script funciona pelo mesmo caminho. Este projeto **não** ativa
nem pareia nada automaticamente, e **não garante** que funcione junto ao Wi-Fi do dongle.

### Alternativa — relatório de bugs

Gere o bugreport pelas **opções do desenvolvedor** do Android e importe o **ZIP** na aba Logs.
O app extrai apenas arquivos de texto, com limites (300 entradas, 48 MB/entrada, 96 MB total,
anti path traversal). **Aviso: logs e bugreports podem conter dados pessoais.**

### O script `coletor-adb.ps1`

- Compatível com **Windows PowerShell 5.1** (salvo com BOM UTF-8).
- Caminho do ADB configurável por `-AdbPath` (default: caminho WinGet conhecido).
- Sempre usa `-s <serial>`; identifica o Motorola pelo modelo.
- **Nunca** executa `logcat -c`, instala, desinstala, escreve configurações, reinicia ou limpa dados.
- Coleta `getprop` + `dumpsys` (versões) e `logcat -d -v threadtime` (buffer atual).
- Saídas em `coletas\` com data/hora e aviso de dados pessoais.

---

## 5. Exportação (aba Relatório)

ZIP gerado localmente e compartilhado **por ação sua** (sem servidor, sem analytics, sem upload):

| Arquivo | Conteúdo |
|---------|----------|
| `manifest.json` | Versão do esquema (v1), opções, avisos |
| `device.json` | Painel do telefone com origem de cada campo |
| `central.json` | Dados manuais + marcação `confirmadoPorUsb: false` |
| `usb-snapshots.json` | Snapshots USB + observações do modo passivo |
| `timeline.json` | Sessão, eventos, monotonicMs, fuso, lacunas |
| `app-events.txt` | Log interno do próprio aplicativo |
| `resumo.txt` | Resumo legível em texto |
| `logs/*.txt` | **Só se você marcar** "incluir logs" (e optar pela sanitização) |

- Ocultação de identificadores aplicada nos arquivos derivados — **a sanitização não é
  perfeita** (o `manifest.json` sempre avisa).
- Logs brutos ficam no armazenamento **privado** até você exportar ou excluí-los.

---

## 6. Limitações reais (leia antes de interpretar resultados)

1. **Ausência de USB visível não é defeito de hardware** nem prova de "central desconectada":
   o app só vê o que o `UsbManager` expõe a ele.
2. **A central não foi testada por USB neste projeto.** Nenhuma leitura de firmware da
   Vision 8920CP foi implementada (não há protocolo documentado) e **nenhuma tentativa de
   atualização** foi feita.
3. Identificador APP `ZCDP0UIN08_2022/08/04` é **informado manualmente / não confirmado por USB**.
4. O receiver dinâmico de USB depende do OEM entregar os broadcasts; a reenumeração ao entrar/retornar
   na tela USB cobre a observação mesmo assim. **Não testado em aparelho físico ainda.**
5. Só há **UMA** sessão ativa por vez; sem serviço em segundo plano, saídas do app geram
   **lacunas de observação** explícitas na linha do tempo.
6. A análise de logs é **evidência, não diagnóstico**: encontrar "SSL" ou "gearhead" não prova
   a causa do erro 7.
7. Os números de versão (Play Services 26.45.31, Android Auto 18.0.664284) **não servem sozinhos
   para concluir a causa** — precisam ser interpretados junto com a linha do tempo e os logs.

---

## 7. Pendências

- [ ] **Instalar o APK debug no Edge 50 Pro** (aguardando confirmação do usuário).
- [ ] **Teste físico**: rodar o app com o telefone conectado à Vision 8920CP e validar enumeração USB,
      eventos de attach/detach e marcação do erro 7 em aparelho real.
- [ ] Validar importação de um **bugreport real** (só testamos o guard com ZIPs gerados nos testes).
- [x] `ng lint` — passa com 0 erros (duas regras estilísticas do Angular 22 desativadas de
      propósito, ver `eslint.config.js`: `prefer-inject` e `prefer-control-flow`; migrar quando
      estabilizar em dispositivo real).
- [ ] Exportar **sessão antiga selecionável** (hoje exporta a ativa ou a última encerrada).
- [ ] Sessão persistida em `localStorage` tem cota limitada (~5 MB): sessões com centenas de
      eventos podem falhar em gravação (o app segue em memória e avisa no export).
- [ ] Compatibilidade com iOS não foi avaliada (o plugin é Android).
