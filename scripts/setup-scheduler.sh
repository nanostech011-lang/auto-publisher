#!/bin/bash
# ==============================================================================
# AutoPublisher Pro - Script de Configuracao do Cloud Scheduler (Bash)
# Cumpre US-05.3: Acionamento via Cron Externo sem manter servico ligado (R$ 0,00)
# ==============================================================================

set -e

SERVICE_URL=$1
SCHEDULE=${2:-"*/30 * * * *"}
TIMEZONE=${3:-"America/Sao_Paulo"}
JOB_NAME="autopublisher-cron-trigger"
LOCATION="southamerica-east1"

if [ -z "$SERVICE_URL" ]; then
  echo "Erro: Forneca a URL do servico Cloud Run como primeiro argumento."
  echo "Exemplo: ./scripts/setup-scheduler.sh 'https://autopublisher-pro-xyz.a.run.app'"
  exit 1
fi

API_KEY=$(grep '^AUTO_PUBLISHER_API_KEY=' .env 2>/dev/null | cut -d '=' -f2- || echo "sua-chave-secreta")
ENDPOINT_URL="${SERVICE_URL}/api/v1/publisher/run"

echo "Configurando Cloud Scheduler job '$JOB_NAME'..."

# Deleta se ja existir
gcloud scheduler jobs delete "$JOB_NAME" --location "$LOCATION" --quiet 2>/dev/null || true

# Cria o job
gcloud scheduler jobs create http "$JOB_NAME" \
    --location "$LOCATION" \
    --schedule "$SCHEDULE" \
    --time-zone "$TIMEZONE" \
    --uri "$ENDPOINT_URL" \
    --http-method POST \
    --headers "X-API-KEY=${API_KEY},Content-Type=application/json" \
    --attempt-deadline 900s

echo "Cloud Scheduler configurado com sucesso para disparar a cada 30 minutos!"
