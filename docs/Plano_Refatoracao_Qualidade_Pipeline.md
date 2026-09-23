# Plano de Refatoração — Qualidade de Saída do Pipeline de Vídeo IA

**Versão:** 1.0
**Status:** Proposto — aguardando decisões de custo (§4)
**Data:** 2026-09-15
**Escopo:** `pipeline/` (Node.js/FFmpeg/Edge-TTS) + ponte `AiPipelineService` (Java)
**Documentos Relacionados:** [SDD v3](SDD_Pipeline_Conteudo_IA_v3.md) (especificação de implementação), [SDD v2](SDD_Pipeline_Conteudo_IA_v2.md) (superado), [ADR 0006](adr/0006-fonte-de-visuais-e-teto-de-qualidade.md), [GEMINI.md](../GEMINI.md), [DoD](DoD.md)

---

## 1. Sumário Executivo

O pipeline entrega hoje um MP4 tecnicamente válido (1080x1920, 30fps, ≥60s) e **qualitativamente impublicável**. A investigação identificou que isso não decorre de um defeito isolado, mas de **três tiers de geração mortos** que fazem 100% da produção convergir para o pior fallback disponível, sem nenhum mecanismo que detecte a degradação.

Os quatro defeitos observáveis no vídeo publicado — borrão, marca d'água de terceiro, descompasso entre narração e imagem, e legendas que quebram frases — são sintomas de **cinco causas-raiz**:

| # | Causa-raiz | Efeito visível |
|---|---|---|
| CR-1 | O tier primário de imagem chama um modelo inexistente (`imagen-3.0-generate-002` → HTTP 404) | 100% das imagens vêm do último fallback |
| CR-2 | O último fallback (Pollinations) tem teto rígido de 0,59 MP e queima marca d'água | Borrão por upscale 3,75x + logo de terceiro em todos os frames |
| CR-3 | O tier de B-roll real (Pexels/Pixabay) nunca executa: chaves ausentes **e** não repassadas | Perde-se a única fonte gratuita de 1080x1920 nativo |
| CR-4 | A chave Gemini não é repassada ao gerador de roteiro | Todo tópico livre produz o **mesmo texto fixo** |
| CR-5 | Não existe gate de qualidade em nenhum ponto | Nada disso é detectado: o sistema reporta sucesso |

**A correção de CR-4 é uma linha de código.** A de CR-1/CR-3 são de baixo esforço. A de CR-2 exige uma decisão de custo (§4). CR-5 é o que impede a regressão.

O plano está organizado em 9 fases ordenadas por **impacto visível ÷ esforço**. A fase F0 é composta exclusivamente de correções triviais e já muda o resultado na próxima execução.

---

## 2. Método e Nível de Confiança

Este documento distingue explicitamente dois níveis de evidência. Nenhuma afirmação abaixo é inferida apenas por leitura de código.

**Nível A — verificado diretamente nesta sessão**: probes de rede reais, `ffprobe`/`ffmpeg` sobre os artefatos de `pipeline/output/run_1789161687124_1/`, inspeção visual de frames extraídos. São os itens CR-1, CR-2, CR-4 e as medições de nitidez, resolução e marca d'água.

**Nível B — auditoria estática com experimentos dos auditores**: 143 achados produzidos por auditores especializados, cada um lendo os módulos de sua dimensão na íntegra e executando probes próprios (renderização do `.ass` com libass, medição EBU R128, cronometragem de latência do Gemini, execução direta das funções exportadas). Estes achados **não passaram pela verificação adversarial** prevista originalmente — ela foi dispensada por decisão de escopo. Tratá-los como hipóteses de altíssima qualidade, confirmando a evidência citada antes de aplicar cada correção.

Pesquisa complementar: análise dos dois repositórios de [`Reference-automation.txt`](../Reference-automation.txt) (ambos acessíveis e analisados) e do estado da arte de shorts faceless — 54 técnicas extraídas, referenciadas ao longo do plano.

### 2.2 Lacuna de cobertura conhecida

Sete das oito dimensões previstas concluíram: roteiro/copy (22 achados), engenharia de prompt visual (17), conectores de API (24), áudio/TTS (18), legendas (16), sincronia/timing (16) e arquitetura/observabilidade (30).

**A dimensão de composição e render FFmpeg não teve auditor dedicado concluído.** As afirmações deste plano sobre `video_compositor.js` e o motion engine (upscale 3,75x, fade-to-black nas fronteiras, CBR vs. CRF, reencode duplo) vêm das medições de Nível A e da pesquisa de estado da arte, não de uma auditoria dedicada ao módulo. A fase **F7 é, portanto, a menos instrumentada do plano** — vale auditá-la especificamente antes de executá-la.

### 2.1 Medições de referência (linha de base)

Executadas sobre `pipeline/output/run_1789161687124_1/video_final_9x16.mp4` e seus assets em `pipeline/scratch/`:

| Métrica | Medido | Alvo |
|---|---|---|
| Resolução dos assets de origem | **576x1024** (0,59 MP) | 1080x1920 (2,07 MP) |
| Fator de upscale aplicado | **3,75x linear** (14x em área) | ≤ 1,0x |
| Nitidez (energia de borda, Laplaciano via `convolution`+`signalstats`) | **1,20** no render final | ≥ 2,5 |
| Nitidez de um asset local do próprio repo, para comparação | 5,04 | — |
| Marca d'água `pollinations.ai` | **presente** no frame t=0,3s | ausente |
| Duração média dos takes | **7,83s** (máx. 12,07s) | 2,0–4,0s |
| Modelos de imagem disponíveis no Pollinations | `["sana"]` — `model=flux` é ignorado | — |
| Cota de imagem do Gemini (free tier) | `limit: 0` (HTTP 429) | — |

---

## 3. Diagnóstico: a Cadeia Causal Completa

### 3.1 Da chave de API ao pixel

```
GEMINI_API_KEY (formato AQ.Ab8..., free tier)
   |
   |-- models.list ......................... 200 OK
   |-- gemini-flash-lite-latest ............ 200 OK (699 ms)  <- texto FUNCIONA
   |-- imagen-3.0-generate-002:predict ..... 404 NOT FOUND    <- CR-1: o código chama ISTO
   +-- gemini-*-image:generateContent ...... 429 limit:0      <- o código NUNCA chama ISTO
                                                 |
                    +----------------------------+
                    v
        ai_image_connector.js: imagenDisabledForSession = true (sem TTL, sem distinção 404/429)
                    |
                    v
        Fallback Pollinations --- model=flux IGNORADO (só existe "sana")
                    |              width/height IGNORADOS -> teto rígido 0,59 MP
                    |              nologo=true IGNORADO -> marca d'água queimada
                    v
        576x1024 com logo, aceito sem validação (único critério: buffer > 5000 bytes)
                    |
                    v
        visuals_harvester.js: scale=2160:3840:flags=bicubic   <- upscale 3,75x
                    |
                    v
        video_compositor.js: -b:v 4500k gasto em borrão interpolado
                    |
                    v
        MP4 publicado: nitidez 1,20 . logo de terceiro . anatomia derretida
```

Simultaneamente, no eixo do texto:

```
run_pipeline.js:67 resolve effectiveGeminiKey
   |
   |-- passa para harvestVisualScenes (linha 158) ........... OK
   +-- NÃO passa para generateScript (linhas 86-92) ......... CR-4
                    |
                    v
        script_generator.js: geminiKey === null em todo o caminho de tópico livre
                    |
                    v
        Bloco hardcoded das linhas 139-181: hook/core1/core2/hack/cta FIXOS
                    |
                    v
        Narração idêntica para qualquer tópico, com topic.slice(0,35)
        cortando a palavra no meio -> a voz NARRA "INTE" (de "INTERIOR")
```

### 3.2 Por que nada disso foi detectado

`grep -rn "ffprobe(" pipeline/src/` retorna **zero ocorrências**, apesar de três módulos configurarem `ffmpeg.setFfprobePath`. O compositor resolve com `durationSeconds: totalDurationSeconds` — o valor **pedido**, nunca o medido. O único critério de aceite de um asset visual em toda a cadeia é `buffer.length > 5000`. O `publisher_ingestor` retorna `success: true` mesmo quando a API rejeita o post. O log anuncia `provider: 'Pollinations AI (Flux HD 1080p)'` enquanto grava um arquivo 576x1024 vindo de um modelo chamado `sana`.

O sistema não tem como saber que está falhando. **Essa é a causa-raiz estrutural (CR-5)** — e a razão de o plano tratar o QC gate como item de primeira classe, não como polimento final.

### 3.3 Sintomas secundários relevantes

Além das cinco causas-raiz, a auditoria isolou defeitos que degradam a percepção de forma independente:

- **Ritmo.** 8 cortes em 62,6s (média 7,83s/take) contra os 2–4s prometidos pelo SDD v2 e pelo `cuts_interval_seconds` de todos os 5 perfis de canal. Takes de 10,5s e 12,1s sobre imagem estática.
- **Transições.** `fade` sem `color=` faz fade **para preto**: medição per-frame na fronteira `scene_1|scene_2` (t=10,233s) mostra a luminância caindo de 61,7 para 17,9. Os 100ms de L-cut do aligner são anulados por 300ms de tela escurecendo.
- **Monotonia visual.** Os 5 bancos de cenas hardcoded em `ai_prompt_generator.js` são selecionados por `idx % length`; o prompt de "STRICT ZERO REPETITION" é enviado em N chamadas independentes que não conhecem umas às outras. Além disso, um burst real de 9 chamadas paralelas com o timeout de 6000ms do código aborta cerca de 1/3 das cenas, que caem no banco hardcoded — daí o mesmo cavaleiro-sob-árvore reaparecendo.
- **Legendas.** `groupWordsIntoChunks` quebra a cada 4 palavras e o branch de pontuação é **código morto** (os wordBoundaries do Edge-TTS não contêm pontuação). `\fscx108` na palavra ativa altera a métrica da linha e faz o bloco inteiro saltar a cada ~250ms. `marginV=380` coloca o texto dentro da zona de UI do TikTok.
- **Áudio.** `amix` sem `normalize=0` derruba o programa de −14,5 para −20,5 LUFS assim que existir trilha (medido) — e `pipeline/assets/music/` está vazio, então o ramo de mixagem nunca executou. Nenhum SSML: LRA de 2,5 LU comprova locução chapada.
- **Config morta.** `visual_profile.subtitles_style`, `audio_profile` inteiro, `format.target_fps/resolution/cuts_interval_seconds`, `script_profile.*` e `voice_profile.pitch` são declarados nos 5 perfis de canal e **nunca lidos**. Todos os canais saem visualmente idênticos.
- **Duplicação de conteúdo.** `--batch N` incrementa `scriptIndex` sobre um catálogo de 4 roteiros com módulo. Para `--channel psicosegredo` há 2 roteiros: `--batch 7` publica o mesmo vídeo 3–4 vezes. Isso é conteúdo duplicado — risco direto de desmonetização.
- **Container.** `fluent-ffmpeg` e `@ffmpeg-installer` estão em `devDependencies`, mas o Dockerfile roda `pnpm install --prod`. O pipeline não roda no container. E nem Montserrat (config) nem Arial (código) existem na imagem.

---

## 4. Decisões Pendentes

Duas decisões alteram materialmente o plano e são do dono do produto, não do implementador.

### DECISÃO 1 — Fonte dos visuais

O teto de qualidade do vídeo é definido aqui. As opções não são mutuamente exclusivas; a recomendação é combinar B e C.

| Opção | Custo | Resolução nativa | Marca d'água | Observação |
|---|---|---|---|---|
| **A. Manter Pollinations** | R$ 0,00 | 576x1024 (0,59 MP) | Sim | Teto matemático em 28% dos pixels do alvo. Mesmo com restauração ótima, não há detalhe a recuperar. |
| **B. Pexels + Pixabay B-roll** | R$ 0,00 | **1080x1920 real** | Não | Cadastro gratuito imediato (Pexels: 20.000 req/mês). Vídeo real, não sintético. Cobre bem cenas de ação humana concreta; cobre mal conceitos abstratos e estilos autorais (Ghibli/anime). |
| **C. Gemini image com billing** | ~US$ 0,03/img (`gemini-3.1-flash-image`, 2K) a ~US$ 0,13/img (`gemini-3-pro-image`, 4K) | 2K/4K nativo 9:16 | Não | Cerca de US$ 0,30/vídeo usando Pro só no gancho + thumbnail e Flash no corpo. Elimina upscale, marca d'água e anatomia derretida de uma vez. |

**Recomendação: B como piso permanente + C para gancho e thumbnail.** O gancho (primeiros 1,5s) e a thumbnail são onde retenção e CTR pagam o custo; o corpo aceita B-roll real. Isso mantém o custo abaixo de US$ 0,10/vídeo e remove o teto de 0,59 MP.

Se a resposta for **A**, o plano permanece válido: todas as fases exceto F1 se aplicam, e F1 se reduz à mitigação de marca d'água + cadeia de restauração (ganho medido de nitidez: 1,20 → 1,37, ou +14%). O vídeo melhora, mas continua sendo um upscale de 3,5x.

### DECISÃO 2 — Trilha sonora, SFX e fontes

`pipeline/assets/music/` e `pipeline/assets/fonts/` contêm apenas `.gitkeep`. É necessário versionar no repositório:

- 3–4 loops livres de direitos por estética (CC0 — Pixabay Music / Free Music Archive);
- 4–6 whooshes e 3–4 impacts para os cortes;
- `Montserrat-Black.ttf` (licença SIL OFL permite redistribuição).

Sem isso, `audio_profile` e `subtitles_style` continuam inaplicáveis mesmo depois de ligados ao código.

---

## 5. Plano de Execução

Cada fase declara critério de aceite **objetivo e mensurável**. A especificação técnica detalhada de cada item está no [SDD v3](SDD_Pipeline_Conteudo_IA_v3.md).

### F0 — Correções triviais de alto impacto

> **Objetivo:** mudar visivelmente o resultado da próxima execução sem nenhuma mudança arquitetural. Todas são de 1 a 5 linhas.
> **Esforço:** ~3h. **Impacto:** alto.

| # | Arquivo | Mudança |
|---|---|---|
| F0.1 | `run_pipeline.js:86` | Adicionar `geminiKey: effectiveGeminiKey` ao objeto de `generateScript`. **Isto sozinho tira o roteiro do template fixo.** |
| F0.2 | `script_generator.js:140-141` | Trocar `topic.slice(0,35)` e `topic.slice(0,50)` por truncamento por palavra. Elimina o "INTE". |
| F0.3 | `youtube_analyzer.js:194` | Timeout `9500` → `45000`. Latência real medida: 12,5–14,2s — hoje **100%** das chamadas abortam. |
| F0.4 | `youtube_analyzer.js:209` | `maxOutputTokens: 1400` → `4096`. Hoje o JSON de roteiro+cenas trunca e o parse falha. |
| F0.5 | `ai_prompt_generator.js:550,562` | Timeout `6000` → `20000`; `maxOutputTokens: 180` → `512`; validar `finishReason === 'STOP'`. |
| F0.6 | `subtitle_generator.js:120` | Trocar `\fscx108\fscy108` por `\bord{N+3}\blur3`. Elimina o salto do bloco de legenda (validado por render). |
| F0.7 | `subtitle_generator.js:117` | Aplicar `escapeAssText()` a todo texto interpolado em `Dialogue:`. |
| F0.8 | `voice_synthesizer.js:34` | `xmlEscape()` antes do SSML. Hoje um `&` no roteiro **aborta a síntese inteira**. |
| F0.9 | `subtitle_generator.js:80` | `marginV` `380` → `560` (união das safe areas de Shorts/Reels/TikTok). |
| F0.10 | `visuals_harvester.js:222` | Trocar `scale=2160:3840:flags=bicubic` pela cadeia com `lanczos` + `unsharp` + crop da faixa de marca d'água. |
| F0.11 | `ai_video_connector.js:209` | Deletar `generateVideoWithPollinations` — `model=video` não existe e o endpoint grava um **JPEG como `.mp4`**. |
| F0.12 | `run_pipeline.js:105` | Repassar `pitch` e `volume` de `voice_profile`. |
| F0.13 | `script_generator.js:163` | `rewardsEligible: true` literal → calculado. |

**Aceite F0:** dois tópicos livres distintos produzem `narrationText` distintos; nenhuma palavra truncada no `.srt`; nenhum pixel de `pollinations.ai` no frame t=0,3s; nitidez do render final ≥ 1,35; legenda estaticamente ancorada (bloco pixel-idêntico entre eventos consecutivos do mesmo card).

---

### F1 — Fonte visual: romper o teto de 0,59 MP

> **Objetivo:** substituir a origem dos pixels. É a fase de maior impacto absoluto. **Bloqueada pela DECISÃO 1.**
> **Esforço:** ~3 dias. **Impacto:** máximo.

- **F1.1** — Preflight `resolveAvailableImageModel()`: consultar `models.list` no início da run e derrubar qualquer model id ausente **antes** de produzir. Deletar `generateImageWithImagen3` por completo.
- **F1.2** — Implementar o tier correto: `gemini-3.1-flash-image` / `gemini-3-pro-image` via `:generateContent` com `responseModalities:['IMAGE']` e `imageConfig:{aspectRatio:'9:16', imageSize:'2K'|'4K'}`, chave **sempre em header** `x-goog-api-key`.
- **F1.3** — Reativar o B-roll real: `PEXELS_API_KEY`/`PIXABAY_API_KEY` no `.env`, repasse explícito em `visuals_harvester.js:481`, ranking por relevância (`per_page=30`, score por termos), filtro de orientação vertical no Pixabay, dedup por asset id entre runs.
- **F1.4** — `pipeline/src/asset_quality_gate.js`: rejeitar asset por resolução mínima (864x1536), desvio de aspecto > 0,06, luminância fora de [38, 215], desvio-padrão de cor abaixo do piso (detecta placeholder chapado) e heurística de marca d'água (razão de energia de borda entre o quadrante inferior-direito e seu espelho > 2,2). **Um asset reprovado cai para o próximo tier — não é aceito.**
- **F1.5** — Circuit breaker por modelo com TTL e classificação de erro (404 = permanente na run; 429/min = 60s; 429/dia = 6h; 400 = nunca abre o breaker). Substitui os flags `imagenDisabledForSession` / `isVeoDisabledForSession`.
- **F1.6** — Cache content-addressed em `pipeline/.cache/assets` com sidecar de qualidade; hit só é aceito se `grade.ok === true`. Negative-cache para não repetir gerações reprovadas.
- **F1.7** — Corrigir o parser de resposta do Veo (`generateVideoResponse.generatedSamples[0].video.uri`, download com `?alt=media` **autenticado**) e quantizar `durationSeconds` para o domínio válido `[4,6,8]`. Hoje o Google renderiza, fatura e o código descarta o resultado.

**Aceite F1:** 100% dos assets aceitos têm ≥ 864x1536 e passam no gate; zero marca d'água detectada; nitidez do render final ≥ 2,5; o log declara o provedor e a **dimensão real** do arquivo.

---

### F2 — Legendas

> **Objetivo:** o elemento mais lido do vídeo. Alto impacto visível, totalmente sob nosso controle, sem dependência externa.
> **Esforço:** ~2 dias. **Impacto:** alto.

- **F2.1** — Agrupamento prosódico em 2 passes: segmentar por `gap` entre wordBoundaries (fronteira forte ≥ 260ms, fraca ≥ 110ms), reconciliar com a pontuação do `narrationText`, e empacotar cards respeitando, nesta ordem: nunca cruzar fronteira forte → no máximo 2 linhas → duração entre 700 e 2200ms.
- **F2.2** — **Um** `Dialogue` por card com sweep de cor via `\t`, em vez de um evento por (palavra ativa × palavras do card). Reduz de 160 eventos/26,6KB para cerca de 40 eventos.
- **F2.3** — `WrapStyle: 2` + `\N` calculado pelo gerador (largura medida), eliminando a quebra imprevisível do libass.
- **F2.4** — Ligar `visual_profile.subtitles_style` do perfil do canal, com **fail-fast** se um campo declarado não tiver consumidor. Versionar `Montserrat-Black.ttf` e passar `fontsdir` ao filtro `subtitles`.
- **F2.5** — Camada de animação: `\fad(70,90)` + pop-in `\t(0,110,\fscx103\fscy103)\t(110,200,\fscx100\fscy100)` **na entrada do card** (onde o reflow é lido como intenção), nunca por palavra.
- **F2.6** — `.srt` em caixa mista (o `.ass` queimado permanece em caixa alta) — o SRT vai para o CC do YouTube, onde caixa alta prejudica acessibilidade.

**Aceite F2:** zero quebras no meio de sintagma em 3 execuções consecutivas; posição do bloco pixel-idêntica entre eventos do mesmo card; base do texto acima de y=1450 em PlayResY=1920; fonte resolvida sem fallback (`fc-match` confirma).

---

### F3 — Ritmo e sincronia

> **Objetivo:** takes de 7,8s sobre imagem estática são a definição de queda de retenção.
> **Esforço:** ~3 dias. **Impacto:** alto.

- **F3.1** — Medir a duração real do `narration.mp3` com `ffprobe` e usá-la como fim da timeline. Hoje são duas gorduras somadas (+300ms no synth, +0,3s no run) sobre um valor estimado que ainda assim **trunca** o áudio.
- **F3.2** — Reconciliação de densidade **antes** do aligner: ler `format.cuts_interval_seconds` → `targetSceneCount = round(duração / média)`. Para 62,6s com 2–4s → 21 cenas. Subdividir beats longos nos limites de vírgula/pausa >150ms, gerando 2–3 sub-takes da **mesma** imagem com `motionType` e crop diferentes (sem custo adicional de geração).
- **F3.3** — Aligner com restrições: `minSceneMs=1800`, `maxSceneMs=4500`, projeção do vetor de cortes na região viável por varredura para frente e para trás até convergir. Hoje só existe piso, nunca teto — um probe com 20 cenas produziu um take de 15,88s seguido de cenas esmagadas em 1,5s.
- **F3.4** — Corrigir `findOptimalPauseCut`: o `else if (maxPause < 200)` fica **permanentemente desligado** após a primeira pausa >200ms, fazendo a função ignorar o `targetTimeMs`.
- **F3.5** — Corrigir o threshold de `findWordSequenceIndex`: hoje casar **apenas a primeira palavra** (score 2,0 ≥ 1,5) aprova o match — uma frase inexistente casa com o artigo "a". Exigir score ≥ 62% do máximo possível e ignorar stopwords de até 2 chars como âncora.
- **F3.6** — Remover o fade-to-black das fronteiras (`fade` sem `color=`) e fazer a transição no compositor com `xfade`, mantendo `fade=t=in` só no primeiro clipe e `fade=t=out` só no último.
- **F3.7** — Quantizar todos os cortes em frames na origem (`cutFrames = round(cutMs/1000*fps)`). Drift cumulativo medido hoje: −36,7ms, até −0,7s na densidade prometida.

**Aceite F3:** duração de todo take entre 1,8s e 4,5s; diferença entre duração do vídeo e do áudio menor que 40ms; luminância média na fronteira de corte não cai abaixo de 70% da luminância dos frames vizinhos.

---

### F4 — Roteiro generativo de verdade

> **Objetivo:** F0.1 liga a IA; esta fase faz o texto ser bom. O caminho de texto do Gemini **funciona hoje** e não depende de nenhuma decisão de custo.
> **Esforço:** ~3 dias. **Impacto:** alto.

- **F4.1** — Extrair `generateScriptWithGemini({theme, transcriptText, channelProfile, visualDirective, apiKey})` de `youtube_analyzer.js` e usá-la no caminho de tópico livre. O template fixo vira contingência nível 4, marcada `degraded: true` no retorno.
- **F4.2** — `responseSchema` declarado + repair de JSON + validação semântica com regeneração dirigida (não apenas checagem de presença de campo).
- **F4.3** — Passe dedicado de reescrita do **hook**, isolado (cerca de 700ms no modelo que já funciona). Técnica extraída do repositório de referência `Yashvi-Vekariya`.
- **F4.4** — Consumir `script_profile` do perfil: `tone`, `hook_formula`, `structure[]` cronometrada, `target_words_min/max` e `words_per_minute` real (o literal `135` está duplicado no código enquanto o Edge-TTS a +5% entrega cerca de 168 WPM — erro de +24% no planejamento).
- **F4.5** — Ledger anti-repetição em `pipeline/state/script_history.json` alimentando o prompt; `temperature` 0.35 → 0.8 com `topP` 0.95 (a garantia de formato passa a vir do schema).
- **F4.6** — `--batch` consome uma **fila de tópicos** (`--topics-file`), não um módulo sobre 4 roteiros. Recusar publicar roteiro cujo `sha1(narrationText)` já exista para o canal.
- **F4.7** — Título com garantias mecânicas (lacuna de curiosidade, até 65 chars) e descrição com hashtags válidas — hoje gera `#psicologia comportamental` (com espaço) e publica o placeholder `{platform}` literal.

**Aceite F4:** 5 tópicos distintos produzem 5 roteiros com similaridade de trigramas menor que 0,35 entre si; contagem de palavras dentro de `target_words_min/max`; duração real do TTS dentro de ±3s da estimada.

---

### F5 — Visual beats estruturados

> **Objetivo:** eliminar simultaneamente o descompasso tema↔imagem e a monotonia.
> **Esforço:** ~4 dias. **Impacto:** alto.

- **F5.1** — Schema de **Visual Beat**: `{id, phrase, blockType, shotType, subject, action, environment, lighting, negativePrompt}`, obtido em **uma única chamada** que recebe todas as frases e devolve todas as cenas. Hoje são N chamadas independentes às quais se pede "ZERO REPETITION" sem que nenhuma conheça as outras.
- **F5.2** — Diversidade **por construção**: grade obrigatória de 8 `shotType` rotacionados + validação que rejeita cena com similaridade de trigramas > 0,45 contra qualquer anterior (reprompt apenas das colididas).
- **F5.3** — **Style contract** por run, persistido no manifesto: `{runSeed, styleToken, palette[], characterSheet}` — é o que dá identidade sem cair na repetição de composição.
- **F5.4** — Deletar os 5 bancos hardcoded. Manter um banco de emergência (rede 100% fora) indexado por `hash(phrase)` e com pool embaralhado sem reposição — nunca por `idx %`.
- **F5.5** — Corrigir `VISUAL_SEMANTIC_DICTIONARY`: regex sem fronteira corrompe palavras no meio (`felicidade` → `felisoaring skyscraper skyline`). Envolver com fronteira unicode-aware e adicionar teste de regressão sobre `['felicidade','velocidade','constantemente','simplesmente']`.
- **F5.6** — Substituir `p.includes(x)` de `deduceActionIntent` por regex com fronteira: hoje `'falha constantemente'` e `'jornada'` disparam buckets errados, colapsando a variedade em `inner_mind`.
- **F5.7** — Parar de truncar o prompt em 250 caracteres (`makeCompactFallbackPrompt` descarta **61%**, justamente as camadas de estilo e os guard-rails `no text`/`no watermark`). Montar o prompt já no orçamento do destino, descartando camadas inteiras por prioridade.

**Aceite F5:** nenhum par de cenas do mesmo vídeo com similaridade maior que 0,45 em `subject+environment`; `shotType` distinto em cenas adjacentes; revisão humana confirma correspondência tema↔imagem em pelo menos 80% dos beats.

---

### F6 — Áudio

> **Esforço:** ~2 dias. **Impacto:** médio-alto (percebido como "produção profissional").

- **F6.1** — Cadeia de voz antes da mixagem: `highpass=f=80`, de-esser, `acompressor`, e fonte em 96–192 kbps (hoje 48 kbps mono).
- **F6.2** — Ducking real por `sidechaincompress` com a voz como chave, substituindo o `volume=0.12` fixo.
- **F6.3** — `amix=...:normalize=0` + `loudnorm` **two-pass no mix final** (hoje o loudnorm roda na voz **antes** do mix e o `amix` cru derruba 6 dB — medido).
- **F6.4** — SSML por bloco via `rawToStream`: `<break>` entre atos, `rate` variável (hook +12%, corpo +4%, punchline −6%, número −10%). LRA atual de 2,5 LU comprova locução chapada.
- **F6.5** — Consumir `audio_profile` (`bg_music_volume`, `target_lufs`, `fade_out_seconds`) e versionar as trilhas (DECISÃO 2).
- **F6.6** — SFX de whoosh nos cortes a −120ms e −8 dB, **fora** do ducking.

**Aceite F6:** `ebur128` no MP4 final com diferença de no máximo 0,8 LU em relação a `target_lufs` e TP de no máximo −1,0 dBTP; LRA de pelo menos 5 LU.

---

### F7 — Render

> **Esforço:** ~2 dias. **Impacto:** médio.

- **F7.1** — `-crf 20 -preset slow -profile:v high -level 4.1` em vez de `-b:v 4500k` CBR.
- **F7.2** — Eliminar o reencode duplo (clipe individual → concat → render final): um único `filter_complex` com `xfade` encadeado, grading, legendas e áudio.
- **F7.3** — Tagging de colorspace `bt709` e `setsar=1`.
- **F7.4** — `ffprobe` obrigatório no `on('end')`: retornar a duração **medida**, não a pedida.

**Aceite F7:** uma única passagem de encode; `ffprobe` confirma `duration`, `r_frame_rate`, `width`/`height` e presença de stream de áudio.

---

### F8 — Robustez, configuração e observabilidade

> **Esforço:** ~5 dias. **Impacto:** médio no vídeo, máximo na prevenção de regressão.

- **F8.1** — Executor de etapas declarativas com `try/catch` por etapa, política de retry por natureza (rede vs. local) e persistência de `run.json` após cada etapa; `--resume <runId>`.
- **F8.2** — `pipeline/src/config_resolver.js` + `pipeline/config/channel.schema.json` com `additionalProperties: false`: uma chave com typo **falha** em vez de degradar em silêncio.
- **F8.3** — Log estruturado NDJSON em canal dedicado (`@@EVT {...}` em stdout, prosa humana em stderr), substituindo os 40+ `console.log` em PT-BR que hoje **são** o contrato de integração com o Java.
- **F8.4** — Gravar `script.json`, `scenes.json`, `prompts.json` e `report.json` no `outputDir` — hoje é impossível auditar por que um vídeo saiu errado.
- **F8.5** — `pipeline/src/qc_gate.js` entre o compositor e a ingestão, com **falha dura** (§6).
- **F8.6** — Dockerfile: mover `fluent-ffmpeg`/`@ffmpeg-installer`/`@ffprobe-installer` para `dependencies` (ou eliminá-los via `FFMPEG_PATH`), e `COPY` das fontes + `fc-cache`.
- **F8.7** — Deletar o catálogo de roteiros duplicado em `AiPipelineService.previewScript` (Java) e falar com o Node por um subcomando único `node pipeline/src/cli.js preview --json`. O fallback Java deve retornar erro explícito, nunca conteúdo fabricado que o usuário possa aprovar.
- **F8.8** — Ingestão idempotente (`postId` determinístico + header `Idempotency-Key`, retry com backoff) e `success: false` quando a API rejeita. Upload real ao Drive antes da ingestão — hoje `videoDriveId` é a string `'video_final_9x16.mp4'`, que não resolve para nenhum objeto: **os vídeos nunca seriam publicados**.
- **F8.9** — Limpeza de scratch (`--keep` para debug) — hoje há 89MB + 327MB acumulados em 37 diretórios.
- **F8.10** — Testes: separar `test:unit` (hermético, CI) de `test:integration` (rede, opt-in); cobrir orquestração, config e composição.

**Aceite F8:** falha em qualquer etapa preserva o trabalho anterior e é retomável; canal com typo no JSON falha no boot; QC gate bloqueia a ingestão; `docker build` + smoke test do pipeline passam.

---

## 6. Gate de Qualidade (QC)

Executado entre `composeFinalVideo` e `ingestGeneratedPost`. **Falha dura: não publica.** Relatório em `${outputDir}/qc.json`.

| # | Checagem | Comando / métrica | Limiar |
|---|---|---|---|
| QC-1 | Duração | `ffprobe format.duration` | pelo menos 60,0s e dentro de ±2s de `format.target_duration_seconds` |
| QC-2 | Resolução e fps | `ffprobe stream v` | exatamente `format.resolution` e `format.target_fps` |
| QC-3 | Áudio presente e audível | `astats` RMS_level; `volumedetect` mean_volume | RMS acima de −50 dB; mean entre −20 e −8 dB |
| QC-4 | Loudness | `ebur128` no MP4 final | no máximo 0,8 LU de `target_lufs`; TP de no máximo −1,0 dBTP |
| QC-5 | Frames pretos | `blackdetect=d=0.5:pix_th=0.10` | zero intervalos |
| QC-6 | Vídeo congelado | `freezedetect=n=-60dB:d=2` | zero intervalos |
| QC-7 | Nitidez média | 8 frames uniformes, energia de borda via `convolution`+`signalstats` | YAVG de pelo menos 2,5 (linha de base atual: **1,20**) |
| QC-8 | Marca d'água | razão de energia de borda quadrante inf.-direito ÷ espelho | menor que 2,2 |
| QC-9 | Diversidade visual | similaridade de trigramas entre `subject+environment` dos beats | nenhum par acima de 0,45 |
| QC-10 | Legenda na safe area | parse do `.ass` + `PlayResY` | base do texto acima de y=1450 |
| QC-11 | Densidade de cortes | `scenes.json` | todo take entre 1,8s e 4,5s |
| QC-12 | Sincronia A/V | diferença entre duração de vídeo e áudio | menor que 40ms |
| QC-13 | Ineditismo | `sha1(narrationText)` vs. ledger do canal | sem colisão |

Um **Readiness Gate** complementar roda antes de produzir (técnica extraída do repositório `darkzOGx`): probes reais contra cada provedor configurado, validando **existência e dimensão**, não apenas HTTP 200. Tier sem credencial é logado em WARN explícito — a degradação nunca mais é silenciosa.

---

## 7. Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Achados de Nível B não verificados adversarialmente podem conter falso positivo | Cada fase confirma a evidência citada antes de aplicar. O QC gate (F8.5) detecta regressão independentemente da origem do achado. |
| Custo do Gemini image escapa em lotes grandes | Cache content-addressed (F1.6) + Pro restrito a gancho e thumbnail + teto de gasto por run no coletor de métricas (F8.4). |
| `xfade` encadeado é caro em CPU a 1080x1920 | Manter `concat` + hard cut como default (correto para o formato) e usar `xfade` apenas em mudança de ato — 85–90% hard cut, conforme o estado da arte. |
| Pexels/Pixabay não cobrem estilos autorais (Ghibli/anime) | Roteamento por `suggestedType`: B-roll para ação humana concreta, IA para conceito abstrato e estilo autoral. |
| Refatoração ampla quebra a integração Java | F8.3 (NDJSON) antes de F8.7; manter a prosa humana em stderr durante a transição. |
| Pollinations pode mudar o teto ou o watermark sem aviso | A validação de dimensão (F1.4) trata isso como dado de runtime, não como premissa de código. |

---

## 8. O Que NÃO Fazer

- **Não investir em restauração/upscale sofisticado sobre 576x1024.** A informação não existe no arquivo de origem. O ganho medido da melhor cadeia testada foi 1,20 → 1,37 (+14%), contra 5,04 de um asset nativo. Resolver a fonte (F1) domina qualquer filtro.
- **Não substituir hard cut por `xfade` em toda transição.** Shorts vivem de corte seco. O defeito atual não é a ausência de crossfade — é o **fade para preto** de 300ms. Remover o fade já resolve.
- **Não aumentar o bitrate para compensar borrão.** O vídeo já está em 4,5 Mbps gastando bitrate em pixels interpolados. `-crf 20` entrega mais qualidade em arquivo menor.
- **Não pedir "ZERO REPETITION" ao LLM em chamadas independentes.** Não funciona e já está provado no código atual. Diversidade vem de grade estrutural + validação, não de instrução.
- **Não manter o catálogo de roteiros como caminho principal.** Com 4 itens e módulo, `--batch` produz conteúdo duplicado — risco de desmonetização maior que o benefício.
- **Não usar `\fscx`/`\fscy` para destacar palavra ativa.** Altera a métrica da linha e move o bloco inteiro. Ênfase por cor, contorno e blur não mexe no avanço do glifo.
- **Não confiar em `buffer.length` como prova de qualidade de imagem**, nem em `fs.existsSync` como prova de sucesso de etapa. Ambos os repositórios de referência cometem o mesmo erro e produzem o mesmo resultado.
- **Não corrigir a ponte Java antes do log estruturado.** Hoje o contrato de integração é prosa em português; mudá-la sem o NDJSON quebra o dashboard.

---

## 9. Anexo — Catálogo de Achados

143 achados catalogados: **44 critical**, 64 high, 31 medium, 4 low, distribuídos em 7 dimensões (roteiro, prompt visual, conectores, áudio/TTS, legendas, sincronia, arquitetura). Ver a lacuna de cobertura em §2.2.

O detalhamento por achado — evidência, causa-raiz, impacto no vídeo final e correção concreta, frequentemente com o trecho de código ou o filtro FFmpeg pronto — está em [**Catálogo de Achados**](Auditoria_Qualidade_Pipeline_Achados.md). Os identificadores (`imagen-404-tier-morto`, `chunk-rigido-modulo-4`, etc.) são estáveis e usados como referência cruzada pelas fases deste plano.
