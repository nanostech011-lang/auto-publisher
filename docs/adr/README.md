# Architectural Decision Records (ADRs) - AutoPublisher Pro

Este diretório contém os registros de decisões arquiteturais (**Architectural Decision Records - ADRs**) que orientam o design técnico, a segurança, os protocolos de rede e os padrões de implementação do **AutoPublisher Pro**.

Cada decisão reflete a busca por **resiliência, escalabilidade, desacoplamento e custo financeiro zero (R$ 0,00)** para canais automatizados com foco em monetização.

---

## Índice de Decisões Arquiteturais

| ADR | Título | Status | Data | Resumo da Decisão |
| :---: | :--- | :---: | :---: | :--- |
| [**ADR 0001**](0001-autenticacao-oauth2-refresh-token-youtube.md) | Autenticação com OAuth 2.0 (Refresh Token) vs Service Account | **Aceito** | 2026-09-03 | Adoção de OAuth 2.0 com `refresh_token` offline perpétuo para permitir upload headless no YouTube sem erros de permissão. |
| [**ADR 0002**](0002-gatilho-serverless-cloud-scheduler-cloud-run.md) | Disparo Serverless com Cloud Scheduler e Cloud Run (Scale-to-Zero) | **Aceito** | 2026-09-03 | Uso do Cloud Scheduler disparando webhook seguro no Cloud Run para manter instâncias em zero e garantir custo R$ 0,00. |
| [**ADR 0003**](0003-streaming-zero-copy-inputstream-otimizacao-memoria.md) | Streaming Zero-Copy de Mídia via InputStream e Chunks | **Aceito** | 2026-09-03 | Transferência direta do Drive para YouTube sem alocação em array na RAM, permitindo rodar em contêineres de 512MB RAM sem OOM. |
| [**ADR 0004**](0004-arquitetura-hexagonal-ports-and-adapters.md) | Adoção de Arquitetura Hexagonal (Ports and Adapters) | **Aceito** | 2026-09-03 | Isolamento completo do domínio de publicação para viabilizar extensão plugável para Instagram Reels e TikTok. |
| [**ADR 0005**](0005-google-sheets-como-banco-de-dados-e-painel-operacional.md) | Google Sheets como Banco de Dados Operacional e UI | **Aceito** | 2026-09-03 | Eliminação de custos de bancos gerenciados e frontend usando Google Sheets como interface e tabela transacional. |
| [**ADR 0006**](0006-fonte-de-visuais-e-teto-de-qualidade.md) | Fonte dos Visuais e o Teto de Qualidade do Vídeo Gerado | **Proposto** | 2026-09-15 | Segmentação da premissa de custo zero por domínio: infraestrutura permanece em R$ 0,00, geração de imagem passa a ter custo medido com teto por execução, rompendo o teto de 0,59 MP do tier gratuito. |
| [**ADR 0007**](0007-modos-de-audio-e-reaproveitamento-de-audio-proprio.md) | Modos de Áudio, Vídeo Puramente Visual e Salvaguardas de Áudio Próprio | **Aceito** | 2026-10-07 | Introdução de `AudioMode` (TTS, NONE, SOURCE_AUDIO), fail-closed `ENABLE_SOURCE_AUDIO`, status `REVISAO_MANUAL` e grafo de áudio universal no FFmpeg. |

---

## Formato Padrão de um ADR
Ao propor uma nova decisão arquitetural, crie um arquivo numerado sequencialmente (`000X-nome-da-decisao.md`) contendo:
1. **Status:** Proposto, Aceito, Rejeitado, Depreciado ou Substituído.
2. **Contexto e Problema:** Cenário e restrições enfrentadas.
3. **Decisão:** A escolha técnica e detalhes de implementação.
4. **Consequências:** Pontos positivos, trade-offs e mitigações.
