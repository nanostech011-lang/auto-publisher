# ==============================================================================
# AutoPublisher Pro - Deploy Unificado Firebase Hosting + Google Cloud Run
# ==============================================================================

param (
    [string]$ProjectId = "",
    [string]$Region = "us-central1",
    [string]$ServiceName = "autopublisher-pro"
)

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  AutoPublisher Pro - Deploy Firebase + Cloud Run    " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# 1. Validação do gcloud e firebase CLI
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Error "O Google Cloud CLI (gcloud) nao foi encontrado no PATH. Instale o gcloud antes de continuar."
    exit 1
}

if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
    Write-Host "Firebase CLI nao encontrado localmente. Tentando via npx firebase..." -ForegroundColor Yellow
    $FirebaseCmd = "npx firebase"
} else {
    $FirebaseCmd = "firebase"
}

# 2. Obtem ou valida o Project ID
if ([string]::IsNullOrWhiteSpace($ProjectId)) {
    $ProjectId = (gcloud config get-value project 2>$null).Trim()
    if ([string]::IsNullOrWhiteSpace($ProjectId)) {
        Write-Error "Nenhum projeto Google Cloud configurado. Passe -ProjectId <seu-id> ou execute 'gcloud config set project <id>'."
        exit 1
    }
}

Write-Host "Projeto: $ProjectId" -ForegroundColor Green
Write-Host "Regiao Cloud Run: $Region" -ForegroundColor Green
Write-Host "Servico Cloud Run: $ServiceName" -ForegroundColor Green

# 3. Sincroniza o index.html na pasta public/
Write-Host "`n[1/4] Sincronizando assets estaticos para public/..." -ForegroundColor Yellow
if (-not (Test-Path "public")) {
    New-Item -ItemType Directory -Path "public" -Force | Out-Null
}
Copy-Item "src/main/resources/static/index.html" -Destination "public/index.html" -Force

# 4. Atualiza o arquivo .firebaserc com o ProjectId correto
Write-Host "`n[2/4] Configurando .firebaserc..." -ForegroundColor Yellow
@"
{
  "projects": {
    "default": "$ProjectId"
  }
}
"@ | Set-Content -Path ".firebaserc" -Encoding UTF8

# 5. Executa deploy do Cloud Run
Write-Host "`n[3/4] Realizando deploy do container no Google Cloud Run..." -ForegroundColor Yellow
gcloud run deploy $ServiceName `
    --source . `
    --platform managed `
    --region $Region `
    --project $ProjectId `
    --allow-unauthenticated `
    --min-instances 0 `
    --max-instances 2 `
    --memory 512Mi `
    --cpu 1 `
    --timeout 900s `
    --port 8080 `
    --set-env-vars "SPRING_PROFILES_ACTIVE=prod,SPRING_THREADS_VIRTUAL_ENABLED=true"

# 6. Executa deploy no Firebase Hosting
Write-Host "`n[4/4] Realizando deploy no Firebase Hosting..." -ForegroundColor Yellow
if ($FirebaseCmd -eq "firebase") {
    firebase deploy --only hosting --project $ProjectId
} else {
    npx -y firebase-tools deploy --only hosting --project $ProjectId
}

Write-Host "`n======================================================" -ForegroundColor Green
Write-Host "  DEPLOY CONCLUIDO COM SUCESSO!                     " -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host "Acesse o sistema pela URL global do Firebase:" -ForegroundColor Cyan
Write-Host "https://$ProjectId.web.app" -ForegroundColor Cyan
Write-Host "Endpoint do Cron Trigger:" -ForegroundColor Cyan
Write-Host "https://$ProjectId.web.app/api/v1/publisher/run" -ForegroundColor Cyan
