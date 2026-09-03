# Épico 03: Adaptadores de Integração e Streaming

* **Identificador:** `EP-03`
* **Status:** Pronto para Iniciar
* **Prioridade:** Must Have
* **Objetivo:** Implementar os adaptadores de infraestrutura que conectam o sistema ao ecossistema Google (Sheets, Drive e YouTube) com foco rigoroso em streaming zero-copy (baixo consumo de memória) e autenticação headless via OAuth 2.0.

---

## Histórias de Usuário

### US-03.1: GoogleSheetsAdapter (Leitura e Atualização Cirúrgica)
* **ID:** `US-03.1`
* **Descrição:**  
  Como operador do sistema,  
  Quero que o AutoPublisher leia o cronograma de postagens da aba `Cronograma` do Google Sheets e atualize o status de cada post de forma isolada,  
  Para manter a rastreabilidade em tempo real sem sobrescrever dados inseridos pelo usuário.

* **Critérios de Aceitação:**
  - [ ] Implementação de `GoogleSheetsAdapter` que implementa a porta `ScheduleRepositoryPort`.
  - [ ] Leitura em lote do intervalo `Cronograma!A2:P` via `spreadsheets.values.get`.
  - [ ] Mapeamento das 16 colunas para a entidade `PostSchedule` com tratamento de linhas vazias e validação de formato de data/hora (`YYYY-MM-DD HH:mm:ss`).
  - [ ] Atualização cirúrgica: método para gravar apenas nas colunas L até P (`Cronograma!L{row}:P{row}`) contendo:
    * Status (`PUBLICADO`, `ERRO_TEMPORARIO`, etc.)
    * URL publicada
    * Timestamp de conclusão
    * Mensagem de log
    * Contador de tentativas
  - [ ] Testes de unidade e integração utilizando stubs/mocks do Sheets API Client.

---

### US-03.2: GoogleDriveAdapter (Streaming Zero-Copy via InputStream)
* **ID:** `US-03.2`
* **Descrição:**  
  Como arquiteto de performance,  
  Quero que o adaptador do Google Drive forneça o fluxo de dados dos arquivos estritamente via `InputStream`,  
  Para que vídeos de mais de 1GB possam ser transferidos para o YouTube sem estourar a memória heap do contêiner (512MB RAM).

* **Critérios de Aceitação:**
  - [ ] Implementação de `GoogleDriveAdapter` que implementa a porta `MediaStoragePort`.
  - [ ] Método `downloadMediaStream(String fileId)` utilizando `driveService.files().get(fileId).executeMediaAsInputStream()`.
  - [ ] Método `getFileSize(String fileId)` obtendo metadados de tamanho (`size`) do arquivo para preenchimento de `contentLength`.
  - [ ] Verificação de que nenhum `byte[]` ou `ByteArrayOutputStream` é instanciado em nenhuma parte do adaptador ([ADR 0003](../adr/0003-streaming-zero-copy-inputstream-otimizacao-memoria.md)).
  - [ ] Tratamento de exceções caso o arquivo não seja encontrado ou a permissão do Drive seja negada.

---

### US-03.3: YouTubePublisherAdapter (Resumable Upload & Chunks)
* **ID:** `US-03.3`
* **Descrição:**  
  Como criador de conteúdo,  
  Quero que o adaptador do YouTube realize o upload resumível do vídeo utilizando o `refresh_token` offline permanente,  
  Para que postagens longas ou instáveis sejam concluídas com segurança e sem necessidade de login humano.

* **Critérios de Aceitação:**
  - [ ] Implementação de `YouTubePublisherAdapter` que implementa `SocialMediaPublisherPort` para plataformas `YOUTUBE_SHORTS` e `YOUTUBE_VIDEO`.
  - [ ] Autenticação utilizando `UserCredentials` configurado com `clientId`, `clientSecret` e `refreshToken` ([ADR 0001](../adr/0001-autenticacao-oauth2-refresh-token-youtube.md)).
  - [ ] Configuração de `MediaHttpUploader` com:
    * `setDirectUploadEnabled(false)` (força Resumable Upload).
    * `setChunkSize(MediaHttpUploader.MINIMUM_CHUNK_SIZE * 4)` (chunks de ~10MB).
  - [ ] Injeção de metadados obrigatórios do vídeo:
    * Título (com `#Shorts` quando aplicável).
    * Descrição com links de afiliados e tags.
    * Categoria e tags de SEO.
    * Status de privacidade (`public`, `private` ou `unlisted`).
    * `status.selfDeclaredMadeForKids: false` (mandatório para liberação de anúncios).
  - [ ] Retorno de `PublishResult` com o ID do vídeo gerado e a URL completa (`https://youtube.com/shorts/{id}` ou `https://youtu.be/{id}`).

---

### US-03.4: YouTubePublisherAdapter (Thumbnail Personalizada)
* **ID:** `US-03.4`
* **Descrição:**  
  Como criador focado em monetização e CTR,  
  Quero que o sistema vincule uma miniatura personalizada ao vídeo logo após o upload caso o `Drive_Thumbnail_ID` esteja preenchido,  
  Para multiplicar a taxa de cliques e o alcance algorítmico do vídeo.

* **Critérios de Aceitação:**
  - [ ] Caso `thumbnailDriveId` esteja presente no agendamento, invocar `MediaStoragePort.downloadMediaStream(thumbnailDriveId)`.
  - [ ] Executar a chamada `youtube.thumbnails().set(videoId, thumbnailContent)` utilizando `InputStreamContent("image/jpeg", stream)`.
  - [ ] Garantir que o consumo de cota associado (50 unidades) seja contabilizado.
  - [ ] Se o upload da thumbnail falhar, o status do vídeo ainda deve ser considerado `PUBLICADO`, mas registrando aviso no log da planilha sem invalidar a postagem principal.
