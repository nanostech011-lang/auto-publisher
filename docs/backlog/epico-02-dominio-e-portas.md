# Épico 02: Núcleo de Domínio e Arquitetura Hexagonal

* **Identificador:** `EP-02`
* **Status:** Pronto para Iniciar
* **Prioridade:** Must Have
* **Objetivo:** Construir o núcleo puro de negócio da Clean Architecture (sem frameworks ou SDKs externos), definindo modelos imutáveis com Java Records e as interfaces (Portas) que garantem o desacoplamento e a testabilidade do sistema.

---

## Histórias de Usuário

### US-02.1: Modelagem de Entidades e Value Objects Imutáveis
* **ID:** `US-02.1`
* **Descrição:**  
  Como engenheiro de software,  
  Quero modelar os conceitos do domínio usando Java Records e Enums puros,  
  Para representar o agendamento de posts, metadados de vídeo e resultados de forma imutável e expressiva.

* **Critérios de Aceitação:**
  - [ ] Criação do Enum `Platform`: `YOUTUBE_SHORTS`, `YOUTUBE_VIDEO`, `INSTAGRAM_REELS`, `TIKTOK`.
  - [ ] Criação do Enum `PublishStatus`: `PENDENTE`, `PROCESSANDO`, `PUBLICADO`, `ERRO_TEMPORARIO`, `COTA_ESGOTADA`.
  - [ ] Criação do Enum `PrivacyStatus`: `PUBLIC`, `PRIVATE`, `UNLISTED`.
  - [ ] Criação do Record `VideoMetadata`:
    * `title` (máx. 100 caracteres)
    * `description` (máx. 5.000 caracteres, com suporte a links UTM)
    * `tags` (List<String>)
    * `categoryId` (Integer)
    * `madeForKids` (boolean - default `false`)
    * `privacy` (PrivacyStatus)
  - [ ] Criação do Record/Entity `PostSchedule`:
    * `id` (String)
    * `rowIndex` (int) - mapeia a linha física da planilha
    * `scheduledTime` (LocalDateTime)
    * `platform` (Platform)
    * `videoDriveId` (String)
    * `thumbnailDriveId` (Optional<String>)
    * `metadata` (VideoMetadata)
    * `status` (PublishStatus)
    * `attempts` (int)
  - [ ] Criação do Record `PublishResult`:
    * `success` (boolean)
    * `platformVideoId` (String)
    * `publishedUrl` (String)
    * `publishedAt` (LocalDateTime)
    * `errorMessage` (String)
  - [ ] Zero dependências externas (apenas JDK padrão no pacote `domain.model`).

---

### US-02.2: Definição das Portas de Entrada e Saída (Interfaces)
* **ID:** `US-02.2`
* **Descrição:**  
  Como desenvolvedor do AutoPublisher,  
  Quero definir as interfaces das portas (Ports) de entrada e saída na camada de aplicação,  
  Para que o caso de uso principal possa orquestrar a publicação sem conhecer detalhes de implementação do Google Sheets, Drive ou YouTube.

* **Critérios de Aceitação:**
  - [ ] **Inbound Port:** `PublishScheduledPostsUseCase`
    * Método: `PublishBatchReport execute()`
  - [ ] **Outbound Port 1:** `ScheduleRepositoryPort`
    * Método: `List<PostSchedule> findPendingPostsDue(LocalDateTime referenceTime)`
    * Método: `void updateStatus(int rowIndex, PublishStatus status, String publishedUrl, String logMessage, int attempts)`
  - [ ] **Outbound Port 2:** `MediaStoragePort`
    * Método: `InputStream downloadMediaStream(String fileId)`
    * Método: `long getFileSize(String fileId)`
  - [ ] **Outbound Port 3:** `SocialMediaPublisherPort`
    * Método: `boolean supports(Platform platform)`
    * Método: `PublishResult publish(PostSchedule post, InputStream videoStream, Optional<InputStream> thumbnailStream)`
  - [ ] Interfaces documentadas com JavaDoc detalhando contratos e pré-condições.

---

### US-02.3: Exceções de Negócio Tipadas (Domain Exceptions)
* **ID:** `US-02.3`
* **Descrição:**  
  Como arquiteto de software,  
  Quero um conjunto de exceções de domínio tipadas e descritivas,  
  Para tratar falhas de negócio de forma explícita e diferenciada (ex: erro de validação vs erro de cota esgotada).

* **Critérios de Aceitação:**
  - [ ] Criação de `QuotaExceededException` (específica para quando a API do YouTube retorna 403 quotaExceeded).
  - [ ] Criação de `MediaStreamingException` (para falhas de I/O na transferência de fluxo do Drive ou para o destino).
  - [ ] Criação de `ScheduleValidationException` (para metadados fora das especificações, como título > 100 caracteres ou ID vazio).
  - [ ] Todas as exceções herdam de uma exceção base `AutoPublisherException` (unchecked).
  - [ ] Testes unitários validando o lançamento e mensagens dessas exceções.
