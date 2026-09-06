# Épico 09: Pipeline de Geração Automatizada de Conteúdo e Vídeos Dark por IA

* **Identificador:** `EP-09`
* **Status:** Planejado / Pronto para Implementação
* **Prioridade:** Should Have (Alta)
* **Complexidade:** Alta
* **Data de Planejamento:** 2026-09-05
* **Documentação de Referência:**
  * [docs/automacao.md](../automacao.md)
  * [docs/PRD_Pipeline_Automacao_Conteudo.md](../PRD_Pipeline_Automacao_Conteudo.md)
  * [docs/PRD_AutoPublisher_Completo.md](../PRD_AutoPublisher_Completo.md)
  * [docs/DoD.md](../DoD.md)

---

## 1. Visão Geral

Implementação do pipeline autônomo de produção (*Upstream*) que transforma temas validados de neurociência, psicologia e motivação (caso piloto: canal `@psicosegredo`) em vídeos verticais prontos (áudio sintetizado, legendas dinâmicas estilo karaokê, takes a cada 2–4s e trilha ambiente), enviando os arquivos diretamente para o Google Drive e agendando as postagens na planilha `Cronograma` do AutoPublisher Pro sem fricção manual.

---

## 2. Histórias de Usuário e Critérios de Aceite

### US-09.1: Motor de Roteirização Estruturada & SEO (Script Engine)
* **ID:** `US-09.1`
* **Status:** Planejado
* **Descrição:**  
  Como operador do canal dark,  
  Quero gerar automaticamente roteiros cronometrados (~150 palavras) e prompts visuais de cena a partir de um tema da neurociência,  
  Para produzir vídeos com duração entre 65 e 70 segundos elegíveis ao TikTok Creator Rewards e Shorts.

* **Critérios de Aceitação:**
  - [ ] Arquitetura orientada a perfis: suporte a múltiplos nichos e canais via arquivos de configuração `pipeline/config/channels/{channel_id}.json` (caso piloto: `psicosegredo.json`).
  - [ ] Roteiro gerado seguindo rigorosamente a estrutura de 4 blocos: Gancho (0-3s), Foco Científico/Tema Central (3-45s), Hack Prático (45-58s) e CTA (58-65s).
  - [ ] Divisão automática do roteiro em 15 a 22 cenas visuais de 2 a 4 segundos com prompts em inglês formatados na estética visual configurada no perfil do canal.
  - [ ] Geração de Título (<100 caracteres com `#Shorts`), Descrição com links UTM de afiliados, Tags SEO e Primeiro Comentário Fixado de acordo com as variáveis do perfil.
  - [ ] Validação de contagem de palavras (145 a 165 palavras para garantir duração $\ge 60$s).

---

### US-09.2: Síntese de Voz Neural e Legendas Dinâmicas (Voice & Subtitles Engine)
* **ID:** `US-09.2`
* **Status:** Planejado
* **Descrição:**  
  Como editor automatizado,  
  Quero sintetizar a narração em voz neural humana com custo R$ 0,00 e gerar legendas com marcação temporal de cada palavra,  
  Para prender a atenção do espectador com legendas animadas em estilo karaokê de alta retenção.

* **Critérios de Aceitação:**
  - [ ] Integração com Microsoft Edge-TTS (`pt-BR-AntonioNeural` ou `pt-BR-FranciscaNeural`).
  - [ ] Captura de *word boundary timestamps* diretamente do stream de síntese.
  - [ ] Geração de arquivo `.ass` com estilo visual padronizado: fonte bold, caixa alta, centralizado no terço inferior, palavra ativa destacada em Amarelo Ouro (`#FFD700`) ou Ciano (`#00E5FF`).
  - [ ] Áudio exportado em WAV/MP3 com amostragem de 44.1 kHz.

---

### US-09.3: Curadoria de B-Roll Vertical e Thumbnails (Visual Assets Engine)
* **ID:** `US-09.3`
* **Status:** Planejado
* **Descrição:**  
  Como sistema de montagem,  
  Quero baixar automaticamente trechos de vídeo verticais com estética dark para cada cena descrita no roteiro,  
  Para garantir ritmo acelerado com trocas de cena a cada 2 a 4 segundos sem custo de licenciamento.

* **Critérios de Aceitação:**
  - [ ] Integração com a API do Pexels/Pixabay filtrando exclusivamente vídeos verticais (orientação `portrait` 1080x1920).
  - [ ] Busca inteligente baseada nas palavras-chave extraídas de cada cena.
  - [ ] Corte dos trechos de vídeo para casar exatamente com a duração de cada cena.
  - [ ] Geração de imagem de capa/thumbnail de alto contraste com o gancho principal.

---

### US-09.4: Renderizador Headless de Vídeo (FFmpeg Compositor)
* **ID:** `US-09.4`
* **Status:** Planejado
* **Descrição:**  
  Como pipeline de pós-produção,  
  Quero compor todos os takes visuais, áudio da locução, trilha sonora ambiente e legendas em um arquivo MP4 único,  
  Para entregar um vídeo vertical finalizado pronto para publicação.

* **Critérios de Aceitação:**
  - [ ] Concatenação sequencial dos vídeos das cenas com proporção estrita 9:16 (1080x1920).
  - [ ] Injeção de trilha de áudio da locução sincronizada no frame 0.
  - [ ] Mixagem de trilha musical de fundo *dark ambient* atenuada (-22dB) com fade-in e fade-out.
  - [ ] Queima (*hardcoding*) das legendas animadas via filtro ASS do FFmpeg.
  - [ ] Normalização de loudness do áudio em -14 LUFS.
  - [ ] Validação pós-render: duração final $\ge 60.5$ segundos.

---

### US-09.5: Ingestor Automático no Google Drive e Google Sheets
* **ID:** `US-09.5`
* **Status:** Planejado
* **Descrição:**  
  Como operador do ecossistema,  
  Quero que o vídeo e a thumbnail renderizados sejam enviados para o Google Drive e cadastrados no AutoPublisher Pro,  
  Para que o agendador publique o vídeo no horário correto sem intervenção manual.

* **Critérios de Aceitação:**
  - [ ] Upload do MP4 para a pasta designada no Google Drive e obtenção de `Drive_Video_ID`.
  - [ ] Upload da thumbnail para o Google Drive e obtenção de `Drive_Thumbnail_ID`.
  - [ ] Disparo de requisição REST para `POST /api/v1/dashboard/posts` preenchendo todos os 12 atributos obrigatórios do contrato.
  - [ ] Linha criada com status `PENDENTE` na aba `Cronograma`.
  - [ ] Purga e limpeza de arquivos intermediários locais no disco efêmero.

---

### US-09.6: Conjunto de Ferramentas MCP para Agentes Autônomos
* **ID:** `US-09.6`
* **Status:** Planejado
* **Descrição:**  
  Como agente de IA (Antigravity),  
  Quero invocar ferramentas MCP padronizadas para cada etapa do pipeline,  
  Para poder planejar temas, gerar lotes semanais de vídeos e monitorar a esteira sob comando do usuário.

* **Critérios de Aceitação:**
  - [ ] Registro das ferramentas MCP: `generate_dark_script`, `synthesize_narration`, `fetch_scene_visuals`, `render_composite_video` e `ingest_to_autopublisher`.
  - [ ] Ferramenta agregadora `run_full_dark_pipeline` para execução completa com um único comando.
  - [ ] Tratamento de erros e feedback claro no console em caso de falha em qualquer etapa.
