---
name: autopublisher-dev-workflow
description: >-
  Use this skill when developing, testing, refactoring, or building the AutoPublisher
  Spring Boot service, implementing new ports or adapters (YouTube, Instagram Reels, TikTok),
  running unit/integration tests, checking DoD compliance, or preparing Docker multi-stage builds.
---

# AutoPublisher Development Workflow

Este guia orienta o desenvolvimento e manutenção do microsserviço **AutoPublisher Pro** em conformidade com as regras arquiteturais e operacionais do projeto.

---

## 1. Estrutura Canônica de Código (Clean Architecture)

Ao criar ou modificar componentes, respeite a localização estrita de cada classe:

```
com.autopublisher/
├── domain/                         # NENHUMA dependência externa do Spring ou Google SDKs
│   ├── model/                      # Entidades e Value Objects (Records)
│   │   ├── PostSchedule.java       # Representação de uma linha da planilha
│   │   ├── VideoMetadata.java      # Metadados: título, descrição com UTM, tags, COPPA
│   │   ├── Platform.java           # Enum: YOUTUBE_SHORTS, YOUTUBE_VIDEO, INSTAGRAM_REELS, TIKTOK
│   │   ├── PublishStatus.java      # Enum: PENDENTE, PROCESSANDO, PUBLICADO, ERRO_TEMPORARIO, COTA_ESGOTADA
│   │   └── PublishResult.java      # Record com status, videoId, publishedUrl, errorMessage
│   └── exception/                  # Exceções de negócio (Domain Exceptions)
│       ├── QuotaExceededException.java
│       ├── MediaStreamingException.java
│       └── ScheduleValidationException.java
├── application/                    # Orquestração de negócio
│   ├── port/
│   │   ├── in/                     # Casos de uso acionados por controladores ou eventos
│   │   │   └── PublishScheduledPostsUseCase.java
│   │   └── out/                    # Interfaces de saída implementadas pela infraestrutura
│   │       ├── ScheduleRepositoryPort.java     # Leitura e escrita na planilha
│   │       ├── MediaStoragePort.java           # Obtenção de InputStream de mídia
│   │       └── SocialMediaPublisherPort.java   # Contrato para publicadores de vídeo
│   └── usecase/
│       └── PublishScheduledPostsService.java   # Implementa o caso de uso e orquestra as portas
└── infrastructure/                 # Implementações tecnológicas e adaptadores concretos
    ├── adapter/
    │   ├── sheets/GoogleSheetsAdapter.java     # Google Sheets API v4
    │   ├── drive/GoogleDriveAdapter.java       # Google Drive API v3 (Streaming)
    │   └── youtube/YouTubePublisherAdapter.java # YouTube Data API v3 (Resumable Upload)
    ├── controller/
    │   └── JobTriggerController.java           # Endpoint REST POST /api/v1/publisher/run
    └── config/                                 # Configurações Spring, Beans e Segurança
```

---

## 2. Padrão de Implementação de Novos Publicadores

Para adicionar suporte a novas plataformas (ex: Instagram Reels, TikTok), siga o padrão Strategy:

1. **Implementar a Interface `SocialMediaPublisherPort`:**
   ```java
   public interface SocialMediaPublisherPort {
       boolean supports(Platform platform);
       PublishResult publish(PostSchedule post, MediaStream mediaStream);
   }
   ```
2. **Implementar o Adaptador na Infraestrutura:**
   * Nunca injete o adaptador diretamente no caso de uso.
   * O Spring Boot injeta uma `List<SocialMediaPublisherPort>` no `PublishScheduledPostsService`.
   * O serviço seleciona o adaptador em runtime via `publisher.supports(post.getPlatform())`.

---

## 3. Diretrizes para Testes Automatizados (DoD >= 80%)

*   **Testes Unitários:** O pacote `application/usecase` e o pacote `domain` devem possuir cobertura superior a 80%.
*   **Proibição de Rede em Testes:** Utilize `Mockito` para mockar `ScheduleRepositoryPort`, `MediaStoragePort` e `SocialMediaPublisherPort`.
*   **Cenários Obrigatórios de Teste:**
    1. Publicação com sucesso: status atualizado para `PUBLICADO` com URL gerada.
    2. Falha transitória de streaming: status atualizado para `ERRO_TEMPORARIO`, tentativas incrementadas.
    3. Erro `QuotaExceededException`: interrompe o processamento do lote e grava `COTA_ESGOTADA`.
    4. Validação de metadados: título com mais de 100 caracteres deve lançar exceção sem tentar fazer upload.
    5. Garantia COPPA: verificar se `selfDeclaredMadeForKids` foi recebido como `false` pelo publicador.

---

## 4. Otimização de Memória e Zero-Copy

Ao codificar adaptadores de mídia:
```java
// CORRETO: Passagem direta de stream
InputStream stream = driveService.files().get(fileId).executeMediaAsInputStream();
InputStreamContent mediaContent = new InputStreamContent("video/mp4", stream);
mediaContent.setLength(fileSize);

// PROIBIDO: NUNCA faça isto!
byte[] bytes = stream.readAllBytes(); // CAUSA OUTOFMEMORY NO CLOUD RUN
```

---

## 5. Docker e Execução em Produção

Utilize sempre um Dockerfile multi-stage com JRE Alpine:
```dockerfile
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app
COPY . .
RUN ./mvnw clean package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
COPY --from=builder /app/target/*.jar app.jar
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
```
