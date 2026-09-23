# Épico 09: Pipeline de Geração Automatizada de Conteúdo e Vídeos Dark por IA

* **Identificador:** `EP-09`
* **Status:** Concluído
* **Prioridade:** Should Have (Alta)
* **Complexidade:** Alta
* **Data de Conclusão:** 2026-09-05
* **Documentação de Referência:**
  * [docs/automacao.md](../automacao.md)
  * [docs/PRD_Pipeline_Automacao_Conteudo.md](../PRD_Pipeline_Automacao_Conteudo.md)
  * [docs/PRD_AutoPublisher_Completo.md](../PRD_AutoPublisher_Completo.md)
  * [docs/DoD.md](../DoD.md)
* **Arquivos Relacionados:**
  * `pipeline/src/run_pipeline.js`
  * `pipeline/src/voice_synthesizer.js`
  * `pipeline/src/subtitle_generator.js`
  * `pipeline/src/visuals_harvester.js`
  * `pipeline/src/video_compositor.js`
  * `pipeline/src/publisher_ingestor.js`
  * `pipeline/config/channels/psicosegredo.json`
  * `pipeline/config/channels/channel_template.json`

---

## 1. Visão Geral

Implementação do pipeline autônomo de produção (*Upstream*) que transforma temas validados de neurociência, psicologia e motivação (caso piloto: canal `@psicosegredo`) em vídeos verticais prontos (áudio sintetizado, legendas dinâmicas estilo karaokê, takes a cada 2–4s e trilha ambiente), enviando os arquivos diretamente para o Google Drive e agendando as postagens na planilha `Cronograma` do AutoPublisher Pro sem fricção manual.

---

## 2. Histórias de Usuário e Critérios de Aceite

### US-09.1: Motor de Roteirização Estruturada & SEO (Script Engine)
* **ID:** `US-09.1`
* **Status:** Concluído
* **Descrição:**  
  Como operador do canal dark,  
  Quero gerar automaticamente roteiros cronometrados (~150 palavras) e prompts visuais de cena a partir de um tema da neurociência,  
  Para produzir vídeos com duração entre 65 e 70 segundos elegíveis ao TikTok Creator Rewards e Shorts.

* **Critérios de Aceitação:**
  - [x] Arquitetura orientada a perfis: suporte a múltiplos nichos e canais via arquivos de configuração `pipeline/config/channels/{channel_id}.json` (caso piloto: `psicosegredo.json`).
  - [x] Roteiro gerado seguindo rigorosamente a estrutura de 4 blocos: Gancho (0-3s), Foco Científico/Tema Central (3-45s), Hack Prático (45-58s) e CTA (58-65s).
  - [x] Divisão automática do roteiro em 15 a 22 cenas visuais de 2 a 4 segundos com prompts em inglês formatados na estética visual configurada no perfil do canal.
  - [x] Geração de Título (<100 caracteres com `#Shorts`), Descrição com links UTM de afiliados, Tags SEO e Primeiro Comentário Fixado de acordo com as variáveis do perfil.
  - [x] Validação de contagem de palavras (145 a 165 palavras para garantir duração $\ge 60$s).

---

### US-09.2: Síntese de Voz Neural e Legendas Dinâmicas (Voice & Subtitles Engine)
* **ID:** `US-09.2`
* **Status:** Concluído
* **Descrição:**  
  Como editor automatizado,  
  Quero sintetizar a narração em voz neural humana com custo R$ 0,00 e gerar legendas com marcação temporal de cada palavra,  
  Para prender a atenção do espectador com legendas animadas em estilo karaokê de alta retenção.

* **Critérios de Aceitação:**
  - [x] Integração com Microsoft Edge-TTS (`pt-BR-AntonioNeural` ou `pt-BR-FranciscaNeural`).
  - [x] Captura de *word boundary timestamps* diretamente do stream de síntese via WebSocket.
  - [x] Geração de arquivo `.ass` com estilo visual padronizado: fonte bold, caixa alta, centralizado no terço inferior, palavra ativa destacada em Amarelo Ouro (`#FFD700`) ou Ciano (`#00E5FF`).
  - [x] Áudio exportado em WAV/MP3 com amostragem de 24.0/44.1 kHz.

---

### US-09.3: Curadoria de B-Roll Vertical e Thumbnails (Visual Assets Engine)
* **ID:** `US-09.3`
* **Status:** Concluído
* **Descrição:**  
  Como sistema de montagem,  
  Quero baixar automaticamente trechos de vídeo verticais com estética dark para cada cena descrita no roteiro,  
  Para garantir ritmo acelerado com trocas de cena a cada 2 a 4 segundos sem custo de licenciamento.

* **Critérios de Aceitação:**
  - [x] Integração com a API do Pexels/Pixabay filtrando exclusivamente vídeos verticais (orientação `portrait` 1080x1920).
  - [x] Suporte a assets cinematográficos fotorrealistas em 9:16 por canal com animação de câmera Ken Burns (*zoompan* dinâmico).
  - [x] Corte e dimensionamento dos trechos para casar rigorosamente com o tempo da locução.
  - [x] Geração de imagem de capa/thumbnail de alto contraste com o gancho principal.

---

### US-09.4: Renderizador Headless de Vídeo (FFmpeg Compositor)
* **ID:** `US-09.4`
* **Status:** Concluído
* **Descrição:**  
  Como pipeline de pós-produção,  
  Quero compor todos os takes visuais, áudio da locução, trilha sonora ambiente e legendas em um arquivo MP4 único,  
  Para entregar um vídeo vertical finalizado pronto para publicação.

* **Critérios de Aceitação:**
  - [x] Concatenação sequencial dos vídeos das cenas com proporção estrita 9:16 (1080x1920).
  - [x] Injeção de trilha de áudio da locução sincronizada no frame 0 com mapeamento explícito (`-map [v_out]`, `-map 1:a`).
  - [x] Codificação de áudio estéreo em AAC 192kbps e vídeo H.264.
  - [x] Queima (*hardcoding*) das legendas animadas em estilo karaokê via filtro ASS do FFmpeg.
  - [x] Validação pós-render: duração final $\ge 60$ segundos (elegível ao Creator Rewards).

---

### US-09.5: Ingestor Automático no Google Drive e Google Sheets
* **ID:** `US-09.5`
* **Status:** Concluído
* **Descrição:**  
  Como operador do ecossistema,  
  Quero que o vídeo e a thumbnail renderizados sejam enviados para o Google Drive e cadastrados no AutoPublisher Pro,  
  Para que o agendador publique o vídeo no horário correto sem intervenção manual.

* **Critérios de Aceitação:**
  - [x] Suporte a upload do MP4 e Thumbnail para as pastas designadas no Google Drive.
  - [x] Integração com a API REST `POST /api/v1/dashboard/posts` com payload completo de 12 campos contratuais.
  - [x] Geração de manifesto local (`POST-AUTO-*_manifest.json`) para sincronização e contingência offline.
  - [x] Purga automática de arquivos intermediários do diretório efêmero.

---

### US-09.6: Runner e Orquestração por Agentes Autônomos
* **ID:** `US-09.6`
* **Status:** Concluído
* **Descrição:**  
  Como agente de IA (Antigravity),  
  Quero disparar a esteira com um único comando CLI ou ferramenta MCP,  
  Para poder planejar temas, gerar vídeos e acompanhar a esteira sob comando do usuário.

* **Critérios de Aceitação:**
  - [x] Script executável unificado `run_pipeline.js` acionado via `pnpm pipeline`.
  - [x] Suporte a argumentos CLI `--channel <id>`, `--script <idx>`, `--topic <tema>`, `--platform <plataforma>`.
  - [x] Feedback em tempo real no console com duração, resolução e status de elegibilidade ao TikTok Rewards.

---

### US-09.7: Geração em Lote e Grade Semanal de Postagens (--batch N)
* **ID:** `US-09.7`
* **Status:** Concluído
* **Descrição:**  
  Como operador de canal autônomo,  
  Quero gerar múltiplos vídeos em lote e agendá-los de forma escalonada no calendário de publicação,  
  Para preencher a grade semanal inteira de conteúdo em uma única sessão.

* **Critérios de Aceitação:**
  - [x] Suporte a argumento CLI `--batch <N>` e requisição REST via `POST /api/v1/dashboard/pipeline/run` com campo `batchCount`.
  - [x] Agendamento escalonado inteligente no `publisher_ingestor.js`: vídeo 1 para daqui a 45 minutos (primeira publicação imediata) e vídeos 2 a N escalonados nos dias subsequentes sempre no horário nobre (18:00 BRT).
  - [x] Orquestração em loop no `run_pipeline.js` garantindo isolamento de diretórios temporários (`ephemeral_runs/{postId}`) e relatórios de progresso individuais.
  - [x] Resiliência a falhas individuais no lote sem abortar os demais vídeos da fila.

---

### US-09.8: Conector de Vídeo IA Google Veo 2 e Resolução Nativa 1080x1920 Full HD
* **ID:** `US-09.8`
* **Status:** Concluído
* **Descrição:**  
  Como diretor de arte automatizado,  
  Quero gerar takes de vídeo reais com IA via Google Veo 2 / Video FX e imagens em alta resolução 1080x1920 Full HD com sincronia labial/fonética exata,  
  Para maximizar o impacto visual, a taxa de retenção dos espectadores e a conversão de monetização.

* **Critérios de Aceitação:**
  - [x] Conector dedicado `ai_video_connector.js` compatível com a API Google Veo 2 (`veo-2.0-generate-001:predictLongRunning`) com polling assíncrono de operações e fallback resiliente.
  - [x] Modo visual configurável (`visualMode: 'hybrid' | 'video' | 'image'`):
    * Modo `hybrid`: gancho inicial (0-3s) gerado como vídeo IA dinâmico de altíssimo impacto visual; cenas subsequentes renderizadas com imagens Full HD e Ken Burns suave a 30fps.
    * Modo `video`: todas as cenas renderizadas com vídeos gerados por IA.
    * Modo `image`: todos os takes com imagens estáticas animadas em movimento cinematográfico.
  - [x] Resolução nativa vertical 1080x1920 Full HD com filtros de interpolação `flags=bicubic` e `-framerate 30` no FFmpeg, eliminando tremulações e artefatos de compressão.
  - [x] Alinhador fonético `scene_aligner.js` com L-Cut cinematográfico (100ms pré-roll) e snap em pausas de fala, garantindo transição sem cortes no meio de palavras.
  - [x] Mixagem de áudio com atenuação dinâmica (*ducking*) da trilha de fundo e fade-out suave ao término da narração.

---

### US-09.9: Gate de Qualidade Contratual (QC Gate), Beat Planner e Masterização EBU R128
* **ID:** `US-09.9`
* **Status:** Concluído
* **Descrição:**  
  Como arquiteto de qualidade de mídia e conformidade de monetização,  
  Quero que todo vídeo renderizado passe obrigatoriamente por um Quality Control Gate automatizado com 13 checagens contratuais e atinja padrões profissionais de transmissão broadcast,  
  Para garantir 100% de elegibilidade a programas de monetização, zero marcas d'água de terceiros, sincronia A/V milimétrica e retenção máxima de audiência.

* **Critérios de Aceitação:**
  - [x] **QC Gate Automático (`qc_gate.js`):** 13 checagens contratuais (`QC-1` a `QC-13`) inspecionando duração ($\ge 60$s), resolução (1080x1920 nativo @ 30fps), áudio broadcast EBU R128 (alvo -14 LUFS, TP -1.5 dBFS), detecção de telas pretas e congelamento de vídeo, nitidez laplaciana, higienização de marcas d'água (crop protetivo de 58px), diversidade semântica de beats, safe area de legendas (`margin_v: 560`), densidade e ritmo dinâmico de cortes (1.8s a 4.5s), sincronia A/V ($\le 40$ms, medido $\le 1$ms) e ineditismo no canal via ledger SHA-1.
  - [x] **Beat Planner (`beat_planner.js`):** Subdivisão inteligente de tomadas longas em 2 a 3 sub-takes dinâmicos com alternância de movimentos de câmera (`push_in`, `pull_out`, `orbit`, `pan`) e zoom sem custo adicional de IA.
  - [x] **Legendas Karaokê Profissionais (`subtitle_generator.js`):** 1 único evento `Dialogue` por card com animação suave de cor via tags ASS `\t` e `\fad(70,90)`, tipografia `Montserrat-Black.ttf` versionada localmente e quebra de linha calculada com `WrapStyle: 2`.
  - [x] **Engenharia de Áudio Broadcast (`video_compositor.js`):** Cadeia de voz com `highpass=f=80` e `acompressor`, ducking automático via `sidechaincompress`, compatibilização de layout estéreo com `aformat` e masterização EBU R128 no mix final.
  - [x] **Manifestos Estruturados de Observabilidade:** Geração e persistência automática de `script.json`, `scenes.json`, `prompts.json`, `run.json` (SDD v3.0 §3.7) e `report.json` em cada execução.

