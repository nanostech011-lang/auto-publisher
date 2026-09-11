# Product Requirements Document (PRD)
# Pipeline de Automação de Produção de Conteúdo e Vídeos Dark por IA

**Versão:** 1.0  
**Status:** Pronto para Implementação  
**Autor:** Antigravity / Gemini (Staff Software Engineer & Backend Architect)  
**Projeto:** AutoPublisher Pro - Extensão Upstream de Criação de Conteúdo  
**Documentos Relacionados:** [docs/automacao.md](automacao.md), [docs/PRD_AutoPublisher_Completo.md](PRD_AutoPublisher_Completo.md), [docs/DoD.md](DoD.md), [docs/Detalhes_Operacional.md](Detalhes_Operacional.md)

---

## 1. Visão Geral e Proposta de Valor

### 1.1. O Problema: O Gargalo de Produção Manual (Upstream)
O **AutoPublisher Pro** foi arquitetado com excelência para resolver o fluxo de distribuição (*Downstream*): leitura de cronogramas no Google Sheets, streaming zero-copy do Google Drive, publicação resiliente no YouTube (Shorts e Vídeos Longos), Instagram Reels e TikTok, além da fixação automática do primeiro comentário com links de afiliados.

No entanto, a **produção dos vídeos** permanecia fora do sistema, exigindo esforço humano intensivo:
1. Pesquisa manual de tendências e redação de roteiros persuasivos com ganchos de alta retenção.
2. Gravação ou síntese de locução (TTS) e alinhamento de timestamps.
3. Geração ou curadoria de múltiplos takes visuais verticais (9:16) a cada 2–4 segundos.
4. Montagem manual em softwares de edição (CapCut, Premiere), inclusão de trilha sonora, renderização e exportação.
5. Edição de legendas animadas dinâmicas (efeito palavra-por-palavra / karaokê).
6. Upload manual para pastas do Google Drive e preenchimento minucioso das 17 colunas da planilha `Cronograma`.

Esse processo manual consome entre 1 e 2 horas por vídeo, inviabilizando a meta de manter de **2 a 6 publicações diárias** consistentes por canal para maximizar os algoritmos das plataformas.

### 1.2. A Solução: Pipeline Autônomo End-to-End
Este PRD especifica o **Pipeline de Geração Automatizada de Vídeos Dark por IA**, um ecossistema que transforma tópicos validados em vídeos verticais completos (áudio sintetizado, cortes dinâmicos a cada 2–4s, legendas sincronizadas, trilha de fundo, metadados de SEO) e os injeta diretamente no Google Drive e na planilha `Cronograma` do AutoPublisher Pro, **sem qualquer intervenção humana**.

### 1.3. O Caso Piloto: Canal `@psicosegredo`
O primeiro caso de uso a ser suportado em escala é o perfil `@psicosegredo`, conforme delineado em [docs/automacao.md](automacao.md):
* **Nicho:** Neurociência prática, inteligência emocional e psicologia comportamental analítica.
* **Formato:** Vídeos verticais (9:16), com duração estritamente superior a 60 segundos (meta: **65 a 70 segundos**) para atender aos requisitos de monetização do **TikTok Creator Rewards Program** e retenção do **YouTube Shorts**.
* **Estética Visual:** *Dark Minimalist*, iluminação *chiaroscuro*, tons escuros com destaques em azul ciano, roxo néon e dourado.

---

## 2. Alinhamento com a Monetização e Custo Operacional

### 2.1. Custo Operacional R$ 0,00 / Free-Tier Sustentável
Seguindo o mandamento central do AutoPublisher Pro, a arquitetura prioriza componentes gratuitos ou de baixíssimo custo:
* **Mídia Visual (B-Roll e Imagens de IA):** Conector oficial para **Google Imagen 3** (`imagen-3.0-generate-002` via Google AI Studio API) com **Gerador Profissional de Prompts Cinematográficos em Inglês** (suporte a Gemini 2.0/1.5 Flash e ontologia semântica em 5 camadas com proporção 9:16). Conta com esteira resiliente de fallback em múltiplos níveis: **Flux HD** (qualidade fotográfica gratuita sem chave) $\rightarrow$ **Turbo** $\rightarrow$ Assets Locais do Canal $\rightarrow$ Renderização Procedural Chiaroscuro via FFmpeg.
* **Motor de Renderização:** FFmpeg e MoviePy/Remotion empacotados em um contêiner efêmero (Cloud Run Job ou script de automação), sem custos de licença.
* **Armazenamento e Ingestão:** Utilização do mesmo Google Drive e Google Sheets configurados no AutoPublisher Pro.

### 2.2. Otimização Algorítmica e Regras de Monetização
* **Elegibilidade ao Programa de Recompensas do Criador (TikTok):** Vídeos com duração garantida de **65 a 75 segundos**. Vídeos com 59 segundos são sumariamente desqualificados.
* **Algoritmo de Retenção (Shorts & TikTok):**
  * Gancho visual e verbal nos primeiros 3 segundos ("Pattern Interrupt").
  * Mudança de take visual a cada 2 a 4 segundos (mínimo de 15 a 20 cortes visuais por vídeo de 65s).
  * Legendas dinâmicas animadas destacando palavras-chave em cores contrastantes (amarelo ouro `#FFD700` e ciano elétrico `#00E5FF`).
* **Conformidade COPPA:** `Made_For_Kids = FALSE` injetado por padrão.
* **Links de Conversão:** Injeção automática de CTAs para produtos afiliados na descrição e geração do `Primeiro_Comentario` fixado.

---

## 3. Arquitetura do Sistema e Fluxo de Dados

```
 ┌──────────────────────────────────────────────────────────────────────────────────────┐
 │                     FASE UPSTREAM: PIPELINE DE CRIAÇÃO POR IA                        │
 └──────────────────────────────────────────────────────────────────────────────────────┘
                                            │
   1. Tema / Gatilho Validado               ▼
 ┌──────────────────────────────────────────────────────────────────────────────────────┐
 │ [Módulo 1: Script & Prompt Engine] (LLM - Gemini / GPT-4o)                           │
 │  ├─ Roteiro narrativo persuasivo (~150 a 170 palavras para 65-70s)                  │
 │  ├─ Prompts visuais cena a cena (9:16, chiaroscuro, cortes a cada 3s)                │
 │  └─ Metadados SEO: Título (<100c com #Shorts), Descrição com UTM, Tags e CTA         │
 └──────────────────────────────────────────┬───────────────────────────────────────────┘
                                            │
                      ┌─────────────────────┴─────────────────────┐
                      ▼                                           ▼
 ┌────────────────────────────────────────┐ ┌────────────────────────────────────────┐
 │ [Módulo 2: Voice & Subtitles Engine]   │ │ [Módulo 3: Visual Assets Engine]       │
 │  ├─ Síntese Neural (Edge-TTS / 11Labs) │ │  ├─ Download B-Roll Vertical (Pexels)  │
 │  ├─ Extração de Timestamps por Palavra │ │  ├─ Geração Text-to-Image / Video IA   │
 │  └─ Geração de arquivo SRT/ASS animado │ │  └─ Geração de Thumbnail 9:16 e 16:9   │
 └────────────────────┬───────────────────┘ └────────────────────┬───────────────────┘
                      │                                           │
                      └─────────────────────┬─────────────────────┘
                                            ▼
 ┌──────────────────────────────────────────────────────────────────────────────────────┐
 │ [Módulo 4: Video Compositor & Rendering Engine] (FFmpeg / Headless Compositor)       │
 │  ├─ Concatenação dos takes visuais com transições sutis                              │
 │  ├─ Mixagem da voz TTS (-3dB) + Trilha Dark Ambient (-22dB, loop contínuo)          │
 │  ├─ Queima de legendas com destaque dinâmico de palavras (Karaokê)                   │
 │  └─ Exportação MP4 H.264 / AAC (1080x1920, 9:16, 30fps)                             │
 └──────────────────────────────────────────┬───────────────────────────────────────────┘
                                            │
                                            ▼
 ┌──────────────────────────────────────────────────────────────────────────────────────┐
 │ [Módulo 5: Ingestor no AutoPublisher Pro]                                            │
 │  ├─ Upload do vídeo e da thumbnail para pasta designada do Google Drive              │
 │  ├─ Obtenção de `Drive_Video_ID` e `Drive_Thumbnail_ID`                              │
 │  └─ Chamada à API `POST /api/v1/dashboard/posts` ou inserção direta no Sheets        │
 └──────────────────────────────────────────┬───────────────────────────────────────────┘
                                            │
                                            ▼
 ┌──────────────────────────────────────────────────────────────────────────────────────┐
 │                    FASE DOWNSTREAM: AUTOPUBLISHER PRO CORE                           │
 │  ├─ Linha salva com status `PENDENTE` na aba `Cronograma`                            │
 │  ├─ Cloud Scheduler dispara `POST /api/v1/publisher/run`                             │
 │  └─ Publicação no YouTube Shorts, Instagram Reels e TikTok + Comentário Fixado       │
 └──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Requisitos Funcionais (RF)

### 4.1. Módulo 1: Roteirização e Metadados SEO (Script Engine)
* **[RF-01] Gerador de Roteiro Estruturado:**
  * Receber um tema de neurociência/psicologia (ex: "O Truque do Silêncio", "Dopamina e Procrastinação") ou consultar uma tabela de temas validados.
  * Produzir um roteiro com cadência de leitura cronometrada: exatamente entre **145 e 165 palavras** (correspondendo a 65–75 segundos em velocidade de fala natural de 135 ppm).
  * Estruturar obrigatoriamente em:
    * **Gancho (00:00 - 00:03):** Frase provocativa que quebra padrão.
    * **Desenvolvimento Científico (00:03 - 00:45):** Explicação da neurobiologia simplificada (amígdala, dopamina, córtex pré-frontal).
    * **Aplicação Prática / Hack (00:45 - 00:58):** Ação imediata para o espectador.
    * **CTA de Conversão (00:58 - 01:05):** Chamada para seguir o canal e acessar o link do perfil/comentário.
* **[RF-02] Segmentação de Cenas e Prompts Visuais:**
  * O roteiro deve ser automaticamente dividido em **cenas de 2 a 4 segundos** cada (totalizando entre 15 e 22 cenas por vídeo).
  * Para cada cena, gerar um prompt em inglês otimizado para text-to-image/video com os descritores de estilo: `dark aesthetic, chiaroscuro lighting, subtle cyan and gold edge light, cinematic, photorealistic, 8k, vertical 9:16`.
* **[RF-03] Geração de Metadados de Publicação:**
  * **Título:** Máximo de 100 caracteres, contendo o gancho principal e a hashtag `#Shorts`.
  * **Descrição:** Texto persuasivo de até 500 palavras contendo links de afiliados com parâmetros UTM (`?utm_source=tiktok&utm_medium=shorts&utm_campaign=psicosegredo`).
  * **Tags SEO:** Lista de palavras-chave separadas por vírgula (ex: `neurociencia, psicologia dark, comportamento, autodomínio, dopamina, shorts`).
  * **Primeiro Comentário Fixado:** Texto curto com CTA direto para a oferta/produto do canal.

### 4.2. Módulo 2: Síntese de Voz e Legendas (Voice & Subtitles Engine)
* **[RF-04] Locução Neural com Timestamps:**
  * Realizar síntese vocal do texto de narração utilizando Microsoft Edge TTS (`pt-BR-AntonioNeural` ou `pt-BR-FranciscaNeural`) em velocidade configurável (default: `+5%` para dinamismo).
  * Salvar o áudio limpo em formato MP3/WAV (44.1kHz, estéreo).
  * Extrair os limites de tempo de cada palavra (*word boundary timestamps*) gerados pelo protocolo WebSocket do Edge TTS.
* **[RF-05] Compilação de Legendas Dinâmicas (ASS / SRT):**
  * Converter os word boundaries em arquivo de legendas avançadas (`.ass` - Advanced SubStation Alpha).
  * Aplicar estilo visual padronizado:
    * Fonte: *Montserrat-Black*, *TheBoldFont* ou *Impact*.
    * Tamanho: 60-75pt centralizado no terço inferior (para não cobrir a área de botões do TikTok/Instagram).
    * Caixa alta (*UPPERCASE*).
    * Cor padrão: Branco (`&H00FFFFFF`) com borda preta espessa (`&H00000000`).
    * Efeito Karaokê: Palavra ativa destacada em Amarelo Ouro (`&H0000D7FF`) ou Ciano Néon (`&H00FFE500`).

### 4.3. Módulo 3: Coleta e Geração de Ativos Visuais (Visual Assets Engine)
* **[RF-06] Curadoria Automática de B-Roll Vertical:**
  * Consultar a API do Pexels/Pixabay utilizando palavras-chave extraídas de cada cena (ex: `brain`, `silence`, `thinking`, `neon dark`, `clock`).
  * Filtrar exclusivamente vídeos em formato vertical (orientação `portrait`), resolução mínima 1080x1920.
  * Cortar o trecho correspondente à duração da cena.
* **[RF-07] Geração e Renderização de Thumbnail:**
  * Gerar uma imagem estática de altíssimo impacto visual baseada no gancho do vídeo.
  * Exportar nos formatos 9:16 (para Shorts e TikTok) e 16:9 (caso publicado no YouTube tradicional).

### 4.4. Módulo 4: Renderização e Composição Final (Video Compositor)
* **[RF-08] Composição Dinâmica com FFmpeg:**
  * Concatenar os trechos de vídeo das cenas aplicando corte seco ou *crossfade* rápido (0.2s).
  * Aplicar filtro de escala e corte (*crop*) para assegurar rigorosamente 1080x1920 (aspect ratio 9:16).
  * Adicionar a trilha de áudio da locução sincronizada com o início do vídeo.
  * Inserir trilha sonora de fundo *dark ambient/tense* em volume atenuado (`volume=0.08` a `0.12`), com *fade-in* inicial e *fade-out* nos últimos 2 segundos.
  * Queimar (*hardcode*) as legendas dinâmicas compiladas via filtro `subtitles` ou `ass` do FFmpeg.
  * Exportar o vídeo final em MP4 com codec `h264` e áudio `aac`.
  * Validar se a duração final do arquivo MP4 é $\ge 60.5$ segundos.

### 4.5. Módulo 5: Ingestão Direta no AutoPublisher Pro (Ingestion Engine)
* **[RF-09] Upload Direto para o Google Drive:**
  * Fazer upload do arquivo de vídeo gerado (`video_psicosegredo_XXX.mp4`) para a pasta de vídeos designada no Google Drive.
  * Fazer upload da thumbnail gerada (`thumb_psicosegredo_XXX.png`) para a pasta de capas.
  * Recuperar os identificadores únicos (`Drive_Video_ID` e `Drive_Thumbnail_ID`).
* **[RF-10] Agendamento Automatizado de Postagem:**
  * Enviar requisição para o endpoint `POST /api/v1/dashboard/posts` do AutoPublisher Pro ou inserir diretamente na aba `Cronograma` do Google Sheets:
    * `ID`: `POST-AUTO-{UUID}`
    * `Data_Agendamento`: Calculada automaticamente com base na grade de publicações do canal (ex: slots diários às 12:00, 18:30 e 21:00).
    * `Plataforma`: `YOUTUBE_SHORTS` (ou duplicar linhas para `TIKTOK` e `INSTAGRAM_REELS`).
    * `Drive_Video_ID`: ID obtido no upload.
    * `Drive_Thumbnail_ID`: ID obtido na thumbnail.
    * `Titulo`: Título SEO com `#Shorts`.
    * `Descricao`: Copy persuasiva com UTMs.
    * `Tags`: Tags relevantes.
    * `Categoria_ID`: `28` (Ciência e Tecnologia) ou `24` (Entretenimento).
    * `Made_For_Kids`: `FALSE`.
    * `Privacidade`: `PUBLIC` (ou `UNLISTED` para checagem prévia).
    * `Status`: `PENDENTE`.
    * `Primeiro_Comentario`: Texto com link de afiliado.

---

## 5. Requisitos Não Funcionais (RNF)

* **[RNF-01] Compatibilidade com Arquitetura Hexagonal:**
  * O pipeline de criação pode operar como um módulo complementar (`com.autopublisher.generation`) ou como um serviço independente acionado via MCP / Agentes, comunicando-se com o AutoPublisher Pro através de suas portas de entrada (`CreatePostRequest` / REST API).
* **[RNF-02] Desempenho de Renderização e Custo de Máquina:**
  * A renderização de um vídeo de 65s via FFmpeg com aceleração por CPU deve ser concluída em menos de **180 segundos**.
  * A execução em nuvem deve ser feita sob demanda (Cloud Run Job ou script local disparado por cron), garantindo consumo de CPU zero fora dos períodos de compilação.
* **[RNF-03] Resolução e Qualidade Audiovisual:**
  * Formato de vídeo: MP4, H.264 (High Profile, level 4.2), 1080x1920 pixels, aspect ratio 9:16, taxa de quadros de 30 fps, bitrate mínimo de 4.5 Mbps.
  * Formato de áudio: AAC, 44.1 kHz, estéreo, bitrate mínimo de 192 kbps.
  * Normalização de loudness: Áudio final normalizado em **-14 LUFS** (padrão ótimo para YouTube Shorts, TikTok e Instagram Reels).
* **[RNF-04] Isolamento e Limpeza de Disco Efêmero:**
  * Todos os arquivos intermediários (áudios TTS temporários, arquivos de cena baixados, legendas `.ass`, frames intermediários) devem ser purgados imediatamente após a conclusão do upload para o Google Drive.
* **[RNF-05] Segurança de Chaves e Configurações:**
  * Todas as chaves necessárias (Pexels API Key, ElevenLabs API Key opcional, OpenAI/Gemini API Key, Google Drive Token) devem ser carregadas via variáveis de ambiente seguras (`.env`), sem exposição no repositório.

---

## 6. Interface de Operação via MCP (Model Context Protocol) e Agentes

Para permitir que agentes autônomos (como o Antigravity / Gemini CLI) operem o pipeline sob demanda ou em lotes, o sistema expõe ferramentas MCP especializadas:

### 6.1. Ferramentas MCP Projetadas

| Nome da Ferramenta | Parâmetros | Descrição |
| :--- | :--- | :--- |
| `generate_dark_script` | `topic`, `niche`, `target_duration_seconds`, `tone` | Gera o roteiro completo com marcações de tempo, narração TTS e prompts visuais de cena a cena. |
| `synthesize_narration` | `script_text`, `voice_id`, `speed_rate` | Gera o arquivo de áudio neural e o mapa de timestamps palavra a palavra. |
| `fetch_scene_visuals` | `scene_prompts`, `source_type` (`pexels`, `ai_gen`) | Obtém os trechos de vídeo ou imagens correspondentes a cada cena em 9:16. |
| `render_composite_video` | `audio_path`, `visuals_dir`, `subtitles_config`, `bg_music` | Executa o FFmpeg, gera legendas dinâmicas animadas e produz o MP4 final. |
| `ingest_to_autopublisher` | `video_path`, `thumbnail_path`, `metadata`, `schedule_slot` | Envia arquivos para o Google Drive e insere a postagem na planilha `Cronograma`. |
| `run_full_dark_pipeline` | `topic`, `channel_profile` | Orquestra todas as etapas acima em uma única execução ponta a ponta. |

---

## 7. Estrutura de Pastas e Componentes Propostos

O pipeline será incorporado de forma modular ao projeto:

```
auto-publisher/
├── docs/
│   ├── automacao.md                                # Documento de contexto do canal @psicosegredo
│   ├── PRD_Pipeline_Automacao_Conteudo.md          # Este PRD
│   └── backlog/
│       └── epico-09-pipeline-geracao-conteudo-ia.md # Épico correspondente no backlog
├── pipeline/                                       # Engine de Geração Upstream
│   ├── scripts/                                    # Automação de montagem e rendering
│   │   ├── generate_script.py                      # Integração LLM com prompts do nicho
│   │   ├── synthesize_voice.py                     # Edge-TTS / Word-level timestamps
│   │   ├── create_subtitles.py                     # Compilador de legendas dinâmicas ASS/SRT
│   │   ├── download_visuals.py                     # Pexels API / B-Roll harvester
│   │   ├── render_video.py                         # FFmpeg compositor & normalizador de áudio
│   │   └── ingest_post.py                          # Conector com Drive & API do AutoPublisher
│   ├── assets/
│   │   ├── fonts/                                  # Fontes para legendas (TheBoldFont, Montserrat)
│   │   └── music/                                  # Trilhas dark ambient royalty-free
│   └── config/
│       └── channels/
│           └── psicosegredo.json                   # Configuração de identidade, cores e bios
└── src/main/java/com/autopublisher/                # Core do Microsserviço Downstream (inalterado)
    ├── application/
    ├── domain/
    └── infrastructure/
```

### 7.1. Schema Canônico do Perfil do Canal (Multi-Nicho e Multi-Canal)

Para suportar múltiplos canais e nichos sem alterar o código, cada canal possui um arquivo de configuração JSON independente em `pipeline/config/channels/{channel_id}.json`:

```json
{
  "channel_id": "psicosegredo",
  "name": "@psicosegredo",
  "niche": "Neurociência Prática e Psicologia Comportamental",
  "target_audience": "Jovens e adultos interessados em autodomínio, foco e comportamento humano",
  "script_profile": {
    "target_words_min": 145,
    "target_words_max": 165,
    "target_duration_seconds": 68,
    "hook_formula": "Pattern Interrupt provocativo + Pergunta retórica ou afirmação contraintuitiva",
    "tone": "Analítico, misterioso, confiante e científico"
  },
  "voice_profile": {
    "provider": "edge_tts",
    "voice_id": "pt-BR-AntonioNeural",
    "rate": "+5%",
    "pitch": "-2Hz"
  },
  "visual_profile": {
    "aesthetic": "Dark Minimalist Chiaroscuro",
    "prompt_prefix": "Cinematic dark aesthetic, chiaroscuro lighting, volumetric smoke, 8k, vertical 9:16",
    "broll_keywords": ["human brain glowing", "dark silhouette", "eye close up cinematic", "thinking in shadow", "clock ticking fast"],
    "subtitles_style": {
      "font_name": "Montserrat-Black",
      "font_size": 65,
      "primary_color": "&H00FFFFFF",
      "active_word_color": "&H0000D7FF",
      "secondary_accent_color": "&H00FFE500",
      "outline_color": "&H00000000",
      "outline_width": 4,
      "position": "bottom_third"
    }
  },
  "audio_profile": {
    "bg_music_track": "assets/music/dark_ambient_tension_01.mp3",
    "bg_music_volume": 0.10,
    "target_lufs": -14.0
  },
  "publishing_profile": {
    "platforms": ["YOUTUBE_SHORTS", "TIKTOK", "INSTAGRAM_REELS"],
    "youtube_category_id": 28,
    "made_for_kids": false,
    "privacy": "PUBLIC",
    "default_tags": ["neurociencia", "psicologia", "autodominio", "comportamento", "dopamina", "shorts"],
    "affiliate_cta": {
      "description_template": "🧠 Domine sua química cerebral e elimine a procrastinação.\n🔗 Guia Definitivo do Autodomínio: https://meulink.com/psicosegredo?utm_source={platform}&utm_medium=shorts",
      "first_comment": "♟️ Quer reprogramar sua mente em 21 dias? Acesse o protocolo completo no link fixado: https://meulink.com/psicosegredo"
    },
    "drive_folder_videos": "DRIVE_FOLDER_ID_VIDEOS",
    "drive_folder_thumbnails": "DRIVE_FOLDER_ID_THUMBS"
  }
}
```

> [!TIP]
> **Adicionando um Novo Canal/Nicho:** Para lançar um canal de Finanças (ex: `@mentesmilionarias`), basta criar `pipeline/config/channels/mentesmilionarias.json`, alterando o `voice_id` (ex: voz feminina enérgica), as cores de legenda (ex: Verde Esmeralda `#00FF66`), as palavras-chave de b-roll (`["stock chart", "money luxury", "investor thinking"]`), a categoria do YouTube (`27` Educação) e os links de afiliado. Zero código precisa ser alterado.


---

## 8. Fases de Implementação e Milestones

### Milestone 1: Motor de Roteiro e Voz Neural (Semanas 1)
- [x] Implementação do gerador de roteiros calibrado para 65–70 segundos com fórmula Gancho + Ciência + Hack + CTA.
- [x] Integração com `edge-tts` e exportador de timestamps de palavras.
- [x] Geração de legendas animadas em formato `.ass` com destaque de palavras estilo karaokê.

### Milestone 2: Curadoria Visual e Motor de Renderização FFmpeg (Semana 2)
- [x] Integração com Pexels API para download de b-roll vertical focado em estética *dark psychology*.
- [x] Script de composição FFmpeg: corte automático a cada 2–4s, aplicação de trilha de fundo atenuada e queima de legendas animadas.
- [x] Validação da qualidade: 1080x1920, 9:16, duração $\ge 60$s, áudio a -14 LUFS.

### Milestone 3: Ingestor Google Drive e Google Sheets (Semana 3)
- [x] Upload automático dos ativos para as pastas do Google Drive configuradas.
- [x] Chamada automatizada para o endpoint `POST /api/v1/dashboard/posts` do AutoPublisher Pro com todos os 17 campos preenchidos.
- [x] Teste ponta a ponta com o Roteiro 1 ("O Truque do Silêncio") gerando vídeo, agendando e publicando no canal de teste.

### Milestone 4: Orquestração Autônoma e Ferramentas MCP (Semana 4)
- [x] Registro das ferramentas MCP no ecossistema Antigravity.
- [x] Suporte a execução em lote (geração de 7 vídeos para a grade da semana inteira em uma única sessão).
- [x] Painel de status no Dashboard Web indicando o progresso da geração.

---

## 9. Métricas de Sucesso e Critérios de Aceitação

1. **Autonomia:** O operador deve ser capaz de produzir 1 vídeo completo e agendado fornecendo apenas um tema (ex: `"Dopamina e Vício em Telas"`), sem abrir nenhum editor de vídeo ou planilha.
2. **Conformidade Algorítmica:** 100% dos vídeos gerados devem ter duração entre 61 e 75 segundos e conter `#Shorts` no título.
3. **Qualidade Audiovisual:** Sincronia perfeita entre a palavra falada na locução e o destaque da legenda na tela (tolerância máxima de $\pm 50\text{ms}$).
4. **Custo de Produção:** R$ 0,00 por vídeo utilizando Edge-TTS e Pexels API.
5. **Integração sem Regressão:** O microsserviço principal Java 21 do AutoPublisher Pro deve continuar funcionando com 100% de estabilidade e zero quebra no contrato da planilha.
