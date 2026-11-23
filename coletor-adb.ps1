<#
.SYNOPSIS
    AutoLink Diagnóstico — coletor complementar Windows (somente leitura).

.DESCRIPTION
    Lista dispositivos ADB, identifica o Motorola pelo modelo, coleta versões
    e captura o buffer logcat ATUAL (nunca limpa, nunca escreve no telefone).

    LIMITAÇÃO FÍSICA: enquanto o telefone estiver conectado por USB à central
    do carro, ele NÃO estará conectado pelo mesmo cabo ao computador. Por isso
    o fluxo é: reproduzir o erro na central -> reconectar ao computador ->
    capturar o buffer imediatamente. Registros antigos podem ter sido
    sobrescritos pelo ring buffer do logcat.

    Alternativa (opcional, configurada e pareada MANUALMENTE por você):
    depuração sem fio (`adb tcpip`/`adb pair`) caso haja conectividade
    compatível. Este script NÃO ativa nem pareia automaticamente, e não
    garante funcionamento junto ao Wi-Fi do dongle.

    Outra alternativa: gerar o relatório de bugs pelas opções do
    desenvolvedor do Android e importar o ZIP no app AutoLink Diagnóstico.
    Aviso: logs e bugreports podem conter dados pessoais.

.EXAMPLE
    .\coletor-adb.ps1
    .\coletor-adb.ps1 -AdbPath 'D:\platform-tools\adb.exe' -Modo logcat
#>
[CmdletBinding()]
param(
    [string]$AdbPath = 'C:\Users\o_hob\AppData\Local\Microsoft\WinGet\Packages\Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe\platform-tools\adb.exe',

    [ValidateSet('menu', 'versoes', 'logcat')]
    [string]$Modo = 'menu',

    [string]$Saida = ''
)

$ErrorActionPreference = 'Stop'

# Resolve a pasta de saída (PSScriptRoot pode estar vazio em defaults de param).
if (-not $Saida) {
    $caminhoScript = $MyInvocation.MyCommand.Path
    $raiz = if ($caminhoScript) { Split-Path -Parent $caminhoScript } else { (Get-Location).Path }
    $Saida = Join-Path $raiz 'coletas'
}

# --- Comandos PROIBIDOS neste script (somente leitura) ----------------------
# adb logcat -c / adb shell settings put / adb install / adb uninstall /
# adb root / adb reboot / adb shell pm clear / qualquer escrita.

function Write-Aviso([string]$Msg) { Write-Host "[AVISO] $Msg" -ForegroundColor Yellow }
function Write-Info([string]$Msg) { Write-Host "[INFO]  $Msg" -ForegroundColor Cyan }

function Testar-Adb {
    if (-not (Test-Path -LiteralPath $AdbPath)) {
        Write-Host "ADB não encontrado em: $AdbPath" -ForegroundColor Red
        Write-Host "Informe o caminho com -AdbPath 'C:\caminho\adb.exe'." -ForegroundColor Yellow
        exit 1
    }
}

function Obter-Dispositivos {
    # Sempre via -s depois; aqui só listamos.
    $linhas = & $AdbPath devices 2>&1 | Out-String
    $lista = @()
    foreach ($linha in ($linhas -split "`r?`n")) {
        if ($linha -match '^(?<serial>\S+)\s+(?<estado>\S+)\s*$' -and $linha -notmatch '^List of devices') {
            $lista += [pscustomobject]@{ Serial = $Matches['serial']; Estado = $Matches['estado'] }
        }
    }
    return $lista
}

function Obter-Modelo([string]$Serial) {
    # Somente leitura: getprop.
    $modelo = (& $AdbPath -s $Serial shell getprop ro.product.model 2>&1 | Out-String).Trim()
    $fabricante = (& $AdbPath -s $Serial shell getprop ro.product.manufacturer 2>&1 | Out-String).Trim()
    return [pscustomobject]@{ Fabricante = $fabricante; Modelo = $modelo }
}

function Escolher-Serial {
    $dispositivos = Obter-Dispositivos
    if ($dispositivos.Count -eq 0) {
        Write-Aviso "Nenhum dispositivo/emulador listado pelo ADB."
        Write-Host "Confira: cabo, depuração USB ativa e autorização 'permitir depuração USB'."
        return $null
    }

    $prontos = @($dispositivos | Where-Object { $_.Estado -eq 'device' })
    if ($prontos.Count -eq 0) {
        Write-Aviso "Dispositivos presentes, mas nenhum em estado 'device':"
        $dispositivos | Format-Table -AutoSize | Out-String | Write-Host
        Write-Aviso "Se aparecer 'unauthorized', aceite a autorização no telefone."
        return $null
    }

    $candidatos = @()
    foreach ($d in $prontos) {
        $info = Obter-Modelo $d.Serial
        Write-Info ("{0} -> {1} {2}" -f $d.Serial, $info.Fabricante, $info.Modelo)
        if ($info.Fabricante -match 'motorola' -and $info.Modelo -match 'edge') {
            $candidatos += [pscustomobject]@{ Serial = $d.Serial; Modelo = $info.Modelo }
        }
    }

    if ($candidatos.Count -eq 1) {
        Write-Info ("Motorola identificado: {0} (serial {1}...)" -f $candidatos[0].Modelo, $candidatos[0].Serial.Substring(0, [Math]::Min(4, $candidatos[0].Serial.Length)))
        return $candidatos[0].Serial
    }
    if ($candidatos.Count -eq 0 -and $prontos.Count -eq 1) {
        Write-Aviso "Só há um dispositivo conectado, mas ele não parece um Motorola Edge."
        return $prontos[0].Serial
    }
    if ($candidatos.Count -eq 0) {
        Write-Aviso "Nenhum Motorola Edge identificado. Disponíveis:"
        $prontos | ForEach-Object { Write-Host "  - $($_.Serial)" }
        return $null
    }

    Write-Aviso "Mais de um Motorola Edge encontrado. Escolha o número:"
    for ($i = 0; $i -lt $candidatos.Count; $i++) {
        Write-Host ("  [{0}] {1} (serial {2}...)" -f ($i + 1), $candidatos[$i].Modelo, $candidatos[$i].Serial.Substring(0, [Math]::Min(4, $candidatos[$i].Serial.Length)))
    }
    $escolha = Read-Host "Número"
    if ($escolha -match '^\d+$' -and [int]$escolha -ge 1 -and [int]$escolha -le $candidatos.Count) {
        return $candidatos[[int]$escolha - 1].Serial
    }
    return $null
}

function Nova-PastaSaida {
    if (-not (Test-Path -LiteralPath $Saida)) {
        New-Item -ItemType Directory -Path $Saida -Force | Out-Null
    }
    return $Saida
}

function Coletar-Versoes([string]$Serial) {
    $pasta = Nova-PastaSaida
    $arquivo = Join-Path $pasta ("versoes_{0:yyyyMMdd-HHmmss}.txt" -f (Get-Date))
    $linhas = @()
    $linhas += "=== Coleta de versões (somente leitura) ==="
    $linhas += "Data: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')"
    $linhas += "Serial: (oculto no relatório: $($Serial.Substring(0,4))...)"
    $linhas += ""

    $props = @(
        'ro.product.manufacturer', 'ro.product.model', 'ro.build.version.release',
        'ro.build.version.sdk', 'ro.build.display.id', 'ro.build.version.security_patch'
    )
    foreach ($p in $props) {
        $valor = (& $AdbPath -s $Serial shell getprop $p 2>&1 | Out-String).Trim()
        $linhas += "{0} = {1}" -f $p, $valor
    }

    $linhas += ""
    $linhas += "=== Google Play Services ==="
    $gms = (& $AdbPath -s $Serial shell dumpsys package com.google.android.gms 2>&1 | Out-String)
    $linhas += (($gms -split "`r?`n") | Where-Object { $_ -match 'versionName=|versionCode=' } | Select-Object -First 6)

    $linhas += ""
    $linhas += "=== Android Auto ==="
    $aa = (& $AdbPath -s $Serial shell dumpsys package com.google.android.projection.gearhead 2>&1 | Out-String)
    $linhas += (($aa -split "`r?`n") | Where-Object { $_ -match 'versionName=|versionCode=' } | Select-Object -First 6)

    $linhas | Out-File -FilePath $arquivo -Encoding utf8
    Write-Info "Versões salvas em: $arquivo"
    $linhas | ForEach-Object { Write-Host $_ }
    return $arquivo
}

function Coletar-Logcat([string]$Serial) {
    $pasta = Nova-PastaSaida
    $arquivo = Join-Path $pasta ("logcat_{0:yyyyMMdd-HHmmss}.txt" -f (Get-Date))

    Write-Aviso "Capturando o buffer ATUAL (NÃO foi limpo). Registros antigos podem já ter sido sobrescritos."
    # -d: drena o buffer e sai. Sem -c (nunca limpa). Sem escrita.
    $buffer = (& $AdbPath -s $Serial logcat -d -v threadtime 2>&1 | Out-String)
    $cabecalho = @(
        "=== Buffer logcat (threadtime) — coleta imediata após reproduzir o erro ===",
        "Data: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')",
        "Aviso: o ring buffer é circular; registros antigos podem ter sido sobrescritos.",
        "Aviso: este arquivo pode conter dados pessoais — revise antes de compartilhar.",
        ""
    )
    $cabecalho + ($buffer -split "`r?`n") | Out-File -FilePath $arquivo -Encoding utf8
    $tamanho = (Get-Item -LiteralPath $arquivo).Length
    Write-Info ("Logcat salvo em: {0} ({1} bytes)" -f $arquivo, $tamanho)
    Write-Info "Importe este .txt no app AutoLink Diagnóstico (aba Logs) para a análise local."
    return $arquivo
}

function Executar-Menu {
    while ($true) {
        Write-Host ""
        Write-Host "=== AutoLink Diagnóstico — coletor ADB (somente leitura) ===" -ForegroundColor Green
        Write-Host " [1] Listar dispositivos e identificar o Motorola"
        Write-Host " [2] Coletar versões (getprop + dumpsys) -> arquivo"
        Write-Host " [3] Capturar logcat AGORA (buffer atual, sem limpar) -> arquivo"
        Write-Host " [4] Sair"
        $opcao = Read-Host "Opção"
        switch ($opcao) {
            '1' {
                $serial = Escolher-Serial
                if ($serial) { Write-Info "Serial usado para os próximos comandos: $serial" }
            }
            '2' {
                $serial = Escolher-Serial
                if ($serial) { Coletar-Versoes $serial | Out-Null }
            }
            '3' {
                Write-Aviso "Procedimento: reproduza o erro na central, reconecte o cabo ao computador e escolha 3 AGORA."
                $serial = Escolher-Serial
                if ($serial) { Coletar-Logcat $serial | Out-Null }
            }
            '4' { return }
            default { Write-Aviso "Opção inválida." }
        }
    }
}

Write-Host "Limitação física: com o telefone ligado à central pelo cabo USB, ele não está conectado a este computador."
Write-Host "Procedimento 1: reproduzir o erro na central -> reconectar ao PC -> coletar o buffer imediatamente."
Write-Host "Procedimento 2 (opcional): depuração sem fio configurada e pareada MANUALMENTE por você — não é ativada por este script."
Write-Host "Alternativa: gerar relatório de bugs nas opções do desenvolvedor e importar o ZIP no app (pode conter dados pessoais)."
Write-Host ""

Testar-Adb

if ($Modo -eq 'menu') {
    Executar-Menu
} else {
    $serial = Escolher-Serial
    if (-not $serial) { exit 1 }
    if ($Modo -eq 'versoes') { Coletar-Versoes $serial | Out-Null }
    if ($Modo -eq 'logcat') { Coletar-Logcat $serial | Out-Null }
}
