# Product Requirements Document (PRD) - AutoPublisher Pro
**Versão:** 2.0  
**Status:** Aprovado para Implementação  
**Finalidade:** Orquestração automatizada e serverless de publicação de vídeos em redes sociais com foco em canais dark/faceless, monetização (AdSense/YPP, afiliados e parcerias) e custo operacional zero.

---

## 1. Visão Geral e Modelo de Negócio

O **AutoPublisher Pro** é um microsserviço backend resiliente, construído em **Java 21 (LTS)** e **Spring Boot 3**, projetado para automatizar o ciclo completo de publicação e agendamento de vídeos em redes sociais (YouTube Shorts/Long-form, Instagram Reels e TikTok).

### 1.1. Alinhamento com a Finalidade de Monetização
Para que canais automatizados gerem receita consistente (via YouTube Partner Program, links de afiliados na descrição, parcerias e tráfego orgânico), a publicação precisa atender a critérios técnicos e algorítmicos essenciais:
1. **Consistência e Frequência:** Publicação em horários de pico sem falhas humanas.
2. **Taxa de Cliques (CTR) e SEO:** Injeção automática de miniaturas personalizadas (*thumbnails*), títulos otimizados, hashtags estratégicas (`#Shorts`) e tags de metadados.
3. **Conformidade de Monetização (COPPA & Direitos):** Sinalização mandatória de conteúdo não infantil (`selfDeclaredMadeForKids: false`) para liberar anúncios personalizados, comentários e telas finais; além de suporte a upload prévio (`private` / agendado) para que o YouTube processe o vídeo em HD/4K e execute o escaneamento do **Content ID** antes do vídeo ir a público, evitando desmonetização nas primeiras horas.
4. **Conversão de Afiliados:** Formatação padronizada de descrições com links rastreáveis (UTM) e chamadas para ação (CTA).

---

## 2. Escopo do Produto

### 2.1. Escopo Atual (Fase 1 - MVP Focado em Monetização)
*   **Painel de Controle & Banco de Dados:** Integração bidirecional com Google Sheets (leitura de cronograma e gravação de status/URLs geradas/logs).
*   **Armazenamento de Assets:** Integração com Google Drive para streaming direto de vídeos e imagens de capa (thumbnails).
*   **Distribuição Principal:** Integração com **YouTube Data API v3** (Shorts e vídeos tradicionais), com upload resumível e injeção de miniatura personalizada.
*   **Gestão de Cotas & Erros:** Monitoramento de cotas diárias da API do YouTube (10.000 unidades/dia) com interrupção graciosa para evitar bloqueios.
*   **Trigger Serverless:** Endpoint seguro compatível com **Google Cloud Scheduler** para disparo pontual sem custo de máquina ociosa.

### 2.2. Escopo de Expansão (Fase 2 - Multiplataforma)
*   **Instagram Reels:** Adaptador via Meta Graph API (Content Publishing API).
*   **TikTok:** Adaptador via TikTok Content Posting API.
*   **Comentário Fixado Automático:** Publicação do primeiro comentário com link de afiliado logo após o upload do vídeo.

### 2.3. Fora do Escopo
*   Geração e edição de vídeo/áudio por IA (feita previamente por ferramentas externas ou Google Labs).
*   Interface gráfica nativa (o Google Sheets atua como a UI completa do usuário).

---

## 3. Arquitetura e Decisões de Engenharia

O projeto adota os princípios de **Clean Architecture**, **SOLID** (com forte desacoplamento de provedores externos) e **12-Factor App**.

```
                           [ Google Cloud Scheduler ] (Cron Trigger)
                                       │ (HTTP POST com Token Seguro)
                                       ▼
                       ┌───────────────────────────────┐
                       │    Cloud Run (Spring Boot)    │
                       │   (Escala a Zero - R$ 0,00)   │
                       └───────────────┬───────────────┘
                                       │
                ┌──────────────────────┼──────────────────────┐
                ▼                      ▼                      ▼
       [ Google Sheets API ]   [ Google Drive API ]   [ YouTube Data API v3 ]
       (Cronograma & Status)     (Stream de Mídia)      (OAuth 2.0 Refresh)
```

### 3.1. Stack Tecnológico
*   **Linguagem:** Java 21 LTS (com suporte nativo a *Virtual Threads* do Project Loom para altíssimo I/O com baixo consumo de memória).
*   **Framework:** Spring Boot 3.x (`spring-boot-starter-web`, `spring-boot-starter-validation`).
*   **Resiliência:** Retry com backoff exponencial via Spring Retry ou Resilience4j.
*   **Contêiner:** Imagem Docker otimizada com eclipse-temurin:21-jre-alpine (~150MB).
*   **Nuvem & Execução:** Google Cloud Run (execução sob demanda) acionado pelo Google Cloud Scheduler.

### 3.2. Resolução do Fator Crítico de Autenticação (OAuth 2.0 vs Service Account)
> [!IMPORTANT]
> **Correção Crítica:** A API do YouTube Data v3 **NÃO permite** upload de vídeos em canais convencionais usando *Service Accounts* puras (retorna erro 401 Unauthorized / channel not found). Service Accounts só funcionam para uploads em contas corporativas vinculadas ao YouTube Content Manager (CMS).
> 
> **Solução Arquitetural:**
> *   **Google Drive & Google Sheets:** Podem utilizar a *Service Account* com permissão concedida na pasta do Drive e na Planilha, **OU** reutilizar o fluxo OAuth 2.0.
> *   **YouTube Data API:** Utiliza credenciais OAuth 2.0 de usuário com `refresh_token` offline de longa duração. O sistema armazena as variáveis `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` e `YOUTUBE_REFRESH_TOKEN`. A cada execução, a biblioteca do Google renova o `access_token` em memória sem qualquer necessidade de intervenção humana.

---

## 4. Requisitos Funcionais (RF)

*   **[RF-01] Autenticação Híbrida e Renovação Automática:**
    *   O sistema deve autenticar-se na YouTube Data API v3 utilizando OAuth 2.0 Client ID, Secret e um `refresh_token` pré-autorizado, renovando os tokens de acesso de forma headless e ininterrupta.
    *   Para Drive e Sheets, o sistema deve suportar credenciais via Service Account JSON ou o mesmo fluxo OAuth.
*   **[RF-02] Disparo Serverless e Leitura do Cronograma:**
    *   Expor um endpoint seguro `POST /api/v1/publisher/run` protegido por chave de API (`X-API-KEY`) ou OIDC, acionado pelo Google Cloud Scheduler.
    *   Ler as linhas da aba "Cronograma" do Google Sheets filtrando por registros onde `Status == "PENDENTE"` e `Data_Hora_Agendamento <= Agora`.
*   **[RF-03] Validação de Metadados e Quota Guard:**
    *   Antes de iniciar o upload, o sistema deve verificar se o limite diário de uploads (máx. 5 a 6 por dia para respeitar as 10.000 unidades de cota) foi atingido.
    *   Validar limites de caracteres: Título (máx. 100 caracteres), Descrição (máx. 5.000 caracteres), Tags (máx. 500 caracteres somados).
*   **[RF-04] Download por Streaming Contínuo (Google Drive):**
    *   Conectar-se ao Google Drive pelo ID do arquivo de vídeo e thumbnail.
    *   Obter o payload de mídia estritamente via `InputStream` (`executeMediaAsInputStream()`), sem salvar em disco local e sem alocar em arrays na RAM.
*   **[RF-05] Upload Resumível com Parâmetros de Monetização (YouTube):**
    *   Executar o upload utilizando `MediaHttpUploader` (Resumable Upload) em blocos de 5MB a 10MB.
    *   Definir explicitamente:
        *   `snippet.title`: Título do vídeo (incluindo `#Shorts` quando aplicável).
        *   `snippet.description`: Texto com links de afiliados, CTAs e hashtags.
        *   `snippet.tags`: Lista de palavras-chave SEO.
        *   `snippet.categoryId`: ID da categoria (ex: 24 para Entretenimento, 28 para Tecnologia).
        *   `status.privacyStatus`: `public`, `private` ou `unlisted`.
        *   `status.publishAt`: Timestamp ISO 8601 caso o usuário deseje agendamento nativo na plataforma.
        *   `status.selfDeclaredMadeForKids`: `false` (obrigatório para liberar monetização com anúncios segmentados e comentários).
*   **[RF-06] Vinculação de Thumbnail Personalizada:**
    *   Caso a coluna `Drive_Thumbnail_ID` esteja preenchida, o sistema deve realizar a chamada `youtube.thumbnails().set(videoId, thumbnailStream)` logo após o upload do vídeo (custo: 50 unidades de cota).
*   **[RF-07] Fechamento do Ciclo e Feedback Loop no Sheets:**
    *   Em caso de sucesso: atualizar o status da linha para `PUBLICADO`, preencher a coluna `URL_Publicada` (ex: `https://youtube.com/shorts/{videoId}`) e registrar a data/hora exata da publicação.
    *   Em caso de erro transitório: atualizar para `ERRO_TEMPORARIO`, incrementar contador de tentativas e gravar mensagem simplificada na coluna `Log_Erro`.
    *   Em caso de cota excedida (HTTP 403 `quotaExceeded`): atualizar para `COTA_ESGOTADA` e abortar as próximas postagens do lote, salvaguardando a estabilidade do sistema.

---

## 5. Requisitos Não Funcionais (RNF)

*   **[RNF-01] Alocação Zero de Mídia na Memória (Zero-Copy Buffer):**
    *   É terminantemente vedada a conversão de streams de vídeo para `byte[]` ou leitura integral em memória heap. O tráfego do Drive para o YouTube deve ser efetuado via `PipedInputStream`/`PipedOutputStream` ou repasse direto de `InputStreamContent` com chunking gerenciado pelo SDK do Google.
    *   O contêiner no Cloud Run deve operar estavelmente com **512MB de RAM**, suportando arquivos de vídeo superiores a 1GB.
*   **[RNF-02] Tolerância a Falhas e Backoff Exponencial:**
    *   Falhas de rede ou interrupções parciais no Resumable Upload devem ser reexecutadas automaticamente com retry exponencial (3 tentativas, intervalo inicial de 2 segundos, multiplicador 2.0).
*   **[RNF-03] Segurança e Conformidade (Zero Hardcoding):**
    *   Todas as credenciais (`GOOGLE_SHEETS_ID`, `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`, `API_AUTH_SECRET`) devem ser fornecidas via variáveis de ambiente ou Secret Manager.
*   **[RNF-04] Modelo de Custo Zero (Free Tier Cloud Run):**
    *   O contêiner não deve manter conexões ativas após a execução do lote (`min-instances = 0`), garantindo que o tempo de CPU faturável ocorra exclusivamente durante o processamento das postagens diárias.

---

## 6. Contrato de Dados - Google Sheets (Tabela de Operação)

A planilha do Google Sheets atua como a interface do criador e banco de dados operacional. A aba principal deve se chamar `Cronograma` e conter rigorosamente o seguinte cabeçalho:

| Coluna | Nome do Campo | Tipo | Exemplo / Descrição |
| :--- | :--- | :--- | :--- |
| **A** | `ID` | Texto / UUID | `POST-2026-001` |
| **B** | `Data_Agendamento` | Data/Hora (ISO ou BR) | `2026-09-03 18:30:00` |
| **C** | `Plataforma` | Enum | `YOUTUBE_SHORTS`, `YOUTUBE_VIDEO`, `INSTAGRAM_REELS`, `TIKTOK` |
| **D** | `Drive_Video_ID` | Texto (ID do Drive) | `1AbCdEfGhIjKlMnOpQrStUvWxYz` |
| **E** | `Drive_Thumbnail_ID` | Texto (Opcional) | `1XyZaBcDeFgHiJkLmNoPqRsTuVw` (deixe vazio se não houver) |
| **F** | `Titulo` | Texto (máx. 100 chars) | `3 Segredos de IA que Ninguém te Conta #Shorts` |
| **G** | `Descricao` | Texto (máx. 5000 chars) | `Aprenda como lucrar com IA... Links e ferramentas: https://meulink.com/afiliado` |
| **H** | `Tags` | Texto (separado por vírgula) | `ia, tecnologia, monetizacao, inteligência artificial` |
| **I** | `Categoria_ID` | Inteiro | `28` (28 = Ciência e Tecnologia; 24 = Entretenimento) |
| **J** | `Made_For_Kids` | Booleano | `FALSE` (sempre FALSE para canais monetizados) |
| **K** | `Privacidade` | Enum | `PUBLIC`, `PRIVATE`, `UNLISTED` |
| **L** | `Status` | Enum | `PENDENTE`, `PROCESSANDO`, `PUBLICADO`, `ERRO_TEMPORARIO`, `COTA_ESGOTADA` |
| **M** | `URL_Publicada` | Texto (Preenchido pelo sistema) | `https://youtube.com/shorts/dQw4w9WgXcQ` |
| **N** | `Data_Publicacao` | Timestamp (Preenchido pelo sistema) | `2026-09-03 18:31:42` |
| **O** | `Log_Erro` | Texto (Preenchido em caso de erro) | `Upload completado com sucesso` ou detalhamento da exceção |
| **P** | `Tentativas` | Inteiro | Contador de retentativas (0 a 3) |

---

## 7. Economia de Cotas e Regras de Negócio de Monetização

### 7.1. Orçamento Diário de Cotas (YouTube Data API v3)
*   **Cota diária gratuita:** 10.000 unidades (reinicia às 04:00 BRT / 00:00 PT).
*   **Custo de um upload de vídeo (`videos.insert`):** 1.600 unidades.
*   **Custo de uma thumbnail personalizada (`thumbnails.set`):** 50 unidades.
*   **Custo de leitura/consulta (`videos.list`):** 1 unidade.
*   **Cálculo da capacidade máxima sem custos:**
    $$\text{Custo por post completo} = 1.600 + 50 = 1.650 \text{ unidades}$$
    $$\text{Posts diários sustentáveis} = \lfloor 10.000 / 1.650 \rfloor = \mathbf{6 \text{ postagens por dia}}$$
    *Consumo total: $6 \times 1.650 = 9.900$ unidades (com 100 unidades de folga para validações).*

### 7.2. Melhores Práticas Algorítmicas Incorporadas
1. **Vídeos Curtos (< 60 segundos):** O sistema garante que a hashtag `#Shorts` esteja contida no título ou na primeira linha da descrição para classificação imediata na estante de Shorts.
2. **Escaneamento Prévio de Direitos Autorais:** Recomenda-se publicar como `UNLISTED` ou com `publishAt` futuro (ex: 30 minutos à frente). Isso garante que o YouTube processe a resolução total e execute a checagem de Content ID, evitando que um vídeo seja desmonetizado após já ter recebido tráfego inicial.

---

## 8. Arquitetura de Software (Clean Architecture / Ports & Adapters)

### 8.1. Estrutura de Pacotes Proposta
```
com.autopublisher
├── domain
│   ├── model
│   │   ├── PostSchedule.java         // Entidade representando a linha da planilha
│   │   ├── Platform.java             // Enum (YOUTUBE_SHORTS, INSTAGRAM, etc.)
│   │   ├── PublishStatus.java        // Enum (PENDENTE, PUBLICADO, etc.)
│   │   ├── VideoMetadata.java        // Value Object com título, descrição, tags, COPPA
│   │   └── PublishResult.java        // Resultado do envio (sucesso, videoId, url, erro)
│   └── exception
│       ├── QuotaExceededException.java
│       └── MediaDownloadException.java
├── application
│   ├── port
│   │   ├── in
│   │   │   └── PublishScheduledPostsUseCase.java
│   │   └── out
│   │       ├── ScheduleRepositoryPort.java     // Interface de leitura/escrita do Sheets
│   │       ├── MediaStoragePort.java           // Interface de streaming do Drive
│   │       └── SocialMediaPublisherPort.java   // Interface genérica para publishers
│   └── usecase
│       └── PublishScheduledPostsService.java   // Orquestrador do fluxo de negócio
└── infrastructure
    ├── adapter
    │   ├── sheets
    │   │   ├── GoogleSheetsAdapter.java
    │   │   └── GoogleSheetsConfig.java
    │   ├── drive
    │   │   ├── GoogleDriveAdapter.java
    │   │   └── GoogleDriveConfig.java
    │   └── youtube
    │       ├── YouTubePublisherAdapter.java
    │       ├── YouTubeOAuthConfig.java
    │       └── YouTubeResumableUploader.java
    ├── controller
    │   └── JobTriggerController.java           // Endpoint POST /api/v1/publisher/run
    └── config
        └── SecurityConfig.java
```

---

## 9. Plano de Execução e Milestones

### Épico 1: Infraestrutura e Configuração de Contas
- [ ] Configuração do projeto no Google Cloud Console com as APIs ativadas (Sheets, Drive, YouTube Data v3).
- [ ] Criação de credenciais OAuth 2.0 Web/Desktop e geração guiada do primeiro `REFRESH_TOKEN` offline.
- [ ] Setup do repositório Spring Boot 3 + Java 21 com Dockerfile multi-stage.

### Épico 2: Núcleo de Domínio e Portas
- [ ] Criação dos modelos de domínio (`PostSchedule`, `VideoMetadata`, `PublishResult`).
- [ ] Definição das interfaces das portas de entrada e saída.

### Épico 3: Adaptadores de Integração
- [ ] Implementação do `GoogleSheetsAdapter` (leitura estruturada e atualização cirúrgica de status).
- [ ] Implementação do `GoogleDriveAdapter` (streaming via `InputStream`).
- [ ] Implementação do `YouTubePublisherAdapter` (Resumable Upload, injeção de metadata e thumbnail).

### Épico 4: Orquestração e Validação de Monetização
- [ ] Implementação do Caso de Uso principal com tratamento de quota `quotaExceeded` e retry.
- [ ] Testes de integração ponta a ponta com planilha e canal de testes do YouTube.
- [ ] Criação do endpoint de trigger com validação de token seguro.

### Épico 5: Deploy e Automação Serverless
- [ ] Build e deploy da imagem Docker no Google Cloud Run (min-instances=0, 512MB RAM).
- [ ] Configuração do Google Cloud Scheduler para disparar a cada 30 ou 60 minutos.
