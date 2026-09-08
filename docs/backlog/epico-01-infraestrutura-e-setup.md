# Épico 01: Infraestrutura, Setup e Segurança

* **Identificador:** `EP-01`
* **Status:** Concluído
* **Prioridade:** Must Have
* **Objetivo:** Estabelecer a base técnica, o gerenciador de dependências, o empacotamento em contêiner seguro e o gerenciamento de variáveis de ambiente para viabilizar o desenvolvimento limpo e sem credenciais expostas.

---

## Histórias de Usuário

### US-01.1: Bootstrap do Projeto Spring Boot 3 + Java 21
* **ID:** `US-01.1`
* **Status:** Concluído
* **Descrição:**  
  Como desenvolvedor do AutoPublisher,  
  Quero inicializar o projeto com Spring Boot 3.x, Java 21 LTS e Maven Wrapper (mvnw),  
  Para que possamos utilizar Virtual Threads e as bibliotecas oficiais do Google APIs de forma estável.

* **Critérios de Aceitação:**
  - [x] Projeto compila com Java 21 sem erros ou avisos graves.
  - [x] Dependências adicionadas no gerenciador de pacotes:
    * `spring-boot-starter-web`
    * `spring-boot-starter-validation`
    * `google-api-services-youtube` (v3)
    * `google-api-services-sheets` (v4)
    * `google-api-services-drive` (v3)
    * `google-auth-library-oauth2-http`
    * `spring-boot-starter-test` (JUnit 5, Mockito, AssertJ)
  - [x] Configuração de *Virtual Threads* habilitada em `application.yml` (`spring.threads.virtual.enabled: true`).
  - [x] Estrutura base de pacotes da Clean Architecture criada (`com.autopublisher.domain`, `com.autopublisher.application`, `com.autopublisher.infrastructure`).

---

### US-01.2: Configuração de Credenciais e Variáveis de Ambiente
* **ID:** `US-01.2`
* **Status:** Concluído
* **Descrição:**  
  Como operador do sistema,  
  Quero que todas as chaves e segredos sejam lidos exclusivamente do arquivo `.env` ou variáveis de ambiente,  
  Para que o código fonte seja 100% seguro contra vazamentos de credenciais no repositório.

* **Critérios de Aceitação:**
  - [x] Criação de classe `@ConfigurationProperties` ou componente de configuração tipado que mapeie:
    * `YOUTUBE_CLIENT_ID`
    * `YOUTUBE_CLIENT_SECRET`
    * `YOUTUBE_REFRESH_TOKEN`
    * `GOOGLE_SHEETS_SPREADSHEET_ID`
    * `GOOGLE_SHEETS_TAB_NAME`
    * `AUTO_PUBLISHER_API_KEY`
  - [x] Falha de inicialização rápida (*fail-fast*) com mensagem explicativa se alguma variável obrigatória estiver vazia.
  - [x] Regra de `.gitignore` protegendo arquivos de segredos validada.
  - [x] Logs mascarados para nunca expor o conteúdo do `refresh_token` ou `client_secret`.

---

### US-01.3: Dockerfile Multi-stage Otimizado (JRE Alpine)
* **ID:** `US-01.3`
* **Status:** Concluído
* **Descrição:**  
  Como arquiteto de infraestrutura,  
  Quero um Dockerfile multi-stage com JRE Alpine e usuário não-privilegiado,  
  Para que o contêiner seja ultra-leve (< 250MB), inicialize em menos de 3 segundos no Cloud Run e atenda às melhores práticas de segurança.

* **Critérios de Aceitação:**
  - [x] Build multi-stage: estágio `builder` com JDK 21 e estágio final com `eclipse-temurin:21-jre-alpine`.
  - [x] Criação e uso de usuário não-root (`appuser`) para execução do processo.
  - [x] Configuração de flags de memória da JVM para contêiner (`-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0`).
  - [x] Imagem Docker construída localmente com sucesso via `docker build`.
  - [x] Imagem testada e consumindo menos de 200MB em repouso.
