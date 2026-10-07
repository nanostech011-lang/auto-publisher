# Plano Operacional de Hospedagem: Firebase Hosting + Google Cloud Run (Custo R$ 0,00)

Este documento estabelece o procedimento oficial e padronizado para a implantação, hospedagem e operação do **AutoPublisher Pro** no ecossistema **Firebase + Google Cloud Platform (GCP)**, preservando 100% da arquitetura serverless de **Custo Zero (R$ 0,00)**, *Scale-to-Zero* e conformidade com o [Definition of Done (DoD)](DoD.md).

---

## 1. Visão Geral da Arquitetura de Hospedagem

O **AutoPublisher Pro** integra uma aplicação híbrida de alta performance:
* **Backend:** Java 21 LTS (Spring Boot 3, Project Loom Virtual Threads).
* **Pipeline Upstream de Mídia:** Node.js 22, FFmpeg nativo, Edge-TTS e manipulação de legendas ASS.
* **Interface do Usuário:** Dashboard Web integrado com SPA e SSE (*Server-Sent Events*).

### Topologia de Rede Serverless:
```
                                 [ Usuário / Criador de Conteúdo ]
                                                │
                                                ▼ (HTTPS / Domínio Próprio)
                             ┌───────────────────────────────────────┐
                             │       FIREBASE HOSTING (CDN)          │
                             │  - SSL Grátis (Google CA)             │
                             │  - CDN Global de Baixa Latência       │
                             │  - https://<project>.web.app          │
                             └──────────────────┬────────────────────┘
                                                │
                                                │ (Rewrites transparentes)
                                                ▼
                             ┌───────────────────────────────────────┐
[ Cloud Scheduler ] ────────►│        GOOGLE CLOUD RUN               │
(Cron R$ 0,00 / 30m)         │  - Contêiner Alpine Multi-stage       │
 (Gatilho POST)              │  - Java 21 + FFmpeg + Node 22 (pnpm)  │
                             │  - Scale-to-Zero (0 instâncias idle)  │
                             │  - Consumo < 256MB RAM (Cota: 512MB)  │
                             └──────────────────┬────────────────────┘
                                                │
                     ┌──────────────────────────┴──────────────────────────┐
                     ▼                                                     ▼
      ┌──────────────────────────────┐                      ┌──────────────────────────────┐
      │   GOOGLE DRIVE & SHEETS      │                      │     REDES SOCIAIS (APIs)     │
      │ - Planilha "Cronograma"      │                      │ - YouTube Data API v3        │
      │ - Zero-Copy Media Stream     │                      │ - TikTok Content Posting v2  │
      │ - Ingestão de Vídeos & Thumbs│                      │ - Meta Graph API (Reels)     │
      └──────────────────────────────┘                      └──────────────────────────────┘
```

---

## 2. Auditoria da Camada Gratuita (*Always Free*)

| Componente | Cota Gratuita Mensal do Google | Consumo do AutoPublisher Pro | Custo Mensal |
| :--- | :--- | :--- | :--- |
| **Google Cloud Run** | 2.000.000 requisições<br>360.000 GB-segundos<br>180.000 vCPU-segundos | ~1.500 requisições/mês<br>~90.000 GB-segundos (512MB RAM em lotes curtos) | **R$ 0,00** |
| **Firebase Hosting** | 10 GB de armazenamento<br>360 MB/dia de transferência | < 50 MB de assets<br>Tráfego leve de dashboard | **R$ 0,00** |
| **Cloud Scheduler** | 3 jobs de agendamento cron gratuitos | 1 job cron a cada 30 minutos | **R$ 0,00** |
| **Artifact Registry** | 500 MB de armazenamento gratuito de imagens | Imagem Docker otimizada (~180MB compactada) | **R$ 0,00** |
| **YouTube Data API** | 10.000 unidades diárias por projeto | Até 6 posts/dia = 9.900 unidades | **R$ 0,00** |

> **Importante:** O projeto no Google Cloud requer ativação do faturamento (*Plano Blaze* pay-as-you-go) para liberar o Cloud Run, porém **nenhum valor é cobrado** desde que o uso permaneça dentro dos limites da camada gratuita acima.

---

## 3. Pré-Requisitos Operacionais

1. **Google Cloud SDK (`gcloud`)** instalado e autenticado:
   ```bash
   gcloud auth login
   ```
2. **Firebase CLI** instalado e autenticado:
   ```bash
   npm install -g firebase-tools
   firebase login
   ```
3. **Gerenciador de Pacotes `pnpm`** instalado localmente ($\ge 9.0.0$):
   ```bash
   pnpm --version
   ```
4. **Projeto Google Cloud / Firebase ativo** com as APIs habilitadas:
   - YouTube Data API v3
   - Google Drive API
   - Google Sheets API
   - Cloud Run Admin API
   - Cloud Scheduler API
   - Cloud Build API

---

## 4. Passo a Passo de Implantação

### Etapa 1: Selecionar o Projeto Google Cloud / Firebase
Substitua `SEU_PROJETO_ID` pelo ID oficial do seu projeto:
```bash
gcloud config set project SEU_PROJETO_ID
```

Habilite os serviços necessários com um único comando:
```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  cloudscheduler.googleapis.com \
  sheets.googleapis.com \
  drive.googleapis.com \
  youtube.googleapis.com
```

---

### Etapa 2: Build e Deploy do Contêiner no Cloud Run

O projeto já contém um [Dockerfile](file:///d:/estudo/Projetos/auto-publisher/Dockerfile) multi-stage afinado com Java 21, FFmpeg nativo, `pnpm` e usuário não-root `appuser`.

Execute o deploy diretamente da raiz do projeto:

```bash
gcloud run deploy autopublisher-pro \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 2 \
  --port 8080 \
  --timeout 900s \
  --set-env-vars "SPRING_PROFILES_ACTIVE=prod,AUTOPUBLISHER_SECURITY_API_KEY=sua-chave-mestra-secreta"
```

**Parâmetros Mandatórios:**
* `--min-instances 0`: **Mandatório**. Desliga instâncias ociosas (Scale-to-Zero), garantindo custo zero.
* `--memory 512Mi`: Suficiente para Virtual Threads do Java e streaming de mídia.
* `--timeout 900s`: Limite de 15 minutos para processamentos de renderização de vídeo longos.

---

### Etapa 3: Configurar o Firebase Hosting (com Rewrites)

1. Crie o arquivo `firebase.json` na raiz do projeto com o seguinte conteúdo:

```json
{
  "hosting": {
    "public": "public",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "run": {
          "serviceId": "autopublisher-pro",
          "region": "us-central1"
        }
      }
    ]
  }
}
```

2. Certifique-se de que o diretório `public/` existe (pode conter um `index.html` estático ou permanecer vazio, pois todos os pedidos serão direcionados pelo rewrite ao Cloud Run):
```bash
mkdir -p public
```

3. Vincule e faça o deploy no Firebase Hosting:
```bash
firebase use SEU_PROJETO_ID
firebase deploy --only hosting
```

Ao concluir, você receberá a URL global:
```
✔  Hosting URL: https://SEU_PROJETO_ID.web.app
```

---

### Etapa 4: Configurar as Variáveis de Ambiente de Produção

Configure as credenciais reais no Cloud Run via console web ou via CLI:

```bash
gcloud run services update autopublisher-pro \
  --region us-central1 \
  --update-env-vars "\
YOUTUBE_CLIENT_ID=seu_client_id.apps.googleusercontent.com,\
YOUTUBE_CLIENT_SECRET=seu_client_secret,\
YOUTUBE_REFRESH_TOKEN=seu_refresh_token_offline,\
GOOGLE_SHEETS_SPREADSHEET_ID=sua_planilha_id,\
AUTOPUBLISHER_SECURITY_API_KEY=sua_chave_mestra_secreta,\
AUTOPUBLISHER_AI_GEMINI_API_KEY=sua_chave_gemini,\
AUTOPUBLISHER_AI_PEXELS_API_KEY=sua_chave_pexels"
```

---

### Etapa 5: Configurar o Gatilho Serverless (Cloud Scheduler)

Crie o job de agendamento gratuito que aciona o endpoint protegido periodicamente:

```bash
gcloud scheduler jobs create http autopublisher-cron \
  --schedule="*/30 * * * *" \
  --uri="https://SEU_PROJETO_ID.web.app/api/v1/publisher/run" \
  --http-method=POST \
  --headers="X-API-KEY=sua-chave-mestra-secreta" \
  --time-zone="America/Sao_Paulo" \
  --location=us-central1
```

O Scheduler aciona o Firebase Hosting a cada 30 minutos; o Firebase acorda o container do Cloud Run; a aplicação processa todos os vídeos pendentes do Google Sheets e, após o término, o container é suspenso automaticamente.

---

## 5. Domínio Próprio com SSL Gratuito

Para apontar seu domínio customizado (ex: `app.meucanal.com`):
1. Acesse o **Firebase Console** > **Hosting** > **Adicionar Domínio Personalizado**.
2. Digite seu subdomínio ou domínio.
3. Adicione os registros `CNAME` ou `A` no seu provedor de DNS (Cloudflare, GoDaddy, Hostinger, etc.).
4. O Firebase provisiona e renova certificados SSL automaticamente sem qualquer custo adicional.

---

## 6. Checklist de Validação Pós-Deploy (DoD Operacional)

- [ ] **Healthcheck:** Acessar `https://SEU_PROJETO_ID.web.app/api/v1/health` e receber status `UP`.
- [ ] **Painel Web:** Acessar `https://SEU_PROJETO_ID.web.app/` e carregar o Studio IA e a listagem de posts.
- [ ] **Autenticação:** Tentar `POST /api/v1/publisher/run` sem header `X-API-KEY` e confirmar retorno HTTP 401 Unauthorized.
- [ ] **Disparo Manual:** Enviar `POST /api/v1/publisher/run` com `X-API-KEY: sua-chave` e confirmar execução de lote no log.
- [ ] **Scale-to-Zero:** Observar no Google Cloud Console > Cloud Run que o número de instâncias ativas retorna para **0** após 15 minutos de inatividade.
- [ ] **Segurança de Segredos:** Nenhuma credencial em texto plano visível no código, no Git ou em variáveis públicas do front-end.
