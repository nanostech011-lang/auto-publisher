# Arquitetura de Nuvem Custo Zero: Firebase Hosting + GitHub Actions (Sem Cartão)

Este documento descreve a operação 100% serverless do **AutoPublisher Pro** utilizando a combinação **Firebase Hosting (Plano Spark)** e **GitHub Actions (Cron)**, garantindo custo **R$ 0,00** e **zero necessidade de cadastrar cartão de crédito**.

---

## 1. Topologia da Solução

```
                    [ Painel / Studio IA ]
                              │
                              ▼ (HTTPS / CDN Grátis)
                 ┌─────────────────────────────┐
                 │    FIREBASE HOSTING         │  Plano Spark Gratuito
                 │    (Plano Spark - Sem Cartão│  (10GB storage, 360MB/dia)
                 │  https://<app>.web.app      │
                 └─────────────────────────────┘

                                ═════

                 ┌─────────────────────────────┐
                 │       GITHUB ACTIONS        │  2.000 minutos/mês GRÁTIS
                 │   (Cron Automático / Manual)│  Sem cartão de crédito
                 └──────────────┬──────────────┘
                                │ Executa Runner Linux (Java 21)
                                ▼
                 ┌─────────────────────────────┐
                 │    AutoPublisher Pro CLI    │
                 │   (--autopublisher.run-once)│
                 └──────────────┬──────────────┘
                                │ Streaming Zero-Copy
                ┌───────────────┴───────────────┐
                ▼                               ▼
  ┌───────────────────────────┐   ┌───────────────────────────┐
  │   GOOGLE DRIVE & SHEETS   │   │   YOUTUBE / TIKTOK / META │
  │ - Planilha "Cronograma"   │   │ - YouTube Data API v3     │
  │ - Vídeos via Stream       │   │ - Quota Guard (10k un.)   │
  └───────────────────────────┘   └───────────────────────────┘
```

---

## 2. Como Funciona

1. **Frontend / Painel Web:**  
   Hospedado no **Firebase Hosting** ([https://autopublisher-pro.web.app](https://autopublisher-pro.web.app)). Fica disponível 24h por dia na CDN global do Google, sem consumir recursos de servidor.
2. **Gatilho de Publicação Serverless:**  
   O arquivo de workflow [`.github/workflows/auto-publisher-cron.yml`](../../.github/workflows/auto-publisher-cron.yml) roda automaticamente a cada 1 hora (ou nos horários de agendamento desejados) ou manualmente via botão no GitHub.
3. **Execução Isolada e Segura:**  
   A cada execução, o runner do GitHub sobe uma máquina virtual Ubuntu com Java 21, executa o comando `./mvnw spring-boot:run -Dspring-boot.run.arguments="--autopublisher.run-once=true"`, publica os vídeos pendentes do Google Drive para o YouTube e desliga imediatamente.
4. **Consumo de Minutos:**  
   Cada execução dura cerca de 40 a 60 segundos. Rodando 4 vezes ao dia, consome menos de **80 minutos por mês** da franquia gratuita de **2.000 minutos mensais do GitHub Actions**.

---

## 3. Configuração dos Secrets no GitHub (Passo Único)

No seu repositório no GitHub:
1. Acesse: **Settings** > **Secrets and variables** > **Actions**.
2. Clique em **"New repository secret"** e adicione as seguintes chaves com os valores do seu arquivo `.env`:

| Nome do Secret | Descrição |
| :--- | :--- |
| `YOUTUBE_CLIENT_ID` | Client ID do OAuth 2.0 do Google Console |
| `YOUTUBE_CLIENT_SECRET` | Client Secret do OAuth 2.0 do Google Console |
| `YOUTUBE_REFRESH_TOKEN` | Refresh Token permanente offline do YouTube |
| `GOOGLE_SHEETS_SPREADSHEET_ID`| ID da sua planilha Google Sheets |
| `AUTOPUBLISHER_SECURITY_API_KEY` | Chave de segurança mestra da aplicação |
| `AUTOPUBLISHER_AI_GEMINI_API_KEY` | Chave de API do Google Gemini (IA de roteiros) |
| `AUTOPUBLISHER_AI_PEXELS_API_KEY` | Chave da API do Pexels (opcional - b-roll) |
| `AUTOPUBLISHER_AI_PIXABAY_API_KEY`| Chave da API do Pixabay (opcional - b-roll) |

---

## 4. Como Disparar Manualmente pelo GitHub

1. No seu repositório no GitHub, clique na aba **Actions**.
2. Na barra lateral esquerda, clique em **"AutoPublisher Pro - Gatilho Serverless (GitHub Actions)"**.
3. Clique no botão **"Run workflow"** e confirme.
4. O GitHub executará o job e exibirá os logs detalhados de cada postagem em tempo real!
