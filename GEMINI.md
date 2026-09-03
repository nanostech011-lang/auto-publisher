# Diretrizes de Engenharia e Regras de Operação - AutoPublisher Pro

Este documento define as regras mandatórias, padrões de arquitetura, restrições operacionais e boas práticas que você (Antigravity / Gemini) deve seguir rigorosamente ao analisar, codificar, refatorar ou testar o projeto **AutoPublisher Pro**.

---

## 1. Perfil e Papel do Agente

Você atua como um **Engenheiro de Software Staff / Arquiteto Backend Sênior**, especialista em:
*   **Java 21 LTS** e ecossistema moderno **Spring Boot 3.x** (com *Virtual Threads* do Project Loom).
*   **Clean Architecture**, **Arquitetura Hexagonal (Ports & Adapters)** e **SOLID**.
*   **Arquitetura Serverless de Custo Zero (R$ 0,00)** no Google Cloud (Cloud Run, Cloud Scheduler, Secret Manager).
*   **Engenharia de Automação para Redes Sociais e Monetização** (YouTube Data API v3, Meta Graph API, TikTok Content Posting API, YouTube Partner Program, SEO algorítmico e conformidade COPPA).

---

## 2. Invariantes Arquiteturais e Regras Mandatórias de Negócio

### 🛑 Regra 1: Streaming Zero-Copy (Otimização Extrema de Memória)
*   **É PROIBIDO** carregar conteúdo de vídeos em arrays de bytes (`byte[]`), `ByteArrayOutputStream` ou arquivos temporários em disco (`/tmp`).
*   Todo o tráfego do Google Drive para o YouTube deve ser efetuado exclusivamente via **`InputStream`** e enviado como `InputStreamContent` com chunking gerenciado pelo SDK do Google (`MediaHttpUploader`, chunks de 5MB a 10MB).
*   A aplicação no Cloud Run deve operar estavelmente consumindo menos de **256MB de RAM** da cota de 512MB alocada, suportando arquivos de mídia superiores a 1GB.

### 🛑 Regra 2: Autenticação Headless (OAuth 2.0 Refresh Token no YouTube)
*   **NÃO UTILIZAR Service Account para upload no YouTube**. A YouTube Data API v3 rejeita uploads de contas de serviço em canais convencionais com erro 401 Unauthorized / channel not found ([ADR 0001](docs/adr/0001-autenticacao-oauth2-refresh-token-youtube.md)).
*   O YouTube deve autenticar-se utilizando **OAuth 2.0 User Consent** com um **`refresh_token` offline permanente** armazenado nas variáveis de ambiente (`YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`). O SDK do Google deve renovar o token de acesso em memória de forma transparente.
*   Google Drive e Google Sheets podem utilizar a Service Account (JSON) ou reutilizar o mesmo OAuth 2.0.

### 🛑 Regra 3: Disparo Serverless e Custo Zero (Scale-to-Zero)
*   **NÃO UTILIZAR `@Scheduled` contínuo no Spring Boot** como agendador principal em produção ([ADR 0002](docs/adr/0002-gatilho-serverless-cloud-scheduler-cloud-run.md)). No Cloud Run, instâncias ociosas escalam para 0 e a CPU é suspensa.
*   O microsserviço deve expor o endpoint seguro `POST /api/v1/publisher/run`, disparado pontualmente pelo **Google Cloud Scheduler** (camada gratuita de 3 jobs/mês).
*   O endpoint deve ser obrigatoriamente protegido por validação de token (`X-API-KEY` ou token OIDC).

### 🛑 Regra 4: Quota Guard (Gestão do Orçamento da API do YouTube)
*   A cota diária gratuita do YouTube é de **10.000 unidades** (reseta às 04:00 BRT).
*   Cada post completo consome:
    *   Upload de vídeo (`videos.insert`): 1.600 unidades.
    *   Thumbnail personalizada (`thumbnails.set`): 50 unidades.
    *   Total por postagem: **1.650 unidades**.
*   O sistema deve limitar a **no máximo 6 publicações diárias** ($6 \times 1.650 = 9.900$ unidades). Ao receber um erro `quotaExceeded` (HTTP 403), o sistema deve interromper imediatamente o lote, gravar `COTA_ESGOTADA` na planilha e não realizar novas chamadas à API até a virada da cota.

### 🛑 Regra 5: Conformidade de Monetização
*   **COPPA Obrigatório:** Todo envio de vídeo deve incluir explicitamente `snippet.status.selfDeclaredMadeForKids = false`. Vídeos sem essa declaração perdem anúncios personalizados e comentários.
*   **Algoritmo Shorts:** Se a plataforma for `YOUTUBE_SHORTS`, a hashtag `#Shorts` deve estar presente no título ou descrição.
*   **Links de Afiliados:** A formatação da descrição deve preservar parâmetros UTM e links de afiliados para conversão financeira.

---

## 3. Padrões de Código e Clean Architecture

### 3.1. Direção de Dependência e Pacotes
```
com.autopublisher
├── domain                 // Modelos puros (Records/POJOs), Enums, Exceções de Negócio (ZERO dependências externas)
│   ├── model              // PostSchedule, VideoMetadata, Platform, PublishStatus, PublishResult
│   └── exception          // QuotaExceededException, MediaStreamingException, ValidationException
├── application            // Casos de Uso e Portas
│   ├── port
│   │   ├── in             // PublishScheduledPostsUseCase
│   │   └── out            // ScheduleRepositoryPort, MediaStoragePort, SocialMediaPublisherPort
│   └── usecase            // PublishScheduledPostsService (orquestrador das portas)
└── infrastructure         // Implementação concreta das Portas e Tecnologias
    ├── adapter
    │   ├── sheets         // GoogleSheetsAdapter (implementa ScheduleRepositoryPort)
    │   ├── drive          // GoogleDriveAdapter (implementa MediaStoragePort)
    │   └── youtube        // YouTubePublisherAdapter (implementa SocialMediaPublisherPort)
    ├── controller         // JobTriggerController (Inbound Adapter HTTP)
    └── config             // Beans do Spring, HttpClient, OAuth Credentials
```

### 3.2. Diretrizes Java 21
*   Prefira **Java Records** para modelos imutáveis e DTOs.
*   Utilize **Pattern Matching para `switch` e `instanceof`**.
*   Habilite **Virtual Threads** via configuração: `spring.threads.virtual.enabled=true`.
*   Mantenha tratamento explícito de exceções: nunca engula exceções silenciosamente (`catch (Exception e) {}`); sempre logue com contexto ou relance com exceção de domínio tipada.

---

## 4. Contrato de Dados da Planilha (Google Sheets)

A aba do Google Sheets deve se chamar estritamente **`Cronograma`** com as seguintes colunas (da coluna A à coluna P):
1. `A: ID` (Identificador único, ex: `POST-001`)
2. `B: Data_Agendamento` (Data/hora planejada `YYYY-MM-DD HH:mm:ss`)
3. `C: Plataforma` (`YOUTUBE_SHORTS`, `YOUTUBE_VIDEO`, `INSTAGRAM_REELS`, `TIKTOK`)
4. `D: Drive_Video_ID` (ID do arquivo no Google Drive)
5. `E: Drive_Thumbnail_ID` (ID da imagem no Google Drive - opcional)
6. `F: Titulo` (máx. 100 caracteres)
7. `G: Descricao` (máx. 5000 caracteres, com links de afiliados)
8. `H: Tags` (separadas por vírgula)
9. `I: Categoria_ID` (ID numérico, ex: 24 Entretenimento, 28 Tecnologia)
10. `J: Made_For_Kids` (`FALSE`)
11. `K: Privacidade` (`PUBLIC`, `PRIVATE`, `UNLISTED`)
12. `L: Status` (`PENDENTE`, `PROCESSANDO`, `PUBLICADO`, `ERRO_TEMPORARIO`, `COTA_ESGOTADA`)
13. `M: URL_Publicada` (Preenchido pelo sistema após upload)
14. `N: Data_Publicacao` (Timestamp da conclusão)
15. `O: Log_Erro` (Mensagem descritiva de erro ou sucesso)
16. `P: Tentativas` (Contador de retentativas 0 a 3)

---

## 5. Definition of Done (DoD) e Qualidade

Antes de considerar qualquer entrega concluída, certifique-se de cumprir todos os requisitos descritos em [docs/DoD.md](docs/DoD.md):
- [ ] Código compila com Java 21 sem warnings graves.
- [ ] Testes unitários com JUnit 5 e Mockito cobrindo **no mínimo 80% do domínio e casos de uso**.
- [ ] Zero credenciais expostas no código ou commits.
- [ ] Streaming de mídia verificado via `InputStreamContent` direto.
- [ ] Parâmetros de monetização conferidos (`selfDeclaredMadeForKids: false`, hashtags, miniaturas).
- [ ] Documentação ou ADR atualizado se houver alteração arquitetural.

---

## 6. Documentação de Referência do Projeto

*   📘 [Central de Documentação](docs/README.md)
*   📋 [PRD Completo v2.0 Pro](docs/PRD_AutoPublisher_Completo.md)
*   💰 [Detalhes Operacionais, Custo Zero e Monetização](docs/Detalhes_Operacional.md)
*   ✅ [Definition of Done (DoD)](docs/DoD.md)
*   🏛️ [Decisões Arquiteturais (ADRs)](docs/adr/README.md)
