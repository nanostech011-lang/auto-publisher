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

| ID | Épico / História | Prioridade | Complexidade | Status | Arquivo de Detalhe |
| :---: | :--- | :---: | :---: | :---: | :--- |
| **EP-01** | **Infraestrutura, Setup e Segurança** | **Must** | **Média** | **Concluído** | [epico-01-infraestrutura-e-setup.md](epico-01-infraestrutura-e-setup.md) |
| US-01.1 | Bootstrap do Projeto Spring Boot 3 + Java 21 | Must | Baixa | Concluído | [epico-01](epico-01-infraestrutura-e-setup.md#us-011) |
| US-01.2 | Configuração de Credenciais e Variáveis de Ambiente | Must | Baixa | Concluído | [epico-01](epico-01-infraestrutura-e-setup.md#us-012) |
| US-01.3 | Dockerfile Multi-stage Otimizado (JRE Alpine) | Must | Média | Concluído | [epico-01](epico-01-infraestrutura-e-setup.md#us-013) |
| **EP-02** | **Núcleo de Domínio e Arquitetura Hexagonal** | **Must** | **Média** | **Concluído** | [epico-02-dominio-e-portas.md](epico-02-dominio-e-portas.md) |
| US-02.1 | Modelagem de Entidades e Value Objects Imutáveis | Must | Baixa | Concluído | [epico-02](epico-02-dominio-e-portas.md#us-021) |
| US-02.2 | Definição das Portas de Entrada e Saída (Interfaces) | Must | Baixa | Concluído | [epico-02](epico-02-dominio-e-portas.md#us-022) |
| US-02.3 | Exceções de Negócio Tipadas (Domain Exceptions) | Must | Baixa | Concluído | [epico-02](epico-02-dominio-e-portas.md#us-023) |
| **EP-03** | **Adaptadores de Integração e Streaming** | **Must** | **Alta** | **Concluído** | [epico-03-adaptadores-e-streaming.md](epico-03-adaptadores-e-streaming.md) |
| US-03.1 | GoogleSheetsAdapter (Leitura e Atualização Cirúrgica) | Must | Média | Concluído | [epico-03](epico-03-adaptadores-e-streaming.md#us-031) |
| US-03.2 | GoogleDriveAdapter (Streaming Zero-Copy via InputStream) | Must | Alta | Concluído | [epico-03](epico-03-adaptadores-e-streaming.md#us-032) |
| US-03.3 | YouTubePublisherAdapter (Resumable Upload & Chunks) | Must | Alta | Concluído | [epico-03](epico-03-adaptadores-e-streaming.md#us-033) |
| US-03.4 | YouTubePublisherAdapter (Thumbnail Personalizada) | Must | Média | Concluído | [epico-03](epico-03-adaptadores-e-streaming.md#us-034) |
| **EP-04** | **Orquestração, Monetização e Quota Guard** | **Must** | **Alta** | **Concluído** | [epico-04-orquestracao-e-monetizacao.md](epico-04-orquestracao-e-monetizacao.md) |
| US-04.1 | Orquestrador de Agendamento (PublishScheduledPostsService) | Must | Média | Concluído | [epico-04](epico-04-orquestracao-e-monetizacao.md#us-041) |
| US-04.2 | Quota Guard e Interrupção Graciosa (YouTube 403) | Must | Média | Concluído | [epico-04](epico-04-orquestracao-e-monetizacao.md#us-042) |
| US-04.3 | Conformidade de Monetização (COPPA, SEO #Shorts e UTMs) | Must | Baixa | Concluído | [epico-04](epico-04-orquestracao-e-monetizacao.md#us-043) |
| US-04.4 | Resiliência com Retentativas e Backoff Exponencial | Should | Média | Concluído | [epico-04](epico-04-orquestracao-e-monetizacao.md#us-044) |
| **EP-05** | **Gatilho Serverless e Deploy em Produção** | **Must** | **Média** | **Concluído** | [epico-05-trigger-serverless-e-deploy.md](epico-05-trigger-serverless-e-deploy.md) |
| US-05.1 | Endpoint Inbound Seguro (JobTriggerController com X-API-KEY)| Must | Baixa | Concluído | [epico-05](epico-05-trigger-serverless-e-deploy.md#us-051) |
| US-05.2 | Deploy no Google Cloud Run (min-instances=0) | Must | Média | Concluído | [epico-05](epico-05-trigger-serverless-e-deploy.md#us-052) |
| US-05.3 | Automação com Google Cloud Scheduler (Cron Externo) | Must | Baixa | Concluído | [epico-05](epico-05-trigger-serverless-e-deploy.md#us-053) |
| **EP-06** | **Expansão Multiplataforma (Fase 2)** | **Could** | **Alta** | **Concluído** | [epico-06-expansao-multiplataforma.md](epico-06-expansao-multiplataforma.md) |
| US-06.1 | InstagramPublisherAdapter (Meta Graph API / Reels) | Could | Alta | Concluído | [epico-06](epico-06-expansao-multiplataforma.md#us-061) |
| US-06.2 | TikTokPublisherAdapter (TikTok Content Posting API) | Could | Alta | Concluído | [epico-06](epico-06-expansao-multiplataforma.md#us-062) |
| US-06.3 | Publicação Automática de Primeiro Comentário Fixado | Could | Média | Concluído | [epico-06](epico-06-expansao-multiplataforma.md#us-063) |
| **EP-07** | **Interface Web do Usuário e Central de Credenciais** | **Must** | **Média** | **Concluído** | [epico-07-interface-do-usuario.md](epico-07-interface-do-usuario.md) |
| US-07.1 | Painel de Indicadores (KPIs) e Quota Guard YouTube | Must | Baixa | Concluído | [epico-07](epico-07-interface-do-usuario.md#us-071) |
| US-07.2 | Monitor de Status, Busca e Filtros | Must | Baixa | Concluído | [epico-07](epico-07-interface-do-usuario.md#us-072) |
| US-07.3 | Modal de Agendamento com Auto-Detecção de Drive ID | Must | Média | Concluído | [epico-07](epico-07-interface-do-usuario.md#us-073) |
| US-07.4 | Central de Chaves & Credenciais All-in-One com Gerador .env | Must | Média | Concluído | [epico-07](epico-07-interface-do-usuario.md#us-074) |
| **EP-08** | **SaaS Multi-Tenant e Gestão de Usuários** | **Should** | **Alta** | **Concluído** | [epico-08-saas-multi-tenant.md](epico-08-saas-multi-tenant.md) |
| US-08.1 | Persistência e Repositório de Tenants com Suporte Multi-Tenant | Should | Alta | Concluído | [epico-08](epico-08-saas-multi-tenant.md#us-081) |
| US-08.2 | Isolamento de Planilhas e Recursos por Tenant | Should | Média | Concluído | [epico-08](epico-08-saas-multi-tenant.md#us-082) |
| US-08.3 | Gestão Descentralizada de Credenciais por Cliente | Should | Alta | Concluído | [epico-08](epico-08-saas-multi-tenant.md#us-083) |
| US-08.4 | API de Gestão Administrativa de Clientes | Should | Média | Concluído | [epico-08](epico-08-saas-multi-tenant.md#us-084) |
| **EP-09** | **Pipeline de Geração de Vídeos Dark por IA** | **Should** | **Alta** | **Concluído** | [epico-09-pipeline-geracao-conteudo-ia.md](epico-09-pipeline-geracao-conteudo-ia.md) |
| US-09.1 | Motor de Roteirização Estruturada & SEO (Script Engine) | Should | Média | Concluído | [epico-09](epico-09-pipeline-geracao-conteudo-ia.md#us-091) |
| US-09.2 | Síntese de Voz Neural e Legendas Dinâmicas (Edge-TTS) | Should | Média | Concluído | [epico-09](epico-09-pipeline-geracao-conteudo-ia.md#us-092) |
| US-09.3 | Curadoria de B-Roll Vertical e Thumbnails (Pexels API) | Should | Média | Concluído | [epico-09](epico-09-pipeline-geracao-conteudo-ia.md#us-093) |
| US-09.4 | Renderizador Headless de Vídeo (FFmpeg Compositor) | Should | Alta | Concluído | [epico-09](epico-09-pipeline-geracao-conteudo-ia.md#us-094) |
| US-09.5 | Ingestor Automático no Google Drive e Google Sheets | Should | Média | Concluído | [epico-09](epico-09-pipeline-geracao-conteudo-ia.md#us-095) |
| US-09.6 | Runner e Orquestração por Agentes Autônomos | Could | Média | Concluído | [epico-09](epico-09-pipeline-geracao-conteudo-ia.md#us-096) |
| US-09.7 | Geração em Lote e Grade Semanal de Postagens (--batch N) | Should | Média | Concluído | [epico-09](epico-09-pipeline-geracao-conteudo-ia.md#us-097) |
| US-09.8 | Conector de Vídeo IA Google Veo 2 e Resolução Nativa 1080x1920 Full HD | Should | Alta | Concluído | [epico-09](epico-09-pipeline-geracao-conteudo-ia.md#us-098) |

---

## 📌 Rastreabilidade com a DoD (Definition of Done)

Cada história de usuário descrita nos arquivos deste diretório só pode ser marcada como concluída se atender rigorosamente a todos os critérios de aceitação individuais descritos nela **e** às regras gerais do [DoD.md](../DoD.md) (cobertura de testes >= 80%, zero arrays de bytes na heap, conformidade COPPA e logs sem credenciais expostas).
