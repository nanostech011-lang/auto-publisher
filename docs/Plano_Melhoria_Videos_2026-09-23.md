# Plano de Melhoria dos Vídeos Gerados — Revisão de 23/09/2026

**Versão:** 2.0
**Status:** Proposto
**Escopo:** `pipeline/` (Node.js + FFmpeg + Edge-TTS) e a ponte `AiPipelineService` (Java)
**Supersede:** [Plano de Refatoração v1.0](Plano_Refatoracao_Qualidade_Pipeline.md) de 15/09/2026
**Relacionados:** [SDD v3](SDD_Pipeline_Conteudo_IA_v3.md), [ADR 0006](adr/0006-fonte-de-visuais-e-teto-de-qualidade.md), [Catálogo de 143 Achados](Auditoria_Qualidade_Pipeline_Achados.md), [GEMINI.md](../GEMINI.md)

---

## 1. Por que uma revisão do plano

O plano de 15/09 foi escrito contra o código de `ba45b05` (11/09). Depois dele entraram dois commits grandes — `464bff5` (19/09) e `071aaaf` (20/09) — que corrigiram parte dos problemas e introduziram outros. Além disso, **um modelo do Google foi descontinuado nesse intervalo e quebrou o gerador de roteiro que o plano anterior considerava "a correção de uma linha"**.

Esta revisão foi construída sobre execução real, não sobre leitura de código:

1. Gerei um vídeo novo com o código de `HEAD` (`pipeline/output/run_1790120121033_1`, tema livre, canal `psicosegredo`).
2. Medi esse vídeo e os artefatos intermediários com `ffprobe` e `ffmpeg`.
3. Inspecionei visualmente frames extraídos do MP4 e o recorte do canto inferior direito.
4. Fiz sondagens HTTP reais contra a `GEMINI_API_KEY` do projeto e contra o Pollinations.

Tudo que está marcado como **medido** abaixo foi verificado nesta sessão, em 22–23/09/2026.

---

## 2. Linha de base medida

Execução de referência: `run_1790120121033_1`, tema `"Por que sua mente sabota suas metas de longo prazo"`.

| Métrica | Medido em `HEAD` | Alvo | Situação |
|---|---|---|---|
| Resolução do MP4 | 1080x1920, 30 fps, H.264 High L4.2 | 1080x1920, 30 fps | ok |
| Resolução real dos assets de origem | **576x1024 (0,59 MP)** nas 8 cenas | 1080x1920 (2,07 MP) | 28% do alvo |
| Nitidez do MP4 final (energia de borda) | **1,34** | ≥ 2,5 | reprovado |
| Nitidez de um asset nativo do repositório | 4,11 | — | referência |
| Nitidez do asset Pollinations, já em 1080x1920 | 0,78 | — | teto da fonte |
| Marca d'água `pollinations.ai` | **presente** e legível no canto inferior direito | ausente | reprovado |
| Número de takes | **8** em 63,8 s | 16 a 32 | reprovado |
| Duração média por take | **7,98 s** (máx. **12,07 s**) | 2,0 a 4,0 s | 2x fora |
| Origem do roteiro | **template fixo** (Gemini retornou 404) | LLM | reprovado |
| Loudness integrado / LRA / true peak | −14,6 dB médio, **LRA 2,5 LU**, TP **−0,9 dBFS** | LRA ≥ 5 LU, TP ≤ −1,0 | reprovado |
| Silêncio acumulado na locução | **6,65 s** em 7 pausas de ~0,95 s | ≤ 2,5 s | 10,4% do vídeo |
| Áudio do MP4 | AAC **96.000 Hz mono** a partir de MP3 24 kHz 48 kbps | 48 kHz estéreo | reprovado |
| Trilha sonora | ausente (`pipeline/assets/music/` vazio) | presente | reprovado |
| Eventos de legenda | 159 eventos, 33 KB, **159 com `\fscx`** | ~40 eventos, 0 com `\fscx` | reprovado |
| Base da legenda | `marginV` 160 → texto a ~210 px do rodapé | ≥ 560 px | dentro da UI |
| Corte-para-preto nas transições | **ausente** | ausente | **corrigido** |
| Tempo de geração | ~6,6 min, dos quais ~5,3 min só de imagem | — | gargalo |

Medições de nitidez feitas com `format=gray,convolution='0 -1 0 -1 4 -1 0 -1 0',signalstats` sobre 8 frames uniformes.

---

## 3. O que já foi corrigido desde o plano anterior

Vale registrar para não refazer trabalho. Tudo abaixo foi confirmado no código de `HEAD` e, quando aplicável, medido.

| Item do plano v1 | Estado hoje | Evidência |
|---|---|---|
| F3.6 — corte-para-preto de 300 ms nas transições | **Resolvido** | Luminância medida nas fronteiras 5,00 s / 10,51 s / 17,49 s: 68,9→54,0, 51,4→58,2, 55,8→82,5. Corte seco limpo, sem queda para preto. `visuals_harvester.js:205` só aplica `fade` no último take. |
| F0.3 / F0.4 — timeout e tokens do analisador | **Resolvido** | `youtube_analyzer.js:216` timeout 35000 ms, `:231` `maxOutputTokens: 4096`. |
| F0.5 — timeout do gerador de prompt visual | **Resolvido** | `ai_prompt_generator.js:550` timeout 20000 ms. |
| F2.4 (parcial) — ligar `subtitles_style` do canal | **Resolvido** | `run_pipeline.js:302-321` lê fonte, tamanho, cores e `margin_v` do perfil. |
| F1.7 (parcial) — duração inválida no Veo | **Resolvido** | `ai_video_connector.js:74-76` quantiza para 4, 6 ou 8 s. |
| F8.6 — dependências de FFmpeg em `devDependencies` | **Resolvido** | `package.json:31-34` movidas para `dependencies`. |
| Qualidade dos prompts visuais | **Muito melhor** | Os prompts da execução nova são específicos e cinematográficos ("*An intricate vintage brass laboratory balance scale resting heavily on a dark, scarred...*"), não mais bancos genéricos. |
| Anti-repetição de stock | **Implementado** | `stock_video_connector.js` com `usedVideoIds`/`usedPhotoIds` e queries contextuais. |

**O gargalo deixou de ser a engenharia de prompt. Passou a ser exclusivamente a fonte dos pixels e o ritmo.**

---

## 4. As cinco causas que limitam o vídeo hoje

### CR-A — A fonte visual tem teto rígido e marca d'água (impacto máximo)

Sondagens HTTP reais, feitas hoje contra as credenciais do projeto:

| Provedor | Resultado medido |
|---|---|
| `imagen-3.0-generate-002:predict` | **HTTP 404** — modelo não existe mais para esta chave |
| `gemini-3.1-flash-image` (2K) | **HTTP 429** — cota excedida |
| `gemini-3-pro-image` (4K) | **HTTP 429** — cota excedida |
| `gemini-2.5-flash-image` (2K) | **HTTP 429** — cota excedida |
| `gemini-3.1-flash-lite-image` (1K) | **HTTP 429** — cota excedida |
| `veo-3.1-fast-generate-preview` | **HTTP 429** — cota excedida |
| Pexels / Pixabay | chaves **ausentes** do `.env` — tier inteiro nunca executa |
| Pollinations `GET /models` | **`["sana"]`** — um único modelo |
| Pollinations, pedido 1080x1920 | entregou **576x1024** |
| Pollinations, pedido 864x1536 | entregou **576x1024** |
| Pollinations `model=flux` vs. sem `model` | **bytes idênticos** (30.447 bytes nos dois casos) |
| Pollinations `nologo=true` | **ignorado**, marca d'água queimada |

Consequências diretas:

- O roteamento `flux` / `flux-realism` acrescentado em `464bff5` (`ai_image_connector.js:186-190`) é **inócuo**. O parâmetro `model` é descartado pelo endpoint; tudo sai do mesmo `sana`.
- A cadeia de movimento atual **piora** a imagem. `visuals_harvester.js:236-252` escala para 2160x3840 com `flags=bicubic` — upscale de 3,75x linear. Medido: o asset sai de 0,78 e chega a **0,76** depois da cadeia. Uma cadeia `lanczos` + `unsharp` direto para 1080x1920 entrega **1,12** sobre o mesmo arquivo, **+44%** sem custo nenhum.
- O único critério de aceite de um asset continua sendo `fs.statSync(...).size > 5000` (`visuals_harvester.js:628`). Um JPEG de 576x1024 com logo de terceiro passa como sucesso.
- A latência é proibitiva: **40 a 45 s por imagem**, 5,3 min dos 6,6 min de execução total.

O log ainda anuncia `Pollinations AI (Flux HD 1080p)` (`ai_image_connector.js:217`) e `Google Imagen 3 [Ativo]` (`run_pipeline.js:218`) enquanto grava 576x1024 vindo de `sana`.

### CR-B — O gerador de roteiro voltou a morrer, por um motivo novo

`gemini_script_generator.js:131` chama `models/gemini-2.0-flash`. Resposta medida hoje:

```
HTTP 404: This model models/gemini-2.0-flash is no longer available.
Please update your code to use models/gemini-3.6-flash
```

O log da execução nova mostra a cascata completa: Gemini 404 → `"Gemini não retornou roteiro válido — usando template local"` → o bloco fixo de `script_generator.js:286-290`. **Todo tema livre volta a produzir o mesmo texto**, com o mesmo gancho, o mesmo "efeito composto" e a mesma CTA. E `topic.slice(0, 35)` continua em `script_generator.js:286`, cortando o tema no meio da palavra.

Modelos que respondem nesta chave, medidos:

| Modelo | Latência | `finishReason` |
|---|---|---|
| `gemini-flash-lite-latest` | **559 ms** | STOP |
| `gemini-3.5-flash-lite` | 645 ms | STOP |
| `gemini-3.1-flash-lite` | 2.670 ms | STOP |
| `gemini-3.6-flash` | 47.325 ms | MAX_TOKENS |
| `gemini-2.5-flash` | — | **404, descontinuado** |

O caminho de texto do Gemini **funciona e é rápido**. Só está apontando para um modelo morto.

### CR-C — O ritmo é metade do prometido

8 takes em 63,8 s. Média de 7,98 s, máximo de 12,07 s. O perfil do canal pede `"cuts_interval_seconds": "2-4"` e esse campo continua sem leitor algum no repositório.

A causa não é o alinhador: é que o número de takes vem do array `scenes` do roteiro (5 a 8 entradas) e **nada no pipeline subdivide um beat longo**. O `scene_aligner.js` distribui o tempo entre as cenas que recebe; se recebe 8, produz 8. Pior, `scene_aligner.js:274` baixou o piso de 1500 ms para 800 ms sem nunca ter introduzido um teto — o que autoriza cenas curtíssimas ao lado dos takes de 12 s.

Subdividir não custa geração de imagem nenhuma: um mesmo asset rende 2 a 3 sub-takes com `motionType` e enquadramento diferentes.

### CR-D — As legendas brigam com a interface e tremem

Medido no `.ass` da execução nova:

- **159 eventos** `Dialogue` para 159 palavras, 33 KB. Um evento por palavra ativa dentro de cada card de 3 palavras.
- **159 de 159 eventos contêm `\fscx`** (`subtitle_generator.js:219`, `\t(0,80,\fscx132\fscy132)`). Escala inline altera o avanço do glifo e faz o bloco inteiro saltar horizontalmente a cada ~390 ms.
- **Zero eventos com `\fad`, `\pos` ou `\N`**. Não há animação de entrada nem quebra de linha controlada.
- `WrapStyle: 0` — o libass decide a quebra sozinho e ela muda entre eventos do mesmo card.
- Fonte declarada: `Montserrat-Black`. O arquivo **não existe** em `pipeline/assets/fonts/` (só `.gitkeep`) nem na imagem Docker, e o filtro `ass` não recebe `fontsdir`. Renderiza com substituta silenciosa.
- `marginV` agora vem do perfil e vale **160**. Isso é uma **regressão de segurança**: o valor antigo, 380, já era arriscado; 160 coloca a base do texto a ~210 px do rodapé, dentro da zona de UI do Shorts (~320 px), do Reels (~360 px) e bem dentro da do TikTok (~470 px). A inspeção dos frames confirma: o texto fica a ~89% da altura.
- O agrupamento continua rígido de 3 em 3 palavras (`subtitle_generator.js:163`), ignorando sintagma. Cards reais desta execução: `"SE VOCÊ BUSCA"`, `"POR QUE SUA"`, `"MENTE SABOTA SUAS"`, `"METAS COM VERDADEIRA"` — frases partidas no meio.

### CR-E — O áudio soa amador

| Medição | Valor | Diagnóstico |
|---|---|---|
| LRA | **2,5 LU** | locução completamente chapada, sem dinâmica |
| True peak | **−0,9 dBFS** | acima do teto de −1,0 dBTP das plataformas |
| Sample rate do MP4 | **96.000 Hz mono** | upsampling absurdo de uma fonte de 24 kHz; `loudnorm` sem `aresample` |
| Fonte da locução | MP3 **48 kbps mono** | `voice_synthesizer.js:21`, `AUDIO_24KHZ_48KBITRATE_MONO_MP3` |
| Silêncios ≥ 0,4 s | **7 ocorrências de ~0,95 s**, total 6,65 s | 10,4% do vídeo é ar morto |
| Trilha de fundo | ausente | `pipeline/assets/music/` tem só `.gitkeep` |
| SSML | ausente | sem `<break>`, sem variação de `rate` por bloco |
| Cadeia de voz | ausente | sem highpass, de-esser, compressor ou limiter |

As 7 pausas de ~0,95 s correspondem exatamente às 7 fronteiras de frase do roteiro-template. Para um Short, quase um segundo de silêncio por frase é queda de retenção pura.

Há ainda um defeito de sincronia: a duração é **estimada**, não medida. `voice_synthesizer.js:86` usa o último `wordBoundary` + 300 ms e estimou 62,63 s; o `ffprobe` do mesmo MP3 mede **63,24 s**. O erro de −0,61 s se propaga para `run_pipeline.js:335`, que soma +1,2 s de padding sobre um número já errado.

---

## 5. Decisões que são do dono do produto

### DECISÃO 1 — Fonte dos visuais (bloqueia a fase P1)

Esta é a decisão que define o teto. As opções não são exclusivas.

| Opção | Custo | Resolução real | Marca d'água | Observação |
|---|---|---|---|---|
| **A. Manter Pollinations** | R$ 0,00 | 576x1024 fixo | **sim** | Teto matemático. A melhor cadeia de restauração testada vai de 0,78 para 1,12 — ainda 3,7x abaixo de um asset nativo. Latência de 40 s/imagem. |
| **B. Pexels + Pixabay** | R$ 0,00 | **1080x1920 nativo** | não | Cadastro gratuito (Pexels: 20.000 req/mês). O código **já está pronto** em `stock_video_connector.js`; falta só a chave no `.env`. Cobre bem ação humana concreta, mal conceito abstrato e estilo autoral. |
| **C. Gemini Image com billing** | ~US$ 0,03/img (`gemini-3.1-flash-image` 2K) a ~US$ 0,13/img (`gemini-3-pro-image` 4K) | 2K/4K nativo 9:16 | não | Medido: **429 sem billing habilitado**. Com Pro só no gancho e na thumbnail e Flash no corpo, fica abaixo de US$ 0,10/vídeo. |

**Recomendação: B agora, C em seguida.** A opção B é gratuita, o código já existe e resolve hoje mesmo a maior parte das cenas. Obter as duas chaves leva minutos e é o maior ganho por esforço em todo este plano. A opção C remove o teto de vez para as cenas que o stock não cobre.

Se a resposta for **A**, todo este plano continua válido exceto P1; o vídeo melhora de forma perceptível mas continua sendo um upscale com marca d'água.

### DECISÃO 2 — Trilha, SFX e fontes

`pipeline/assets/music/` e `pipeline/assets/fonts/` contêm apenas `.gitkeep`. Sem isso, `audio_profile` e `subtitles_style` continuam parcialmente inaplicáveis mesmo depois de ligados. É preciso versionar no repositório:

- 3 a 4 loops CC0 por estética (Pixabay Music, Free Music Archive);
- 4 a 6 whooshes e 3 a 4 impacts para os cortes;
- `Montserrat-Black.ttf` (a licença SIL OFL permite redistribuição).

### DECISÃO 3 — Voz

O `gemini-3.1-flash-tts-preview` **respondeu 200 nesta chave**, entregando 24 kHz mono L16 com controle de estilo por prompt. É um salto de expressividade sobre o Edge-TTS. Porém: 34 s de latência para 12,5 s de áudio e, sobretudo, **não devolve word boundaries** — o que quebraria a sincronia das legendas e do alinhador.

**Recomendação: manter o Edge-TTS** como motor principal pelos timestamps, e investir em SSML (P4). Reavaliar o TTS do Gemini apenas se surgir uma forma de alinhamento forçado.

---

## 6. Plano de execução

Ordenado por impacto visível dividido por esforço. Cada fase tem aceite objetivo e mensurável.

### P0 — Correções de uma linha, alto impacto (~2 h)

Mudam o resultado da próxima execução sem nenhuma alteração arquitetural.

| # | Arquivo | Mudança |
|---|---|---|
| P0.1 | `gemini_script_generator.js:131` | `gemini-2.0-flash` → **`gemini-flash-lite-latest`**. **Isto sozinho tira o roteiro do template fixo.** Validado ponta a ponta: o prompt real do módulo, em dois temas distintos, devolveu `finishReason: STOP`, separador `---JSON---` presente, JSON parseando, **143 e 149 palavras** (dentro de `target_words_min/max`) e 6 cenas, em 9,3 s e 17,4 s. |
| P0.2 | `script_generator.js:286,285` | Trocar `topic.slice(0,35)` e `topic.slice(0,50)` por truncamento na fronteira de palavra. Elimina o corte no meio da palavra. |
| P0.3 | `visuals_harvester.js:236-252` | Substituir `scale=2160:3840:flags=bicubic` por `scale=1080:1920:flags=lanczos:force_original_aspect_ratio=increase,crop=1080:1920,unsharp=5:5:0.9:5:5:0.0` antes do `zoompan`. Ganho medido: **0,76 → 1,12 (+47%)**. |
| P0.4 | `visuals_harvester.js`, após o download | Cortar a faixa da marca d'água: `crop=iw:ih-58:0:0,scale=1080:1920`. Remove o logo de terceiro de 100% dos frames. |
| P0.5 | `subtitle_generator.js:219,221` | Trocar `\fscx132\fscy132` por `\bord{N+3}\blur3` na palavra ativa. Elimina o salto do bloco. |
| P0.6 | `psicosegredo.json:54` e demais perfis | `margin_v` 160 → **560** (união das safe areas). Tira o texto da zona de UI. |
| P0.7 | `video_compositor.js:159,165` | Acrescentar `,aresample=48000` depois do `loudnorm` e trocar `TP=-1` por `TP=-1.5`. Corrige os 96 kHz e o true peak de −0,9 dBFS. |
| P0.8 | `voice_synthesizer.js:21` | `AUDIO_24KHZ_48KBITRATE_MONO_MP3` → `AUDIO_24KHZ_96KBITRATE_MONO_MP3`. |
| P0.9 | `voice_synthesizer.js` | Escapar `&`, `<` e `>` antes do SSML. Hoje um `&` no roteiro aborta a síntese inteira. |
| P0.10 | `subtitle_generator.js:117` | Escapar `\`, `{` e `}` em todo texto interpolado no `Dialogue`. |
| P0.11 | `run_pipeline.js:218` e `ai_image_connector.js:217` | Declarar o provedor e a **dimensão real** do arquivo, não o rótulo otimista. |
| P0.12 | `ai_image_connector.js:18-102` | Deletar `generateImageWithImagen3`. O modelo retorna 404 e o kill-switch de sessão mascara a falha. |

**Aceite P0:** dois temas livres distintos produzem `narrationText` distintos; nenhuma palavra truncada no `.srt`; zero pixels de `pollinations.ai` no frame t=0,3 s; nitidez do render ≥ 1,10; áudio do MP4 a 48 kHz; bloco de legenda pixel-idêntico entre eventos consecutivos do mesmo card; base do texto acima de y=1360.

### P1 — Romper o teto da fonte visual (~2 dias, **bloqueada pela DECISÃO 1**)

Maior impacto absoluto do plano.

- **P1.1** — Obter `PEXELS_API_KEY` e `PIXABAY_API_KEY`, gravá-las no `.env` e no `.env.example`. O repasse já existe em `run_pipeline.js:209` e `visuals_harvester.js:502`.
- **P1.2** — Elevar o stock de fallback a **primeira opção** para beats com `suggestedType === 'stock_video'` ou sujeito humano concreto. Hoje a foto de stock só é consultada depois que a IA falha (`visuals_harvester.js:636`), ou seja, quase nunca.
- **P1.3** — `pipeline/src/asset_quality_gate.js`: rejeitar asset por resolução mínima (864x1536), desvio de aspecto > 0,06, luminância fora de [38, 215], desvio-padrão de cor abaixo do piso e heurística de marca d'água (razão de energia de borda entre o quadrante inferior-direito e seu espelho > 2,2). **Asset reprovado cai para o próximo tier, nunca é aceito com aviso.**
- **P1.4** — Preflight `resolveAvailableImageModel()`: consultar `models.list` no início da run e derrubar model id ausente **antes** de produzir. Teria detectado o 404 do Imagen e o do `gemini-2.0-flash` sem gastar uma execução.
- **P1.5** — Circuit breaker por modelo com TTL e classificação de erro (404 = permanente na run; 429/minuto = 60 s; 429/dia = 6 h; 400 = nunca abre). Substitui `imagenDisabledForSession` e `isVeoDisabledForSession`.
- **P1.6** — Cache content-addressed em `pipeline/.cache/assets` com sidecar de qualidade. Com 40 s por imagem, o cache é também ganho de tempo, não só de custo.
- **P1.7** *(se DECISÃO 1 = C)* — Implementar o tier correto: `gemini-3.1-flash-image` e `gemini-3-pro-image` via `:generateContent` com `responseModalities:['IMAGE']` e `imageConfig:{aspectRatio:'9:16', imageSize:'2K'|'4K'}`, chave sempre em header `x-goog-api-key`. Habilitar billing no projeto Google.

**Aceite P1:** 100% dos assets aceitos têm ≥ 864x1536 e passam no gate; zero marca d'água detectada; nitidez do render final ≥ 2,5; o `report.json` registra provedor e dimensão real por cena.

### P2 — Ritmo (~2 dias)

- **P2.1** — `pipeline/src/beat_planner.js`: ler `format.cuts_interval_seconds` e calcular `targetSceneCount = round(duraçãoMedida / média)`. Para 63,8 s com [2,4] → **21 cenas** (hoje 8). Subdividir beats longos nos limites de vírgula, conjunção e pausa > 150 ms, gerando 2 a 3 sub-takes do **mesmo** asset com `motionType` e crop diferentes. Sem custo adicional de geração.
- **P2.2** — Restaurar `minSceneMs = 1800` em `scene_aligner.js:274` e **acrescentar `maxSceneMs = 4500`**, com projeção do vetor de cortes na região viável por varredura até convergir. Hoje só existe piso.
- **P2.3** — Medir a duração real do `narration.mp3` com `ffprobe` em `voice_synthesizer.js` e usá-la como fim da timeline. Elimina o erro de −0,61 s e o padding cego de `run_pipeline.js:335`.
- **P2.4** — Comprimir as pausas: `silenceremove` ou `<break time="220ms">` por bloco, reduzindo as 7 pausas de ~0,95 s para ~0,25 s. Recupera **~5 s** de conteúdo útil no mesmo tempo de vídeo.
- **P2.5** — Corrigir o threshold de `findWordSequenceIndex` (`scene_aligner.js:95`): hoje casar **só a primeira palavra** (score 2,0 ≥ 1,5) aprova o match. Exigir score ≥ 62% do máximo possível e não ancorar em stopwords de até 2 caracteres.
- **P2.6** — Corrigir `findOptimalPauseCut` (`scene_aligner.js:182`): o ramo `else if (maxPause < 200)` fica permanentemente desligado depois da primeira pausa > 200 ms, fazendo a função ignorar o `targetTimeMs`.
- **P2.7** — Quantizar os cortes em frames na origem (`cutFrames = round(cutMs/1000*fps)`).

**Aceite P2:** todo take entre 1,8 s e 4,5 s; ao menos 16 takes em um vídeo de 60 s; diferença entre duração de vídeo e de áudio < 40 ms; silêncio acumulado ≤ 2,5 s.

### P3 — Legendas (~1,5 dia)

- **P3.1** — Agrupamento prosódico em 2 passes: segmentar por `gap` entre `wordBoundaries` (fronteira forte ≥ 260 ms, fraca ≥ 110 ms) e reconciliar com a pontuação do `narrationText`. Empacotar cards respeitando, nesta ordem: nunca cruzar fronteira forte → no máximo 2 linhas → duração entre 700 e 2200 ms.
- **P3.2** — **Um** `Dialogue` por card, com sweep de cor por palavra via `\t`. Reduz de 159 eventos e 33 KB para cerca de 40 eventos.
- **P3.3** — `WrapStyle: 2` com `\N` calculado por largura medida, eliminando a quebra imprevisível do libass.
- **P3.4** — Versionar `Montserrat-Black.ttf` em `pipeline/assets/fonts/`, passar `fontsdir` ao filtro `ass` e **falhar** se a fonte não resolver, em vez de cair em substituta silenciosa.
- **P3.5** — Animação de entrada uma vez por card: `\fad(70,90)` e um pop-in curto **na entrada**, onde o reflow é lido como intenção, nunca por palavra.
- **P3.6** — `.srt` em caixa mista. O `.ass` queimado permanece em caixa alta; o SRT vai para o CC do YouTube, onde caixa alta prejudica acessibilidade e SEO.

**Aceite P3:** zero quebras no meio de sintagma em 3 execuções consecutivas; bloco pixel-idêntico entre eventos do mesmo card; base do texto acima de y=1360 com `PlayResY=1920`; `fc-match` confirma a fonte sem fallback.

### P4 — Áudio (~1,5 dia, **depende da DECISÃO 2**)

- **P4.1** — Cadeia de voz antes da mixagem: `highpass=f=80`, de-esser, `acompressor=threshold=0.05:ratio=3:attack=10:release=180`.
- **P4.2** — SSML por bloco via `rawToStream`: `rate` variável (gancho +12%, corpo +4%, punchline −6%, número −10%) e `<break>` controlado entre atos. Alvo: **LRA ≥ 5 LU** (hoje 2,5).
- **P4.3** — Ordem correta da mixagem: `amix=...:normalize=0` e `loudnorm` **two-pass no mix final**. Hoje o `loudnorm` roda na voz **antes** do `amix` (`video_compositor.js:159-161`), e o `amix` cru derruba o programa em 6 dB assim que existir trilha.
- **P4.4** — Ducking real por `sidechaincompress` com a voz como chave, substituindo o `volume=0.12` fixo.
- **P4.5** — Consumir `audio_profile` (`bg_music_volume`, `target_lufs`, `fade_out_seconds`) e versionar as trilhas.
- **P4.6** — SFX de whoosh nos cortes, a −120 ms e −8 dB, fora do ducking.

**Aceite P4:** `ebur128` no MP4 final com diferença ≤ 0,8 LU do `target_lufs`, TP ≤ −1,0 dBTP e **LRA ≥ 5 LU**.

### P5 — Roteiro e diversidade visual (~3 dias)

- **P5.1** — `responseSchema` declarado na chamada do Gemini, com repair de JSON e validação semântica com regeneração dirigida. Hoje `extractJsonFromResponse` depende de um separador textual `---JSON---` que o modelo pode omitir.
- **P5.2** — Consumir `script_profile`: `tone`, `hook_formula`, `structure[]` cronometrada, `target_words_min/max` e o WPM real. O literal `135` está duplicado no código enquanto o Edge-TTS entrega ~168 WPM — erro de +24% no planejamento.
- **P5.3** — Passe dedicado de reescrita do gancho, isolado. Cerca de 560 ms no modelo que já funciona. **Isto é necessário, não cosmético:** na validação de P0.1, dois temas completamente diferentes produziram ganchos quase idênticos — *"Existe um segredo biológico que os neurocientistas escondem de você..."* e *"Existe um segredo biológico sobre o seu cérebro..."*. A causa é `gemini_script_generator.js:58`, `new Date().getDate() % formulas.length`: **todos os vídeos gerados no mesmo dia recebem a mesma fórmula de gancho**, e a `temperature` de 0,85 não é suficiente para separar as aberturas. Trocar a seleção por sorteio com memória dos ganchos já usados no canal.
- **P5.4** — Ledger anti-repetição em `pipeline/state/script_history.json`, com recusa de publicar roteiro cujo `sha1(narrationText)` já exista para o canal. Elimina o risco de desmonetização por conteúdo duplicado que o `--batch` sobre 8 roteiros com módulo produz hoje.
- **P5.5** — Visual Beats em **uma única chamada** que recebe todas as frases e devolve todas as cenas, com grade obrigatória de 8 `shotType` rotacionados e validação por similaridade de trigramas > 0,45. Pedir "zero repetição" em N chamadas independentes não funciona e já está provado no código atual.
- **P5.6** — `StyleContract` por run (`runSeed`, `styleToken`, `palette[]`, `characterSheet`) persistido no manifesto. É o que dá identidade visual sem repetir composição.
- **P5.7** — Corrigir o título e a descrição: hoje o título é o tema ecoado + `#Shorts`, sem lacuna de curiosidade nem limite de 65 caracteres, e a descrição publica hashtags inválidas com espaço (`#psicologia comportamental`) e o placeholder `{platform}` literal — confirmado no manifesto de `run_1790120121033_1`.

**Aceite P5:** 5 temas distintos produzem 5 roteiros com similaridade de trigramas < 0,35 entre si; contagem de palavras dentro de `target_words_min/max`; nenhum par de cenas com similaridade > 0,45; nenhuma hashtag com espaço e nenhum placeholder literal publicado.

### P6 — Render (~1 dia)

- **P6.1** — Trocar `-b:v 6000k -maxrate 8000k` (`video_compositor.js:179-181`) por `-crf 20 -preset slow`. Hoje 6 Mbps são gastos em pixels interpolados; o arquivo tem 46 MB para 63 s.
- **P6.2** — Eliminar o reencode duplo (clipe individual → concat → render final) com um único `filter_complex`.
- **P6.3** — Tagging de colorspace `bt709` e `setsar=1`.
- **P6.4** — `ffprobe` obrigatório no `on('end')`, retornando a duração **medida**, não a pedida. Hoje `video_compositor.js:204` devolve `totalDurationSeconds`, o valor que recebeu.
- **P6.5** — Revisar o grading. A `vignette=angle=PI/5` combinada com as `curves` escurece o já escuro e some com o detalhe de sombra dos assets dark.

**Aceite P6:** uma única passagem de encode; `ffprobe` confirma duração, fps, dimensões e presença de stream de áudio.

### P7 — QC gate, publicação e observabilidade (~3 dias)

- **P7.1** — `pipeline/src/qc_gate.js` entre o compositor e a ingestão, com **falha dura** e relatório em `qc.json`. As 13 checagens estão especificadas no [Plano v1, §6](Plano_Refatoracao_Qualidade_Pipeline.md#6-gate-de-qualidade-qc) e continuam válidas. **Esta é a peça que impede a regressão de tudo o que este plano corrige.**
- **P7.2** — **Upload real ao Drive antes da ingestão.** Hoje `publisher_ingestor.js:23` grava `videoDriveId = path.basename(videoPath)`, e o manifesto real registra `"videoDriveId": "video_final_9x16.mp4"`. Esse valor vai para a coluna D da planilha, e `PublishScheduledPostsService.java:117` o usa como ID de arquivo no Drive. **Nenhum vídeo gerado pelo pipeline seria publicado em produção.** O `GoogleSheetsAdapter:320-321` só disfarça o problema em dev local, resolvendo para um caminho absoluto de disco.
- **P7.3** — `publisher_ingestor.js` deve retornar `success: false` quando a API rejeita. Hoje retorna `success: true` com `source: 'manifest'` mesmo quando o POST falha.
- **P7.4** — Log estruturado NDJSON (`@@EVT {...}`) em canal dedicado, mantendo a prosa em stderr durante a transição. O contrato de integração com o Java é hoje o texto em português: `AiPipelineService.java:538-571` faz `line.contains("[1/6]")` e `line.contains("Video MP4:")`. Qualquer mudança de log quebra o dashboard.
- **P7.5** — Gravar `script.json`, `scenes.json`, `prompts.json` e `report.json` no `outputDir`. Hoje é impossível auditar por que um vídeo saiu errado.
- **P7.6** — `config_resolver.js` + `channel.schema.json` com `additionalProperties: false`: uma chave com typo falha no boot em vez de degradar em silêncio.
- **P7.7** — Executor de estágios com `try/catch` por etapa, retry por natureza e `--resume <runId>`. Com 5,3 min só de geração de imagem, perder a run inteira por uma falha de rede no render é caro.
- **P7.8** — Limpeza de scratch com `--keep` para depuração. Há 89 MB em scratch e 427 MB em output acumulados localmente.

**Aceite P7:** o QC gate bloqueia a ingestão de um vídeo reprovado; `videoDriveId` é um ID real do Drive; falha em qualquer etapa preserva o trabalho anterior e é retomável; canal com typo no JSON falha no boot.

---

## 7. Sequenciamento recomendado

```
P0 (2h) ─────► P7.1 QC gate ─────► P1 ─────► P2 ─────► P3 ─────► P4 ─────► P5 ─────► P6 ─────► P7 restante
   │                  │                │
   │                  │                └── bloqueada pela DECISÃO 1
   │                  └── entra cedo para que todas as fases seguintes sejam progresso MEDIDO
   └── muda o resultado hoje, sem decisão nenhuma
```

Duas observações sobre a ordem:

1. **P0 é independente de qualquer decisão** e já entrega roteiro generativo, nitidez +47%, sem marca d'água, legenda estável e fora da zona de UI. São ~2 horas.
2. **P7.2 (upload ao Drive) é urgente por outro motivo.** Não é qualidade de vídeo: é a diferença entre o pipeline publicar e não publicar. Se houver intenção de operar em produção antes do resto do plano, esse item sobe para junto do P0.

---

## 8. O que não fazer

- **Não investir em restauração sofisticada sobre 576x1024.** A informação não existe no arquivo. Medido: a melhor cadeia testada vai de 0,78 para 1,12, contra 4,11 de um asset nativo. Resolver a fonte domina qualquer filtro.
- **Não confiar no parâmetro `model` do Pollinations.** Medido: só existe `sana`; `flux` e `flux-realism` devolvem os mesmos bytes. O roteamento por estilo adicionado em `464bff5` não faz nada.
- **Não aumentar o bitrate para compensar borrão.** O vídeo já está em 6 Mbps gastando bits em pixels interpolados.
- **Não substituir hard cut por `xfade` em toda transição.** Shorts vivem de corte seco, e o dip-to-black já foi resolvido. O problema do ritmo é a **duração** dos takes, não a transição entre eles.
- **Não usar `\fscx`/`\fscy` para destacar palavra ativa.** Altera a métrica da linha e move o bloco inteiro. Ênfase por cor, contorno e blur não mexe no avanço do glifo.
- **Não pedir "zero repetição" ao LLM em chamadas independentes.** Diversidade vem de grade estrutural e validação, não de instrução.
- **Não mexer no contrato de log do Java antes do NDJSON.** `AiPipelineService` faz parsing de prosa em português; mudar as mensagens sem P7.4 quebra o dashboard.
- **Não hardcodar um novo model id sem preflight.** O `gemini-2.0-flash` estava correto quando foi escrito e morreu em produção sem aviso. P1.4 existe exatamente para isso.

---

## 9. Nível de confiança

**Verificado nesta sessão (22–23/09/2026):** todas as medições da §2, as sondagens HTTP da §4 (CR-A e CR-B), a contagem e a composição dos eventos de legenda, as medições de áudio e de silêncio, a luminância nas fronteiras de corte, os experimentos comparativos de cadeia de escala, e a leitura direta do código em `HEAD` para todos os `arquivo:linha` citados.

**Herdado do Catálogo de Achados de 15/09:** os detalhes de módulos que não foram reexecutados nesta sessão, em particular o comportamento do `youtube_analyzer` em caminho de URL, a análise fina do `ai_prompt_generator` e os achados sobre Docker. Esses continuam com a ressalva original: não passaram por verificação adversarial. Confirme a evidência citada antes de aplicar.

**Não coberto por nenhuma das duas rodadas:** comportamento do pipeline dentro do contêiner Docker e o caminho de repurposing por URL do YouTube ponta a ponta.
