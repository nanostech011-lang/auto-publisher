# ==============================================================================
# AutoPublisher Pro - Script de Configuracao do Google Cloud Scheduler (Windows PowerShell)
# Cumpre US-05.3: Acionamento via Cron Externo sem manter servico ligado (R$ 0,00)
# ==============================================================================

param (
    [Parameter(Mandatory=$true)]
    [string]$ServiceUrl,
    [string]$Schedule = "*/30 * * * *",
    [string]$Timezone = "America/Sao_Paulo",
    [string]$JobName = "autopublisher-cron-trigger",
    [string]$Location = "southamerica-east1"
)

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  AutoPublisher Pro - Setup do Cloud Scheduler       " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# Verifica chave de API no .env
$ApiKey = ""
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match "^\s*AUTO_PUBLISHER_API_KEY\s*=\s*(.+)$") {
            $ApiKey = $matches[1].Trim()
        }
    }
}

if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    Write-Host "Aviso: AUTO_PUBLISHER_API_KEY nao encontrada no .env. Usando chave padrao de teste." -ForegroundColor Yellow
    $ApiKey = "sua-chave-secreta"
}

$EndpointUrl = "$ServiceUrl/api/v1/publisher/run"

Write-Host "Alvo HTTP: $EndpointUrl" -ForegroundColor Green
Write-Host "Expressao Cron: $Schedule ($Timezone)" -ForegroundColor Green
Write-Host "Job Name: $JobName" -ForegroundColor Green

# 1. Deleta o job antigo se existir
Write-Host "`n[1/2] Verificando se o job ja existe..." -ForegroundColor Yellow
gcloud scheduler jobs delete $JobName --location $Location --quiet 2>$null

# 2. Cria o novo job no Cloud Scheduler
Write-Host "`n[2/2] Criando job no Cloud Scheduler..." -ForegroundColor Yellow
gcloud scheduler jobs create http $JobName `
    --location $Location `
    --schedule "$Schedule" `
    --time-zone "$Timezone" `
    --uri "$EndpointUrl" `
    --http-method POST `
    --headers "X-API-KEY=$ApiKey,Content-Type=application/json" `
    --attempt-deadline 900s

Write-Host "`n======================================================" -ForegroundColor Green
Write-Host "  CLOUD SCHEDULER CONFIGURADO COM SUCESSO!           " -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host "O Cloud Scheduler agora ira acordar o Cloud Run a cada 30 minutos." -ForegroundColor Cyan
Write-Host "Para testar o disparo agora mesmo via linha de comando:" -ForegroundColor Yellow
Write-Host "gcloud scheduler jobs run $JobName --location $Location" -ForegroundColor Yellow
