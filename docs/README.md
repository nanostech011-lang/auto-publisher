# Central de Documentação - AutoPublisher Pro

Bem-vindo à documentação oficial do **AutoPublisher Pro**, um microsserviço serverless projetado em **Java 21** e **Spring Boot 3** para automação de publicações de vídeos em redes sociais (YouTube Shorts, Instagram Reels, TikTok) com custo operacional zero e foco em **monetização** para canais dark/faceless.

---

## 📚 Mapa da Documentação

### 🌐 [Manual Interativo do Usuário (HTML)](manual/index.html)
> **[Abrir o Manual Interativo](manual/index.html)**: Guia visual completo com diagramas, Studio IA para repurposing de vídeos do YouTube e geração de roteiros em 4 blocos de retenção, preenchimento da planilha (17 colunas), passo a passo do Google Drive, configuração de credenciais OAuth 2.0 permanentes, deploy serverless e FAQ.

### 1. [Product Requirements Document (PRD v2.0)](PRD_AutoPublisher_Completo.md)
*   **Finalidade do Produto:** Objetivos de negócio, canais de monetização e regras de SEO.
*   **Arquitetura e Stack:** Clean Architecture, Ports & Adapters, Java 21 Virtual Threads e contêiner Alpine.
*   **Requisitos Funcionais e Não Funcionais:** Regras de streaming zero-copy, autenticação e tolerância a falhas.
*   **Contrato do Google Sheets:** Esquema detalhado das 16 colunas da planilha de operação.
*   **Orçamento de Cotas:** Economia de 10.000 unidades diárias da YouTube Data API v3 (até 6 vídeos/dia gratuitos).

### 2. [Detalhes Operacionais e Estrutura de Custos](Detalhes_Operacional.md)
*   **Auditoria de Custo Zero (R$ 0,00):** Detalhamento de como as camadas gratuitas (*Always Free*) do Google Cloud Run, Cloud Scheduler, Drive e Sheets cobrem 100% da infraestrutura.
*   **Funil de Monetização:** Estratégias de ganhos financeiros via YouTube Partner Program (Shorts & vídeos longos), links de afiliados com rastreamento UTM e parcerias.
*   **Segurança contra Penalizações:** Diretrizes para evitar flags de spam e salvaguardar a saúde algorítmica do canal.

### 3. [Definition of Done (DoD)](DoD.md)
*   **Critérios de Aceite para Desenvolvimento:** Checklist obrigatório para código, arquitetura, testes unitários (mínimo de 80% de cobertura no domínio), conformidade COPPA, quotas e segurança de credenciais.

### 4. [Architectural Decision Records (ADRs)](adr/README.md)
Histórico e justificativa das decisões técnicas e de design do sistema:
*   [**ADR 0001:** Autenticação com OAuth 2.0 (Refresh Token) vs Service Account para YouTube](adr/0001-autenticacao-oauth2-refresh-token-youtube.md)
*   [**ADR 0002:** Disparo Serverless com Cloud Scheduler e Cloud Run (Scale-to-Zero)](adr/0002-gatilho-serverless-cloud-scheduler-cloud-run.md)
*   [**ADR 0003:** Streaming Zero-Copy de Mídia via InputStream e Chunks (Otimização de RAM)](adr/0003-streaming-zero-copy-inputstream-otimizacao-memoria.md)
*   [**ADR 0004:** Adoção de Arquitetura Hexagonal (Ports and Adapters)](adr/0004-arquitetura-hexagonal-ports-and-adapters.md)
*   [**ADR 0005:** Google Sheets como Banco de Dados Operacional e Interface do Usuário](adr/0005-google-sheets-como-banco-de-dados-e-painel-operacional.md)

### 5. [Product Backlog (Épicos e Histórias)](backlog/README.md)
Gestão ágil de demandas dividida em 9 épicos detalhados com critérios de aceitação:
*   [**Épico 01:** Infraestrutura, Setup e Segurança](backlog/epico-01-infraestrutura-e-setup.md)
*   [**Épico 02:** Núcleo de Domínio e Arquitetura Hexagonal](backlog/epico-02-dominio-e-portas.md)
*   [**Épico 03:** Adaptadores de Integração e Streaming Zero-Copy](backlog/epico-03-adaptadores-e-streaming.md)
*   [**Épico 04:** Orquestração, Monetização e Quota Guard](backlog/epico-04-orquestracao-e-monetizacao.md)
*   [**Épico 05:** Gatilho Serverless e Deploy em Produção (Cloud Run + Scheduler)](backlog/epico-05-trigger-serverless-e-deploy.md)
*   [**Épico 06:** Expansão Multiplataforma (Instagram Reels e TikTok)](backlog/epico-06-expansao-multiplataforma.md)
*   [**Épico 07:** Interface Web do Usuário e Central de Credenciais](backlog/epico-07-interface-do-usuario.md)
*   [**Épico 08:** SaaS Multi-Tenant e Gestão de Usuários](backlog/epico-08-saas-multi-tenant.md)
*   [**Épico 09:** Pipeline de Geração de Vídeos Dark por IA](backlog/epico-09-pipeline-geracao-conteudo-ia.md)

### 6. [Pipeline de Automação de Conteúdo por IA](PRD_Pipeline_Automacao_Conteudo.md)
*   **PRD de Geração Upstream:** Especificação completa da esteira autônoma que transforma temas em vídeos verticais prontos (áudio TTS Edge-TTS, legendas dinâmicas karaokê, b-roll dark 9:16, FFmpeg compositor e injeção automática no Google Drive/Sheets).
*   **Contexto do Canal Piloto:** Especificação da identidade, estética dark chiaroscuro e roteiros validados do canal piloto em [docs/automacao.md](automacao.md).

---

## 🚀 Fluxo Operacional End-to-End (Upstream + Downstream)

```
 ┌────────────────────────────────────────────────────────────┐
 │        UPSTREAM: PIPELINE DE CRIAÇÃO POR IA (EP-09)        │
 │  Tema Neurociência ──► LLM Roteiro ──► Edge-TTS Locução    │
 │           ──► B-Roll Pexels ──► FFmpeg Render (MP4 9:16)   │
 └─────────────────────────────┬──────────────────────────────┘
                               │ (Upload Automático de Assets & Metadados)
                               ▼
 ┌────────────────────────────────────────────────────────────┐
 │                 GOOGLE DRIVE & GOOGLE SHEETS               │
 │    - Google Drive: Salva MP4 e Thumbnail                   │
 │    - Google Sheets: Cria linha com status PENDENTE         │
 └─────────────────────────────┬──────────────────────────────┘
                               │
                               ▼ (Trigger Periódico)
 ┌────────────────────────────────────────────────────────────┐
 │      DOWNSTREAM: AUTOPUBLISHER PRO (Java 21 / Cloud Run)   │
 │   - Leitura de agendamentos pendentes                      │
 │   - Streaming Zero-Copy de mídia do Drive                  │
 │   - Publicação YouTube Shorts + Instagram Reels + TikTok   │
 │   - Fixação do Primeiro Comentário de Afiliados            │
 │   - Atualização cirúrgica de status e URLs no Sheets       │
 └────────────────────────────────────────────────────────────┘
```
