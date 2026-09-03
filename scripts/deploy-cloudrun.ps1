# ==============================================================================
# AutoPublisher Pro - Script de Deploy no Google Cloud Run (Windows PowerShell)
# Cumpre US-05.2: Escala para 0 instâncias (Custo R$ 0,00), 512MB RAM, timeout 900s
# ==============================================================================

param (
    [string]$ProjectId = "",
    [string]$Region = "southamerica-east1",
    [string]$ServiceName = "autopublisher-pro"
)

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  AutoPublisher Pro - Deploy no Google Cloud Run     " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# Verifica se o gcloud CLI esta instalado
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Error "O Google Cloud CLI (gcloud) nao foi encontrado no PATH. Instale o gcloud antes de continuar."
    exit 1
}

# Obtem ou valida o Project ID
if ([string]::IsNullOrWhiteSpace($ProjectId)) {
    $ProjectId = (gcloud config get-value project 2>$null).Trim()
    if ([string]::IsNullOrWhiteSpace($ProjectId)) {
        Write-Error "Nenhum projeto Google Cloud configurado. Passe -ProjectId <seu-id> ou execute 'gcloud config set project <id>'."
        exit 1
    }
}

Write-Host "Projeto Google Cloud: $ProjectId" -ForegroundColor Green
Write-Host "Regiao: $Region" -ForegroundColor Green
Write-Host "Servico: $ServiceName" -ForegroundColor Green

# 1. Habilita as APIs necessarias no GCP
Write-Host "`n[1/4] Habilitando servicos necessarios no Google Cloud..." -ForegroundColor Yellow
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudscheduler.googleapis.com --project $ProjectId

# 2. Constrói e envia a imagem Docker via Cloud Build
Write-Host "`n[2/4] Enviando codigo e construindo imagem via Google Cloud Build..." -ForegroundColor Yellow
$ImageTag = "gcr.io/$ProjectId/${ServiceName}:latest"
gcloud builds submit --tag $ImageTag . --project $ProjectId

# 3. Executa o deploy no Cloud Run com escala para zero
Write-Host "`n[3/4] Realizando deploy no Cloud Run com Scale-to-Zero..." -ForegroundColor Yellow
gcloud run deploy $ServiceName `
    --image $ImageTag `
    --platform managed `
    --region $Region `
    --project $ProjectId `
    --allow-unauthenticated `
    --min-instances 0 `
    --max-instances 1 `
    --memory 512Mi `
    --cpu 1 `
    --timeout 900s `
    --port 8080 `
    --set-env-vars "SPRING_THREADS_VIRTUAL_ENABLED=true"

# 4. Obtem a URL gerada
$ServiceUrl = (gcloud run services describe $ServiceName --platform managed --region $Region --project $ProjectId --format "value(status.url)").Trim()

Write-Host "`n======================================================" -ForegroundColor Green
Write-Host "  DEPLOY CONCLUIDO COM SUCESSO!                     " -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host "URL do Servico: $ServiceUrl" -ForegroundColor Cyan
Write-Host "Endpoint de Trigger: $ServiceUrl/api/v1/publisher/run" -ForegroundColor Cyan
Write-Host "`nPara configurar o agendamento automatico, execute:" -ForegroundColor Yellow
Write-Host ".\scripts\setup-scheduler.ps1 -ServiceUrl `"$ServiceUrl`"" -ForegroundColor Yellow
