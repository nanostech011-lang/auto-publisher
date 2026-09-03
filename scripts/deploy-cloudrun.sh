#!/bin/bash
# ==============================================================================
# AutoPublisher Pro - Script de Deploy no Google Cloud Run (Bash)
# Cumpre US-05.2: Escala para 0 instâncias (Custo R$ 0,00), 512MB RAM, timeout 900s
# ==============================================================================

set -e

PROJECT_ID=${1:-$(gcloud config get-value project 2>/dev/null)}
REGION=${2:-"southamerica-east1"}
SERVICE_NAME=${3:-"autopublisher-pro"}

if [ -z "$PROJECT_ID" ]; then
  echo "Erro: Nenhum projeto Google Cloud configurado. Passe o Project ID como primeiro parametro."
  exit 1
fi

echo "Deploying $SERVICE_NAME to Google Cloud Run (Project: $PROJECT_ID, Region: $REGION)..."

# Habilita servicos
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudscheduler.googleapis.com --project "$PROJECT_ID"

# Build e push da imagem
IMAGE_TAG="gcr.io/$PROJECT_ID/${SERVICE_NAME}:latest"
gcloud builds submit --tag "$IMAGE_TAG" . --project "$PROJECT_ID"

# Deploy no Cloud Run com escala a zero
gcloud run deploy "$SERVICE_NAME" \
    --image "$IMAGE_TAG" \
    --platform managed \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --allow-unauthenticated \
    --min-instances 0 \
    --max-instances 1 \
    --memory 512Mi \
    --cpu 1 \
    --timeout 900s \
    --port 8080 \
    --set-env-vars "SPRING_THREADS_VIRTUAL_ENABLED=true"

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --platform managed --region "$REGION" --project "$PROJECT_ID" --format "value(status.url)")

echo "Deploy concluido com sucesso!"
echo "URL do servico: $SERVICE_URL"
echo "Para configurar o Scheduler, execute: ./scripts/setup-scheduler.sh '$SERVICE_URL'"
