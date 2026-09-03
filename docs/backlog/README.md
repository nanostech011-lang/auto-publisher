# Product Backlog - AutoPublisher Pro

Este diretório gerencia o **Backlog Ágil** do produto, estruturado em **Épicos** e **Histórias de Usuário** com critérios de aceitação rigorosos, alinhados à [Definition of Done (DoD)](../DoD.md), às decisões arquiteturais ([ADRs](../adr/README.md)) e ao [PRD v2.0](../PRD_AutoPublisher_Completo.md).

---

## 🧭 Visão Geral e Priorização (MoSCoW)

O backlog está organizado para viabilizar um MVP funcional focado em **monetização imediata no YouTube (Shorts e Vídeos Longos)** na Fase 1, com arquitetura preparada para expansão multiplataforma (Instagram e TikTok) na Fase 2.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             FASE 1: MVP YOUTUBE                             │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│    ÉPICO 01     │    ÉPICO 02     │    ÉPICO 03     │       ÉPICO 04        │
│ Infra & Setup   │ Domínio & Port  │ Adaptadores     │ Orquestração & Quota  │
│ (Bootstrap Java)│ (Clean Core)    │ (Sheets/Drive/YT│ (Monetização & Retry) │
└────────┬────────┴────────┬────────┴────────┬────────┴───────────┬───────────┘
         │                 │                 │                    │
         ▼                 ▼                 ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     ÉPICO 05: TRIGGER SERVERLESS & CLOUD                    │
│        (Cloud Scheduler + Cloud Run Scale-to-Zero - R$ 0,00)                │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                FASE 2: EXPANSÃO MULTIPLATAFORMA (ÉPICO 06)                  │
│               (Instagram Reels API + TikTok Posting API)                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Matriz Consolidada de Épicos e Histórias

| ID | Épico / História | Prioridade | Complexidade | Arquivo de Detalhe |
| :---: | :--- | :---: | :---: | :--- |
| **EP-01** | **Infraestrutura, Setup e Segurança** | **Must** | **Média** | [epico-01-infraestrutura-e-setup.md](epico-01-infraestrutura-e-setup.md) |
| US-01.1 | Bootstrap do Projeto Spring Boot 3 + Java 21 | Must | Baixa | [epico-01](epico-01-infraestrutura-e-setup.md#us-011) |
| US-01.2 | Configuração de Credenciais e Variáveis de Ambiente | Must | Baixa | [epico-01](epico-01-infraestrutura-e-setup.md#us-012) |
| US-01.3 | Dockerfile Multi-stage Otimizado (JRE Alpine) | Must | Média | [epico-01](epico-01-infraestrutura-e-setup.md#us-013) |
| **EP-02** | **Núcleo de Domínio e Arquitetura Hexagonal** | **Must** | **Média** | [epico-02-dominio-e-portas.md](epico-02-dominio-e-portas.md) |
| US-02.1 | Modelagem de Entidades e Value Objects Imutáveis | Must | Baixa | [epico-02](epico-02-dominio-e-portas.md#us-021) |
| US-02.2 | Definição das Portas de Entrada e Saída (Interfaces) | Must | Baixa | [epico-02](epico-02-dominio-e-portas.md#us-022) |
| US-02.3 | Exceções de Negócio Tipadas (Domain Exceptions) | Must | Baixa | [epico-02](epico-02-dominio-e-portas.md#us-023) |
| **EP-03** | **Adaptadores de Integração e Streaming** | **Must** | **Alta** | [epico-03-adaptadores-e-streaming.md](epico-03-adaptadores-e-streaming.md) |
| US-03.1 | GoogleSheetsAdapter (Leitura e Atualização Cirúrgica) | Must | Média | [epico-03](epico-03-adaptadores-e-streaming.md#us-031) |
| US-03.2 | GoogleDriveAdapter (Streaming Zero-Copy via InputStream) | Must | Alta | [epico-03](epico-03-adaptadores-e-streaming.md#us-032) |
| US-03.3 | YouTubePublisherAdapter (Resumable Upload & Chunks) | Must | Alta | [epico-03](epico-03-adaptadores-e-streaming.md#us-033) |
| US-03.4 | YouTubePublisherAdapter (Thumbnail Personalizada) | Must | Média | [epico-03](epico-03-adaptadores-e-streaming.md#us-034) |
| **EP-04** | **Orquestração, Monetização e Quota Guard** | **Must** | **Alta** | [epico-04-orquestracao-e-monetizacao.md](epico-04-orquestracao-e-monetizacao.md) |
| US-04.1 | Orquestrador de Agendamento (PublishScheduledPostsService) | Must | Média | [epico-04](epico-04-orquestracao-e-monetizacao.md#us-041) |
| US-04.2 | Quota Guard e Interrupção Graciosa (YouTube 403) | Must | Média | [epico-04](epico-04-orquestracao-e-monetizacao.md#us-042) |
| US-04.3 | Conformidade de Monetização (COPPA, SEO #Shorts e UTMs) | Must | Baixa | [epico-04](epico-04-orquestracao-e-monetizacao.md#us-043) |
| US-04.4 | Resiliência com Retentativas e Backoff Exponencial | Should | Média | [epico-04](epico-04-orquestracao-e-monetizacao.md#us-044) |
| **EP-05** | **Gatilho Serverless e Deploy em Produção** | **Must** | **Média** | [epico-05-trigger-serverless-e-deploy.md](epico-05-trigger-serverless-e-deploy.md) |
| US-05.1 | Endpoint Inbound Seguro (JobTriggerController com X-API-KEY)| Must | Baixa | [epico-05](epico-05-trigger-serverless-e-deploy.md#us-051) |
| US-05.2 | Deploy no Google Cloud Run (min-instances=0) | Must | Média | [epico-05](epico-05-trigger-serverless-e-deploy.md#us-052) |
| US-05.3 | Automação com Google Cloud Scheduler (Cron Externo) | Must | Baixa | [epico-05](epico-05-trigger-serverless-e-deploy.md#us-053) |
| **EP-06** | **Expansão Multiplataforma (Fase 2)** | **Could** | **Alta** | [epico-06-expansao-multiplataforma.md](epico-06-expansao-multiplataforma.md) |
| US-06.1 | InstagramPublisherAdapter (Meta Graph API / Reels) | Could | Alta | [epico-06](epico-06-expansao-multiplataforma.md#us-061) |
| US-06.2 | TikTokPublisherAdapter (TikTok Content Posting API) | Could | Alta | [epico-06](epico-06-expansao-multiplataforma.md#us-062) |
| US-06.3 | Publicação Automática de Primeiro Comentário Fixado | Could | Média | [epico-06](epico-06-expansao-multiplataforma.md#us-063) |

---

## 📌 Rastreabilidade com a DoD (Definition of Done)

Cada história de usuário descrita nos arquivos deste diretório só pode ser marcada como concluída se atender rigorosamente a todos os critérios de aceitação individuais descritos nela **e** às regras gerais do [DoD.md](../DoD.md) (cobertura de testes >= 80%, zero arrays de bytes na heap, conformidade COPPA e logs sem credenciais expostas).
