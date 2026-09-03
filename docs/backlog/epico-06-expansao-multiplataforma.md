# Épico 06: Expansão Multiplataforma (Fase 2)

* **Identificador:** `EP-06`
* **Status:** Concluído
* **Prioridade:** Could Have
* **Objetivo:** Expandir o alcance de monetização estendendo a arquitetura hexagonal para suportar publicação automática no Instagram Reels e TikTok, além de publicar o primeiro comentário fixado com links de conversão logo após o upload.

---

## Histórias de Usuário

### US-06.1: InstagramPublisherAdapter (Meta Graph API / Reels)
* **ID:** `US-06.1`
* **Status:** Concluído
* **Descrição:**  
  Como criador de conteúdo multiplataforma,  
  Quero que os vídeos com plataforma `INSTAGRAM_REELS` sejam publicados automaticamente na minha conta profissional do Instagram,  
  Para multiplicar o alcance orgânico dos meus vídeos verticais sem retrabalho manual.

* **Critérios de Aceitação:**
  - [x] Implementação de `InstagramPublisherAdapter` implementando `SocialMediaPublisherPort` para `Platform.INSTAGRAM_REELS`.
  - [x] Fluxo em dois passos da Meta Graph API:
    1. Criação do container de mídia resumível (`POST /{ig-user-id}/media?media_type=REELS&upload_type=resumable`).
    2. Upload binário via streaming contínuo (`InputStream`) sem buffering de array em heap.
    3. Polling de status até o container atingir o estado `FINISHED`.
    4. Publicação do container (`POST /{ig-user-id}/media_publish`).
  - [x] Tratamento do limite de postagens da Meta (máx. 25 posts/dia).
  - [x] Atualização do status da planilha com a URL do Reel publicado via permalink retornado pela API.

---

### US-06.2: TikTokPublisherAdapter (TikTok Content Posting API)
* **ID:** `US-06.2`
* **Status:** Concluído
* **Descrição:**  
  Como criador focado no público jovem e retenção rápida,  
  Quero publicar vídeos diretamente no TikTok através da Content Posting API,  
  Para monetizar através do Programa de Recompensas do Criador do TikTok e parcerias comerciais.

* **Critérios de Aceitação:**
  - [x] Implementação de `TikTokPublisherAdapter` implementando `SocialMediaPublisherPort` para `Platform.TIKTOK`.
  - [x] Integração com o endpoint `/v2/post/publish/video/init/` da TikTok Content Posting API.
  - [x] Streaming de dados direto para o upload_url via `HttpRequest.BodyPublishers.ofInputStream()`.
  - [x] Suporte a hashtags formatadas a partir dos metadados do post.
  - [x] Retorno da URL de visualização e `publish_id` para atualização no Google Sheets.

---

### US-06.3: Publicação Automática de Primeiro Comentário Fixado
* **ID:** `US-06.3`
* **Status:** Concluído
* **Descrição:**  
  Como profissional de marketing de afiliados,  
  Quero que o sistema publique e fixe automaticamente o primeiro comentário com links de conversão e cupons logo após o upload do vídeo no YouTube,  
  Para aumentar a taxa de cliques em links de afiliados (que é até 3x maior no comentário fixado do que na descrição).

* **Critérios de Aceitação:**
  - [x] Suporte a leitura da coluna `Q: Primeiro_Comentario` no Google Sheets (`Cronograma!A2:Q`).
  - [x] Mapeamento do campo `firstComment` na entidade imutável de domínio `PostSchedule`.
  - [x] Chamada à API do YouTube `youtube.commentThreads().insert(...)` logo após a confirmação do upload do vídeo.
  - [x] Tratamento de resiliência: se a postagem do comentário falhar, o vídeo ainda é considerado com sucesso `PUBLICADO`, registrando apenas aviso informativo no log.
