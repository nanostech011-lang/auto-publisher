# ADR 0004: Adoção de Arquitetura Hexagonal (Ports and Adapters) e Clean Architecture

* **Status:** Aceito
* **Data:** 2026-09-03
* **Decisores:** Time de Arquitetura e Engenharia AutoPublisher
* **Contexto Técnico:** [PRD_AutoPublisher_Completo.md](../PRD_AutoPublisher_Completo.md) - Seções 3 e 8

---

## 1. Contexto e Problema

O AutoPublisher é projetado inicialmente com foco prioritário no YouTube (Shorts e vídeos tradicionais), mas com uma exigência de negócio explícita: **permitir expansão futura para outras redes sociais (Instagram Reels, TikTok, Facebook Reels)** e possíveis trocas de provedores de storage (ex: AWS S3 ou Cloudflare R2 caso o usuário deseje migrar do Google Drive).

Em aplicações fortemente acopladas, bibliotecas de terceiros (como os SDKs do Google) poluem as regras de negócio, tornando qualquer adição de plataforma uma tarefa complexa de refatoração geral do código.

Era necessário estabelecer um padrão arquitetural que:
1. Isolasse totalmente a regra de agendamento e publicação dos SDKs de rede social.
2. Permitisse adicionar novos canais de distribuição (como Instagram e TikTok) apenas implementando uma nova interface, sem alterar uma única linha do núcleo de negócios.

---

## 2. Decisão

Decidimos estruturar a aplicação seguindo os preceitos da **Arquitetura Hexagonal (Ports and Adapters)** e **Clean Architecture**:

```
                  ┌────────────────────────────────────────────────────────┐
                  │                 INBOUND ADAPTERS                       │
                  │   [JobTriggerController] (HTTP POST /api/v1/run)       │
                  └──────────────────────────┬─────────────────────────────┘
                                             │
                                             ▼ (chama)
               ┌──────────────────────────────────────────────────────────────┐
               │                         CORE (DOMÍNIO)                       │
               │                                                              │
               │   PORTAS DE ENTRADA (Inbound Ports):                         │
               │   - PublishScheduledPostsUseCase                             │
               │                                                              │
               │   CASO DE USO (Application Service):                         │
               │   - PublishScheduledPostsService                             │
               │                                                              │
               │   PORTAS DE SAÍDA (Outbound Ports / Interfaces):             │
               │   - ScheduleRepositoryPort (CRUD da Planilha)                │
               │   - MediaStoragePort (Download InputStream)                  │
               │   - SocialMediaPublisherPort (Publicador de Vídeos)          │
               │                                                              │
               │   MODELOS DE DOMÍNIO:                                        │
               │   - PostSchedule, VideoMetadata, Platform, PublishResult     │
               └───────────────┬──────────────────────────────┬───────────────┘
                               │                              │
                               ▼ (implementa)                 ▼ (implementa)
        ┌───────────────────────────────┐      ┌───────────────────────────────┐
        │       STORAGE & DATABASE      │      │     OUTBOUND PUBLISHERS       │
        │ - GoogleSheetsAdapter         │      │ - YouTubePublisherAdapter     │
        │ - GoogleDriveAdapter          │      │ - InstagramPublisherAdapter*  │
        │                               │      │ - TikTokPublisherAdapter*     │
        └───────────────────────────────┘      └───────────────────────────────┘
                                                *Fase 2 de expansão
```

### Regras Mandatórias de Dependência:
1. **Direção das Dependências:** As dependências apontam sempre de fora para dentro. O pacote `domain` e `application` não conhecem nenhuma biblioteca de infraestrutura (`google-api-services`, `spring-web`, `docker`).
2. **SocialMediaPublisherPort:** Define o contrato universal de publicação:
   ```java
   public interface SocialMediaPublisherPort {
       boolean supports(Platform platform);
       PublishResult publish(PostSchedule post, MediaStream mediaStream);
   }
   ```
3. **Padrão Strategy / Multi-Tenant de Plataformas:** O `PublishScheduledPostsService` recebe uma coleção de adaptadores que implementam `SocialMediaPublisherPort` e delega a publicação com base no enum `Platform` da linha da planilha.

---

## 3. Consequências

### Pontos Positivos
* **Extensibilidade Imediata:** A inclusão do Instagram Reels ou TikTok requer apenas a criação de uma nova classe adaptadora (`InstagramPublisherAdapter`) que implementa `SocialMediaPublisherPort`, com zero risco de quebrar o YouTube.
* **Testabilidade Suprema:** As regras de negócio de agendamento, validação de limites de título/descrição, tags e cotas podem ser testadas unitariamente com mocks simples das portas, sem necessidade de emular serviços do Google.
* **Independência Tecnológica:** Se no futuro decidirmos trocar o Google Sheets por um banco relacional ou Notion, apenas o adaptador `ScheduleRepositoryPort` precisa ser reescrito.

### Pontos de Atenção / Trade-offs
* **Maior Número de Classes e Interfaces:** Exige a criação de DTOs de domínio próprios e mapeadores (*mappers*) para converter os objetos do SDK externo nos modelos internos da aplicação.
