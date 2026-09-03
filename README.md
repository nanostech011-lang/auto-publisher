# AutoPublisher Pro 🚀

> Microsserviço backend serverless em **Java 21** e **Spring Boot 3** para automação e orquestração de postagens de vídeos em redes sociais (YouTube Shorts, Instagram Reels, TikTok), com foco em **canais automatizados/dark**, **monetização** e **custo operacional R$ 0,00**.

---

## 🎯 Visão Geral

O **AutoPublisher Pro** elimina todo o trabalho manual de upload e agendamento de vídeos para criadores de conteúdo e canais dark focados em monetização:
* **Interface Zero-Code:** O criador usa o **Google Sheets** como painel de controle e banco de dados.
* **Armazenamento:** Os vídeos e miniaturas residem no seu próprio **Google Drive**.
* **Distribuição Otimizada:** Upload no **YouTube** via *Resumable Upload*, com injeção automática de miniaturas personalizadas, tags SEO, hashtags e links de afiliados na descrição.
* **Custo Zero Real:** Roda 100% dentro das cotas gratuitas (*Always Free*) do Google Cloud (Cloud Run + Cloud Scheduler).

---

## 📂 Documentação Completa

Toda a documentação técnica, decisões de engenharia e regras operacionais estão organizadas no diretório [`docs/`](docs/):

* 📋 [**Product Requirements Document (PRD v2.0)**](docs/PRD_AutoPublisher_Completo.md): Escopo detalhado, regras de negócio, quotas da API e modelo da planilha.
* 💰 [**Detalhes Operacionais & Custos**](docs/Detalhes_Operacional.md): Como rodar com R$ 0,00 e o modelo de receita para canais automatizados.
* ✅ [**Definition of Done (DoD)**](docs/DoD.md): Critérios de qualidade, cobertura de testes (mín. 80%), boas práticas e conformidade de monetização.
* 🏛️ [**Architectural Decision Records (ADRs)**](docs/adr/README.md):
  * [ADR 0001: Autenticação OAuth 2.0 com Refresh Token no YouTube](docs/adr/0001-autenticacao-oauth2-refresh-token-youtube.md)
  * [ADR 0002: Disparo Serverless com Cloud Scheduler e Cloud Run (Scale-to-Zero)](docs/adr/0002-gatilho-serverless-cloud-scheduler-cloud-run.md)
  * [ADR 0003: Streaming Zero-Copy de Mídia via InputStream e Chunks](docs/adr/0003-streaming-zero-copy-inputstream-otimizacao-memoria.md)
  * [ADR 0004: Arquitetura Hexagonal (Ports and Adapters)](docs/adr/0004-arquitetura-hexagonal-ports-and-adapters.md)
  * [ADR 0005: Google Sheets como Banco de Dados e Painel Operacional](docs/adr/0005-google-sheets-como-banco-de-dados-e-painel-operacional.md)
* 📊 [**Product Backlog (Épicos e Histórias)**](docs/backlog/README.md): 6 Épicos detalhados com histórias de usuário no padrão ágil e critérios de aceitação.

---

## 🛠️ Stack Tecnológico

* **Linguagem:** Java 21 LTS (Virtual Threads habilitadas)
* **Framework:** Spring Boot 3.x
* **Padrões:** Clean Architecture / Hexagonal (Ports & Adapters), SOLID
* **APIs Externas:** Google Sheets API v4, Google Drive API v3, YouTube Data API v3
* **Infraestrutura:** Docker (multi-stage JRE Alpine) e Google Cloud Run
