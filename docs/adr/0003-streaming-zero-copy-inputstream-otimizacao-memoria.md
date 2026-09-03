# ADR 0003: Streaming Zero-Copy de Mídia via InputStream e Chunks

* **Status:** Aceito
* **Data:** 2026-09-03
* **Decisores:** Time de Arquitetura e Engenharia AutoPublisher
* **Contexto Técnico:** [PRD_AutoPublisher_Completo.md](../PRD_AutoPublisher_Completo.md) - [RNF-01], [RNF-03]

---

## 1. Contexto e Problema

Arquivos de vídeo de alta qualidade (1080p, 4K, 60fps) e transmissões de longa duração variam comumente entre **100MB e 2GB** de tamanho.

Em microsserviços tradicionais, uma abordagem ingênua consiste em:
1. Baixar o arquivo completo do Google Drive para um array de bytes em memória (`byte[]`) ou para o disco local temporário.
2. Enviar o array de bytes para a API de destino (YouTube Data API).

Essa abordagem gera dois problemas graves no ambiente serverless:
1. **Estouro de Memória Heap (OutOfMemoryError):** O Google Cloud Run no plano gratuito opera de maneira mais econômica com **512MB de RAM**. Alocar centenas de megabytes em arrays de bytes causaria travamento imediato da JVM por falta de memória.
2. **Esgotamento de Disco Efêmero:** O armazenamento temporário em disco no Cloud Run utiliza a própria memória RAM configurada na instância (tmpfs). Gravar o vídeo em `/tmp` consome a memória RAM do contêiner da mesma forma.

---

## 2. Decisão

Decidimos adotar uma estratégia rigorosa de **Streaming Contínuo Zero-Copy**, onde os bytes trafegam diretamente do Google Drive para o YouTube sem nunca serem retidos integralmente na memória da JVM nem persistidos em disco.

### Mecanismo Técnico:
1. **Google Drive Adapter:**
   * Conecta ao arquivo via Google Drive API Client e invoca `driveService.files().get(fileId).executeMediaAsInputStream()`.
   * Esse método retorna um `InputStream` conectado à conexão HTTP de download.

2. **YouTube Publisher Adapter:**
   * Utiliza a classe oficial do SDK do Google: `InputStreamContent("video/*", driveInputStream)`.
   * O upload é configurado com a funcionalidade de **Resumable Upload** gerenciada pelo `MediaHttpUploader` do Google API Client:
     ```java
     YouTube.Videos.Insert videoInsert = youtube.videos().insert("snippet,status", videoObject, mediaContent);
     MediaHttpUploader uploader = videoInsert.getMediaHttpUploader();
     uploader.setDirectUploadEnabled(false); // Força Resumable Upload
     uploader.setChunkSize(MediaHttpUploader.MINIMUM_CHUNK_SIZE * 4); // Chunks de ~10MB
     ```
   * O SDK realiza a leitura do `InputStream` em blocos pontuais (chunks de 5MB a 10MB) e despacha imediatamente para o endpoint de upload resumível do YouTube.

3. **Virtual Threads (Project Loom - Java 21):**
   * Configuração de `spring.threads.virtual.enabled=true`.
   * Como o streaming envolve operações de I/O bloqueante (leitura da rede do Drive e escrita na rede do YouTube), as *Virtual Threads* do Java 21 evitam a saturação de threads nativas do sistema operacional, mantendo a pegada de memória do processo mínima.

---

## 3. Consequências

### Pontos Positivos
* **Pegada de Memória Mínima e Constante:** O consumo de memória RAM da aplicação permanece estável entre **150MB e 220MB**, independentemente de o vídeo ter 50MB ou 3GB.
* **Compatibilidade com Instâncias de 512MB:** O contêiner opera folgadamente na menor e mais econômica classe de instância do Google Cloud Run.
* **Altíssima Velocidade de Transferência:** Como a transferência ocorre diretamente entre os backbones internos de alta velocidade do Google (Google Drive e YouTube compartilham a infraestrutura de rede global da Google Cloud), o tráfego não sofre gargalos residenciais.
* **Resiliência de Rede:** Em caso de oscilação momentânea, o protocolo de Resumable Upload retoma o envio a partir do último bloco confirmado, sem recomeçar do zero.

### Pontos de Atenção / Trade-offs
* **Tamanho do Stream (Content Length):** O protocolo Resumable do YouTube funciona melhor quando o tamanho total do arquivo (`contentLength`) é informado no cabeçalho. **Solução:** O `GoogleDriveAdapter` obtém os metadados do arquivo (campo `size`) antes de iniciar o stream e repassa explicitamente ao `InputStreamContent.setLength(fileSize)`.
