# Épico 06: Expansão Multiplataforma (Fase 2)

* **Identificador:** `EP-06`
* **Status:** Planejado (Fase 2)
* **Prioridade:** Could Have
* **Objetivo:** Expandir o alcance de monetização estendendo a arquitetura hexagonal para suportar publicação automática no Instagram Reels e TikTok, além de publicar o primeiro comentário fixado com links de conversão logo após o upload.

---

## Histórias de Usuário

### US-06.1: InstagramPublisherAdapter (Meta Graph API / Reels)
* **ID:** `US-06.1`
* **Descrição:**  
  Como criador de conteúdo multiplataforma,  
  Quero que os vídeos com plataforma `INSTAGRAM_REELS` sejam publicados automaticamente na minha conta profissional do Instagram,  
  Para multiplicar o alcance orgânico dos meus vídeos verticais sem retrabalho manual.

* **Critérios de Aceitação:**
  - [ ] Implementação de `InstagramPublisherAdapter` implementando `SocialMediaPublisherPort` para `Platform.INSTAGRAM_REELS`.
  - [ ] Fluxo em dois passos da Meta Graph API:
    1. Criação do container de mídia (`POST /{ig-user-id}/media?media_type=REELS`).
    2. Polling de status até o container atingir o estado `FINISHED`.
    3. Publicação do container (`POST /{ig-user-id}/media_publish`).
  - [ ] Tratamento do limite de postagens da Meta (máx. 25 posts/dia).
  - [ ] Atualização do status da planilha com a URL do Reel publicado.

---

### US-06.2: TikTokPublisherAdapter (TikTok Content Posting API)
* **ID:** `US-06.2`
* **Descrição:**  
  Como criador focado no público jovem e retenção rápida,  
  Quero publicar vídeos diretamente no TikTok através da Content Posting API,  
  Para monetizar através do Programa de Recompensas do Criador do TikTok e parcerias comerciais.

* **Critérios de Aceitação:**
  - [ ] Implementação de `TikTokPublisherAdapter` implementando `SocialMediaPublisherPort` para `Platform.TIKTOK`.
  - [ ] Integração com o endpoint `/v2/post/publish/video/init/` da TikTok Content Posting API.
  - [ ] Suporte a tags comerciais e declaração de conteúdo gerado por IA (`is_aigc: true`) conforme regras de transparência da plataforma.
  - [ ] Retorno da URL ou status de postagem para o Google Sheets.

---

### US-06.3: Publicação Automática de Primeiro Comentário Fixado
* **ID:** `US-06.3`
* **Descrição:**  
  Como profissional de marketing de afiliados,  
  Quero que o sistema publique e fixe automaticamente o primeiro comentário com links de conversão e cupons logo após o upload do vídeo no YouTube,  
  Para aumentar a taxa de cliques em links de afiliados (que é até 3x maior no comentário fixado do que na descrição).

* **Critérios de Aceitação:**
  - [ ] Nova coluna opcional no Google Sheets: `Q: Primeiro_Comentario` (com links e cupons).
  - [ ] Chamada à API do YouTube `youtube.commentThreads().insert(...)` após o upload do vídeo ser concluído.
  - [ ] Tratamento de falhas: se a postagem do comentário falhar, o vídeo não deve ser considerado com erro, apenas registrando um aviso no log da planilha.
