# Catálogo de Achados — Auditoria de Qualidade do Pipeline de Vídeo

**Versão:** 1.0  
**Data:** 2026-09-15  
**Documentos Relacionados:** [Plano de Refatoração](Plano_Refatoracao_Qualidade_Pipeline.md), [SDD v3](SDD_Pipeline_Conteudo_IA_v3.md)

---

## Como ler este documento

Anexo do [Plano de Refatoração](Plano_Refatoracao_Qualidade_Pipeline.md). Cada achado traz evidência, causa-raiz, impacto no vídeo final e correção concreta.

> **Nível de confiança.** Estes achados foram produzidos por auditoria especializada por dimensão, com experimentos próprios dos auditores (renderização do `.ass` com libass, medição EBU R128, cronometragem de latência, execução direta das funções exportadas). **Não passaram pela verificação adversarial** prevista no método original — ela foi dispensada por decisão de escopo. Confirme a evidência citada antes de aplicar cada correção. As medições de nível A (resolução real, nitidez, marca d'água, teto do Pollinations, 404 do Imagen, cota zero de imagem) estão no plano, §2.1.

> **Lacuna de cobertura.** Sete das oito dimensões previstas concluíram. **A dimensão de composição e render FFmpeg (`video_compositor.js`, motion engine, cinemagraph FX, thumbnail) não tem achados neste catálogo** — sua auditoria foi interrompida. O que o plano afirma sobre esse módulo vem de medição direta e da pesquisa de estado da arte, não de auditoria dedicada.

| Severidade | Quantidade |
|---|---|
| CRÍTICO | 44 |
| ALTO | 64 |
| MÉDIO | 31 |
| BAIXO | 4 |
| **Total** | **143** |

---

## Arquitetura, Configuracao e Observabilidade do Pipeline

30 achados.

### `cfg-subtitles-style-morta` — visual_profile.subtitles_style e definido em 5 perfis e NUNCA lido — legendas hardcoded em Arial/marginV 380

**Severidade:** CRÍTICO · **Esforço:** small · **Categoria:** config-drift  
**Arquivo:** `pipeline/src/run_pipeline.js:120`

**Evidência**

run_pipeline.js:120 chama generateAssSubtitles({ wordBoundaries, outputAssPath }) sem nenhum campo de estilo. subtitle_generator.js:70-81 declara defaults fontName='Arial', fontSize=65, marginV=380, activeWordColor='&H0000D7FF'. Nenhum arquivo em pipeline/src/ referencia a string 'subtitles_style' (grep retorna zero ocorrencias). Os 5 JSONs (psicosegredo, curiosidades, estoicismo, financas, channel_template) declaram font_name 'Montserrat-Black', margin_v 160, e cores por canal (curiosidades &H00D700FF magenta, financas &H0000FF00 verde).

**Causa-raiz**

O contrato de configuracao nunca foi ligado ao gerador. Nao existe uma camada de resolucao perfil->parametros; cada modulo tem seus proprios defaults de assinatura e run_pipeline nao repassa nada.

**Impacto no vídeo final**

Todos os canais saem visualmente IDENTICOS: mesma fonte generica, mesma cor dourada de karaoke, mesma altura. A identidade visual por nicho (magenta para misterio, verde para financas) simplesmente nao existe no video. Alem disso marginV=380 vs 160 configurado empurra a legenda ~220px para cima do previsto; e 'Arial' nao existe no container Alpine (nem Montserrat), entao fontconfig substitui silenciosamente por DejaVu -> o video renderizado em Docker tem tipografia diferente do renderizado no Windows.

**Correção**

Criar pipeline/src/config_resolver.js com resolveChannelConfig(channelId) que valida o JSON contra um schema e retorna um objeto achatado. Em run_pipeline.js:120 passar tudo:

const st = cfg.visual_profile.subtitles_style;
generateAssSubtitles({ wordBoundaries, outputAssPath: subtitlesPath, fontName: st.font_name, fontSize: st.font_size, primaryColor: st.primary_color, activeWordColor: st.active_word_color, outlineColor: st.outline_color, outlineWidth: st.outline_width, alignment: st.alignment, marginV: st.margin_v });

Em subtitle_generator.js remover os defaults da assinatura e lancar erro se faltar campo (fail-fast, nao default silencioso). Adicionar `alignment` ao template do Style (hoje o `2` esta hardcoded na linha 95 ignorando st.alignment). No Dockerfile instalar a fonte real: `apk add --no-cache font-montserrat` ou COPY de pipeline/assets/fonts + fc-cache -f.

---

### `cfg-publishing-profile-parcial` — publishing_profile.platforms[] e drive_folder_* ignorados; ingestao envia basename como Drive ID

**Severidade:** CRÍTICO · **Esforço:** large · **Categoria:** config-drift  
**Arquivo:** `pipeline/src/publisher_ingestor.js:23`

**Evidência**

publisher_ingestor.js:23-24: `const finalVideoId = driveVideoId || path.basename(videoPath)` e o mesmo para a thumb. run_pipeline.js:220-227 chama ingestGeneratedPost sem driveVideoId/driveThumbnailId, entao o payload sai com videoDriveId='video_final_9x16.mp4'. Nenhum modulo referencia drive_folder_videos/drive_folder_thumbnails. `publishing_profile.platforms` (array de 3) tambem nao e lido — a plataforma vem do CLI --platform, default unico 'YOUTUBE_SHORTS'.

**Causa-raiz**

A camada de upload para Drive prometida no SDD secao 2.1 ('Google Drive API - Zero Copy Stream') nunca foi implementada; o ingestor foi escrito assumindo que ela existiria e usa o nome de arquivo como placeholder de ID.

**Impacto no vídeo final**

O video NUNCA e publicado. O backend recebe um post agendado cujo videoDriveId e a string 'video_final_9x16.mp4', que nao resolve para nenhum objeto no Drive. Todo lote de N videos gera N registros agendados que vao falhar no momento da publicacao, e como o ingestor retorna success:true (ver achado ingest-falso-sucesso) nada sinaliza o problema. O custo computacional de renderizar 62s de video a 4.5Mbps e integralmente desperdicado. Alem disso, so o YouTube e alimentado — TikTok e Instagram Reels, declarados em platforms[], nunca recebem nada, e o TikTok e justamente o que tem o Creator Rewards que motivou o requisito de >=60s.

**Correção**

Implementar pipeline/src/drive_uploader.js com upload resumable para cfg.publishing_profile.drive_folder_videos / drive_folder_thumbnails usando as credenciais ja presentes no .env (YOUTUBE_CLIENT_ID/SECRET/REFRESH_TOKEN cobrem o escopo drive.file se adicionado). Em run_pipeline, apos o QC gate, fazer o upload e so entao chamar ingestGeneratedPost com os IDs reais. Tornar driveVideoId OBRIGATORIO em ingestGeneratedPost (lancar se ausente) em vez de cair em basename. Iterar sobre cfg.publishing_profile.platforms gerando um post por plataforma quando --platform nao for passado.

---

### `run-sem-trycatch-por-etapa` — run_pipeline nao tem try/catch por etapa: qualquer falha aborta a run inteira e descarta todo trabalho anterior

**Severidade:** CRÍTICO · **Esforço:** medium · **Categoria:** arch  
**Arquivo:** `pipeline/src/run_pipeline.js:66`

**Evidência**

runSinglePipeline (linhas 66-240) e uma sequencia linear de 6 await sem um unico try/catch. O unico handler e global: `main().catch(err => { console.error('[FALHA FATAL NO PIPELINE]:', err); process.exit(1); })` (linhas 285-288). Nao existe classificacao de erro (transiente vs permanente), nao existe retry, nao existe fallback de etapa.

**Causa-raiz**

Orquestrador escrito como script procedural de prototipo, nunca promovido a maquina de etapas.

**Impacto no vídeo final**

Uma oscilacao de rede na etapa 5 (FFmpeg) ou 6 (ingestao) joga fora ~3-5 minutos de sintese de voz, alinhamento fonetico e 8-15 chamadas de geracao de imagem ja pagas/consumidas de cota. Em modo --batch N, a falha do item k aborta os itens k+1..N (nao ha try/catch no loop de main tambem, linhas 251-270), entao um lote de 7 videos pode produzir 2 e morrer. O SDD secao 1.2 invariante 2 declara 'Resiliencia Absoluta: o pipeline nunca deve abortar' — o orquestrador viola o proprio invariante que os conectores individuais respeitam.

**Correção**

Refatorar para um array de etapas declarativas: `const STAGES = [{ id:'script', run: ctx=>..., required:true }, { id:'voice', ... }, ...]` e um executor que envolve cada uma em try/catch, mede duracao, grava ctx no disco apos cada etapa e aplica politica por etapa (retry com backoff para etapas de rede, fail-fast para etapas locais). O loop de --batch deve capturar por item e continuar, agregando os resultados num relatorio final com sucessos e falhas.

---

### `batch-duplica-conteudo` — --batch N apenas incrementa scriptIndex sobre um catalogo de 4 roteiros com modulo — a partir do 3o video do canal o conteudo se repete literalmente

**Severidade:** CRÍTICO · **Esforço:** medium · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/run_pipeline.js:260`

**Evidência**

run_pipeline.js:258-261: `scriptIndex: (options.scriptIndex || 0) + b`. script_generator.js:128-135: filtra o catalogo por channelId e faz `const idx = Math.abs(scriptIndex) % matchingChannelScripts.length`. VALIDATED_SCRIPTS_CATALOG tem 4 entradas no total (script-01 e script-02 psicosegredo, script-03 estoicismo, script-04 financas). Para --channel psicosegredo, matchingChannelScripts.length === 2. Logo --batch 7 produz a sequencia de roteiros 0,1,0,1,0,1,0: o mesmo narrationText, o mesmo title e as mesmas metadata 4 vezes. Para estoicismo e financas, length === 1: TODOS os N videos do lote sao byte-identicos no roteiro.

**Causa-raiz**

O catalogo hardcoded e usado como fonte primaria em vez de contingencia, e o batch foi implementado como um contador sobre um indice de array em vez de um gerador de variacao.

**Impacto no vídeo final**

Um lote de 7 videos agendados em 7 dias consecutivos publica o MESMO video (mesma narracao, mesmo titulo, mesma descricao) 3-4 vezes no mesmo canal. Isso e reuploaded/duplicate content: o YouTube Shorts e o TikTok penalizam ou desmonetizam, e o canal pode ser sinalizado como spam — destruindo exatamente a monetizacao que e o objetivo de negocio do SDD secao 1.1. Como o titulo tambem repete, a duplicidade e visivel para o proprio publico.

**Correção**

Curto prazo (obrigatorio antes de qualquer uso de --batch): deduplicar por hash. Manter um indice ${outputDir}/../published_index.json com sha1(narrationText) por canal; recusar publicar um roteiro cujo hash ja existe e falhar alto com a mensagem 'catalogo esgotado para o canal X'. Medio prazo (correto): --batch deve consumir uma FILA DE TOPICOS (`--topics-file topics.txt` ou `--topic` repetido), gerando cada roteiro via Gemini a partir do perfil do canal, e o catalogo hardcoded vira tier 4 de contingencia. O batch tambem deve variar a seed visual entre itens (hoje fixedVideoSeed ja e aleatorio por run, ok) e checar sobreposicao de agendamento.

---

### `geminikey-nao-repassado` — run_pipeline resolve a chave Gemini mas nao a passa para generateScript — o caminho de topico livre nunca chega na IA

**Severidade:** CRÍTICO · **Esforço:** trivial · **Categoria:** bug  
**Arquivo:** `pipeline/src/run_pipeline.js:86`

**Evidência**

run_pipeline.js:67 resolve `effectiveGeminiKey` e a usa em harvestVisualScenes (:158), mas a chamada de generateScript (:86-92) passa apenas channelId, topic, scriptIndex, sourceUrl e visualDirective. generateScript aceita `geminiKey = null` (script_generator.js:108) e o repassa para generateThematicScenes (:170) e analyzeAndAdaptYouTubeVideo (:114). Como run_pipeline nunca envia, geminiKey === null em todo o caminho de topico. Combinado com o texto fixo das linhas 141-147, o resultado e determinístico.

**Causa-raiz**

Um parametro adicionado na assinatura de generateScript e nunca ligado no unico call site de producao. Nenhum teste cobre run_pipeline, entao a omissao passou.

**Impacto no vídeo final**

Confirma empiricamente o comportamento observado: QUALQUER topico livre produz o mesmo roteiro com o topico interpolado no gancho. As frases do video auditado — 'DAS PESSOAS FALHA CONSTANTEMENTE', 'DISTRACAO IRRELEVANTE PROTEJA A' — vem literalmente de script_generator.js:142 e :144. Nao existe conteudo unico nem relevancia ao tema pedido; o video e um template com um nome trocado. Essa e a maior falha de qualidade do output inteiro, e e um one-liner.

**Correção**

Adicionar `geminiKey: effectiveGeminiKey` ao objeto passado em run_pipeline.js:86-92. Em seguida, tornar o caminho de topico livre realmente generativo (ver achado cfg-script-profile-morto): chamar o Gemini com system instruction montada do perfil. Notar que a chave desta conta so tem cota de TEXTO (gemini-flash-lite-latest responde em ~700ms), entao o caminho de roteiro via Gemini e viavel HOJE — diferente do caminho de imagem. Adicionar um teste que afirme que dois topicos distintos produzem narrationText distintos.

---

### `qc-gate-inexistente` — Nao existe QC gate antes da ingestao — ffprobe esta configurado em 3 modulos e nunca e invocado

**Severidade:** CRÍTICO · **Esforço:** large · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/run_pipeline.js:219`

**Evidência**

`grep -rn "ffprobe(" pipeline/src/` retorna ZERO ocorrencias, apesar de video_compositor.js:8-11, visuals_harvester.js:11-14 e stock_video_connector.js:16-19 configurarem ffmpeg.setFfprobePath. composeFinalVideo (video_compositor.js:97-105) resolve com `durationSeconds: totalDurationSeconds` — o valor PEDIDO, nao o medido; e statSync apenas para o tamanho. run_pipeline.js:235 imprime 'Elegivel TikTok Rewards: SIM' comparando esse numero nao-verificado com 60. A ingestao (linha 219) ocorre imediatamente depois, sem nenhuma verificacao.

**Causa-raiz**

Confianca no comando FFmpeg: se ele nao lancou erro, presume-se que o artefato esta correto. Nao ha distincao entre 'o processo terminou' e 'o resultado e publicavel'.

**Impacto no vídeo final**

Todos os defeitos observados no video final passaram por esta lacuna sem resistencia: imagens 576x1024 upscaladas 3.75x (nitidez), marca d'agua 'pollinations.ai' queimada no canto inferior direito, legendas com a palavra truncada 'INTE', e a duracao/elegibilidade de rewards reportada a partir de um numero que ninguem mediu. Se o FFmpeg produzir um arquivo sem trilha de audio, com frames pretos, ou mais curto que 60s, o pipeline agenda a publicacao do mesmo jeito e reporta sucesso. O gate e o unico ponto que separa 'renderizou' de 'e publicavel'.

**Correção**

Criar pipeline/src/qc_gate.js executado entre composeFinalVideo e ingestGeneratedPost, com FALHA DURA (nao publica) e relatorio em ${outputDir}/qc.json. Checagens, todas via ffprobe/ffmpeg ja disponiveis:
1. duracao: ffprobe format.duration >= 60.0 e dentro de +/-2s de format.target_duration_seconds.
2. resolucao/fps: stream v.width x v.height === fmt.resolution exato; r_frame_rate === fmt.target_fps.
3. audio presente e audivel: existe stream a; `ffmpeg -af astats=metadata=1 -f null -` com RMS_level > -50dB; e `volumedetect` mean_volume dentro de [-20,-8] dB (proxy de LUFS) — hoje um video mudo passaria.
4. frames pretos: `blackdetect=d=0.5:pix_th=0.10` deve retornar zero intervalos; `freezedetect=n=-60dB:d=2` zero intervalos.
5. nitidez media: amostrar 8 frames uniformes, medir variancia do Laplaciano (ou `ffmpeg -vf "select=..,signalstats" ` YDIF) e exigir acima de um piso calibrado — isto e o que teria barrado o upscale 3.75x.
6. legendas na safe area: parsear o .ass e validar marginV >= 0.12*PlayResY e <= 0.35*PlayResY; validar que nenhuma palavra do wordBoundaries foi truncada (comparar tokens do .ass com os do narrationText — teria pego 'INTE').
7. marca d'agua: hash perceptual do canto inferior direito (ultimos 15% x 15%) comparado com uma referencia do logo Pollinations, ou simplesmente crop dessa regiao antes do compositor.
8. metadata: title nao vazio, description contem o UTM, madeForKids === false, #Shorts presente.
Qualquer falha => status FAILED_QC, artefatos preservados, ingestao NAO executada, motivo no report.json.

---

### `ingest-falso-sucesso` — publisher_ingestor retorna success:true mesmo quando a API rejeita o post — falha silenciosa ate o Java

**Severidade:** CRÍTICO · **Esforço:** trivial · **Categoria:** bug  
**Arquivo:** `pipeline/src/publisher_ingestor.js:102`

**Evidência**

Linhas 87-95: se `response.ok` for falso, apenas console.warn; se fetch lancar, apenas console.warn. Em ambos os casos a execucao cai no bloco 97-107 que grava o manifesto e retorna `{ success: true, source: 'manifest', ... }`. run_pipeline.js:236 imprime 'Status Ingestao: manifest' — uma palavra em ingles no meio de prosa PT-BR que o Java nao inspeciona. O exit code continua 0.

**Causa-raiz**

O fallback de manifesto (util para desenvolvimento offline) foi modelado com o mesmo valor de retorno do caminho de sucesso real, apagando a distincao entre 'agendado' e 'nao agendado'.

**Impacto no vídeo final**

Um erro 401 (API_KEY errada), 400 (payload invalido) ou o backend fora do ar produzem exatamente a mesma experiencia de 'SUCESSO' no terminal e no painel: o job fica COMPLETED, 100%, 'Video Gerado com Sucesso!'. Os videos nunca entram na fila e ninguem descobre ate notar que o canal parou de postar. Em --batch 7, sao 7 falhas silenciosas seguidas.

**Correção**

Retornar `{ success: false, source: 'manifest', httpStatus, error }` no caminho de fallback e propagar: run_pipeline deve marcar a run como PARTIAL e sair com exit code 2. Manter o manifesto (e util) mas exigir `--allow-manifest-fallback` explicito para que o exit code seja 0. Logar o status HTTP e o corpo do erro como evento estruturado, nao como console.warn.

---

### `java-catalogo-duplicado` — AiPipelineService.previewScript duplica o catalogo de roteiros em Java — fonte de verdade dupla ja divergente

**Severidade:** CRÍTICO · **Esforço:** medium · **Categoria:** arch  
**Arquivo:** `src/main/java/com/autopublisher/application/usecase/AiPipelineService.java:97`

**Evidência**

previewScript (linhas ~97-180) contem hardcoded em Java o narrationText integral de script-01 e script-02 do psicosegredo, os 4 blocks, firstComment, tags, e wordCount/estimatedDurationSeconds como literais (152/68 e 149/66). O Node calcula os mesmos campos: script_generator.js:183 `narrationText.trim().split(/\s+/).length` e :199 `Math.round((wordCount/135)*60)`. A regra de selecao tambem diverge: o Java usa `if (topic.toLowerCase().contains("motiva")) index = 1` (linha ~104), regra que nao existe no Node — la a selecao e por `s.topic.includes(topic) || s.title.includes(topic)` com fallback por modulo. Os blocks tambem divergem: o Java tem textos curados por bloco, o Node fatia a narracao por offset de caracteres (slice(0,100), slice(100,350), slice(350,500), slice(500)).

**Causa-raiz**

O preview precisava ser sincrono para a UI e, em vez de invocar o Node (como ja e feito em analyzeYouTubeVideo, que faz spawn com `node -e import(...)`), o conteudo foi copiado. O mecanismo correto ja existe no mesmo arquivo e nao foi reusado.

**Impacto no vídeo final**

O usuario aprova no painel um roteiro que NAO e o que sera narrado. Os blocks pre-visualizados sao textos curados; o que o pipeline usa sao fatias por offset de caractere que cortam palavras no meio. Qualquer edicao no catalogo do Node nao aparece no preview e vice-versa, e ja nao aparecem: o fallback generico do Java produz um narrationText de 1 frase ('Roteiro dinamico estruturado para o canal X abordando: Y...') completamente diferente do texto de 5 paragrafos do Node. A confianca na etapa de aprovacao humana — a unica barreira de qualidade editorial que existe hoje — esta quebrada.

**Correção**

Deletar todo o conteudo hardcoded de previewScript e reutilizar o mecanismo ja presente no proprio arquivo em analyzeYouTubeVideo: spawn de `node -e "import('./pipeline/src/script_generator.js').then(m => m.generateScript({channelId, topic, scriptIndex}))..."` com o mesmo protocolo JSON_START/JSON_END. Melhor ainda: expor um subcomando unico `node pipeline/src/cli.js preview --channel X --topic Y --json` e fazer TODO o Java (preview e run) falar com ele, para que exista um unico contrato. O fallback Java deve retornar erro explicito ('pipeline Node indisponivel'), nunca conteudo fabricado que o usuario possa aprovar.

---

### `docker-devdeps-quebram-runtime` — Dockerfile roda `pnpm install --prod` mas fluent-ffmpeg e @ffmpeg-installer estao em devDependencies — o pipeline nao roda no container

**Severidade:** CRÍTICO · **Esforço:** small · **Categoria:** config-drift  
**Arquivo:** `Dockerfile:60`

**Evidência**

package.json coloca @ffmpeg-installer/ffmpeg, @ffprobe-installer/ffprobe, fluent-ffmpeg e dotenv em devDependencies; apenas msedge-tts e youtube-transcript estao em dependencies. O Dockerfile executa `RUN pnpm install --prod --ignore-scripts`, que por definicao omite devDependencies. Porem video_compositor.js:3-5, visuals_harvester.js:3-5 e stock_video_connector.js:11-13 fazem `import ffmpeg from 'fluent-ffmpeg'` e `import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'` no topo do modulo.

**Causa-raiz**

A classificacao dev/prod das dependencias foi feita quando o pipeline era um utilitario local; a imagem foi escrita depois assumindo que `--prod` era sempre seguro.

**Impacto no vídeo final**

Em producao o pipeline morre com ERR_MODULE_NOT_FOUND na primeira importacao, antes de gerar um unico frame — a etapa [4/6] nunca comeca. O AiPipelineService captura o stderr (redirectErrorStream(true)) e marca FAILED, entao o painel mostra o erro, mas nenhum video e produzido em container. Todo o caminho de deploy Cloud Run esta nao-funcional.

**Correção**

Mover fluent-ffmpeg, @ffmpeg-installer/ffmpeg e @ffprobe-installer/ffprobe para `dependencies`. Observar que dentro do container o codigo ja prefere os binarios do sistema (`fs.existsSync('/usr/bin/ffmpeg')` em video_compositor.js:7-8 e o ENV FFMPEG_PATH=/usr/bin/ffmpeg), entao a alternativa mais leve e melhor e eliminar a dependencia dos pacotes @*-installer: extrair um pipeline/src/ffmpeg_env.js que resolve o binario por FFMPEG_PATH/FFPROBE_PATH e so tenta o installer dentro de um import dinamico em try/catch (mantendo-o como devDependency para uso local). Isso tambem remove ~80MB de binarios da imagem. Adicionar ao Dockerfile um passo de smoke test no build: `RUN node -e "import('./pipeline/src/video_compositor.js')"` para que essa classe de erro falhe no build e nao em producao.

---

### `sdd-tiers-fallback-mortos` — Dos 4 tiers de fallback prometidos, 2 estao mortos por configuracao e 1 por modelo inexistente — tudo converge para um unico provedor

**Severidade:** CRÍTICO · **Esforço:** medium · **Categoria:** arch  
**Arquivo:** `pipeline/src/stock_video_connector.js:32`

**Evidência**

Matriz do SDD secao 5, linha 'Imagens de Cena': Imagen 3 -> Pollinations Flux -> Pollinations Turbo -> assets locais. Realidade verificada: (a) imagen-3.0-generate-002:predict retorna 404 NOT_FOUND para esta chave — ai_image_connector.js:32 usa esse endpoint, e a linha 65 marca imagenDisabledForSession no primeiro 404, entao o tier 1 falha sempre; (b) tiers 2 e 3 sao o MESMO provedor e o parametro model e ignorado (flux e turbo retornaram bytes de tamanho identico, 40532) — nao sao dois tiers, sao um; (c) linha 'Clipes de Video': Pexels e Pixabay exigem PEXELS_API_KEY e PIXABAY_API_KEY (stock_video_connector.js:32 e :86) e nenhuma das duas existe no .env — os tiers 2 e 3 de video retornam 'nao configurada' imediatamente; (d) tier 3 de locucao ('Sintese Local Alternativa') e tier 4 ('Procedural com BGM') nao existem no codigo — voice_synthesizer nao tem nenhum fallback de voz.

**Causa-raiz**

A matriz de resiliencia foi escrita como design e nunca validada contra o ambiente real: nenhum teste ou script verifica se cada tier esta de fato alcancavel com as credenciais presentes.

**Impacto no vídeo final**

O invariante 2 do SDD ('Resiliencia Absoluta... cadeia de fallback de 4 niveis') e ficcao. Na pratica existe UM provedor de imagem — Pollinations — que entrega 576x1024 com marca d'agua, e e ele que produz 100% do visual do video final. As consequencias observadas (nitidez ruim por upscale 3.75x, anatomia deformada, watermark) nao sao azar: sao a unica opcao disponivel operando sem alternativa. Se o Pollinations cair, o pipeline cai para assets locais estaticos do canal (5 imagens ciclicas, visuals_harvester.js:524) e produz um video ainda pior — sem que nada sinalize a degradacao.

**Correção**

1) Trocar o endpoint morto: usar `gemini-3.1-flash-image:generateContent` com generationConfig.responseModalities=['IMAGE'] e imageConfig.aspectRatio='9:16' (modelos confirmados como listados para esta chave), mantendo imagen-3.0 fora. Notar que hoje retorna 429 por ausencia de cota de imagem no free tier — entao registrar isso explicitamente como decisao de custo, nao como bug silencioso. 2) Obter PEXELS_API_KEY e PIXABAY_API_KEY (ambas gratuitas, ja documentadas no SDD 3.2) e adiciona-las ao .env: isso reativa dois tiers reais e resolve simultaneamente o problema de qualidade, ja que video de estoque 1080x1920 nativo e infinitamente superior a upscale 3.75x de 576x1024. 3) Corrigir o tier Pollinations para pedir uma resolucao que ele de fato honre e cropar a faixa inferior com a watermark antes do motion engine. 4) Registrar em report.json qual tier atendeu cada cena e falhar o QC gate se mais de X% das cenas cairem no tier de contingencia — tornando a degradacao visivel em vez de silenciosa.

---

### `cfg-audio-profile-morto` — audio_profile inteiro ignorado — volume de BGM, LUFS e fade hardcoded no compositor

**Severidade:** ALTO · **Esforço:** small · **Categoria:** config-drift  
**Arquivo:** `pipeline/src/video_compositor.js:70`

**Evidência**

composeFinalVideo({ videoClips, audioPath, subtitlesAssPath, outputVideoPath, totalDurationSeconds, bgMusicPath }) — a assinatura nao aceita nenhum parametro de audio. Linha 70: `[2:a]volume=0.12,afade=t=out:st=${fadeOutStart}:d=2.5[a_bg]` com fadeOutStart = totalDuration-2.5. Linhas 69/75: `loudnorm=I=-14:TP=-1:LRA=11` fixo. Os perfis declaram bg_music_volume 0.08 (estoicismo/financas), 0.09 (curiosidades), 0.10 (psicosegredo), fade_out_seconds 2.0, target_lufs -14.0, voice_volume 1.0 — nenhum e lido.

**Causa-raiz**

Mesma causa raiz do item anterior: ausencia de uma fronteira de configuracao. Os valores foram fixados durante prototipagem e o JSON foi escrito depois, como documentacao aspiracional.

**Impacto no vídeo final**

A trilha entra 20-50% mais alta que o especificado nos canais de estoicismo/financas (0.12 real vs 0.08 pedido), competindo com a locucao e reduzindo inteligibilidade — o principal fator de retencao em shorts. O fade de 2.5s em vez de 2.0s corta 0.5s a mais da cauda musical. E o bg_music_track do perfil e ignorado: run_pipeline.js:193-203 varre o diretorio e pega `musicFiles[0]` (ordem alfabetica do filesystem), entao o canal pode receber uma trilha que nao e a dele.

**Correção**

Passar o bloco: composeFinalVideo({ ..., audioProfile: cfg.audio_profile }) e usar `volume=${ap.bg_music_volume}`, `afade=...:d=${ap.fade_out_seconds}` com `st = totalDuration - ap.fade_out_seconds`, `loudnorm=I=${ap.target_lufs}:TP=-1:LRA=11`, e `[1:a]...volume=${ap.voice_volume}`. Para a trilha, resolver bg_music_track do perfil primeiro (path.resolve(cfg.audio_profile.bg_music_track)) e so cair na varredura de diretorio se o arquivo nao existir, logando qual caminho foi usado.

---

### `cfg-format-morto` — format.target_fps / resolution / aspect_ratio / cuts_interval_seconds / target_duration_seconds nunca lidos — saida sem contrato

**Severidade:** ALTO · **Esforço:** medium · **Categoria:** config-drift  
**Arquivo:** `pipeline/src/video_compositor.js:81`

**Evidência**

outputOptions em video_compositor.js:81-92 nao contem `-r`, nem `-s`, nem `-aspect`. A resolucao 1080x1920 e o fps 30 aparecem hardcoded em visuals_harvester.js:223-239 (`s=1080x1920:fps=30` repetido em 5 ramos de motionFilter) e em stock_video_connector.js:165 (`scale=1080:1920...crop=1080:1920`). `cuts_interval_seconds: "2-4"` e uma STRING de range que nenhum parser consome — scene_aligner recebe as duracoes de scriptData.scenes (catalogo: 5s, 15s, 18s, 14s, 13s), nao do perfil. `target_duration_seconds: 68` tambem e ignorado: run_pipeline.js:134 calcula targetDurationSeconds = duracao real do TTS + 0.3.

**Causa-raiz**

Os dominios de formato estao espalhados por 3 modulos como literais, sem nenhum ponto unico de verdade. O JSON de canal descreve a intencao mas o codigo nunca a consulta.

**Impacto no vídeo final**

O video final nao tem nenhuma garantia de formato: se um clipe de stock ou de Veo entrar com resolucao/fps diferentes, o concat demuxer aceita e o libx264 herda o do primeiro clipe — sem `-r`/`-s` de saida nao ha normalizacao. Mais grave: o `cuts_interval_seconds: 2-4` prometido pelo SDD nunca e aplicado; o video auditado tem takes de 13-18s. Isso e a causa direta da monotonia visual observada (mesma composicao de cavaleiro sob arvore persistindo por 15+ segundos) — a promessa de 'takes dinamicos a cada 2 a 4 segundos' do SDD secao 1.1 esta violada por um fator de 4x a 9x.

**Correção**

1) Em video_compositor adicionar `-r ${fmt.target_fps}`, `-s ${fmt.resolution}`, `-aspect ${fmt.aspect_ratio}` as outputOptions. 2) Trocar cuts_interval_seconds por um objeto tipado: `"cuts": { "min_seconds": 2.0, "max_seconds": 4.0 }`. 3) Em scene_aligner, apos o alinhamento fonetico, aplicar um passo de SUBDIVISAO: toda cena com duration > cuts.max_seconds e quebrada em ceil(duration/cuts.max) sub-takes na fronteira de palavra mais proxima, cada um recebendo um prompt variante (angulo/plano diferente do mesmo sujeito) — isso resolve simultaneamente o contrato de corte e a monotonia. 4) Propagar fmt.resolution para os 5 motionFilter de visuals_harvester em vez de literais.

---

### `cfg-script-profile-morto` — script_profile.target_words_min/max, words_per_minute e hook_formula nunca aplicados; WPM 135 duplicado como literal

**Severidade:** ALTO · **Esforço:** medium · **Categoria:** config-drift  
**Arquivo:** `pipeline/src/script_generator.js:162`

**Evidência**

script_generator.js:162 e :199 calculam `Math.round((wordCount / 135) * 60)` com o 135 literal, ignorando channel.script_profile.words_per_minute (que por acaso tambem vale 135 em todos os perfis hoje — drift latente). Nao existe nenhuma validacao de target_words_min/max: o texto de topico livre (linhas 141-147) e fixo, entao o wordCount e sempre o mesmo independente do perfil. `hook_formula` e `script_profile.structure` (o array de 4 secoes de psicosegredo.json com time ranges) nao aparecem em nenhum grep de pipeline/src. Unico campo de script_profile realmente usado: `.tone`, em youtube_analyzer.js:155.

**Causa-raiz**

O catalogo hardcoded (VALIDATED_SCRIPTS_CATALOG, 4 itens) tornou o perfil irrelevante: se o roteiro ja esta escrito no codigo, os parametros de geracao nao tem onde atuar.

**Impacto no vídeo final**

O gancho dos primeiros 3 segundos — o unico fator que determina se o espectador fica ou desliza — e escrito uma vez em codigo e reusado para qualquer topico. O hook_formula de cada canal ('Pattern Interrupt provocativo', 'Existe um fato perturbador que a ciencia ainda nao explica', 'O erro financeiro silencioso') nunca chega ao prompt. O espectador recebe sempre o mesmo padrao retorico, e nenhum limite de palavras e checado, entao a duracao final flutua livremente em torno do alvo de 68s.

**Correção**

Substituir o literal 135 por `channel.script_profile.words_per_minute`. Mais importante: no caminho de topico livre (script_generator.js:139-181), construir o prompt do Gemini a partir do perfil — system instruction com `tone`, `hook_formula`, `structure[]` (as 4 secoes com seus time ranges) e uma restricao dura `responda entre ${min} e ${max} palavras`. Apos a resposta, validar wordCount contra [target_words_min, target_words_max] e reprompt uma vez se estourar. Remover o texto fixo de hook/core1/core2/hack/cta e mante-lo APENAS como tier 4 de contingencia, logado como tal.

---

### `cfg-visual-profile-parcial` — visual_profile.prompt_prefix, lighting e broll_keywords nunca lidos — so `aesthetic` sobrevive

**Severidade:** ALTO · **Esforço:** medium · **Categoria:** config-drift  
**Arquivo:** `pipeline/src/script_generator.js:170`

**Evidência**

Unico uso do visual_profile em todo pipeline/src: `channel.visual_profile?.aesthetic` em script_generator.js:170 e :207. Nenhuma ocorrencia de 'prompt_prefix', 'broll_keywords' ou de leitura de visual_profile.lighting. Pior: visuals_harvester.js:433 faz `const effectiveAesthetic = scene.aesthetic || visualDirective || 'Cinematic Dark Minimalist'` — note que `scene.aesthetic` nao e um campo produzido pelo catalogo nem por generateThematicScenes, logo o valor real quase sempre cai em visualDirective (CLI) ou no literal final. O `aesthetic` do perfil e lido em script_generator mas nao e propagado para o objeto scene, entao se perde no caminho.

**Causa-raiz**

Dois caminhos paralelos de estetica (perfil de canal vs --visual-directive de CLI) que nunca foram reconciliados; o de CLI venceu e o de perfil ficou orfao.

**Impacto no vídeo final**

Esta e a causa raiz do descompasso tematico observado: topico 'O Poder do Silencio e da Calma Interior' (psicologia) renderizado como fantasia medieval com cavaleiro. O prompt_prefix do psicosegredo ('Cinematic dark aesthetic, chiaroscuro dramatic lighting, volumetric atmospheric smoke, 8k, photorealistic, vertical 9:16') existe no JSON e descreveria exatamente a estetica correta, mas nunca e concatenado ao prompt. Em vez disso, ai_prompt_generator.js cai em bancos de frases hardcoded de fantasia (linhas 189-203: 'solitary wandering knight', 'mossy stone bridge', 'medieval village'). Os 6 broll_keywords curados do canal ('human brain glowing 3D', 'intense eyes close up cinematic', 'golden key glowing') — que gerariam o visual correto — sao letra morta.

**Correção**

Propagar o perfil visual inteiro ate o gerador de prompt. Em run_pipeline passar `visualProfile: cfg.visual_profile` para harvestVisualScenes; em buildProfessionalScenePrompt montar o prompt como `${vp.prompt_prefix}, ${subject}, ${vp.lighting}, ${camera/lens}, ${vp.aesthetic}` com o prefixo do perfil SEMPRE presente. Usar vp.broll_keywords como pool de stockQuery quando scene.stockQuery estiver ausente (hoje visuals_harvester.js:483 cai no literal 'cinematic dark psychology'). Definir precedencia explicita e documentada: visualDirective (CLI) SOBRESCREVE aesthetic, mas NUNCA remove prompt_prefix/lighting do perfil.

---

### `cfg-sem-schema-nem-validacao` — loadChannelProfile faz JSON.parse cru e cai num perfil-stub silencioso quando o canal nao existe

**Severidade:** ALTO · **Esforço:** small · **Categoria:** config-drift  
**Arquivo:** `pipeline/src/script_generator.js:70`

**Evidência**

script_generator.js:70-96: `if (fs.existsSync(profilePath)) return JSON.parse(fs.readFileSync(...))` — sem try/catch (JSON malformado derruba a run com SyntaxError cru), sem validacao de schema. Se o arquivo NAO existe, retorna um objeto stub de 18 linhas com voice pt-BR-AntonioNeural, aesthetic 'Cinematic Dark Minimalist' e tags ['shorts','viral',channelId] — sem emitir NENHUM aviso. Nao existe nenhum arquivo de schema no repo (pipeline/config/ contem apenas channels/).

**Causa-raiz**

Ausencia de fronteira de configuracao validada. O channel_template.json serve de documentacao informal mas nao e um schema executavel.

**Impacto no vídeo final**

Um typo em `--channel psicossegredo` (dois S) produz um video completo, sem erro, com voz generica, estetica generica, tags erradas e descricao SEM o link de afiliado — ou seja, um video monetizavel publicado com a copy de conversao faltando, e ninguem percebe ate olhar o post. O mesmo vale para qualquer canal novo criado com uma chave com nome errado: o campo some silenciosamente porque tudo usa `?.` e `||` default.

**Correção**

Criar pipeline/config/channel.schema.json (JSON Schema draft 2020-12) com required em format/script_profile/voice_profile/visual_profile/audio_profile/publishing_profile e `additionalProperties: false` em cada bloco (assim uma chave com typo falha em vez de sumir). Criar config_resolver.js que carrega, valida (ajv ou validador manual sem dependencia) e FALHA ALTO com a lista de erros. Remover o fallback-stub: canal inexistente deve ser `throw new Error('Canal "x" nao encontrado. Disponiveis: ...')`. Adicionar `npm run validate:channels` rodando o validador sobre todos os *.json e plugar no npm test e no build do Docker.

---

### `run-sem-estado-nem-retomada` — Nenhuma persistencia do estado da run e nenhuma retomada — trabalho caro e irrecuperavel

**Severidade:** ALTO · **Esforço:** medium · **Categoria:** arch  
**Arquivo:** `pipeline/src/run_pipeline.js:77`

**Evidência**

Linhas 77-81 criam scratchDir/outputDir com runId = `run_${Date.now()}_${batchIndex+1}` e nada mais e gravado sobre a run. Nao ha run.json, nao ha checkpoint, nao ha flag --resume no parseArgs (linhas 20-64, que aceita apenas channel/script/topic/platform/batch/url/visual-directive/visual-mode/gemini-key). Os artefatos intermediarios existem em disco (narration.mp3, subtitles.ass, scene_N.mp4) mas nada os indexa nem sabe quais etapas ja passaram.

**Causa-raiz**

runId usado apenas como sufixo de diretorio, nunca como identidade de um agregado com ciclo de vida.

**Impacto no vídeo final**

Impossivel retomar uma run que morreu na renderizacao — e preciso regerar tudo, consumindo cota de imagem de novo (critico dado que o free tier de imagem ja retorna 429). Tambem impossivel reprocessar so a legenda ou so o audio apos um ajuste de configuracao, o que trava qualquer ciclo de iteracao de qualidade.

**Correção**

Gravar ${outputDir}/run.json apos CADA etapa com { runId, startedAt, options, resolvedConfig, stages: [{id, status, startedAt, durationMs, artifacts[], error?}], artifacts: {audio, subtitles, scenes[], clips[], video, thumbnail} }. Adicionar `--resume <runId>`: carrega run.json, pula toda etapa com status 'ok' cujo artefato ainda existe no disco, e retoma da primeira pendente.

---

### `run-sem-auditoria-roteiro` — Roteiro, cenas alinhadas e prompts de IA nunca sao gravados em disco — impossivel auditar por que um video saiu errado

**Severidade:** ALTO · **Esforço:** small · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/run_pipeline.js:146`

**Evidência**

scriptData (narrationText, blocks, scenes, metadata) e alignedScenes existem apenas em memoria. Linhas 146-151 imprimem os takes em console.log e linhas 153-162 imprimem o prompt truncado em 90 chars (visuals_harvester.js:449: `scenePrompt.slice(0, 90)`). O prompt final que de fato foi enviado ao provedor — construido dentro de buildProfessionalScenePrompt e depois enriquecido com negative prompt em ai_image_connector — nunca e persistido. Nenhum fs.writeFileSync de script/scenes/prompts existe em run_pipeline.

**Causa-raiz**

Observabilidade tratada como logging de progresso para humano, nao como registro de proveniencia do artefato.

**Impacto no vídeo final**

Esta e a razao pela qual o descompasso tematico (topico de psicologia -> visual de cavaleiro medieval) nao pode ser diagnosticado a partir do output: nao existe o prompt que gerou cada frame. Nao da para responder 'o prompt estava errado ou o provedor ignorou o prompt?' sem reinstrumentar e reexecutar. Cada regressao de qualidade vira uma investigacao do zero, e otimizacao de prompt (o maior alavanca de qualidade visual) fica sem ciclo de feedback.

**Correção**

Gravar no outputDir: script.json (scriptData completo), scenes.json (alignedScenes com startTime/endTime/duration/alignmentType/matchedWord), prompts.json (por cena: prompt base, prompt final expandido, negative prompt, provedor tentado, provedor que respondeu, seed, latencia, bytes, dimensoes reais da imagem). Gravar prompts.json DENTRO de visuals_harvester (append por cena) para que sobreviva a uma falha no meio. Copiar subtitles.ass/srt do scratch para o outputDir.

---

### `run-sem-limpeza-scratch` — Scratch e output nunca sao limpos: 89MB + 327MB acumulados em 37 diretorios locais; em container isso enche o disco

**Severidade:** ALTO · **Esforço:** small · **Categoria:** cost  
**Arquivo:** `pipeline/src/run_pipeline.js:78`

**Evidência**

`du -sh pipeline/scratch pipeline/output` => 89M e 327M; `ls pipeline/scratch | wc -l` => 37 entradas, incluindo 11 diretorios run_* e restos soltos de teste (photo_test_human.jpg, real_brain.jpg, test_audio.mp3, regen_thumb.mjs). run_pipeline.js:80-81 so faz mkdirSync; nao existe rmSync/unlink em lugar nenhum do orquestrador. O Dockerfile cria /app/pipeline/scratch e /app/pipeline/output mas nao declara VOLUME nem politica de retencao.

**Causa-raiz**

Ciclo de vida de artefato temporario nunca definido; scratch e output tratados como o mesmo tipo de coisa.

**Impacto no vídeo final**

Em Cloud Run o filesystem e tmpfs contado contra a memoria da instancia (o Dockerfile aponta 512MB de RAM total com MaxRAMPercentage=50). Cerca de 30MB de scratch por run em tmpfs somados ao heap JVM levam a OOMKill apos poucas runs — e o JAVA_OPTS tem `-XX:+ExitOnOutOfMemoryError`, entao a instancia morre no meio de um lote. Localmente, 416MB e crescendo por dia de uso.

**Correção**

Separar semanticamente: scratch = descartavel, output = artefato. Em run_pipeline adicionar finally { if (!options.keep) fs.rmSync(scratchDir, { recursive:true, force:true }) } e a flag `--keep` para preservar em debug. Adicionar uma varredura de retencao no inicio da run que apaga diretorios run_* com mtime > N dias (default 3, configuravel por PIPELINE_RETENTION_DAYS). No Dockerfile, declarar VOLUME /app/pipeline/output e apontar scratch para /tmp via env PIPELINE_SCRATCH_DIR. Apagar os restos de teste versionados fora de run_* do scratch atual.

---

### `obs-sem-log-estruturado` — Zero logging estruturado: 40+ console.log em prosa PT-BR sao o contrato de integracao com o Java

**Severidade:** ALTO · **Esforço:** medium · **Categoria:** arch  
**Arquivo:** `pipeline/src/run_pipeline.js:229`

**Evidência**

Todo o orquestrador usa console.log com emojis, acentos e caixas de '='. AiPipelineService.java depende disso: `line.contains("[1/6]")` ate `[6/6]` para progresso, `line.substring(line.indexOf("Video MP4:") + 10)` para o caminho, `line.replaceAll("[^0-9.]", "")` para a duracao e `line.contains("SIM")` para rewards. Nao existe nenhum logger, nenhum JSON por linha, nenhum nivel (debug/info/warn/error), nenhum correlation id nas linhas (o runId nao aparece nas mensagens).

**Causa-raiz**

A UI foi construida sobre os logs de desenvolvimento em vez de sobre uma interface de eventos.

**Impacto no vídeo final**

O contrato e fragil de tres formas concretas: (1) renomear '[4/6]' para '[4/7]' ao adicionar uma etapa quebra silenciosamente a barra de progresso do painel; (2) `replaceAll("[^0-9.]","")` na linha 'Duracao Final:  62.6 segundos' funciona, mas qualquer numero adicional na linha concatena digitos e produz uma duracao absurda que e gravada como verdade no job; (3) combinado com o process.exit(0), o job pode ficar COMPLETED com videoPath null. O operador ve 'sucesso' sem artefato. E como nao ha runId nas linhas, dois jobs concorrentes escrevendo no mesmo stdout do painel sao indistinguiveis.

**Correção**

Emitir NDJSON num canal dedicado: cada evento como uma linha `@@EVT {"ts":...,"runId":...,"level":"info","stage":"visuals","event":"stage_end","durationMs":...,"data":{...}}` em stdout, mantendo a prosa humana em stderr. No AiPipelineService, parsear apenas linhas com o prefixo @@EVT (JSON -> Map) e derivar progresso de stage/total declarados pelo proprio evento, eliminando os contains/substring. Manter as linhas em prosa para o painel de log bruto.

---

### `obs-sem-metricas-nem-custo` — Sem tempo por etapa, sem contabilidade de chamadas/custo, sem relatorio final da run

**Severidade:** ALTO · **Esforço:** medium · **Categoria:** cost  
**Arquivo:** `pipeline/src/run_pipeline.js:66`

**Evidência**

Nenhum Date.now() de medicao em run_pipeline alem do runId (linha 77). Nenhum contador de chamadas por provedor. ai_image_connector mede latencyMs por chamada (linha ~60) mas o valor e descartado no retorno agregado. Ao final (linhas 229-237) imprime 6 linhas: caminho do MP4, thumb, duracao, elegibilidade, status de ingestao — nenhuma metrica. Em modo lote (linhas 272-280) imprime uma linha por item sem tempo nem custo.

**Causa-raiz**

O invariante 'custo R$ 0,00' do SDD secao 1.2 foi tratado como escolha de fornecedor, nao como algo a ser medido e provado.

**Impacto no vídeo final**

Nao se sabe onde o tempo vai (a suspeita forte e o sleep fixo de 1200ms por cena em visuals_harvester.js:517 mais a latencia do Pollinations, mas nao ha dado). Nao se sabe quantas chamadas de Imagen sao queimadas a cada run para sempre retornar 404 (imagenDisabledForSession corta apos a primeira, mas isso nao e reportado). Nao ha como detectar regressao de performance nem provar o invariante de custo zero. Sem tempo por etapa, nao ha base para paralelizar a geracao de imagens — a otimizacao mais obvia.

**Correção**

Instrumentar o executor de etapas com { stage, startedAt, durationMs }. Em cada conector, retornar e acumular { provider, attempts, httpStatus, latencyMs, bytes, cost } num coletor por run. Gravar ${outputDir}/report.json com: duracao total, tabela de etapas, tabela de provedores (tentativas/sucessos/falhas/latencia p50-p95/bytes), custo estimado, resultado do QC gate, e caminhos de todos os artefatos. Imprimir um resumo em tabela no fim e emitir o report como evento NDJSON para o Java persistir no PipelineJobStatus.

---

### `ingest-sem-idempotencia-nem-retry` — Ingestao sem idempotencia e sem retry: postId derivado de Date.now(), toda reexecucao cria post duplicado

**Severidade:** ALTO · **Esforço:** small · **Categoria:** arch  
**Arquivo:** `pipeline/src/publisher_ingestor.js:26`

**Evidência**

Linha 26: `const postId = 'POST-AUTO-' + Date.now()`. Um unico fetch (linha 73) sem timeout (AbortController), sem retry, sem backoff — diferente de ai_image_connector.js que ao menos usa AbortController com 25s. Nenhum header de idempotencia. Nenhuma consulta previa a fila para detectar um post ja existente para o mesmo video.

**Causa-raiz**

Identidade do post derivada do relogio da execucao em vez do conteudo; a operacao de rede tratada como confiavel.

**Impacto no vídeo final**

Um 503 transiente do backend perde a ingestao permanentemente (sem retry). Ao reexecutar a run para recuperar, um novo postId e gerado e, se a primeira chamada na verdade tinha chegado ao servidor antes do erro de rede, ficam DOIS posts agendados para o mesmo video — publicacao duplicada no canal. Sem timeout, um backend pendurado trava o pipeline indefinidamente na ultima etapa, apos todo o custo de renderizacao.

**Correção**

Derivar postId deterministicamente: `POST-${channelId}-${sha1(narrationText + videoDriveId).slice(0,12)}`, e enviar como header `Idempotency-Key`. Envolver o fetch em retry com backoff exponencial (3 tentativas, 1s/2s/4s + jitter) apenas para 5xx, 429 e erros de rede — nunca para 4xx. Adicionar AbortController com timeout de 15s. Antes de POSTar, fazer GET do postId e pular se ja existir.

---

### `docker-fontes-erradas` — Dockerfile instala DejaVu/Liberation/Noto mas nem Montserrat (config) nem Arial (codigo) existem — legenda renderiza com fonte substituta silenciosa

**Severidade:** ALTO · **Esforço:** small · **Categoria:** config-drift  
**Arquivo:** `Dockerfile:38`

**Evidência**

Dockerfile linha ~38: `apk add ... fontconfig font-liberation font-noto ttf-dejavu ... && fc-cache -f -v`. Os perfis pedem 'Montserrat-Black'; subtitle_generator.js:73 usa o default 'Arial'. Nenhuma das duas esta no conjunto instalado. O ffmpeg do Alpine e compilado com libass e o filtro `subtitles=` e usado em video_compositor.js:62, entao a renderizacao ocorre — porem o fontconfig resolve 'Arial' (ou 'Montserrat-Black') para o melhor match disponivel, tipicamente DejaVu Sans, sem erro e sem log.

**Causa-raiz**

As fontes foram escolhidas por serem 'fontes TrueType completas' genericas (como o comentario no Dockerfile diz) em vez de derivadas do contrato de configuracao dos canais.

**Impacto no vídeo final**

A tipografia da legenda — que ocupa o terco inferior do frame durante os 62 segundos inteiros e e o elemento de marca mais visivel do video — difere entre a maquina de desenvolvimento (Windows, tem Arial) e producao (Alpine, DejaVu). O peso 'Black' pedido pelo perfil nunca aparece em lugar nenhum: DejaVu Sans regular tem contraste muito menor sobre imagem, prejudicando legibilidade em tela de celular, que e o unico dispositivo alvo. A substituicao e completamente silenciosa.

**Correção**

Versionar a fonte no repo (pipeline/assets/fonts/Montserrat-Black.ttf, licenca SIL OFL permite) e no Dockerfile: `COPY pipeline/assets/fonts/ /usr/share/fonts/truetype/autopublisher/ && fc-cache -f`. Ligar subtitles_style ao gerador (ver achado cfg-subtitles-style-morta) para que o font_name do perfil seja de fato usado. Adicionar ao build um assert: `RUN fc-match 'Montserrat-Black' | grep -qi montserrat || (echo 'FONTE AUSENTE' && exit 1)` — assim a substituicao silenciosa vira falha de build. Passar `fontsdir=` ao filtro subtitles do FFmpeg apontando para o diretorio da fonte, garantindo resolucao tambem fora do container.

---

### `testes-nao-cobrem-orquestracao` — Os 5 arquivos de teste existem e passam (25/25), mas nenhum cobre orquestracao, config ou composicao — e fazem chamadas de rede reais

**Severidade:** ALTO · **Esforço:** medium · **Categoria:** test-coverage  
**Arquivo:** `package.json:10`

**Evidência**

CORRECAO DE PREMISSA: pipeline/test_*.js NAO esta ausente. `npm test` executa e reporta `# tests 25 / # pass 25 / # fail 0` (node --test expande o glob nativamente). Os arquivos sao test_ai_connector.js (193 l), test_ai_video_connector.js (77), test_batch_scheduling.js (28), test_scene_aligner.js (184), test_youtube_analyzer.js (38). Porem: ZERO testes para run_pipeline.js, script_generator.js, subtitle_generator.js, video_compositor.js, publisher_ingestor.js, visuals_harvester.js e para os JSONs de canal. test_batch_scheduling.js (28 linhas) nao importa publisher_ingestor — ele reimplementa a aritmetica de data no proprio teste e verifica a si mesmo, sem tocar no codigo de producao. test_ai_connector.js faz chamadas HTTP reais (a saida mostra 'Sucesso com Fallback Flux HD (43 KB em 585ms)'), tornando a suite dependente de rede e da disponibilidade do Pollinations.

**Causa-raiz**

Os testes seguiram os modulos com logica algoritmica pura (prompt, alinhamento) e pararam antes da camada de integracao, que e exatamente onde todos os defeitos deste relatorio vivem.

**Impacto no vídeo final**

Cada bug critico deste relatorio e invisivel para a suite verde: o geminiKey nao repassado, o subtitles_style ignorado, o audio_profile ignorado, o success:true falso da ingestao, a duplicacao de conteudo em lote. Uma suite 25/25 verde da confianca injustificada e permite que regressoes de configuracao entrem sem resistencia. E por depender de rede, a suite pode falhar em CI por motivo alheio ao codigo, treinando a equipe a ignorar vermelho.

**Correção**

1) Mover os testes para pipeline/test/ e separar por natureza: `test:unit` (hermetico, sem rede, roda em CI) e `test:integration` (rede, opt-in via env RUN_NETWORK_TESTS=1). Em test_ai_connector, injetar um fetch fake em vez de bater no Pollinations. 2) Reescrever test_batch_scheduling para importar ingestGeneratedPost de verdade com fetch mockado e relogio fixo, verificando payload, idempotencia e o retorno em caso de HTTP 500. 3) Adicionar testes novos de alto valor: contrato de canal (todo *.json valida contra o schema E toda chave declarada e consumida por algum modulo — um teste que FALHA quando alguem adiciona config morta); subtitle_generator (marginV/fontName do perfil chegam ao .ass; nenhuma palavra do wordBoundaries e truncada); script_generator (dois topicos distintos => narrationText distintos; --batch 7 no psicosegredo nao repete hash de roteiro); qc_gate (fixtures de video curto/mudo/preto sao rejeitadas). 4) Rodar `npm test` num passo do Dockerfile ou em CI.

---

### `sdd-xfade-inexistente` — SDD promete transicoes xfade de 0.25-0.3s; o compositor usa concat demuxer — 100% hard cuts

**Severidade:** ALTO · **Esforço:** medium · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/video_compositor.js:48`

**Evidência**

SDD secao 3.6: 'o FFmpeg utiliza o filtro xfade conectando take i e take i+1 com transicao de 0.25 a 0.3 segundos (efeitos: fade, dissolve, fadeblack). O take 0 mantem corte seco'. SDD secao 1.2 invariante 3: 'Sem cortes bruscos (hard cuts continuos substituidos por xfade suave)'. Realidade: video_compositor.js:31-33 escreve um concat_list.txt e :48 usa `inputOptions(['-f concat','-safe 0'])`. `grep -rn xfade pipeline/src/` retorna zero ocorrencias. O concat demuxer emenda os clipes sem nenhuma transicao. O Passo 1 do plano de implementacao do SDD listava exatamente essa mudanca como entrega.

**Causa-raiz**

O Passo 1 do SDD foi implementado pela metade: o upscale 2x do Ken Burns foi feito (visuals_harvester.js:223-239 tem scale=2160:3840 conforme especificado) mas a parte de xfade/vinheta do mesmo passo nao — a vinheta e o grading entraram (linha 61), o xfade nao.

**Impacto no vídeo final**

Cada troca de take e um salto seco. Combinado com o problema de composicoes repetidas (mesmo cavaleiro sob arvore em cenas distintas), o hard cut entre duas imagens quase iguais produz um 'pulo' visual que parece um glitch de renderizacao em vez de uma escolha de montagem. O SDD identificou corretamente que transicoes suaves sustentam retencao; a promessa esta documentada e nao entregue.

**Correção**

Substituir o concat demuxer por filter_complex com xfade encadeado. Para N clipes com duracoes d[i] e transicao t=0.28: manter o take 0 com corte seco conforme o SDD (comecar o xfade a partir do par 1-2) e encadear `[v0][v1]xfade=transition=fade:duration=0.28:offset=${sum(d[0..0])-0.28}[x1]; [x1][v2]xfade=...:offset=...[x2]; ...`. Atencao: xfade CONSOME 0.28s por transicao, entao a duracao total encolhe em (N-2)*0.28 — recalcular os offsets a partir das duracoes acumuladas e compensar alongando cada clipe em t na geracao (visuals_harvester ja recebe scene.duration, gerar duration+t). Validar a duracao resultante no QC gate, que e exatamente o tipo de erro que o gate pegaria.

---

### `cfg-voice-pitch-volume-descartados` — run_pipeline repassa apenas voice_id e rate — pitch e volume do perfil sao descartados

**Severidade:** MÉDIO · **Esforço:** trivial · **Categoria:** config-drift  
**Arquivo:** `pipeline/src/run_pipeline.js:100`

**Evidência**

run_pipeline.js:100-110 le `voiceProfile.voice_id` e `voiceProfile.rate` e chama synthesizeVoiceWithTimestamps({ text, voice, rate, outputAudioPath }) — sem pitch, sem volume. voice_synthesizer.js:13 tem `pitch = '-2Hz'` como default de assinatura e :36 o usa. psicosegredo.json pede pitch '-2Hz' (coincide por acaso), mas curiosidades/estoicismo/financas/template pedem '+0Hz'. `volume` ('+0%') nao existe sequer como parametro em voice_synthesizer.

**Causa-raiz**

Repasse campo-a-campo manual em vez de spread do bloco de configuracao inteiro; cada campo novo no JSON exige uma edicao em run_pipeline que ninguem fez.

**Impacto no vídeo final**

Tres dos quatro canais tem a locucao rebaixada em 2Hz sem que ninguem tenha pedido. Para a voz feminina pt-BR-ThalitaNeural (curiosidades) e pt-BR-FranciscaNeural (financas) o -2Hz nao intencional achata o timbre e contraria o tom 'Suspense/Hipnotico' e 'Energico' declarado nos perfis.

**Correção**

Trocar o repasse manual por `await synthesizeVoiceWithTimestamps({ text: scriptData.narrationText, outputAudioPath: audioPath, ...cfg.voice_profile })` apos o config_resolver ter normalizado as chaves (voice_id->voice). Adicionar suporte a `volume` em voice_synthesizer (msedge-tts aceita). Remover os defaults da assinatura de voice_synthesizer para que a ausencia de um campo falhe alto em vez de silenciar.

---

### `run-process-exit-zero` — process.exit(0) no fim de main() trunca stdout pendente e mascara falhas parciais

**Severidade:** MÉDIO · **Esforço:** trivial · **Categoria:** bug  
**Arquivo:** `pipeline/src/run_pipeline.js:282`

**Evidência**

main() termina com `process.exit(0)` (linha 282) incondicionalmente, apos o loop de lote. Nao ha inspecao dos resultados agregados: mesmo que ingestResult.source seja 'manifest' (ou seja, a API rejeitou) em todos os N itens, o exit code e 0.

**Causa-raiz**

exit(0) explicito adicionado para forcar encerramento, provavelmente porque algum handle (socket do msedge-tts ou processo ffmpeg) mantinha o event loop vivo. Tratou-se o sintoma.

**Impacto no vídeo final**

Duplo dano. (1) process.exit nao espera o flush de stdout quando ele e um pipe — e AiPipelineService.java le exatamente esse stdout por linha para extrair 'Video MP4:', 'Duracao Final:' e 'Elegivel TikTok Rewards:'; as ultimas linhas podem ser perdidas, fazendo o job aparecer COMPLETED com generatedVideoPath null. (2) O Java decide sucesso por `exitCode == 0` (AiPipelineService.runProcess), entao uma run que nao publicou nada e reportada como 'Video Gerado com Sucesso!' com progresso 100%. O operador do painel nao tem como saber que o lote falhou.

**Correção**

Remover o process.exit(0). Se algum handle impedir o encerramento, localiza-lo (provavelmente fechar o socket do msedge-tts) ou usar `process.exitCode = code` e deixar o loop drenar. Definir exit codes semanticos: 0 = todos os itens ingeridos via API; 2 = renderizado mas ingestao caiu em manifesto; 1 = falha de renderizacao. Emitir uma ultima linha machine-readable `RUN_RESULT <json>` e fazer o Java parsear ESSA linha em vez de substring de prosa.

---

### `run-sem-dryrun` — Nao existe --dry-run: impossivel validar configuracao, roteiro e prompts sem gastar cota e renderizar

**Severidade:** MÉDIO · **Esforço:** small · **Categoria:** arch  
**Arquivo:** `pipeline/src/run_pipeline.js:20`

**Evidência**

parseArgs (linhas 20-64) reconhece 9 flags e nenhuma delas e --dry-run, --keep, --out-dir, --resume ou --verbose. Argumentos desconhecidos sao silenciosamente ignorados (o for/if-else nao tem branch de erro), entao `--dry-run` digitado hoje roda a pipeline completa sem avisar.

**Causa-raiz**

CLI cresceu por acrescimo de if/else; nao ha tabela de flags nem validacao de argv.

**Impacto no vídeo final**

Cada tentativa de ajustar uma diretriz visual ou um perfil custa uma run completa: 8-15 chamadas de geracao de imagem (contra um free tier que ja responde 429), sintese TTS e ~2-4 minutos de encode a 4.5Mbps. Isso torna a iteracao de qualidade — exatamente o que o video auditado precisa — proibitivamente lenta, e e parte da razao pela qual os problemas de prompt persistiram.

**Correção**

Adicionar uma tabela de flags declarativa com validacao (argv desconhecido => erro + usage). Implementar `--dry-run`: executa etapas 1 (roteiro), o alinhamento de cenas e a CONSTRUCAO dos prompts, grava script.json/scenes.json/prompts.json e o .ass, imprime a config resolvida com a origem de cada valor (perfil vs CLI vs default), e para antes de qualquer chamada de rede paga e antes do FFmpeg. Adicionar tambem --keep, --out-dir e --resume.

---

### `ingest-agendamento-ingenuo` — Agendamento escalonado ingenuo: sem timezone explicita, sem checagem de colisao com a fila existente, sem janela por plataforma

**Severidade:** MÉDIO · **Esforço:** medium · **Categoria:** arch  
**Arquivo:** `pipeline/src/publisher_ingestor.js:31`

**Evidência**

Linhas 31-41: batchIndex 0 => agora+45min; batchIndex k>0 => hoje+k dias as 18:00. A data e formatada com getFullYear/getMonth/getDate/getHours do relogio LOCAL do processo, sem offset nem 'Z', e enviada como string 'YYYY-MM-DD HH:mm:ss'. O Dockerfile define TZ=America/Sao_Paulo no container mas o desenvolvedor local pode estar em outra TZ, e o backend interpreta a string sem saber a origem. Nenhuma consulta a posts ja agendados.

**Causa-raiz**

Regra de agendamento embutida no conector de ingestao em vez de ser um servico de scheduling com visao da fila.

**Impacto no vídeo final**

Tres problemas. (1) Ambiguidade de timezone: o mesmo lote gerado local e em container agenda em horarios diferentes; em transicao de horario de verao a string sem offset e ambigua. (2) Rodar --batch 7 duas vezes em dias distintos empilha dois posts as 18:00 do mesmo dia — dois videos do mesmo canal no mesmo minuto, o que canibaliza alcance. (3) 18:00 fixo ignora que a janela otima difere por plataforma e por publico, e publishing_profile nem tem campo para isso.

**Correção**

Enviar ISO-8601 com offset explicito (`toISOString()` ou com offset da TZ do canal) e adicionar `"publishing_profile": { "timezone": "America/Sao_Paulo", "publish_windows": { "YOUTUBE_SHORTS": ["18:00","21:00"], "TIKTOK": ["12:00","19:00"] } }` ao schema de canal. Extrair um scheduler que consulta a fila existente via GET, encontra o proximo slot livre respeitando um espacamento minimo configuravel (ex: 20h entre posts do mesmo canal) e so entao devolve o horario. Aplicar jitter de +/-15min para nao publicar sempre no minuto cheio.

---

### `docker-sem-verificacao-ambiente` — verify_environment.js existe mas nao esta ligado a nenhum script npm, build ou healthcheck

**Severidade:** MÉDIO · **Esforço:** small · **Categoria:** config-drift  
**Arquivo:** `package.json:10`

**Evidência**

package.json scripts tem apenas test, test:pipeline e pipeline — nao ha `verify`. `grep -rn verify_environment` em json/md/yml/Dockerfile retorna zero ocorrencias. O HEALTHCHECK do Dockerfile so faz curl no /api/v1/health do Spring, que nao exercita FFmpeg, nem Edge-TTS, nem a resolucao de fonte, nem a presenca das dependencias Node. Alem disso verify_environment.js nao checa libass/fontconfig nem a existencia das fontes configuradas, e assume que tts.toFile grava exatamente 'audio.mp3' (linha 27) — acoplamento fragil ao nome gerado pela lib.

**Causa-raiz**

Script escrito como ferramenta manual de diagnostico durante o setup inicial e nunca promovido a gate.

**Impacto no vídeo final**

Nenhum dos problemas de ambiente acima (devDeps ausentes, fontes ausentes, ffmpeg sem libass, PEXELS_API_KEY faltando) e detectado antes da primeira run real — que so falha depois de ja ter consumido cota de API e minutos de processamento. A instancia Cloud Run sobe 'saudavel' mesmo incapaz de renderizar qualquer video.

**Correção**

Expandir verify_environment.js para checar e reportar em tabela: binario ffmpeg + `ffmpeg -filters | grep -E 'subtitles|zoompan|xfade|blackdetect'`, `ffmpeg -version | grep libass`, `fc-match` para cada font_name declarado nos perfis, presenca de cada dependencia importada por pipeline/src, validacao de schema de todos os canais, e presenca/ausencia de cada env key (GEMINI_API_KEY, PEXELS_API_KEY, PIXABAY_API_KEY, API_BASE_URL) com o efeito de cada ausencia. Adicionar `"verify": "node pipeline/scripts/verify_environment.js"` e `"prepipeline": "npm run verify"` ao package.json, rodar no Dockerfile como etapa de build (falhando o build) e expor um /api/v1/health/pipeline no Spring que execute a variante rapida.

---

### `arch-sem-isolamento-de-run` — Caminhos relativos ao cwd e diretorio scratch compartilhado: duas runs concorrentes se corrompem

**Severidade:** MÉDIO · **Esforço:** medium · **Categoria:** arch  
**Arquivo:** `pipeline/src/run_pipeline.js:78`

**Evidência**

run_pipeline.js usa path.resolve('pipeline/scratch/...'), path.resolve('pipeline/assets/music'), path.resolve('pipeline/assets/scenes/...') — todos relativos ao cwd do processo. AiPipelineService.java faz `pb.directory(new File("."))` em runProcess e em analyzeYouTubeVideo, herdando o cwd da JVM. startPipelineJob dispara uma Virtual Thread por requisicao sem nenhum limite de concorrencia nem lock, e o jobRepository/jobLogs sao ConcurrentHashMap em memoria (perdidos em cada restart do Cloud Run, que e scale-to-zero).

**Causa-raiz**

O pipeline foi projetado como processo unico invocado manualmente da raiz do repo; a exposicao via API (N jobs simultaneos) veio depois sem revisitar as premissas de isolamento.

**Impacto no vídeo final**

Dois jobs disparados pelo painel ao mesmo tempo escrevem em runIds distintos (Date.now() + batchIndex), o que os separa por sorte — mas Date.now() pode colidir em ms e ambos compartilham a cadencia de 1.2s contra o mesmo IP no Pollinations, dobrando a chance de 429 e de degradacao para assets locais. Mais grave: se o Cloud Run escalar a zero ou reiniciar no meio de um job, o estado do job desaparece do ConcurrentHashMap e o painel perde o job para sempre, sem manifesto nem registro — e como nao ha persistencia de run (ver achado run-sem-estado), nao ha nada em disco para reconciliar.

**Correção**

1) Substituir todos os path.resolve relativos por resolucao a partir de uma raiz explicita: `const ROOT = process.env.PIPELINE_ROOT || path.resolve(fileURLToPath(import.meta.url), '../../..')`. 2) runId deve usar crypto.randomUUID() em vez de Date.now(). 3) Limitar concorrencia no Java com um Semaphore configuravel (o gargalo real e FFmpeg + cota de API, nao threads) e enfileirar o excedente. 4) Persistir PipelineJobStatus fora da memoria (o proprio run.json em disco/Drive, ou a tabela de posts) para que o painel reconcilie apos restart. 5) Para Cloud Run, apontar PIPELINE_SCRATCH_DIR para /tmp e nao assumir persistencia entre requisicoes.

---

## Integração com APIs Generativas (imagem, vídeo, stock B-roll), cascata de provedores e gate de qualidade

24 achados.

### `imagen-404-tier-morto` — Tier primário de imagem chama modelo inexistente (imagen-3.0-generate-002:predict → 404): 100% das imagens vêm do último fallback

**Severidade:** CRÍTICO · **Esforço:** small · **Categoria:** bug  
**Arquivo:** `pipeline/src/ai_image_connector.js:31`

**Evidência**

const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${effectiveKey}`;  — probe real contra a chave do .env retorna HTTP 404 NOT_FOUND. models.list da mesma chave expõe apenas gemini-2.5-flash-image, gemini-3-pro-image(-preview), nano-banana-pro-preview, gemini-3.1-flash-image(-preview), gemini-3.1-flash-lite-image. Nenhum imagen-*.

**Causa-raiz**

Model id hardcoded, escolhido por suposição e nunca validado contra models.list. Não existe preflight de disponibilidade de modelo; o código assume que a superfície :predict do Vertex AI existe em generativelanguage.googleapis.com, o que não é verdade para essa chave (formato AQ.Ab8..., 53 chars).

**Impacto no vídeo final**

O tier de maior qualidade nunca produz um pixel. Todas as ~9 imagens de cada vídeo são geradas pelo Pollinations em 576x1024 com marca d'água. Toda a degradação visual observada no vídeo final (borrão, anatomia derretida, logo queimado) é consequência direta deste 404.

**Correção**

Substituir o tier por :generateContent nos modelos que a chave realmente expõe, e adicionar preflight que derruba qualquer model id ausente do models.list antes de a pipeline começar:

```js
export async function resolveAvailableImageModel(apiKey, preference = ['gemini-3-pro-image','gemini-3.1-flash-image','gemini-2.5-flash-image']) {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',
    { headers: { 'x-goog-api-key': apiKey } });
  if (!res.ok) return null;
  const { models = [] } = await res.json();
  const ids = new Set(models.map(m => m.name.replace('models/', '')));
  return preference.find(m => ids.has(m)) || null;   // null => pular tier Google inteiro
}
```
Chamar uma vez em run_pipeline.js e propagar o id resolvido. Deletar generateImageWithImagen3 por completo.

---

### `gemini-generatecontent-ausente` — A chamada de imagem CORRETA (gemini-3-pro-image / gemini-3.1-flash-image via :generateContent) não existe em lugar nenhum do código

**Severidade:** CRÍTICO · **Esforço:** medium · **Categoria:** arch  
**Arquivo:** `pipeline/src/ai_image_connector.js:33`

**Evidência**

O payload construído é estilo Vertex predict: { instances:[{prompt}], parameters:{ sampleCount, aspectRatio:'9:16', outputMimeType, personGeneration, safetySetting } }. Não há nenhuma ocorrência de responseModalities, imageConfig, inlineData ou generateContent no arquivo inteiro (372 linhas).

**Causa-raiz**

A API de imagem do Gemini (generativelanguage) é multimodal-out via :generateContent com generationConfig.responseModalities=['IMAGE'] e generationConfig.imageConfig{aspectRatio,imageSize}. O projeto implementou a superfície errada (Vertex predict) e nunca migrou.

**Impacto no vídeo final**

Sem esse tier, o teto de qualidade do pipeline é o Pollinations 576x1024. Com ele, cada cena sairia em 2K/4K nativo 9:16 — fim do upscale 3.75x, fim do watermark, fim da anatomia derretida.

**Correção**

Implementar o tier assim (chave SEMPRE em header, nunca em ?key= na URL):

```js
async function generateWithGeminiImage({ model, prompt, imageSize, apiKey, outputPath, timeoutMs = 45000 }) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio: '9:16', imageSize }   // '1K' | '2K' | '4K'
        }
      })
    });
    if (!res.ok) {
      const body = await res.text();
      const err = new Error(`HTTP ${res.status}: ${body.slice(0,300)}`);
      err.status = res.status;
      err.quotaId = (body.match(/"quotaId"\s*:\s*"([^"]+)"/) || [])[1] || '';
      err.retryAfterMs = Number(res.headers.get('retry-after') || 0) * 1000;
      throw err;
    }
    const json = await res.json();
    const part = json?.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
    if (!part) throw new Error(`sem inlineData (finish=${json?.candidates?.[0]?.finishReason})`);
    const buf = Buffer.from(part.inlineData.data, 'base64');
    fs.writeFileSync(outputPath, buf);
    return { buf, mime: part.inlineData.mimeType, model };
  } finally { clearTimeout(t); }
}
```
Esse tier retorna 429 no free tier atual — ver o finding `cascata-sem-politica-429` para como tratar sem matar o tier.

---

### `pollinations-resolucao-ignorada` — Pollinations ignora width/height: pede-se 1080x1920, recebe-se 576x1024, e o motion engine faz upscale bicúbico de 3.75x

**Severidade:** CRÍTICO · **Esforço:** small · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/ai_image_connector.js:186`

**Evidência**

URL pedida: `...?width=1080&height=1920&nologo=true&seed=${sceneSeed}&model=flux&negative_prompt=...`. ffprobe em pipeline/scratch/run_1789132969254_1/scene_1_generated.jpg retorna literalmente `576,1024`. Em visuals_harvester.js:222 o motion filter faz `scale=2160:3840:flags=bicubic` sobre esse 576x1024 → fator 3.75x lineares (14x em área).

**Causa-raiz**

O endpoint clampa a resolução ao teto do modelo (lado longo ~1024) e devolve o aspecto pedido reduzido. O código nunca verifica as dimensões do que baixou — confia no que pediu. Depois o motion engine amplifica o erro fazendo upscale bicúbico (o pior kernel para ampliação) direto para 2160x3840.

**Impacto no vídeo final**

É a causa raiz número 1 do borrão do vídeo final. Cada pixel de origem vira ~14 pixels de saída por interpolação; o encoder a 4.5 Mbps gasta bitrate em borrão interpolado. Detalhe facial (o 'cavaleiro sem rosto') é fisicamente impossível de existir a 576px de largura depois de um crop 9:16.

**Correção**

Duas correções acopladas.
(1) Pedir a resolução nativa máxima que o Flux entrega e manter 9:16 exato — múltiplos de 16, lado longo ≤1792:
```js
const url = `https://image.pollinations.ai/prompt/${cleanPrompt}`
  + `?width=1024&height=1792&model=flux&seed=${sceneSeed}&nologo=true&referrer=autopublisher`;
```
(2) Trocar o upscale bicúbico por lanczos + unsharp e NÃO passar por 2160x3840 (visuals_harvester.js:222-238):
```
scale=1080:1920:flags=lanczos:force_original_aspect_ratio=increase,crop=1080:1920,
unsharp=5:5:0.9:5:5:0.0,zoompan=...:s=1080x1920:fps=30
```
Se mantiver a matriz 2x para o pan, usar `flags=lanczos+accurate_rnd` e só até 1620x2880 (1.5x), não 3.75x.

---

### `pollinations-watermark-queimada` — nologo=true é ignorado no tier anônimo: marca d'água 'pollinations.ai' queimada em 100% dos frames, sem detecção nem remoção

**Severidade:** CRÍTICO · **Esforço:** small · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/ai_image_connector.js:186`

**Evidência**

A URL envia `nologo=true` em ambos os tiers (linhas 186 e 238), mas as imagens salvas em pipeline/scratch/*/scene_N_generated.jpg trazem 'pollinations.ai' queimado no canto inferior direito. Não há nenhum crop, inpaint ou verificação de watermark em todo o arquivo.

**Causa-raiz**

nologo só é honrado para requisições autenticadas (token/referrer registrado). Anônimo, o parâmetro é aceito e ignorado. O código trata o parâmetro como garantia contratual e nunca inspeciona o resultado.

**Impacto no vídeo final**

Logo de terceiro visível em todo o vídeo publicado — problema de marca e de monetização (YouTube/TikTok tratam como conteúdo de terceiro / reduzem a percepção de produção própria), além de sinalizar publicamente que o conteúdo é gerado por um serviço gratuito.

**Correção**

(a) Autenticar: `POLLINATIONS_TOKEN` no .env e enviar `Authorization: Bearer ${token}` + `&referrer=autopublisher`; só então nologo funciona.
(b) Mitigação determinística enquanto isso — cortar a faixa inferior onde o logo é queimado e recompor o 9:16 por crop-e-rescale (perde ~4% de enquadramento, não deforma):
```
-vf "crop=iw:ih*0.958:0:0,scale=1080:1920:flags=lanczos:force_original_aspect_ratio=increase,crop=1080:1920"
```
(c) Detecção no gate (ver `gate-de-qualidade-inexistente`): comparar a variância do laplaciano do box inferior-direito (x>0.55w, y>0.90h) contra o box espelhado à esquerda; razão >2.2 com luminância média do box acima da global indica logo queimado → rejeitar o asset e cair para o próximo tier.

---

### `pollinations-sem-validacao-dimensao` — Nenhuma validação de dimensão, formato ou conteúdo após o download: aceita qualquer buffer >5000 bytes como imagem válida

**Severidade:** CRÍTICO · **Esforço:** small · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/ai_image_connector.js:206`

**Evidência**

if (buffer.length > 5000) { fs.writeFileSync(outputPath, buffer); return { success: true, provider: 'Pollinations AI (Flux HD 1080p)', ... } }  — o provider declarado é literalmente 'Flux HD 1080p' enquanto o arquivo tem 576x1024.

**Causa-raiz**

A única prova de qualidade aceita pelo código é o tamanho do arquivo em bytes. Não há decode, não há checagem de magic bytes, não há leitura de dimensões, não há verificação de que o aspect ratio é 9:16.

**Impacto no vídeo final**

Qualquer coisa passa: uma página de erro HTML de 6KB, um JPEG placeholder cinza, uma imagem 512x512 quadrada (que depois vira crop central destruindo a composição). E o log mente para o operador ('Flux HD 1080p'), tornando impossível notar o problema sem abrir o arquivo no ffprobe — que foi exatamente o que aconteceu neste projeto.

**Correção**

Validar antes de aceitar, e reportar a dimensão real no provider string:
```js
const SIG = { jpg: [0xFF,0xD8,0xFF], png: [0x89,0x50,0x4E,0x47] };
const isImage = b => SIG.jpg.every((v,i)=>b[i]===v) || SIG.png.every((v,i)=>b[i]===v);

if (!res.ok || !isImage(buffer)) continue;
const meta = await sharp(buffer).metadata();
const ar = meta.width / meta.height;
if (meta.width < 768 || meta.height < 1344 || Math.abs(ar - 9/16) > 0.06) {
  console.warn(`[Pollinations] rejeitado: ${meta.width}x${meta.height} (ar ${ar.toFixed(3)})`);
  continue;   // tenta próximo tier, não aceita lixo
}
return { success: true, provider: `Pollinations Flux ${meta.width}x${meta.height}`, width: meta.width, height: meta.height, ... };
```

---

### `gate-de-qualidade-inexistente` — Não existe NENHUM gate de qualidade: nenhuma checagem de resolução, nitidez, luminância ou watermark antes de aceitar o asset

**Severidade:** CRÍTICO · **Esforço:** medium · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/ai_image_connector.js:280`

**Evidência**

generateHighQualitySceneImage (linhas 280-372) aceita o primeiro tier cujo .success seja true e retorna { outputPath, provider, prompt, sizeKb }. O único critério em todo o caminho é buffer.length > 5000. Em visuals_harvester.js:501 o retorno é usado com `if (generated && fs.existsSync(generated.outputPath))` — existência de arquivo como prova de qualidade.

**Causa-raiz**

A cascata é um fallback de DISPONIBILIDADE, não de QUALIDADE. Ela responde 'consegui um arquivo?' e nunca 'o arquivo presta?'. Sem essa medida, nenhum tier superior pode ser acionado por um asset ruim — só por um asset ausente.

**Impacto no vídeo final**

É o defeito estrutural que permite tudo o que foi observado no vídeo final: 576x1024 borrado, watermark queimado, imagens deformadas e composições repetidas passam sem uma única objeção do sistema. Um gate teria rejeitado 100% das imagens do run analisado.

**Correção**

Criar pipeline/src/asset_quality_gate.js e exigir aprovação antes de cada `return success` da cascata:

```js
import sharp from 'sharp';
const MIN_W = 864, MIN_H = 1536, MIN_LAP = 120, LUMA = [38, 215];

export async function gradeImageAsset(filePath) {
  const img = sharp(filePath, { failOn: 'none' });
  const meta = await img.metadata();
  const reasons = [];
  if (!meta.width) return { ok:false, score:0, reasons:['nao-decodificavel'] };

  if (meta.width < MIN_W || meta.height < MIN_H)
    reasons.push(`resolucao ${meta.width}x${meta.height} < ${MIN_W}x${MIN_H}`);
  const ar = meta.width / meta.height;
  if (Math.abs(ar - 9/16) > 0.06) reasons.push(`aspect ${ar.toFixed(3)} != 9:16`);

  const st = await img.stats();
  const luma = 0.2126*st.channels[0].mean + 0.7152*st.channels[1].mean + 0.0722*st.channels[2].mean;
  if (luma < LUMA[0] || luma > LUMA[1]) reasons.push(`luminancia ${luma.toFixed(1)} fora de [${LUMA}]`);
  if (Math.max(...st.channels.map(c => c.stdev)) < 8) reasons.push('imagem chapada (placeholder/erro)');

  const g = await img.clone().greyscale().resize(512, 512, { fit:'inside' })
                     .raw().toBuffer({ resolveWithObject: true });
  const varLap = laplacianVar(g.data, g.info.width, g.info.height);
  if (varLap < MIN_LAP) reasons.push(`borrado: var-laplaciano ${varLap.toFixed(0)} < ${MIN_LAP}`);

  if (await hasCornerWatermark(img, meta)) reasons.push('watermark no canto inferior direito');

  return { ok: reasons.length === 0, width: meta.width, height: meta.height, varLap, luma, reasons };
}

function laplacianVar(g, w, h) {
  let s = 0, s2 = 0, n = 0;
  for (let y = 1; y < h-1; y++) for (let x = 1; x < w-1; x++) {
    const i = y*w + x;
    const v = -4*g[i] + g[i-1] + g[i+1] + g[i-w] + g[i+w];
    s += v; s2 += v*v; n++;
  }
  return s2/n - (s/n)**2;
}

// logo queimado => densidade de borda muito maior no canto inferior-direito que no espelho esquerdo
async function hasCornerWatermark(img, meta) {
  const bw = Math.round(meta.width * 0.45), bh = Math.round(meta.height * 0.09);
  const top = meta.height - bh;
  const box = async left => {
    const r = await img.clone().extract({ left, top, width: bw, height: bh })
                       .greyscale().raw().toBuffer({ resolveWithObject: true });
    return laplacianVar(r.data, r.info.width, r.info.height);
  };
  const right = await box(meta.width - bw), left = await box(0);
  return right > left * 2.2 && right > 200;
}
```
Regra de uso na cascata: `const grade = await gradeImageAsset(outputPath); if (!grade.ok) { log(grade.reasons); continue; /* próximo tier */ }`. Registrar a grade no manifest do run para auditoria (varLap e resolução por cena).

---

### `cascata-correta-proposta` — A cascata atual está ordenada por otimismo, não por custo/qualidade, e não tem política de 429 nem cache: proposta de reordenação completa

**Severidade:** CRÍTICO · **Esforço:** large · **Categoria:** arch  
**Arquivo:** `pipeline/src/ai_image_connector.js:306`

**Evidência**

Ordem atual: (1) Imagen3 [404 sempre] → (2) Pollinations Flux [576x1024 c/ watermark] → (3) Pollinations Turbo [idêntico ao 2] → (4) asset local `scene_${(i % 5) + 1}.jpg` (visuals_harvester.js:508-510, que rotaciona 5 arquivos fixos e é a origem da composição 'cavaleiro sob a árvore' repetida em cenas diferentes). O tier de stock B-roll real existe mas está em outro ramo do código e nunca recebe as chaves.

**Causa-raiz**

A cascata foi escrita como sequência de esperanças em vez de política de custo/qualidade com evidência de aprovação entre etapas. Não há preflight, não há cache, não há gate, e 429 é tratado como morte do tier.

**Impacto no vídeo final**

Custo real hoje: US$ 0,00 e qualidade de piso (576x1024 com logo). A ordenação correta troca ~US$ 0,30/vídeo por 9 imagens 2K nativas sem watermark — a diferença entre o vídeo atual e um vídeo publicável.

**Correção**

Cascata proposta, ordenada por custo/qualidade, com gate obrigatório entre tiers:

**T0 — Cache local (US$ 0, ~5ms).** Chave = sha256(kind|model|prompt|seed|aspect|size). Hit só é aceito se o sidecar .json disser `grade.ok === true`.

**T1 — gemini-3.1-flash-image :generateContent, imageConfig{aspectRatio:'9:16', imageSize:'2K'}** (~US$0,03/img). Tier de corpo (cenas 2..n-1).

**T2 — gemini-3-pro-image :generateContent, imageSize:'4K'** (~US$0,13/img). Só hook (cena 1) + thumbnail — onde retenção e CTR pagam o preço.

**T3 — Stock B-roll real (Pexels → Pixabay)** (US$ 0). Para cenas com ação humana concreta; 1080x1920 nativo real bate qualquer imagem sintética borrada. Exige as chaves (ver `stock-keys-ausentes`).

**T4 — Pollinations Flux 1024x1792 + crop de watermark + upscale lanczos** (US$ 0). Último recurso *remoto*.

**T5 — Cena procedural chiaroscuro** (createProceduralDarkScene, já existe). Nunca o asset local rotativo de 5 arquivos — ele é a causa da monotonia visual.

Orquestrador:
```js
const TIERS = [
  { id:'cache',  run: t => cacheGet(t.key) },
  { id:'flash',  model:'gemini-3.1-flash-image', size:'2K', usd:0.03, when: t => !t.isHook },
  { id:'pro',    model:'gemini-3-pro-image',     size:'4K', usd:0.13, when: t => t.isHook || t.isThumb },
  { id:'stock',  run: t => fetchAndPrepareStockBroll(t), when: t => !!t.stockQuery },
  { id:'flux',   run: t => pollinationsFlux(t) },
  { id:'procedural', run: t => createProceduralDarkScene(t) }
];

for (const tier of TIERS) {
  if (tier.when && !tier.when(task)) continue;
  if (tier.model && isOpen(tier.model)) continue;          // circuit breaker c/ TTL
  let out;
  try { out = await runTier(tier, task); }
  catch (e) {
    if (e.status === 429 && !/PerDay/i.test(e.quotaId || '')) {
      await sleep(e.retryAfterMs || 20000);
      try { out = await runTier(tier, task); } catch (e2) { trip(tier.model, e2.status, e2.quotaId); continue; }
    } else { trip(tier.model, e.status, e.quotaId); continue; }
  }
  const grade = await gradeImageAsset(out.path);            // GATE OBRIGATORIO
  if (!grade.ok) { console.warn(`[${tier.id}] reprovado: ${grade.reasons.join('; ')}`); continue; }
  if (tier.model) reset(tier.model);
  cachePut(task.key, out.path, grade);
  budget.spent += tier.usd || 0;
  return { ...out, tier: tier.id, grade };
}
```
**Política de 429 (free tier):** 429 por-minuto → 1 retry com Retry-After, depois breaker de 60s; 429 com quotaId contendo 'PerDay' → breaker de 6h e log explícito 'habilite billing para o tier de imagem'. Nunca latch booleano permanente. Adicionalmente: preflight único por run que dispara 1 imagem 1K barata; se der 429/PerDay, o run inteiro pula T1/T2 sem pagar 9 tentativas fracassadas.

---

### `veo-parse-resposta-errado` — O parser da resposta do Veo procura campos que a API generativelanguage não retorna: mesmo um job bem-sucedido é descartado

**Severidade:** CRÍTICO · **Esforço:** small · **Categoria:** bug  
**Arquivo:** `pipeline/src/ai_video_connector.js:152`

**Evidência**

const videoBytes = pollData.response?.generatedVideos?.[0]?.video?.bytesBase64Encoded || pollData.response?.predictions?.[0]?.bytesBase64Encoded;  ...  const videoUri = pollData.response?.generatedVideos?.[0]?.video?.uri;  ...  return { success:false, error:'Operação do Veo concluída sem dados binários de vídeo' };

**Causa-raiz**

A LRO do :predictLongRunning em generativelanguage retorna o resultado sob `response.generateVideoResponse.generatedSamples[0].video.uri` — e entrega URI, não bytes inline (vídeo é grande demais para base64 na resposta). O código busca `response.generatedVideos[...]` (shape do SDK JS) e `response.predictions[...]` (shape do Vertex), nenhum dos dois presente. Confirmação colateral: o payload de REQUISIÇÃO {instances:[{prompt}], parameters:{...}} está CORRETO para :predictLongRunning em generativelanguage (não é 'contents') — o erro é só na leitura da resposta.

**Impacto no vídeo final**

Cenário mais caro possível: o Google renderiza e FATURA o clipe (veo-3.1-fast é cobrado por segundo de vídeo gerado), a operação completa com done:true, e o código joga o resultado fora com a mensagem 'concluída sem dados binários'. Dinheiro gasto, zero pixels entregues, e o operador acredita que o Veo 'não funciona'.

**Correção**

Corrigir o caminho e baixar a URI COM autenticação (a URI de download exige a chave; o fetch nu da linha 169 devolve 403):
```js
const sample = pollData.response?.generateVideoResponse?.generatedSamples?.[0]
            || pollData.response?.generatedVideos?.[0];
const uri = sample?.video?.uri;
const inline = sample?.video?.bytesBase64Encoded;

if (inline) { fs.writeFileSync(outputPath, Buffer.from(inline, 'base64')); return ok(); }
if (uri) {
  const dl = await fetch(uri.includes('?') ? `${uri}&alt=media` : `${uri}?alt=media`,
                         { headers: { 'x-goog-api-key': effectiveKey } });
  if (!dl.ok) return { success:false, error:`download do Veo falhou: HTTP ${dl.status}` };
  const buf = Buffer.from(await dl.arrayBuffer());
  if (!(buf.length > 12 && buf.slice(4,8).toString('ascii') === 'ftyp'))
    return { success:false, error:'download do Veo nao e MP4' };
  fs.writeFileSync(outputPath, buf); return ok();
}
```

---

### `pollinations-video-escreve-jpeg-como-mp4` — Pollinations 'model=video' não existe: o endpoint devolve um JPEG que é gravado como scene_N.mp4 e aceito como vídeo real

**Severidade:** CRÍTICO · **Esforço:** trivial · **Categoria:** bug  
**Arquivo:** `pipeline/src/ai_video_connector.js:209`

**Evidência**

const url = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=720&height=1280&model=video&nologo=true&seed=${s}`;  ...  if (buffer.length > 20480) { fs.writeFileSync(outputPath, buffer); return { success:true, provider:'Pollinations AI Video (Text-to-Video)' } }  — o host é image.pollinations.ai (só imagem) e já está provado que o parâmetro model é ignorado. Um JPEG 720x1280 do Flux pesa ~40KB > 20480, então a condição passa. Em generateCinematicTake:304 o retorno vira isRealVideo:true, e visuals_harvester.js:465 confirma com `fs.statSync(clipPath).size > 20000` e faz videoClips.push(clipPath).

**Causa-raiz**

Endpoint e modelo inventados (não existe geração de vídeo em image.pollinations.ai), combinados com validação por byte-count em vez de magic bytes. Nenhum ponto do caminho verifica que o arquivo .mp4 é realmente um container de vídeo.

**Impacto no vídeo final**

Com --visual-mode video, um arquivo JPEG entra na lista de clipes com extensão .mp4 e vai para o concat/compositor do FFmpeg. Resultado: falha de concat ou cena corrompida/preta no vídeo publicado. É um defeito latente hoje (default é 'hybrid', onde o Pollinations video só roda se visualMode==='video'), mas é uma bomba armada na flag documentada no --help.

**Correção**

Deletar generateVideoWithPollinations e sua chamada em generateCinematicTake:296-312. Se algum motor de vídeo aberto for adicionado no futuro, validar o container por magic bytes e por ffprobe:
```js
const isMp4  = buf.length > 12 && buf.slice(4,8).toString('ascii') === 'ftyp';
const isWebm = buf[0]===0x1A && buf[1]===0x45 && buf[2]===0xDF && buf[3]===0xA3;
if (!isMp4 && !isWebm)
  return { success:false, error:`resposta nao e video (magic=${buf.slice(0,8).toString('hex')})` };
// e depois: ffprobe -> exigir nb_frames > 1 e codec_type === 'video'
```

---

### `stock-keys-ausentes` — O tier de B-roll real está morto em dois níveis: as chaves não existem no .env E o harvester nunca as repassa

**Severidade:** CRÍTICO · **Esforço:** trivial · **Categoria:** config-drift  
**Arquivo:** `pipeline/src/stock_video_connector.js:32`

**Evidência**

searchPexelsVideo: `const effectiveKey = apiKey || process.env.PEXELS_API_KEY; if (!effectiveKey) return { success:false, error:'PEXELS_API_KEY não configurada' };` (idem Pixabay na linha 86). O .env do projeto contém YOUTUBE_*, GOOGLE_SHEETS_*, AUTO_PUBLISHER_API_KEY, SERVER_PORT e GEMINI_API_KEY — nenhuma menção a PEXELS_API_KEY ou PIXABAY_API_KEY. E em visuals_harvester.js:481-486, fetchAndPrepareStockBroll é chamado apenas com { query, outputPath, durationSeconds, isHookScene } — pexelsApiKey e pixabayApiKey ficam no default null.

**Causa-raiz**

Integração entregue sem provisionamento de credenciais e sem plumbing no orquestrador. Pior: a ausência falha em silêncio — retorna { success:false } como qualquer outro erro, e o harvester simplesmente segue para a geração por IA sem alertar que o tier grátis de maior qualidade acabou de ser pulado.

**Impacto no vídeo final**

O tier que entregaria vídeo REAL 1080x1920 nativo (Pexels: 20.000 req/mês, custo zero) nunca executa. Cenas de ação humana concreta ('pessoa olhando o celular', 'mãos segurando um livro') — onde stock supera folgadamente qualquer imagem sintética 576x1024 — caem para o Pollinations borrado. Isto é qualidade grátis sendo jogada fora por falta de duas linhas no .env.

**Correção**

(1) Adicionar ao .env: `PEXELS_API_KEY=` e `PIXABAY_API_KEY=` (ambas gratuitas, cadastro imediato).
(2) Repassar explicitamente em visuals_harvester.js:481:
```js
const stockResult = await fetchAndPrepareStockBroll({
  query: stockQuery, outputPath: clipPath, durationSeconds: scene.duration, isHookScene: isHook,
  pexelsApiKey: process.env.PEXELS_API_KEY,
  pixabayApiKey: process.env.PIXABAY_API_KEY
});
```
(3) Preflight no início do run que loga em WARN cada tier desabilitado por credencial ausente, para que a degradação nunca mais seja silenciosa:
```js
for (const [k, tier] of [['PEXELS_API_KEY','stock-pexels'],['PIXABAY_API_KEY','stock-pixabay'],['GEMINI_API_KEY','gemini-image']])
  if (!process.env[k]) console.warn(`[preflight] tier ${tier} DESABILITADO: ${k} ausente`);
```

---

### `imagen-kill-switch-sessao` — imagenDisabledForSession desliga o tier primário para a sessão inteira no primeiro erro, sem TTL e sem distinguir 404 de 429

**Severidade:** ALTO · **Esforço:** small · **Categoria:** arch  
**Arquivo:** `pipeline/src/ai_image_connector.js:12`

**Evidência**

let imagenDisabledForSession = false;  ...  if (res.status === 404 || res.status === 403 || res.status === 429) { imagenDisabledForSession = true; }  — e no topo da função: if (imagenDisabledForSession) return { success:false, error:'...indisponível na cota da chave para esta sessão' }.

**Causa-raiz**

Circuit breaker booleano, latch permanente, sem TTL, sem contador e sem taxonomia de erro. 404 (modelo não existe — irreversível), 403 (permissão — irreversível) e 429 (cota do MINUTO — reversível em 60s) recebem exatamente o mesmo tratamento terminal. O flag é module-level e nunca é resetado.

**Impacto no vídeo final**

Um único 429 transitório de rate-limit por minuto na cena 1 condena as 8 cenas seguintes ao Pollinations 576x1024, mesmo que a cota volte em 60s. Metade do vídeo poderia ter qualidade 2K e sai borrada. Também mascara a causa real: a mensagem diz 'cota' quando na verdade é 404 de modelo inexistente, o que atrasou o diagnóstico.

**Correção**

Trocar por circuit breaker por-modelo com backoff exponencial e TTL, e classificar o erro:

```js
const breakers = new Map(); // modelId -> { openUntil, consecutive }
const isOpen = m => { const b = breakers.get(m); return !!b && Date.now() < b.openUntil; };
function trip(model, status, quotaId = '') {
  const b = breakers.get(model) || { consecutive: 0 };
  b.consecutive++;
  const base =
    status === 404 || status === 403 ? Infinity              // modelo inexistente: fora do run
    : status === 429 && /PerDay/i.test(quotaId) ? 6*3600e3    // cota diária: 6h
    : status === 429 ? 60e3                                   // cota por minuto: 60s
    : 5*60e3;
  b.openUntil = base === Infinity ? Infinity
    : Date.now() + Math.min(base * 2 ** (b.consecutive - 1), 6*3600e3);
  breakers.set(model, b);
}
function reset(model) { breakers.delete(model); }   // chamar em todo sucesso
```
Em 429 por-minuto, antes de abrir o breaker, tentar 1 retry com `await sleep(err.retryAfterMs || 20000)`.

---

### `threshold-5000-bytes` — Threshold de 5000 bytes é insuficiente: JPEGs de erro/placeholder e imagens chapadas passam como sucesso

**Severidade:** ALTO · **Esforço:** trivial · **Categoria:** bug  
**Arquivo:** `pipeline/src/ai_image_connector.js:86`

**Evidência**

if (buffer.length < 5000) { return { success:false, error:`Imagem recebida corrompida ou muito pequena (${buffer.length} bytes)` }; }  — repetido nas linhas 206 e 258. As imagens boas do projeto têm 27KB-76KB; um JPEG 9:16 cinza sólido a 576x1024 tem ~8-12KB e passa folgado.

**Causa-raiz**

Heurística de byte-count usada como proxy de conteúdo. Não existe faixa mínima calibrada por resolução, nem checagem de entropia/desvio-padrão que distinguiria uma imagem real de um placeholder monocromático ou de um frame de erro do provedor.

**Impacto no vídeo final**

Cenas em preto/cinza chapado entram no vídeo final como se fossem arte válida, e o motion engine ainda aplica Ken Burns sobre elas — um retângulo cinza com zoom por 7 segundos. O operador não é avisado porque o log diz '✓ Sucesso'.

**Correção**

Trocar byte-count por prova de conteúdo. Mínimo por resolução + desvio-padrão de cor:
```js
const stats = await sharp(buffer).stats();
const spread = Math.max(...stats.channels.map(c => c.stdev));
const minBytes = Math.round((meta.width * meta.height) * 0.02);  // ~0.02 B/px p/ JPEG q80
if (buffer.length < minBytes) return reject('bytes abaixo do esperado p/ resolução');
if (spread < 8) return reject('imagem chapada: placeholder ou erro do provedor');
```

---

### `pollinations-tier2-duplicado` — O 'Fallback Tier 2' (Turbo) é bit-a-bit idêntico ao Tier 1: mesmo host, mesmo prompt, MESMA seed, e o parâmetro model é ignorado

**Severidade:** ALTO · **Esforço:** trivial · **Categoria:** arch  
**Arquivo:** `pipeline/src/ai_image_connector.js:238`

**Evidência**

Tier1: `...?width=1080&height=1920&nologo=true&seed=${sceneSeed}&model=flux&negative_prompt=${negParam}`  |  Tier2: `...?width=1080&height=1920&nologo=true&seed=${sceneSeed}&negative_prompt=${negParam}` — mesma seed derivada do mesmo argumento. Probe real: model=flux e model=turbo retornaram bytes de tamanho IDÊNTICO (40532), provando que o parâmetro não altera o modelo.

**Causa-raiz**

Diversidade de provedor confundida com diversidade de query string. Os dois 'tiers' apontam para image.pollinations.ai; a única diferença sintática (model=flux) é ignorada pelo serviço, e a seed é reusada, o que garante determinismo — se o Tier 1 produziu uma imagem ruim, o Tier 2 produz exatamente a mesma imagem ruim.

**Impacto no vídeo final**

Não há fallback real: são 3 tentativas + 2 tentativas contra o mesmo endpoint, custando até 22s+18s de latência por cena para zero ganho de qualidade. E se o Tier 1 falhou por timeout de rede, o Tier 2 falha pelo mesmo motivo. Também impede recuperação de 'imagem ruim' — só cobre 'nenhuma imagem'.

**Correção**

Se o tier 2 for mantido no mesmo provedor, no mínimo variar a seed e o prompt: `seed: sceneSeed + 7919` e `compact + ', alternate camera angle, different composition'`. Mas o correto é o tier 2 ser um provedor diferente de fato — Pexels/Pixabay B-roll (grátis, real, 1080x1920 nativo) antes de qualquer segunda tentativa no Pollinations. Ver `cascata-correta-proposta`.

---

### `negative-prompt-dead-code` — getNegativePromptForDirective é código morto em produção: Pollinations não suporta negative_prompt, e Flux ignora negativos por design

**Severidade:** ALTO · **Esforço:** small · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/ai_image_connector.js:183`

**Evidência**

const negParam = encodeURIComponent(negPrompt); ... `&negative_prompt=${negParam}`. getNegativePromptForDirective (linhas 104-126) produz strings de ~230-290 chars ('anime, cartoon, illustration, drawing, 3d render, doll, plastic, ... deformed, bad anatomy, bad hands ...'). Como o tier Imagen nunca executa (404), 100% das imagens do projeto vêm do Pollinations — onde esse parâmetro não existe.

**Causa-raiz**

Parâmetro inventado por analogia com Stable Diffusion WebUI. O endpoint image.pollinations.ai aceita apenas prompt no path e width/height/seed/model/nologo/enhance/private/referrer na query; parâmetros desconhecidos são silenciosamente descartados. Além disso, Flux (rectified flow) não tem guidance negativa como SD 1.5/XL.

**Impacto no vídeo final**

Toda a engenharia anti-deformidade do projeto ('deformed, bad anatomy, bad hands') tem efeito ZERO nas imagens realmente produzidas — o que explica diretamente a anatomia deformada e o 'elmo derretido' observados nos frames extraídos. Também explica por que o watermark não é evitado apesar de 'watermark' constar do negative prompt.

**Correção**

Converter negativos em afirmativos dentro do prompt positivo, que é o que Flux honra, e remover o parâmetro da URL:
```js
const POSITIVE_CONSTRAINTS = {
  ghibli:  'clean hand-painted gouache cel, correct anatomy, five fingers per hand, serene daylight, no text anywhere',
  anime:   'crisp cel-shaded line art, anatomically correct hands and faces, clean plate, no lettering',
  default: 'sharp documentary photograph, 85mm lens, natural skin texture, anatomically correct hands and face, clean frame free of any text or logo'
};
const compact = `${base}, ${POSITIVE_CONSTRAINTS[styleKey]}`;
const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(compact)}?width=1024&height=1792&model=flux&seed=${sceneSeed}&nologo=true&referrer=autopublisher`;
```
Manter getNegativePromptForDirective apenas para o tier Gemini/Veo, que aceita negativos de verdade.

---

### `veo-duration-invalida` — Veo recebe durationSeconds inválido (3,5,7) que o modelo rejeita com 400 — e o handler de 400 desliga o Veo para a sessão inteira

**Severidade:** ALTO · **Esforço:** trivial · **Categoria:** bug  
**Arquivo:** `pipeline/src/ai_video_connector.js:78`

**Evidência**

durationSeconds: Math.min(8, Math.max(3, Math.round(durationSeconds)))  — produz qualquer inteiro de 3 a 8. veo-3.1 aceita apenas {4, 6, 8}. Logo abaixo: if (initRes.status === 429 || initRes.status === 404 || initRes.status === 400) { isVeoDisabledForSession = true; }. As cenas do pipeline têm duração derivada do alinhamento fonético (floats arbitrários), então 5s e 7s são os valores mais prováveis.

**Causa-raiz**

Clamp contínuo aplicado a um domínio discreto. E 400 (INVALID_ARGUMENT — erro do CLIENTE, corrigível no retry) foi agrupado com 429/404 no mesmo kill-switch de sessão, então um bug de formatação de payload se apresenta ao operador como 'cota excedida ou acesso prévio restrito'.

**Impacto no vídeo final**

O tier de vídeo generativo (o único que produziria movimento real no gancho, onde a retenção é decidida) falha no primeiro disparo por um erro trivial de payload, e o kill-switch garante que nenhuma cena posterior tente de novo. Todo o vídeo cai para Ken Burns sobre imagem estática.

**Correção**

Quantizar para o domínio válido e remover 400 do kill-switch:
```js
const ALLOWED = [4, 6, 8];
const target = Number(durationSeconds) || 6;
const dur = ALLOWED.reduce((a, b) => Math.abs(b - target) < Math.abs(a - target) ? b : a);
// ...
if (initRes.status === 429 || initRes.status === 404) tripVeo(initRes.status);
if (initRes.status === 400) console.error('[Veo] PAYLOAD INVALIDO (nao e cota):', errDetail); // nao desliga o tier
```
Se a cena precisar de 5s e o Veo só entrega 4 ou 6, gerar 6 e cortar no compositor — nunca enviar 5.

---

### `veo-polling-75s` — Polling de 75s abandona jobs do Veo que levam 1-6 min, sem cancelar nem persistir a operação — paga e descarta

**Severidade:** ALTO · **Esforço:** small · **Categoria:** cost  
**Arquivo:** `pipeline/src/ai_video_connector.js:131`

**Evidência**

const maxWaitMs = 75000; // Limite de 75s para não travar o fluxo  ... while (Date.now() - pollStart < maxWaitMs) { ... }  return { success:false, error:'Timeout de espera na renderização do Google Veo (> 75s)' };  — e o operationName não é persistido em lugar nenhum.

**Causa-raiz**

Timeout dimensionado pela impaciência do orquestrador, não pela latência real do modelo. Geração de vídeo 8s em veo-3.1-fast tipicamente leva 60-360s. Além disso, abandonar a LRO não a cancela: o cluster continua renderizando e faturando.

**Impacto no vídeo final**

Na melhor hipótese o gancho nunca recebe vídeo real (o clipe fica pronto aos ~120s, 45s depois do abandono). Na pior, o run paga por um clipe de 8s a cada execução e nunca o usa. Como o pipeline não persiste operationName, um run seguinte não consegue nem recuperar o clipe já pago.

**Correção**

(a) maxWaitMs = 360000 com pollIntervalMs escalonado (4s → 10s após o primeiro minuto), já que o gancho é uma única cena e o custo de esperar é 1x por vídeo.
(b) Persistir a operação para recuperação entre runs:
```js
const opFile = path.join(path.dirname(outputPath), 'veo_operation.json');
fs.writeFileSync(opFile, JSON.stringify({ operationName, startedAt: Date.now(), outputPath, prompt }));
// no inicio do run: se existir opFile com <24h, dar um poll antes de gerar de novo
```
(c) Orçamento explícito: `VEO_MAX_USD_PER_RUN` no .env, e pular o tier quando o run já gastou o limite.

---

### `veo-kill-switch-e-sem-timeout` — isVeoDisabledForSession latcha no primeiro 400/404/429 e o POST inicial não tem timeout algum

**Severidade:** ALTO · **Esforço:** small · **Categoria:** arch  
**Arquivo:** `pipeline/src/ai_video_connector.js:97`

**Evidência**

if (initRes.status === 429 || initRes.status === 404 || initRes.status === 400) { isVeoDisabledForSession = true; }  — mesma patologia do lado da imagem. E o fetch das linhas 87-94 não tem AbortController/signal, ao contrário do conector de imagem que usa timeout de 25s.

**Causa-raiz**

Kill-switch booleano permanente misturando erro de cliente (400), erro de configuração (404) e limite transitório (429). Sem timeout no POST inicial, uma conexão pendurada trava o run inteiro indefinidamente — não há default de timeout no fetch do Node.

**Impacto no vídeo final**

Um 429 de rate-limit por minuto no gancho desliga o Veo para as 8 cenas seguintes no modo 'video'. E um socket pendurado congela a pipeline sem log, sem progresso e sem vídeo — o pior modo de falha para um job automatizado agendado por cron.

**Correção**

Aplicar o mesmo circuit breaker com TTL do finding `imagen-kill-switch-sessao` (por modelo, exponencial, 429/min = 60s, 429/dia = 6h, 404 = permanente-no-run, 400 = nunca abre o breaker) e adicionar timeout:
```js
const ctl = new AbortController();
const t = setTimeout(() => ctl.abort(), 30000);
const initRes = await fetch(url, { method:'POST', signal: ctl.signal, headers:{...}, body:... });
clearTimeout(t);
```

---

### `stock-selecao-primeiro-hit` — Seleção de B-roll pega o primeiro resultado sem relevância, sem filtro de duração e sem captura de licença/atribuição

**Severidade:** ALTO · **Esforço:** medium · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/stock_video_connector.js:105`

**Evidência**

Pixabay: `const hit = data.hits[0]; const candidate = videos.medium || videos.large || videos.small;` — literalmente o primeiro hit e a qualidade 'medium' preferida sobre 'large'. Pexels: `per_page=5` e `for (const video of data.videos) { const idealFile = files.find(f => f.height > f.width && f.width >= 720) || files.find(f => f.quality==='hd') || files[0]; if (idealFile?.link) return ... }` — retorna no primeiro item iterado, aceita largura 720, e cai para `files[0]` (que pode ser 640x360 landscape). Nenhum dos dois lê video.duration para decidir, nem guarda user/url para atribuição.

**Causa-raiz**

Busca tratada como sorte: 'a API respondeu, logo serve'. Não há score de relevância contra a query, nem checagem de que a duração da fonte cobre a duração da cena, nem deduplicação entre cenas, nem registro de licença.

**Impacto no vídeo final**

Três degradações concretas: (a) clipe tematicamente errado entra no vídeo — é a mesma classe de erro do 'cavaleiro medieval em vídeo de psicologia'; (b) fonte de 2s para cena de 7s é loopada 3,5x por `-stream_loop -1` (linha 162), produzindo saltos visíveis; (c) o mesmo clipe pode ser escolhido para várias cenas, reforçando a monotonia. Sem atribuição registrada, há também exposição de licença em conteúdo monetizado.

**Correção**

Rankear e filtrar, com per_page alto e deduplicação por run:
```js
const url = `https://api.pexels.com/videos/search?query=${q}&orientation=portrait&size=large&per_page=30`;
const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 3);
const ranked = (data.videos || [])
  .filter(v => v.duration >= Math.ceil(durationSeconds) + 1 && v.duration <= 45)   // cobre a cena, sem loop
  .map(v => {
    const file = (v.video_files || [])
      .filter(f => f.height > f.width && f.width >= 1080 && /mp4/i.test(f.file_type || ''))
      .sort((a, b) => b.height - a.height)[0];                                      // maior, nao 'medium'
    if (!file) return null;
    const hay = `${v.url} ${(v.tags || []).join(' ')}`.toLowerCase();
    const relevance = terms.filter(t => hay.includes(t)).length / Math.max(1, terms.length);
    return { v, file, relevance, score: relevance * 3 + (file.height >= 1920 ? 1 : 0) };
  })
  .filter(Boolean)
  .sort((a, b) => b.score - a.score);

const pick = ranked.find(c => !usedStockIds.has(c.v.id) && c.relevance >= 0.34);
if (!pick) return { success:false, error:`sem match relevante para "${query}"` };  // melhor nada que errado
usedStockIds.add(pick.v.id);
return { success:true, provider:'Pexels', videoUrl: pick.file.link,
         width: pick.file.width, height: pick.file.height, duration: pick.v.duration,
         license:'Pexels License', attribution:`Video by ${pick.v.user?.name} (${pick.v.url})` };
```
Persistir `attribution` no manifest do run para a descrição do vídeo.

---

### `stock-pixabay-sem-orientacao` — Busca no Pixabay não filtra orientação vertical: clipes 16:9 sofrem crop 9:16 que destrói ~70% do enquadramento

**Severidade:** ALTO · **Esforço:** small · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/stock_video_connector.js:93`

**Evidência**

const url = `https://pixabay.com/api/videos/?key=${effectiveKey}&q=${cleanQuery}&video_type=all&per_page=5`;  — sem nenhum filtro de proporção, enquanto o ramo do Pexels (linha 39) usa orientation=portrait. O clipe resultante vai para formatStockClipToExactDuration:165 com `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920`.

**Causa-raiz**

A API do Pixabay Video não oferece parâmetro de orientação, e o código não compensou isso com um filtro client-side sobre candidate.width/height — que ele até recebe e retorna, mas nunca usa para decidir.

**Impacto no vídeo final**

Um clipe 1920x1080 escalado por 'increase' até cobrir 1080x1920 vira 3413x1920, e o crop central descarta 68% da largura. O sujeito enquadrado no terço esquerdo simplesmente desaparece, e o que sobra é um zoom digital de 1.78x sobre material já comprimido. Some-se isso ao fato de que o Pixabay é o fallback (roda quando o Pexels falha) e a probabilidade de cena arruinada é alta.

**Correção**

Filtrar por proporção no cliente, aceitando vertical ou quadrado, e rejeitando landscape puro:
```js
const verticalish = (data.hits || []).flatMap(hit =>
  Object.entries(hit.videos || {})
    .map(([q, v]) => ({ hit, q, ...v }))
    .filter(v => v.width && v.height && v.height / v.width >= 1.2 && v.width >= 720)
).sort((a, b) => b.height - a.height);
if (!verticalish.length) return { success:false, error:'Pixabay sem material vertical para esta query' };
```
Se nada vertical existir, é preferível falhar para o tier de imagem 2K do que entregar um crop destrutivo.

---

### `sem-cache-de-assets` — Zero cache de assets entre runs: cada execução re-gera e re-paga todas as cenas do zero

**Severidade:** ALTO · **Esforço:** medium · **Categoria:** cost  
**Arquivo:** `pipeline/src/ai_image_connector.js:176`

**Evidência**

grep -rn "cache" pipeline/src/*.js retorna ZERO ocorrências em todo o diretório. Todo asset é escrito em pipeline/scratch/run_<timestamp>_N/ e nunca reutilizado — há 5+ diretórios run_* com os mesmos scene_N_generated.jpg regerados. Os timestamps de pipeline/scratch/run_1789132969254_1 mostram 10:23 → 10:30 para 9 cenas, ~50-60s por cena, mais o sleep fixo de 1.2s em visuals_harvester.js:517.

**Causa-raiz**

Nenhuma camada de conteúdo endereçável. A identidade de um asset (prompt + seed + modelo + aspecto + tamanho) é perfeitamente determinística e cacheável, mas o diretório de saída é indexado por timestamp de run, garantindo miss em 100% dos casos.

**Impacto no vídeo final**

Custo: com a cascata correta (US$0,03/img × 8 + US$0,13 hook ≈ US$0,37/vídeo), cada re-render por ajuste de legenda, de música ou de corte paga a conta inteira de novo. Latência: ~8 minutos de geração visual por iteração, o que desincentiva iterar — e é justamente a iteração que corrigiria os problemas de qualidade deste projeto. Também impede o padrão mais valioso: regenerar APENAS as cenas reprovadas pelo gate.

**Correção**

Cache content-addressed com sidecar de qualidade, e negative-cache para não repetir gerações reprovadas:
```js
// pipeline/src/asset_cache.js
import crypto from 'crypto';
const ROOT = path.resolve('pipeline/.cache/assets');

export const cacheKey = ({ kind, model, prompt, seed, aspect, size }) =>
  crypto.createHash('sha256').update([kind, model, prompt, seed, aspect, size].join('|'))
        .digest('hex').slice(0, 32);

export function cacheGet(key, ext = 'jpg') {
  const p = path.join(ROOT, `${key}.${ext}`), m = path.join(ROOT, `${key}.json`);
  if (!fs.existsSync(p) || !fs.existsSync(m)) return null;
  const meta = JSON.parse(fs.readFileSync(m, 'utf8'));
  if (!meta.grade?.ok) return null;          // nunca reusar asset reprovado
  return { path: p, meta };
}

export function cachePut(key, srcPath, grade, ext = 'jpg') {
  fs.mkdirSync(ROOT, { recursive: true });
  const p = path.join(ROOT, `${key}.${ext}`);
  fs.copyFileSync(srcPath, p);
  fs.writeFileSync(path.join(ROOT, `${key}.json`),
    JSON.stringify({ grade, createdAt: Date.now(), src: path.basename(srcPath) }));
  return p;
}
```
No harvester, linkar/copiar do cache para scratchDir em vez de gerar. Adicionar `--no-cache` para forçar regeneração e um TTL de 30 dias na limpeza.

---

### `veo-provider-label-mentiroso` — O conector reporta 'Google Veo 2 (veo-2.0-generate-001)' enquanto chama veo-3.1-fast-generate-preview

**Severidade:** MÉDIO · **Esforço:** trivial · **Categoria:** config-drift  
**Arquivo:** `pipeline/src/ai_video_connector.js:119`

**Evidência**

URL na linha 58: `...models/veo-3.1-fast-generate-preview:predictLongRunning...`. Strings de provider nas linhas 119, 160 e 175: 'Google Veo 2 (veo-2.0-generate-001)'. Logs nas linhas 84 e 130: '[Google Veo 2]'. O JSDoc da linha 22 diz 'Google Veo 2/3.1'.

**Causa-raiz**

Migração parcial de modelo: a URL foi atualizada para 3.1 e os rótulos de telemetria/log ficaram em 2.0. Mesmo padrão do conector de imagem, que declara 'Pollinations AI (Flux HD 1080p)' para um arquivo 576x1024.

**Impacto no vídeo final**

Não degrada pixels diretamente, mas torna o diagnóstico impossível: o log do run, o manifest e qualquer métrica de custo atribuem a geração ao modelo errado. Foi exatamente essa classe de rótulo-mentiroso que escondeu por semanas que o vídeo saía em 576x1024.

**Correção**

Derivar o rótulo do model id em uso, nunca hardcodar: `const MODEL = process.env.VEO_MODEL || 'veo-3.1-fast-generate-preview'; const provider = `Google ${MODEL}`;` e usar essa constante na URL, nos logs e nos três returns. Idem para o conector de imagem: `provider: `${tier.id} ${meta.width}x${meta.height}``.

---

### `veo-image-to-video-nunca-usado` — O caminho image-to-video do Veo está implementado mas nunca é acionado, e o payload de imagem omite mimeType

**Severidade:** MÉDIO · **Esforço:** small · **Categoria:** arch  
**Arquivo:** `pipeline/src/ai_video_connector.js:66`

**Evidência**

instance.image = { bytesBase64Encoded: imgBuffer.toString('base64') };  — sem mimeType. E em visuals_harvester.js:455-462, generateCinematicTake é chamado com { prompt, durationSeconds, outputPath, visualMode, isHookScene, apiKey } — inputImagePath nunca é passado, então inputImagePath é sempre null.

**Causa-raiz**

A funcionalidade foi construída de baixo para cima e nunca conectada no orquestrador. Além disso o ordenamento do harvester tenta vídeo ANTES de gerar a imagem da cena, então não haveria imagem disponível para animar mesmo se fosse passada.

**Impacto no vídeo final**

Perde-se o único mecanismo que daria coerência visual entre o gancho em vídeo e o resto do vídeo em imagens: animar a imagem 2K já aprovada pelo gate produz movimento real mantendo exatamente a mesma composição e paleta. Em text-to-video puro o gancho fica esteticamente descolado das cenas seguintes.

**Correção**

Inverter a ordem no harvester: gerar e APROVAR a imagem da cena 1 pelo gate, e só então oferecê-la ao Veo como base de animação:
```js
// visuals_harvester.js, cena 0
const hookImg = await generateHighQualitySceneImage({ ...task, outputPath: sceneImgPath });
if (hookImg && visualMode !== 'image') {
  const take = await generateCinematicTake({
    prompt: scenePrompt, inputImagePath: hookImg.outputPath,
    durationSeconds: scene.duration, outputPath: clipPath, visualMode, isHookScene: true, apiKey });
  ...
}
```
E completar o payload: `instance.image = { bytesBase64Encoded: buf.toString('base64'), mimeType: 'image/jpeg' };` (o campo é obrigatório na API).

---

### `stock-download-sem-limite` — downloadRemoteFile baixa em memória sem timeout, sem limite de tamanho e sem checagem de content-type

**Severidade:** MÉDIO · **Esforço:** small · **Categoria:** bug  
**Arquivo:** `pipeline/src/stock_video_connector.js:129`

**Evidência**

export async function downloadRemoteFile(url, tempPath) { const res = await fetch(url); if (!res.ok) throw new Error(...); const buffer = Buffer.from(await res.arrayBuffer()); fs.writeFileSync(tempPath, buffer); return tempPath; }

**Causa-raiz**

arrayBuffer() materializa o arquivo inteiro em heap antes de gravar. Sem AbortController, sem Content-Length guard, sem validação de que o corpo é vídeo. O Pexels serve arquivos 4K de 50-200MB para clipes longos — e a seleção atual (ver `stock-selecao-primeiro-hit`) pode escolher justamente um deles.

**Impacto no vídeo final**

Um clipe de 3 segundos pode custar 150MB de download e um pico de heap equivalente, travando ou derrubando o processo Node no meio do run (perdendo todo o trabalho já pago dos tiers anteriores). Um servidor pendurado congela o job sem timeout algum.

**Correção**

Stream para disco com teto e timeout:
```js
export async function downloadRemoteFile(url, tempPath, { maxBytes = 60e6, timeoutMs = 60000 } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (!/^video\//i.test(ct)) throw new Error(`content-type inesperado: ${ct}`);
    const len = Number(res.headers.get('content-length') || 0);
    if (len > maxBytes) throw new Error(`arquivo grande demais: ${(len/1e6).toFixed(1)}MB`);
    const out = fs.createWriteStream(tempPath);
    let seen = 0;
    for await (const chunk of res.body) {
      seen += chunk.length;
      if (seen > maxBytes) { out.destroy(); throw new Error('excedeu maxBytes durante o stream'); }
      out.write(chunk);
    }
    await new Promise(r => out.end(r));
    return tempPath;
  } finally { clearTimeout(t); }
}
```

---

### `chave-em-query-string-e-env-relativo` — API key trafega na query string (e vaza em log de erro), e o .env é carregado por caminho relativo dependente do cwd

**Severidade:** MÉDIO · **Esforço:** trivial · **Categoria:** config-drift  
**Arquivo:** `pipeline/src/ai_image_connector.js:31`

**Evidência**

URL: `...:predict?key=${effectiveKey}` E header 'x-goog-api-key': effectiveKey — autenticação duplicada, com a chave na URL. Mesmo padrão em ai_video_connector.js:58 e no pollUrl da linha 138. Carregamento de env (repetido nos 3 conectores): `if (typeof process.loadEnvFile === 'function' && fs.existsSync('.env')) process.loadEnvFile('.env');` — caminho relativo, e AiPipelineService.java também resolve 'pipeline/config/channels' relativo ao cwd do processo Java.

**Causa-raiz**

A chave na URL é legado de exemplos de curl do Google AI Studio; combinada com o header, é redundante. E `fs.existsSync('.env')` resolve contra process.cwd(), que depende de onde o Java (ou o Docker) inicia o Node — não do local do módulo.

**Impacto no vídeo final**

(a) A chave aparece em qualquer log de rede, proxy corporativo ou mensagem de erro que ecoe a URL — risco real de vazamento de credencial. (b) Se o processo Node for iniciado de um cwd diferente da raiz do repo, .env não carrega, GEMINI_API_KEY fica undefined, e a cascata degrada silenciosamente para Pollinations sem uma única linha de erro — exatamente o modo de falha mais caro deste projeto, porque é invisível.

**Correção**

(a) Remover `?key=` de todas as URLs; manter só `'x-goog-api-key'` no header (inclusive no pollUrl do Veo). Sanitizar mensagens de erro: `errDetail.replace(/key=[^&\s]+/g, 'key=***')`.
(b) Resolver o .env a partir da raiz do módulo, uma única vez, em um módulo compartilhado:
```js
// pipeline/src/env.js
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ENV = path.join(ROOT, '.env');
if (typeof process.loadEnvFile === 'function' && fs.existsSync(ENV)) process.loadEnvFile(ENV);
else console.warn(`[env] .env NAO encontrado em ${ENV} — tiers pagos serao pulados`);
export { ROOT };
```
Importar esse módulo nos três conectores em vez de repetir o try/catch silencioso.

---

## Roteiro/Copy (script_generator, youtube_analyzer, metadados e prompt de IA)

22 achados.

### `free-topic-texto-fixo` — Topico livre gera SEMPRE o mesmo texto fixo: zero IA, zero especificidade

**Severidade:** CRÍTICO · **Esforço:** medium · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/script_generator.js:139`

**Evidência**

Linhas 139-181: `const hook = 'Se você busca dominar ${topic.slice(0,35)} com verdadeira maestria...'` + core1/core2/hack/cta 100% hardcoded. Prova executada: topic='O Poder do Silencio e da Calma Interior' e topic='Como Ganhar Dinheiro com Trading de Criptomoedas' produzem narracao IDENTICA exceto pelas 35 primeiras letras do topico interpoladas no hook. O manifesto real pipeline/output/run_1789161687124_1/POST-AUTO-1789162230042_manifest.json confirma que foi esse texto que virou video publicavel. Nenhuma chamada de LLM existe nesse caminho — generateThematicScenes (linha 170) so gera PROMPTS VISUAIS, nunca o texto narrado.

**Causa-raiz**

O caminho `--topic` nunca foi implementado com IA. O SDD (docs/SDD_Pipeline_Conteudo_IA_v2.md, Passo 3, linha 260) prometia 'Atualizar script_generator.js para permitir geração de roteiros a partir de temas livres usando o Gemini' — a funcao analyzeTranscriptWithGemini existe mas so e chamada por analyzeAndAdaptYouTubeVideo (linha 260 do youtube_analyzer.js).

**Impacto no vídeo final**

O espectador ouve uma locucao de 62s de vagueza absoluta ('a maioria das pessoas falha constantemente', 'aja com firmeza serena') que nao ensina nada, nao tem dado, nome, numero nem mecanismo. Retencao despenca no segundo 5 porque o hook nao promete payload. Pior: se o canal publicar 10 videos de 10 topicos diferentes, o YouTube/TikTok vera 10 audios quase identicos -> deteccao de conteudo repetitivo/spam e desmonetizacao.

**Correção**

Extrair de youtube_analyzer.js uma funcao pura `generateScriptWithGemini({ theme, transcriptText=null, channelProfile, visualDirective, apiKey })` e chama-la no caminho de topico livre ANTES do template. O template fixo vira contingencia Nivel 4 (matriz do SDD secao 5) e passa a ser marcado `degraded: true` no retorno.

```js
// script_generator.js, substituir o bloco 139-181
if (topic && !hasExactCatalogMatch) {
  const ai = await generateScriptWithGemini({
    theme: topic,
    transcriptText: null,
    channelProfile: channel,
    visualDirective,
    apiKey: geminiKey || process.env.GEMINI_API_KEY
  });
  if (ai) return buildScriptPayload({ ai, channel, topic, visualDirective, geminiKey, degraded: false });
  console.warn('[Script] Gemini indisponivel — usando template de contingencia (roteiro GENERICO).');
  return buildScriptPayload({ ai: buildTemplateFallback(topic, channel), channel, topic, degraded: true });
}
```
E em run_pipeline.js abortar (ou exigir `--allow-generic`) quando `scriptData.degraded === true`, para que texto generico nunca chegue a renderizacao sem decisao humana explicita.

---

### `topic-slice-35-palavra-cortada` — topic.slice(0,35) corta o topico no meio da palavra e a voz NARRA a palavra quebrada

**Severidade:** CRÍTICO · **Esforço:** trivial · **Categoria:** bug  
**Arquivo:** `pipeline/src/script_generator.js:141`

**Evidência**

Linha 141: `const hook = \`Se você busca dominar ${topic.slice(0, 35)} com verdadeira maestria...\``. Para topic='O Poder do Silêncio e da Calma Interior', slice(0,35) = 'O Poder do Silêncio e da Calma Inte'. Prova no artefato real pipeline/scratch/run_1789161687124_1/subtitles.srt, cue 3: `00:00:02,550 --> 00:00:03,240 / E DA CALMA INTE`. O TTS pronunciou literalmente 'inte'. Mesma falha na linha 140 (`topic.slice(0,50)` no titulo).

**Causa-raiz**

Truncamento por caracteres em vez de palavras. A funcao `truncateWords(text, maxLength)` que resolve exatamente isso JA EXISTE e esta exportada em pipeline/src/youtube_analyzer.js:80, mas nunca foi importada em script_generator.js.

**Impacto no vídeo final**

Nos primeiros 3 SEGUNDOS do video — a janela que decide a retencao inteira — o narrador diz uma palavra inexistente e a legenda karaoke exibe 'E DA CALMA INTE'. O espectador percebe imediatamente que e conteudo automatizado de baixa qualidade e desliza. Tambem envenena o titulo (slice(0,50)) e portanto o CTR.

**Correção**

Importar e usar truncateWords, e nunca truncar o topico dentro da narracao (o topico deve ser reescrito pela IA, nao interpolado cru):
```js
import { truncateWords } from './youtube_analyzer.js';
const safeTopic = truncateWords(topic, 60);           // titulo
const spokenTopic = truncateWords(topic, 45);         // narracao
```
Adicionar guarda de sanidade pos-geracao, rodando sobre `narrationText` antes do TTS:
```js
function assertNoTruncatedWords(text, sourceTerms) {
  for (const t of sourceTerms) {
    const last = t.trim().split(/\s+/).pop();
    if (last.length >= 3 && !new RegExp(`\\b${last}\\b`, 'i').test(text) && text.includes(last.slice(0, 3)))
      throw new Error(`[Script] Palavra truncada detectada perto de "${last}"`);
  }
}
```

---

### `catalogo-4-roteiros-modulo` — Catalogo de 4 roteiros com modulo por scriptIndex: lote de N videos repete o MESMO roteiro

**Severidade:** CRÍTICO · **Esforço:** medium · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/script_generator.js:128`

**Evidência**

Linhas 128-135: `const idx = Math.abs(scriptIndex) % matchingChannelScripts.length; selectedScript = matchingChannelScripts[idx];`. VALIDATED_SCRIPTS_CATALOG (linhas 8-65) tem 4 itens: 2 de psicosegredo, 1 de estoicismo, 1 de financas. Execucao real: `generateScript({channelId:'psicosegredo', scriptIndex: 0..3})` devolveu script-01, script-02, script-01, script-02 — ciclo de periodo 2. Para estoicismo e financas o periodo e 1 (SEMPRE o mesmo roteiro). run_pipeline.js:258-261 incrementa scriptIndex por lote (`scriptIndex: (options.scriptIndex||0) + b`), entao `--batch 4 --channel estoicismo` renderiza 4 videos com narracao byte-a-byte identica.

**Causa-raiz**

O catalogo e um placeholder de demo que virou fonte de producao. Nao ha geracao, nao ha estado persistido de 'o que ja foi publicado', e o modulo garante colisao assim que batch > numero de scripts do canal.

**Impacto no vídeo final**

Quatro videos identicos agendados para 4 dias seguidos (publisher_ingestor.js:33-38 agenda batchIndex>0 nos dias seguintes as 18h). O algoritmo trata como reupload/spam: alcance zerado, canal sob risco de strike de conteudo repetitivo, e a audiencia que ver dois deles perde a confianca no canal.

**Correção**

1) Remover o modulo e falhar alto quando nao ha roteiro inedito:
```js
const pool = VALIDATED_SCRIPTS_CATALOG.filter(s => s.channelId === channelId);
const used = loadUsedLedger(channelId);            // JSON em pipeline/state/used_scripts.json
const fresh = pool.filter(s => !used.includes(s.id));
if (fresh.length === 0) {
  // catalogo esgotado -> OBRIGA geracao por IA, nunca repete
  return await generateScriptWithGemini({ theme: topic || channel.niche, channelProfile: channel, apiKey: geminiKey });
}
selectedScript = fresh[Math.abs(scriptIndex) % fresh.length];
appendUsedLedger(channelId, selectedScript.id);
```
2) Em run_pipeline.js, para `--batch N`, derivar N TEMAS distintos por IA (uma chamada que retorna `{themes:[...]}`) em vez de incrementar um indice numerico.

---

### `geminikey-nao-repassada` — run_pipeline nao repassa geminiKey para generateScript: --gemini-key e silenciosamente ignorado

**Severidade:** CRÍTICO · **Esforço:** trivial · **Categoria:** config-drift  
**Arquivo:** `pipeline/src/run_pipeline.js:86`

**Evidência**

Linhas 86-92: `await generateScript({ channelId, topic, scriptIndex, sourceUrl, visualDirective })` — sem `geminiKey`, embora `effectiveGeminiKey` tenha sido calculado na linha 67 e seja passado corretamente para harvestVisualScenes (linha 158). generateScript declara o parametro (script_generator.js:108) e o encaminha para analyzeAndAdaptYouTubeVideo (linha 114) e generateThematicScenes (linhas 170 e 207). Sem ele, `apiKey` chega null; analyzeTranscriptWithGemini (youtube_analyzer.js:150) salva-se pelo `|| process.env.GEMINI_API_KEY`, mas quem usa `--gemini-key` na CLI sem .env fica sem IA e sem aviso.

**Causa-raiz**

Parametro adicionado na assinatura de generateScript sem atualizar o unico call site do orquestrador. O fallback por env var mascara o defeito em dev (onde existe .env) e o expoe em CI/Docker/Java (AiPipelineService) onde a chave vem por argumento.

**Impacto no vídeo final**

Em qualquer ambiente que passe a chave por CLI (o caminho usado pelo bridge Java), o roteiro cai no fallback heuristico canned e os prompts visuais caem na heuristica — o video sai com texto generico e visual generico simultaneamente, sem UM unico log dizendo que a IA nao foi usada.

**Correção**

```js
// run_pipeline.js:86
const scriptData = await generateScript({
  channelId: options.channel,
  topic: options.topic,
  scriptIndex: options.scriptIndex,
  sourceUrl: options.sourceUrl,
  visualDirective: options.visualDirective,
  geminiKey: effectiveGeminiKey            // <-- faltava
});
if (!effectiveGeminiKey) console.warn('[Pipeline] SEM GEMINI_API_KEY: roteiro sera TEMPLATE, nao IA.');
console.log(`[Pipeline] Roteiro via: ${scriptData.generator || 'desconhecido'}`);
```
E marcar a origem no payload (`generator: 'gemini' | 'heuristic' | 'catalog' | 'template'`) para que o log da linha 94-96 pare de mentir por omissao.

---

### `gemini-timeout-9500-sempre-aborta` — Timeout de 9.5s aborta 100% das chamadas Gemini (latencia real medida: 12.5s a 14.2s)

**Severidade:** CRÍTICO · **Esforço:** small · **Categoria:** bug  
**Arquivo:** `pipeline/src/youtube_analyzer.js:194`

**Evidência**

Linha 193-194: `const controller = new AbortController(); const timeoutId = setTimeout(() => controller.abort(), 9500);`. Medicao real hoje contra gemini-flash-lite-latest com o systemInstruction e generationConfig EXATOS do codigo: run0=14204ms, run1=13889ms, run2=12500ms (3/3 acima de 9500ms, finishReason=STOP em todos, saida valida). O AbortError cai no catch da linha 228 que faz `return null` mudo, e analyzeAndAdaptYouTubeVideo:282 desce para extractConceptualSummary.

**Causa-raiz**

O timeout foi calibrado para uma resposta curta, mas o prompt pede roteiro de 160-180 palavras MAIS 7-10 cenas com ai_prompt cinematografico longo — ~1200-1300 tokens de saida. gemini-flash-lite gera isso em ~13s. O SDD (linha 132) fala em 'timeout de 8 segundos', ou seja o numero nasceu errado no design.

**Impacto no vídeo final**

A unica rota de IA de roteiro do projeto NUNCA entrega. Todo video de `--url` sai com o texto canned de extractConceptualSummary — que e o mesmo paragrafo de neurociencia para qualquer video de YouTube que o usuario mandar. E o log da linha 275 nunca imprime o '✓ sintetizados com sucesso', mas o da linha 259 imprime 'Analisando com IA generativa', dando falsa sensacao de que funcionou.

**Correção**

Elevar o timeout, separar a chamada em duas (roteiro / cenas) para caber na janela, e logar a causa do abort:
```js
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 45000);
const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
...
} catch (err) {
  clearTimeout(timeoutId);
  console.warn(`[Gemini] FALHA (${err.name}: ${err.message}) apos ${Date.now()-t0}ms — caindo para heuristica`);
  return null;
}
```
Adicionalmente: dividir em `generateNarration()` (~350 tokens, ~4s) e `generateVisualScenes(narration)` (~900 tokens, ~9s). Duas chamadas rapidas sao mais resilientes e permitem validar o roteiro antes de gastar tokens nas cenas.

---

### `duracao-alvo-nao-verificada` — Duracao estimada com wpm errado e mascarada por Math.max(62): rewardsEligible mente

**Severidade:** CRÍTICO · **Esforço:** small · **Categoria:** bug  
**Arquivo:** `pipeline/src/youtube_analyzer.js:301`

**Evidência**

youtube_analyzer.js:301 `const estimatedDurationSeconds = Math.max(62, Math.round((wordCount / 140) * 60));` e :363 `rewardsEligible: estimatedDurationSeconds >= 60`. O `Math.max(62, ...)` torna rewardsEligible SEMPRE true — matematicamente impossivel ser false. Com o roteiro de 130 palavras medido, a formula da 56s, o Math.max reporta 62s, e o audio real a ~154 wpm sai ~51s. Em script_generator.js:162 e :199 a constante e 135 wpm, inconsistente com os 140 do analyzer. Aferição empirica: run_1789161687124_1 tem 160 palavras e o subtitles.srt termina em 00:01:02,070 => 154.6 wpm reais (com voice_profile.rate '-4%'), nao 135. Erro de +14% na estimativa. Nada no pipeline compara `voiceResult.durationSeconds` (run_pipeline.js:113, valor REAL) com o alvo — o numero real e obtido e descartado.

**Causa-raiz**

Tres constantes wpm divergentes (135, 140, e o 135 do channel config `script_profile.words_per_minute` que ninguem le), nenhuma calibrada contra o TTS real, e um `Math.max` colocado para 'garantir' elegibilidade que na verdade so falsifica o relatorio. O `rate` do voice_profile (-4% em psicosegredo, +4% em curiosidades) nem entra na conta.

**Impacto no vídeo final**

Videos abaixo de 60s sao renderizados, ingeridos e agendados com o selo 'Elegivel TikTok Rewards: SIM' (run_pipeline.js:235) — e rejeitados pela plataforma. O objetivo central do produto (SDD linha 21, 40) falha silenciosamente e o operador so descobre no painel do TikTok.

**Correção**

1) wpm unico, derivado do perfil do canal e corrigido pelo rate do TTS:
```js
function effectiveWpm(channelProfile) {
  const base = channelProfile.script_profile?.words_per_minute || 154;
  const rate = parseFloat(String(channelProfile.voice_profile?.rate || '+0%').replace('%','')) / 100;
  return base * (1 + rate);
}
```
2) Nunca usar Math.max para mascarar:
```js
const estimatedDurationSeconds = Number(((wordCount / wpm) * 60).toFixed(1));
const rewardsEligible = estimatedDurationSeconds >= 60;   // agora pode ser false
```
3) Gate duro no orquestrador, apos o TTS real (run_pipeline.js, logo depois da linha 113):
```js
const real = Number(voiceResult.durationSeconds);
if (real < 60.5) {
  const faltam = Math.ceil(((60.5 - real) / 60) * effectiveWpm(channelProfile));
  throw new Error(`[Pipeline] Audio de ${real}s < 60s. Regenere o roteiro com +${faltam} palavras no scientific_core antes de renderizar.`);
}
if (Math.abs(real - scriptData.estimatedDurationSeconds) > 5)
  console.warn(`[Calibracao] wpm desatualizado: estimado ${scriptData.estimatedDurationSeconds}s vs real ${real}s`);
```

---

### `extract-conceptual-ignora-transcricao` — extractConceptualSummary descarta a transcricao inteira: 4 textos canned selecionados por substring

**Severidade:** CRÍTICO · **Esforço:** large · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/youtube_analyzer.js:90`

**Evidência**

Linhas 90-137. `transcriptText` e usado APENAS para `combined.includes(...)` em 4 flags booleanas (isKahneman, isDecision, isDopamine, isStoic, linhas 93-96). Os 4 ramos (98, 108, 118, 128) retornam paragrafos 100% hardcoded; no fallback generico (linhas 129-136) so o TITULO entra, via `truncateWords(baseTitle, 40)` — o conteudo do video de origem nao influencia uma unica palavra. Como o Gemini nunca completa dentro do timeout de 9.5s (ver achado gemini-timeout), ESTA e a funcao que produz o roteiro de todo `--url` na pratica. Risco adicional: o ramo isKahneman dispara com `combined.includes('decis') && combined.includes('livro')` e injeta afirmacoes sobre 'Rápido e Devagar de Daniel Kahneman', Sistema 1 e Sistema 2 em um video que pode nao ter nada a ver — atribuicao falsa de autoria.

**Causa-raiz**

A heuristica era para ser Nivel 3 da matriz de fallback (SDD secao 5), mas virou o caminho de execucao real. Nunca houve extracao de conteudo: `extractKeyInsight` (linhas 387-405), a unica funcao que de fato le a transcricao, e CODIGO MORTO — nao ha nenhuma chamada a ela no repositorio.

**Impacto no vídeo final**

Repurpose de YouTube que nao reaproveita nada: qualquer video que o usuario mande vira o mesmo paragrafo sobre 'atalhos cognitivos' e 'poupar esforço mental'. O espectador que veio pelo tema nao encontra o tema. E, no pior caso, o canal publica uma atribuicao falsa a Daniel Kahneman — risco reputacional e de reivindicacao.

**Correção**

1) Tornar a heuristica realmente extrativa, usando a transcricao (e reaproveitando o extractKeyInsight morto):
```js
export function extractConceptualSummary(transcriptText, baseTitle, authorName, channelName) {
  if (!transcriptText || transcriptText.length < 200) {
    return { degraded: true, ...templateFallback(baseTitle, channelName) };
  }
  const sents = transcriptText.replace(/\s+/g,' ')
    .match(/[^.!?]+[.!?]+/g)?.map(s => s.trim()).filter(s => s.split(/\s+/).length >= 8) || [];
  const STOP = new Set(['que','para','com','uma','dos','das','nao','isso','você','voce','então','entao','mais','como','quando','porque']);
  const freq = {};
  for (const s of sents) for (const w of s.toLowerCase().match(/[a-zà-ú]{5,}/g) || []) if (!STOP.has(w)) freq[w] = (freq[w]||0)+1;
  const score = s => (s.toLowerCase().match(/[a-zà-ú]{5,}/g)||[]).reduce((a,w)=>a+(freq[w]||0),0) / Math.sqrt(s.split(/\s+/).length);
  const top = [...sents].sort((a,b)=>score(b)-score(a)).slice(0,6)
    .sort((a,b)=>sents.indexOf(a)-sents.indexOf(b));      // reordena cronologicamente
  return {
    degraded: false,
    hookText:    `${top[0]}`,
    scienceText: top.slice(1,4).join(' '),
    hackText:    top.slice(4).join(' '),
    ctaText:     `Siga ${channelName} para mais analises como esta.`,
    insight:     Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([w])=>w).join(', ')
  };
}
```
2) DELETAR os ramos isKahneman/isDopamine/isStoic (linhas 93-126) — nenhum conteudo factual deve ser injetado por substring.
3) Marcar `degraded: true` no retorno e bloquear renderizacao sem `--allow-generic`, igual ao achado free-topic-texto-fixo.

---

### `gemini-sem-retry-fallback-mudo` — Zero retry e fallback totalmente mudo: qualquer falha vira texto canned sem log

**Severidade:** ALTO · **Esforço:** small · **Categoria:** bug  
**Arquivo:** `pipeline/src/youtube_analyzer.js:216`

**Evidência**

Tres `return null` silenciosos: linha 216 (`if (!res.ok) return null` — descarta status e body, entao 429/500/503 sao indistinguiveis de 400), linha 220 (`if (!rawText) return null`), linha 224 (validacao de campos). E `catch { return null }` na linha 228-231, que engole AbortError, erro de rede e SyntaxError de JSON.parse (linha 222) no mesmo balde. Nenhum backoff, nenhuma segunda tentativa.

**Causa-raiz**

Politica de resiliencia 'fail-silent' em vez de 'fail-loud com retry'. A API do Gemini free tier retorna 429/503 transitorios com frequencia (comprovado nos probes de imagem que deram 429), e um unico 429 condena o video inteiro a texto canned.

**Impacto no vídeo final**

Um blip de rede de 200ms transforma um roteiro sob medida em um paragrafo generico de neurociencia — e ninguem descobre, porque o pipeline segue imprimindo '[6/6] CONCLUIDO COM SUCESSO'. O operador so descobre assistindo o video pronto.

**Correção**

```js
async function callGeminiWithRetry(url, body, { attempts = 3, timeoutMs = 45000 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json','x-goog-api-key':key}, body: JSON.stringify(body), signal: ctl.signal });
      clearTimeout(t);
      if (res.ok) return await res.json();
      const txt = await res.text();
      lastErr = new Error(`HTTP ${res.status}: ${txt.slice(0,300)}`);
      if (![429, 500, 502, 503, 504].includes(res.status)) break;  // 4xx definitivo nao adianta repetir
    } catch (e) { clearTimeout(t); lastErr = e; }
    const wait = 1200 * 2 ** i + Math.random() * 400;               // backoff exponencial + jitter
    console.warn(`[Gemini] tentativa ${i+1}/${attempts} falhou (${lastErr.message}); retry em ${Math.round(wait)}ms`);
    await new Promise(r => setTimeout(r, wait));
  }
  console.error('[Gemini] TODAS as tentativas falharam:', lastErr?.message);
  return null;
}
```

---

### `maxoutputtokens-1400-estoura` — maxOutputTokens=1400 nao comporta roteiro completo + 8-10 cenas: trunca o JSON e derruba o parse

**Severidade:** ALTO · **Esforço:** trivial · **Categoria:** bug  
**Arquivo:** `pipeline/src/youtube_analyzer.js:209`

**Evidência**

Linha 207-211: `generationConfig: { temperature: 0.35, maxOutputTokens: 1400, responseMimeType: 'application/json' }`. Medicao real: candidatesTokenCount=1186, 1289, 1303 com 7-8 cenas e apenas 112-136 palavras de narracao (o modelo SUBENTREGOU). Com visualDirective ativa e 10 cenas o consumo medido subiu para 1339 tokens = 95.6% do teto. Se o modelo OBEDECESSE as 160-180 palavras mandadas na linha 171 (+~80 tokens) com 10 cenas, o teto estoura -> finishReason=MAX_TOKENS -> JSON cortado no meio -> `JSON.parse(rawText)` (linha 222) lanca -> catch da linha 228 -> `return null` -> texto canned.

**Causa-raiz**

Orcamento de tokens dimensionado para o roteiro isolado, sem contar os 10 objetos de cena (cada um com phrase PT + ai_prompt cinematografico EN de ~45 palavras + stock_search_query + cinemagraph_fx ≈ 110-130 tokens). A margem real e de 4% a 15%.

**Impacto no vídeo final**

Falha nao-deterministica: em parte das execucoes o video sai com roteiro sob medida, em outra parte com o mesmo paragrafo canned — sem que nada no log diferencie. Quando trunca no meio das cenas, o pipeline tambem perde os prompts visuais contextuais e cai nas cenas heuristicas repetitivas.

**Correção**

Elevar o teto, tratar MAX_TOKENS explicitamente e fixar a contagem de cenas:
```js
generationConfig: {
  temperature: 0.8,
  topP: 0.95,
  maxOutputTokens: 4096,
  responseMimeType: 'application/json',
  responseSchema: SCRIPT_SCHEMA            // ver achado json-sem-schema-nem-validacao
}
...
const finish = data.candidates?.[0]?.finishReason;
if (finish === 'MAX_TOKENS') {
  console.warn('[Gemini] Resposta truncada por MAX_TOKENS — repetindo com menos cenas');
  return await analyzeTranscriptWithGemini({ ...args, sceneCount: 6 });
}
```

---

### `json-sem-schema-nem-validacao` — Saida do Gemini sem responseSchema, sem repair de JSON e com validacao que so checa presenca

**Severidade:** ALTO · **Esforço:** medium · **Categoria:** bug  
**Arquivo:** `pipeline/src/youtube_analyzer.js:222`

**Evidência**

Linha 222: `const parsed = JSON.parse(rawText);` cru, dentro do try generico. Linha 223-225 valida apenas `if (!parsed.hook || !parsed.scientific_core || !parsed.practical_hack || !parsed.cta) return null` — nao checa tipo, nao checa tamanho, nao checa visual_scenes, nao checa se hook tem 12-16 palavras nem se o total bate 160-180. O generationConfig (linha 207-211) usa responseMimeType JSON mas NAO passa responseSchema, entao o modelo e livre para renomear campos ou aninhar. Nenhuma tentativa de reparo (strip de cercas
```json
, corte no ultimo `}` balanceado).

**Causa-raiz**

Contrato implicito descrito em prosa no systemInstruction (linha 184-185) em vez de declarado como schema estruturado que a API sabe forcar. O SDD (linhas 113-131) ate desenha o JSON Schema, mas ele nunca foi codificado.

**Impacto no vídeo final**

Uma virgula extra, uma cerca de markdown ou um campo renomeado derruba toda a geracao para o texto canned. E, quando o parse passa, nada impede um hook de 40 palavras (destroi os 3s iniciais) ou um roteiro de 90 palavras (video de 35s, inelegivel ao Rewards) de ir direto para o TTS.

**Correção**

Declarar schema + repair + validacao semantica com regeneracao dirigida:
```js
const SCRIPT_SCHEMA = {
  type: 'object',
  properties: {
    title:           { type: 'string' },
    insight:         { type: 'string' },
    hook:            { type: 'string' },
    scientific_core: { type: 'string' },
    practical_hack:  { type: 'string' },
    cta:             { type: 'string' },
    visual_scenes: { type: 'array', minItems: 7, maxItems: 10, items: {
      type: 'object',
      properties: {
        phrase:             { type: 'string' },
        visual_intent:      { type: 'string' },
        suggested_type:     { type: 'string', enum: ['ai_image','stock_video','ai_video'] },
        stock_search_query: { type: 'string' },
        ai_prompt:          { type: 'string' },
        cinemagraph_fx:     { type: 'string', enum: ['fire_embers','fireflies','twinkling_stars','sunbeams_dust','anime_aura_sparks','none'] }
      },
      required: ['phrase','suggested_type','stock_search_query','ai_prompt','cinemagraph_fx']
    }}
  },
  required: ['title','insight','hook','scientific_core','practical_hack','cta','visual_scenes'],
  propertyOrdering: ['title','insight','hook','scientific_core','practical_hack','cta','visual_scenes']
};

function repairJson(raw) {
let t = String(raw).trim().replace(/^
```
(?:json)?/i, '').replace(/
```
$/, '').trim();
  const i = t.indexOf('{'); if (i > 0) t = t.slice(i);
  let depth = 0, end = -1, inStr = false, esc = false;
  for (let k = 0; k < t.length; k++) {
    const c = t[k];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) { end = k; break; }
  }
  return JSON.parse(end > 0 ? t.slice(0, end + 1) : t);
}

const W = s => String(s || '').trim().split(/\s+/).filter(Boolean).length;
export function validateScript(p, { wpm = 154, minSec = 63, maxSec = 75 } = {}) {
  const errs = [];
  if (W(p.hook) < 10 || W(p.hook) > 18)              errs.push(`hook tem ${W(p.hook)} palavras (esperado 10-18)`);
  if (W(p.scientific_core) < 80)                      errs.push(`scientific_core tem ${W(p.scientific_core)} (minimo 80)`);
  if (W(p.practical_hack) < 30)                       errs.push(`practical_hack tem ${W(p.practical_hack)} (minimo 30)`);
  if (W(p.cta) < 12)                                  errs.push(`cta tem ${W(p.cta)} (minimo 12)`);
  const total = W(p.hook) + W(p.scientific_core) + W(p.practical_hack) + W(p.cta);
  const sec = (total / wpm) * 60;
  if (sec < minSec || sec > maxSec)                   errs.push(`total ${total} palavras => ${sec.toFixed(1)}s (alvo ${minSec}-${maxSec}s). AJUSTE ${sec < minSec ? 'AUMENTANDO' : 'REDUZINDO'} ~${Math.abs(Math.round((sec-((minSec+maxSec)/2))*wpm/60))} palavras no scientific_core.`);
  if (!Array.isArray(p.visual_scenes) || p.visual_scenes.length < 6) errs.push('visual_scenes < 6');
  if (p.title && p.title.replace(/#Shorts/i,'').trim().length > 65)  errs.push('title > 65 chars');
  return { ok: errs.length === 0, errs, total, sec };
}
```
No loop de geracao: se `!ok`, reenviar o MESMO contexto acrescido de `CORRIJA EXATAMENTE ESTES ERROS: ${errs.join('; ')}` — ate 2 rodadas de repair, e so entao cair na heuristica.

```
---

### `prompt-sistema-contradicao-palavras` — System prompt se contradiz nas contagens de palavras e o modelo entrega 30% a menos que o pedido

**Severidade:** ALTO · **Esforço:** medium · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/youtube_analyzer.js:166`

**Evidência**

Linhas 166-171: a lista numerada pede 'hook (10 a 16 palavras)', 'scientific_core (75 a 90)', 'practical_hack (28 a 35)', 'cta (14 a 18)' — soma 127-159. Cinco linhas abaixo o mesmo prompt manda 'hook: 12-16, scientific_core: 85-95, practical_hack: 35-42, cta: 16-20' e 'TOTAL rigorosamente entre 160 e 180'. Dois contratos incompativeis no mesmo texto (127-159 vs 160-180). Resultado medido em 3 execucoes reais: 118, 136 e 130 palavras — 27% a 34% abaixo do total exigido, e abaixo ate do minimo da primeira lista.

**Causa-raiz**

Instrucao editada por acrescimo em vez de substituicao. Alem disso, LLMs nao contam palavras de forma confiavel por instrucao textual — a restricao precisa ser verificada em codigo e corrigida por reprompt, nao 'pedida com mais enfase'.

**Impacto no vídeo final**

130 palavras a ~154 wpm reais = ~51 segundos de audio. Abaixo do corte de 60s do TikTok Creator Rewards: o video sai INELEGIVEL para monetizacao, que e o objetivo declarado do projeto (SDD linha 21 e 40). E o scientific_core curto significa menos mecanismo explicado = menos valor percebido = menos retencao.

**Correção**

Reescrever o systemInstruction com UM unico contrato, alvos em CARACTERES (que o modelo respeita melhor) alem de palavras, e delegar a garantia ao validador:

```
Voce e Roteirista-Chefe de shorts virais em portugues do Brasil para o canal "${channelName}".
Nicho: ${niche}. Tom obrigatorio: ${tone}.

REGRAS DE CONTEUDO (nao negociaveis):
1. Fundamente cada afirmacao no material fornecido. PROIBIDO inventar estudo, autor, instituicao, percentual ou data que nao esteja na transcricao. Se o material nao trouxer numero, NAO cite numero.
2. PROIBIDAS as expressoes vazias: "a maioria das pessoas", "poucos sabem", "efeito composto", "firmeza serena", "calma interior", "passo a passo", "muito poderoso", "fascinante". Substitua sempre por o MECANISMO concreto (orgao, hormonio, acao observavel, consequencia mensuravel).
3. Cada bloco deve conter pelo menos um substantivo especifico e verificavel do tema (nome do mecanismo, do fenomeno, da estrutura cerebral, do numero).

ESTRUTURA (exatamente 4 campos de texto):
- hook: 12 a 16 palavras (70-110 caracteres). Abre com uma AFIRMACAO CONTRAINTUITIVA na 2a pessoa, sem saudacao e sem "voce sabia". Nao pode conter o titulo copiado.
- scientific_core: 92 a 104 palavras (560-650 caracteres). Explica o mecanismo em 3 movimentos: (a) o que acontece por dentro, (b) por que o cerebro/sistema faz isso, (c) o custo pratico disso na vida do espectador.
- practical_hack: 36 a 44 palavras (220-280 caracteres). Uma acao UNICA, executavel hoje, com gatilho ("quando X acontecer"), acao e duracao.
- cta: 16 a 20 palavras (95-130 caracteres). Fecha com loop aberto e convite para seguir ${channelName}.

ORCAMENTO DE DURACAO: a locucao roda a ${wpm} palavras/minuto. O total dos 4 blocos DEVE somar entre ${minWords} e ${maxWords} palavras para render ${minSec}-${maxSec} segundos de audio. Antes de responder, CONTE as palavras de cada bloco e ajuste o scientific_core ate a soma cair na faixa.

TITULO: maximo 65 caracteres incluindo " #Shorts". Deve conter uma lacuna de curiosidade ou um numero. NAO pode ser o tema copiado.

CENAS: exatamente ${sceneCount} objetos em visual_scenes, um por frase falada, na ordem da narracao.
- phrase: o trecho LITERAL e continuo da narracao acima (copia exata, sem parafrasear) — a soma das phrases deve reconstituir a narracao inteira.
- ai_prompt: ingles, 9:16 vertical. Cada cena com SUJEITO, ANGULO e CENARIO diferentes de todas as outras. Proibido repetir o mesmo sujeito duas vezes.
- cinemagraph_fx: um de fire_embers|fireflies|twinkling_stars|sunbeams_dust|anime_aura_sparks|none.
${visualDirective ? `DIRETRIZ VISUAL OBRIGATORIA em 100% dos ai_prompt: "${visualDirective}".` : ''}

EVITE REPETIR estas aberturas ja usadas neste canal: ${recentHooks.join(' | ')}.
```
Com `temperature: 0.8` e o validador do achado json-sem-schema-nem-validacao rodando em loop de ate 2 correcoes.

---

### `rewards-eligible-hardcoded-true` — rewardsEligible: true literal no caminho de topico livre

**Severidade:** ALTO · **Esforço:** trivial · **Categoria:** bug  
**Arquivo:** `pipeline/src/script_generator.js:163`

**Evidência**

Linha 163: `rewardsEligible: true,` — valor constante, sem nenhuma relacao com `estimatedDurationSeconds` calculado na linha imediatamente acima (162). Compare com a linha 200 do caminho de catalogo, que ao menos calcula `Math.round((wordCount / 135) * 60) >= 60`.

**Causa-raiz**

Copia-e-cola do objeto de retorno sem reavaliar o campo. Como o template fixo sempre da ~153-160 palavras, o autor assumiu que sempre passaria de 60s — mas com topicos de 1-2 palavras o total cai para ~154 palavras e, a 154 wpm reais, isso e exatamente 60.0s: na fronteira.

**Impacto no vídeo final**

Alimenta o mesmo relatorio falso do achado duracao-alvo-nao-verificada e e propagado ao backend via publisher_ingestor. Decisoes de agendamento e de plataforma sao tomadas sobre um booleano que nao foi computado.

**Correção**

```js
const estimatedDurationSeconds = Number(((wordCount / effectiveWpm(channel)) * 60).toFixed(1));
return {
  ...,
  estimatedDurationSeconds,
  rewardsEligible: estimatedDurationSeconds >= 60,
};
```

---

### `blocks-slice-caracteres` — blocks[] fatiado por offsets de caractere fixos (100/350/500): corta no meio da palavra e mapeia o bloco errado

**Severidade:** ALTO · **Esforço:** small · **Categoria:** bug  
**Arquivo:** `pipeline/src/script_generator.js:202`

**Evidência**

Linhas 202-205: `.slice(0,100)`, `.slice(100,350)`, `.slice(350,500)`, `.slice(500)`. Saida real do script-01: Gancho termina em '...nunca confronte a pessoa na h'; Foco Central comeca em 'ora. Existe um truque...'; Hack Pratico recebe 'é fascinante: o cérebro detesta o vácuo de informação...' (que e EXPLICACAO, nao hack); e o bloco 'CTA & Retenção (58-65s)' recebe 403 caracteres (script-01) e 433 (script-02) — metade do roteiro, incluindo todo o miolo cientifico. Os offsets sao os mesmos para todos os roteiros, de 146 a 151 palavras, com estruturas diferentes.

**Causa-raiz**

Segmentacao posicional sobre um texto de tamanho variavel, quando os limites reais dos blocos ja sao conhecidos (o catalogo tem `scenes[].phrase` e o Gemini retorna hook/core/hack/cta separados). A informacao estruturada existe e e jogada fora para ser re-derivada por corte cego.

**Impacto no vídeo final**

Em youtube_analyzer.js:365-368 os blocks sao usados para casar texto com `visualDescription` — com blocos errados, a cena do 'hack pratico' ilustra a explicacao cientifica e a cena do CTA ilustra o miolo. Contribui diretamente para o descompasso tema/visual observado no video final. E os blocks vao no payload de ingestao, poluindo qualquer revisao editorial downstream.

**Correção**

Guardar os blocos como campos de primeira classe no catalogo e nunca re-fatiar:
```js
// no catalogo, ao lado de narrationText:
blocks: { hook: '...', core: '...', hack: '...', cta: '...' }
// e no retorno:
blocks: [
  { title: 'Gancho (0-3s)',           text: s.blocks.hook },
  { title: 'Foco Central (3-45s)',    text: s.blocks.core },
  { title: 'Hack Prático (45-58s)',   text: s.blocks.hack },
  { title: 'CTA & Retenção (58-65s)', text: s.blocks.cta }
]
```
Para roteiros legados sem blocks, segmentar por SENTENCA e proporcao, nunca por caractere:
```js
function splitIntoBlocks(text) {
  const sents = text.match(/[^.!?]+[.!?]+/g)?.map(s => s.trim()) || [text];
  const w = s => s.split(/\s+/).length, total = sents.reduce((a,s)=>a+w(s),0);
  const cuts = [0.06, 0.70, 0.86], out = [[],[],[],[]];
  let acc = 0;
  for (const s of sents) { acc += w(s); const r = acc/total;
    out[r<=cuts[0]?0:r<=cuts[1]?1:r<=cuts[2]?2:3].push(s); }
  return out.map(a => a.join(' '));
}
```

---

### `catalogo-match-titulo-morto` — Match por titulo e sempre descartado pela guarda da linha 139 e ainda sequestra o match por topico

**Severidade:** ALTO · **Esforço:** small · **Categoria:** bug  
**Arquivo:** `pipeline/src/script_generator.js:139`

**Evidência**

Linha 121-124 aceita match por `s.topic` OU `s.title`. Linha 139 reavalia so `s.topic`: `if (topic && (!selectedScript || !selectedScript.topic.toLowerCase().includes(topic.toLowerCase())))` -> descarta o roteiro. Execucao real: `topic='O Erro Silencioso'` casa com o TITULO de script-04 ('O Erro Silencioso que Te Mantém Pobre') e devolve `scriptId: custom_...` com o texto generico. Pior: `topic='Dopamina'` casa PRIMEIRO com o TITULO de script-01 ('...e a Dopamina da Dúvida'), cujo topic e 'Linguagem Corporal & Silêncio' — a guarda falha e o roteiro script-02 ('Dopamina & Procrastinação'), que era o certo, nunca e alcancado. Verificado: devolveu custom_1789516433182.

**Causa-raiz**

Duas condicoes de match divergentes para a mesma decisao, avaliadas em pontos diferentes do fluxo, com o `find` retornando o PRIMEIRO match do array inteiro (sem filtro de canal, sem score).

**Impacto no vídeo final**

O catalogo curado — o unico conteudo de qualidade humana do sistema — e inalcancavel por busca de tema. O usuario pede 'Dopamina' e recebe o paragrafo generico sobre 'calma interior'. Todo pedido tematico degrada para o mesmo video.

**Correção**

Uma unica funcao de match com score, filtro de canal e limiar, e a guarda da linha 139 eliminada:
```js
function scoreMatch(script, topic) {
  const q = topic.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const hay = `${script.topic} ${script.title} ${script.narrationText.slice(0,300)}`.toLowerCase();
  return q.filter(w => hay.includes(w)).length / Math.max(1, q.length);
}
const best = VALIDATED_SCRIPTS_CATALOG
  .filter(s => s.channelId === channelId)                 // nunca cruzar marcas
  .map(s => ({ s, score: scoreMatch(s, topic) }))
  .sort((a,b) => b.score - a.score)[0];
const selectedScript = best && best.score >= 0.6 ? best.s : null;   // abaixo disso -> IA, nao template
```

---

### `zero-variacao-entre-execucoes` — temperature 0.35 sem seed, sem memoria de hooks usados: aberturas quase identicas a cada execucao

**Severidade:** ALTO · **Esforço:** medium · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/youtube_analyzer.js:208`

**Evidência**

Linha 208: `temperature: 0.35`. Tres execucoes consecutivas do MESMO prompt produziram hooks: 'Você não é apenas preguiçoso, seu cérebro está quimicamente...', 'Você não é apenas preguiçoso, seu cérebro foi sequestrado pe...', 'Você não é apenas preguiçoso, seu cérebro está literalmente...' — as 6 primeiras palavras sao IDENTICAS nas 3. Nao ha `topP`/`topK` configurados, nao ha seed, e nao existe nenhum registro persistido de titulos/hooks ja publicados (nao ha `pipeline/state/`, e o unico ledger do sistema e o nome do diretorio `run_<timestamp>`).

**Causa-raiz**

Temperatura baixa foi escolhida para estabilizar o JSON — mas a estabilidade de FORMATO deveria vir do responseSchema, nao de matar a diversidade de CONTEUDO. E nada alimenta o prompt com o que ja foi produzido.

**Impacto no vídeo final**

Os primeiros 3 segundos — o unico ativo que determina a retencao — sao praticamente os mesmos em todos os videos do canal. O feed do usuario mostra dois shorts do mesmo canal abrindo com a mesma frase e ele desliza nos dois. Em lote, o efeito e canal inteiro com uma unica voz repetida.

**Correção**

1) `temperature: 0.8, topP: 0.95` (a validacao de formato passa a ser feita pelo responseSchema + validateScript).
2) Ledger de anti-repeticao alimentando o prompt:
```js
// pipeline/src/script_history.js
const FILE = 'pipeline/state/script_history.json';
export function recentHooks(channelId, n = 12) {
  try { return (JSON.parse(fs.readFileSync(FILE,'utf8'))[channelId] || []).slice(-n).map(e => e.hook); }
  catch { return []; }
}
export function rememberScript(channelId, { hook, title, topic }) {
  let db = {}; try { db = JSON.parse(fs.readFileSync(FILE,'utf8')); } catch {}
  (db[channelId] ||= []).push({ hook, title, topic, at: new Date().toISOString() });
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}
```
3) Injetar no systemInstruction: `EVITE REPETIR estas aberturas ja usadas: ${recentHooks(channelId).join(' | ')}. Comece com uma construcao sintatica diferente de todas elas.`
4) Rejeitar em validateScript se `similaridade(hook, recentHooks) > 0.6` (trigram Jaccard) e reprompt.

---

### `titulo-generico-sem-ctr` — Titulo = topico ecoado + ' #Shorts': sem lacuna de curiosidade, sem numero, sem limite de 65 chars

**Severidade:** ALTO · **Esforço:** small · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/script_generator.js:140`

**Evidência**

script_generator.js:140 `const customTitle = \`${topic.slice(0,50)} #Shorts\`;` e youtube_analyzer.js:304 `const finalTitle = \`${truncateWords(baseTitle, 55)} #Shorts\`;`. Manifesto real publicado: `"title": "O Poder do Silêncio e da Calma Interior #Shorts"` — e a query do usuario, literalmente. No caminho Gemini, o campo `title` retornado pelo modelo e simplesmente IGNORADO: analyzeAndAdaptYouTubeVideo le hook/scientific_core/practical_hack/cta/insight/visual_scenes (linhas 276-281) mas nunca `aiScript.title`. O SDD (linha 116) especifica 'Título magnético com menos de 65 caracteres' e o codigo nao aplica limite nenhum nem verifica o teto de 100 chars do YouTube.

**Causa-raiz**

Titulo tratado como rotulo de arquivo e nao como o ativo de CTR que e. O unico titulo pensado para clique (o do Gemini) e descartado por esquecimento no destructuring.

**Impacto no vídeo final**

Zero motivo para clicar. No feed do Shorts o titulo aparece sobre o video e compete com milhares de outros — 'O Poder do Silêncio e da Calma Interior' nao promete payload, nao cria lacuna, nao tem numero nem tensao. CTR baixo -> menos impressoes -> o video morre independentemente da qualidade do resto.

**Correção**

1) Usar o titulo da IA (correcao de 1 linha em youtube_analyzer.js):
```js
const aiTitle = aiScript?.title?.trim();
const finalTitle = buildViralTitle(aiTitle || baseTitle);
```
2) Funcao de titulo com garantias mecanicas:
```js
function buildViralTitle(raw) {
  let t = truncateWords(String(raw).replace(/#shorts/ig, '').trim(), 58);
  if (!/\d/.test(t) && !/[?:]/.test(t)) t = `${t}?`;   // garante lacuna quando nao ha numero
  t = t.charAt(0).toUpperCase() + t.slice(1);
  const full = `${t} #Shorts`;
  if (full.length > 100) return `${truncateWords(t, 88)} #Shorts`;   // teto duro do YouTube
  return full;
}
```
3) Pedir 3 variantes de titulo a IA (`title_variants: string[3]` no schema) e escolher a mais curta que contenha numero ou interrogacao — base para futuro A/B.

---

### `descricao-hashtags-quebradas-utm-literal` — Descricao gera hashtags invalidas com espaco e publica o placeholder {platform} literal

**Severidade:** ALTO · **Esforço:** small · **Categoria:** bug  
**Arquivo:** `pipeline/src/script_generator.js:173`

**Evidência**

script_generator.js:173 e :188 e youtube_analyzer.js:305: `Tags: #${tags.slice(0,5).join(' #')}`. As default_tags de psicosegredo.json contem termos multi-palavra ('psicologia comportamental', 'inteligencia emocional'), entao a saida real do manifesto e `#neurociencia #psicologia comportamental #autodominio #dopamina #inteligencia emocional` — o YouTube interpreta como '#psicologia' seguida da palavra solta 'comportamental'. Alem disso o mesmo manifesto publica `https://meulink.com/psicosegredo?utm_source={platform}&utm_medium=shorts` com `{platform}` NAO substituido, apesar de `platform` ser conhecido em run_pipeline.js (linha 26) e em ingestGeneratedPost (publisher_ingestor.js:14).

**Causa-raiz**

Concatenacao de string sem normalizacao de hashtag e sem interpolacao do template de CTA. `description_template` foi projetado com placeholder mas nenhum ponto do pipeline faz o replace.

**Impacto no vídeo final**

Duas das cinco hashtags nao indexam (perda direta de descoberta na busca e nas paginas de hashtag). E o link publicado exibe `{platform}` cru para o espectador: sinal inequivoco de automacao malfeita, alem de perder toda a atribuicao de trafego por plataforma.

**Correção**

```js
const toHashtag = t => '#' + t.normalize('NFD').replace(/[\u0300-\u036f-\u0300-\u036f]/g,'')
  .replace(/[^a-zA-Z0-9\s]/g,'').trim().split(/\s+/)
  .map((w,i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase()+w.slice(1).toLowerCase())
  .join('');                                   // 'psicologia comportamental' -> '#psicologiaComportamental'

const renderCta = (tpl, platform) => String(tpl || '')
  .replace(/\{platform\}/g, String(platform || 'youtube_shorts').toLowerCase())
  .replace(/\{channel\}/g, channel.channel_id);
```
E passar `platform` para generateScript (hoje ele so existe no orquestrador e no ingestor). Descricao final com as 3 primeiras linhas carregando o gancho (unica parte visivel antes do 'mais'):
```js
const description = [
  hookText,                                              // linha 1 = gancho, nao o titulo repetido
  '',
  `Neste short: ${insight}.`,
  '',
  renderCta(ctaProfile.description_template, platform),
  '',
  tags.slice(0, 8).map(toHashtag).join(' ')
].join('\n');
```

---

### `script-profile-config-ignorado` — channel.script_profile (palavras-alvo, wpm, hook_formula, tone, structure) e totalmente ignorado

**Severidade:** ALTO · **Esforço:** medium · **Categoria:** config-drift  
**Arquivo:** `pipeline/src/script_generator.js:110`

**Evidência**

Todos os 5 JSONs em pipeline/config/channels/ definem `script_profile: { target_words_min: 145, target_words_max: 165, words_per_minute: 135, hook_formula: '...', tone: '...' }` e psicosegredo.json define ainda um array `structure` com 4 secoes e timings. Busca no codigo: `script_profile` aparece uma unica vez em todo o pipeline, em youtube_analyzer.js:155 (`channelProfile.script_profile?.tone`) — e apenas o `tone`. `target_words_min/max`, `words_per_minute`, `hook_formula` e `structure` nao sao lidos em lugar nenhum; script_generator.js hardcoda 135 (linhas 162 e 199) e o systemInstruction hardcoda 160-180 (linha 171), contradizendo os 145-165 do config.

**Causa-raiz**

Configuracao escrita como documentacao aspiracional, sem nenhum consumidor. Mesmo padrao de drift ja identificado em subtitles_style e audio_profile.

**Impacto no vídeo final**

Cada canal deveria ter voz propria — `hook_formula` de curiosidades e 'Existe um fato perturbador que a ciência ainda não consegue explicar', a de financas e 'O erro financeiro silencioso que drena seu patrimônio'. Nada disso chega ao prompt: todos os canais produzem o mesmo tipo de abertura de neurociencia. O portfolio inteiro soa como um canal so, e os alvos de duracao por canal nao existem na pratica.

**Correção**

Um resolvedor unico de perfil de roteiro, consumido por AMBOS os caminhos:
```js
export function resolveScriptProfile(channel) {
  const sp = channel.script_profile || {};
  const rate = parseFloat(String(channel.voice_profile?.rate || '+0%').replace('%','')) / 100;
  return {
    minWords: sp.target_words_min || 150,
    maxWords: sp.target_words_max || 175,
    wpm: (sp.words_per_minute || 154) * (1 + rate),
    hookFormula: sp.hook_formula || 'Afirmacao contraintuitiva na 2a pessoa',
    tone: sp.tone || 'Direto e confiante',
    structure: sp.structure || DEFAULT_STRUCTURE,
    targetDuration: channel.format?.target_duration_seconds || 68
  };
}
```
Injetar no systemInstruction: `FORMULA DE GANCHO OBRIGATORIA DESTE CANAL: "${p.hookFormula}". TOM: ${p.tone}. TOTAL: ${p.minWords}-${p.maxWords} palavras.` E usar `p.wpm` em toda estimativa de duracao (substituindo os 135/140/62 espalhados).

---

### `cta-marca-cruzada-catalogo` — CTA da marca fica embutido na narracao do catalogo: canal estoicismo narra 'Siga o Psicosegredo'

**Severidade:** MÉDIO · **Esforço:** small · **Categoria:** bug  
**Arquivo:** `pipeline/src/script_generator.js:14`

**Evidência**

O `narrationText` de cada item do catalogo termina com o CTA da marca dentro do proprio texto: script-01 e script-02 encerram com 'Siga o Psicosegredo...', script-03 com 'Siga a Filosofia Estoica...', script-04 com 'Siga a Mente Milionária...'. O fallback por scriptIndex (linhas 132-135) usa `VALIDATED_SCRIPTS_CATALOG[idx]` SEM filtro de canal quando o canal nao tem roteiro proprio — entao `--channel curiosidades` (que nao tem nenhum item no catalogo) recebe um roteiro de psicosegredo e a locucao diz 'Siga o Psicosegredo' enquanto o titulo, tags e descricao vem de @fatos.ocultos.

**Causa-raiz**

CTA acoplado ao corpo do roteiro em vez de ser um slot parametrizado por `channel.name`, combinado com um fallback que atravessa a fronteira de canal.

**Impacto no vídeo final**

O audio pede para o espectador seguir um canal que nao e o que ele esta assistindo. Conversao do CTA vai a zero e a credibilidade do canal e destruida em um unico segundo.

**Correção**

Separar o CTA do corpo no catalogo e montar em runtime:
```js
// catalogo: narrationBody termina ANTES do CTA; ctaTemplate usa o slot
{ narrationBody: '...O silêncio sob controle sempre entrega mais poder do que qualquer argumento verbal.',
  ctaTemplate: 'Siga {channelName} para dominar sua mente antes que usem isso contra você.' }
// runtime:
const ctaText = script.ctaTemplate.replace('{channelName}', channel.name);
const narrationText = `${script.narrationBody} ${ctaText}`;
```
E no fallback nunca cruzar canal: se `matchingChannelScripts.length === 0`, gerar por IA em vez de emprestar o roteiro de outra marca (ver achado catalogo-4-roteiros-modulo).

---

### `first-comment-nunca-contextual` — firstComment e constante do config: nunca menciona o conteudo do video

**Severidade:** MÉDIO · **Esforço:** small · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/script_generator.js:178`

**Evidência**

script_generator.js:178 e :189 leem `ctaProfile.first_comment` direto do JSON; youtube_analyzer.js:306 idem. O manifesto real publicado traz sempre: '♟️ Quer aprender a controlar sua dopamina e eliminar a procrastinação em 21 dias?...' — mesmo o video sendo sobre 'O Poder do Silêncio e da Calma Interior'. Nenhum dos 3 call sites interpola topico, insight ou hook.

**Causa-raiz**

Primeiro comentario modelado como constante de canal e nao como copy por video. O campo `insight` (que o Gemini ja produz, youtube_analyzer.js:280) seria material pronto e e usado apenas para prompts visuais.

**Impacto no vídeo final**

O comentario fixado e o principal driver de comentarios (sinal de engajamento que o algoritmo pesa forte) e de clique no link. Um comentario sobre dopamina embaixo de um video sobre silencio nao gera resposta nem clique — e ainda sinaliza automacao para a audiencia. Alem disso, todos os videos do canal tem o mesmo comentario fixado: sinal de spam.

**Correção**

Pedir o primeiro comentario a IA (campo `first_comment` no responseSchema, com pergunta aberta obrigatoria) e compor com o link do canal:
```js
// no schema: first_comment: { type:'string' }  // 1 pergunta aberta sobre o tema, 12-20 palavras
const firstComment = [
  aiScript?.first_comment?.trim() || `E você, já testou isso na prática? Conta aqui embaixo.`,
  '',
  renderCta(affiliateCta.first_comment, platform)
].join('\n');
```
No systemInstruction acrescentar: `first_comment: uma PERGUNTA ABERTA de 12 a 20 palavras sobre o tema especifico deste video, que so faca sentido para quem assistiu ate o fim. Proibido fazer pergunta de sim/nao.`

---

### `extract-narration-beats-perde-conectivo` — extractNarrationBeats remove o conectivo ao dividir e produz frases orfas como phrase das cenas

**Severidade:** MÉDIO · **Esforço:** small · **Categoria:** bug  
**Arquivo:** `pipeline/src/youtube_analyzer.js:424`

**Evidência**

Linha 424: `sentence.split(/[,;:]+|\s+(?:quando|porque|enquanto|mas|onde)\s+/i)` — o `split` com esses delimitadores DESCARTA a palavra capturada. 'Quando você aprende a silenciar o ruído, cada decisão ganha peso' vira ['você aprende a silenciar o ruído', 'cada decisão ganha peso'], perdendo o 'Quando'. Alem disso a regex e case-insensitive mas sem flag `g` explicita no split (funciona, porem tambem quebra no meio de ocorrencias legitimas). Essas `phrase` viram o campo `phrase` das cenas (linha 603) e sao o input do scene_aligner para o casamento fonetico.

**Causa-raiz**

Uso de split destrutivo onde seria necessario lookbehind/lookahead para preservar o delimitador.

**Impacto no vídeo final**

As phrases usadas para casar cena com audio nao correspondem ao texto realmente falado — o scene_aligner erra o ponto de corte e o visual troca no meio da frase. Contribui para o descompasso corte/fala observado no video final. As phrases tambem alimentam os prompts visuais (deduceActionIntent / buildProfessionalScenePrompt), entao um fragmento sem sujeito gera prompt sem sujeito.

**Correção**

Preservar o conectivo com lookahead e garantir que a concatenacao das beats reconstitua a narracao:
```js
const parts = sentence
  .split(/(?<=[,;:])\s+|\s+(?=(?:quando|porque|enquanto|mas|onde)\s)/i)
  .map(p => p.trim()).filter(p => p.length > 10);
```
E adicionar uma asserçao de integridade ao fim de extractNarrationBeats:
```js
const norm = s => s.toLowerCase().replace(/[^a-zà-ú0-9]/g, '');
if (norm(consolidated.join(' ')) !== norm(narrationText))
  console.warn('[Beats] Perda de texto no fatiamento — cortes podem dessincronizar');
```

---

### `extract-key-insight-codigo-morto` — extractKeyInsight (unica funcao que le a transcricao) e codigo morto

**Severidade:** BAIXO · **Esforço:** trivial · **Categoria:** arch  
**Arquivo:** `pipeline/src/youtube_analyzer.js:387`

**Evidência**

Linhas 387-405. Funcao `function extractKeyInsight(transcriptText, fallbackTopic)` — nao exportada e sem nenhum call site no repositorio. Ela limpa muletas ('né', 'tipo assim', 'então', 'sabe', 'aí') e extrai uma sentenca representativa de 120-180 caracteres da transcricao real. No lugar dela, o `insight` vem de strings canned (linhas 103/113/123/134) ou de `\`análise estratégica de ${baseTitle}\`` (linha 280).

**Causa-raiz**

Refatoracao incompleta: a versao heuristica antiga foi substituida por strings fixas e a funcao ficou orfa.

**Impacto no vídeo final**

O `insight` e propagado para generateThematicScenes (linha 342) como material de prompt visual e para a descricao. Com 'análise estratégica de <titulo>' no lugar do insight real, os prompts visuais perdem a unica ancora semantica do conteudo — reforcando o descompasso tema/visual. Recuperar a funcao e ganho barato de especificidade.

**Correção**

Exportar, corrigir o `.toLowerCase()` que destroi nomes proprios (linhas 402 e 404) e usar como fonte real de insight no fallback heuristico:
```js
export function extractKeyInsight(transcriptText, fallbackTopic) {
  ...
  if (sentences.length > 1) return truncateWords(sentences[1], 160);   // sem toLowerCase
  return truncateWords(clean, 160);
}
// youtube_analyzer.js:280
insight = aiScript.insight || extractKeyInsight(transcriptData.text, baseTitle);
```

---

## audio-e-sintese-de-voz

18 achados.

### `ssml-sem-escape-xml` — Texto cru injetado no SSML sem escape XML: qualquer '&', '<' ou '>' no roteiro ABORTA a sintese inteira (reproduzido ao vivo)

**Severidade:** CRÍTICO · **Esforço:** trivial · **Categoria:** bug  
**Arquivo:** `pipeline/src/voice_synthesizer.js:34`

**Evidência**

voice_synthesizer.js:34 chama `tts.toStream(text, {...})`. Em node_modules/msedge-tts/dist/MsEdgeTTS.js, `_SSMLTemplate` interpola `${input}` DIRETO dentro de `<prosody ...>${input}</prosody>` sem nenhum escape. TESTE A/B REAL executado agora:
  A) text='Dopamina & Procrastinação: o teste do e comercial.' -> ERRO: 'Stream closed before the synthesis completed (no turn.end received). The audio is likely truncated.'
  B) text='Dopamina e Procrastinacao: o teste de controle sem e comercial.' -> RESULTADO: {bytes:27792, dur:4.11, words:10}
Mesma rede, mesma chamada, mesmo segundo. O unico delta e o '&'.
E o catalogo do proprio projeto usa '&' nos topicos (script_generator.js:12,26,40,54: 'Dopamina & Procrastinação', 'Linguagem Corporal & Silêncio'), e o caminho de topico livre interpola o topico cru na narracao (script_generator.js:141).

**Causa-raiz**

O SSML e um documento XML. '&' abre uma entidade XML; sem escape o parser do servico Bing rejeita o documento e fecha o WebSocket antes do turn.end. Nenhuma camada do pipeline sanitiza o texto antes de virar markup.

**Impacto no vídeo final**

Video NAO e produzido: o pipeline morre no passo [2/6] com uma mensagem de erro de WebSocket que nao indica a causa. Basta o usuario rodar `--topic "Dopamina & Foco"` (um topico plausivel, literalmente presente no catalogo) para o lote inteiro falhar. Em runs de batch, derruba todos os videos seguintes.

**Correção**

Escapar SEMPRE os nos de texto antes de montar o SSML, e migrar para `rawToStream` (controle total do documento):
```js
const xmlEscape = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ''); // chars invalidos em XML 1.0
```
Alem disso, validar o documento montado antes de enviar (ex.: `new DOMParser()` via fast-xml-parser ou um regex-guard) e tratar o erro 'no turn.end' com mensagem acionavel ('SSML invalido - verifique caracteres especiais no roteiro') + 1 retry.

---

### `amix-derruba-6db` — `amix=inputs=2` sem `normalize=0` derruba o programa inteiro de -14,5 para -20,5 LUFS (-6 dB medidos) assim que existir trilha de fundo

**Severidade:** CRÍTICO · **Esforço:** small · **Categoria:** bug  
**Arquivo:** `pipeline/src/video_compositor.js:71`

**Evidência**

video_compositor.js:69-71:
```
[1:a]loudnorm=I=-14:TP=-1:LRA=11,volume=1.0[a_voice]
[2:a]volume=0.12,afade=...[a_bg]
[a_voice][a_bg]amix=inputs=2:duration=first:dropout_transition=2[a_out]
```
MEDICAO REAL (ebur128, feita agora sobre narration.mp3 da run):
  A) so `[0:a]loudnorm=I=-14:TP=-1:LRA=11` -> Integrated: -14.5 LUFS
  B) mesma cadeia + trilha via `amix=inputs=2:duration=first:dropout_transition=2` -> Integrated: -20.5 LUFS
Delta exato de -6,0 dB = 20*log10(1/2), a normalizacao automatica do amix por 1/n.

**Causa-raiz**

O `amix` do FFmpeg divide cada entrada por N por padrao (`normalize=1`). O loudnorm e aplicado ANTES do mix, entao o alvo de -14 LUFS e destruido pelo estagio seguinte. Nao existe nenhuma medicao pos-mix para pegar isso.

**Impacto no vídeo final**

Bug latente e mascarado: hoje pipeline/assets/music esta vazio (so .gitkeep), entao o ramo nunca executa e o video sai em -14,5 LUFS. No dia em que alguem colocar 1 mp3 na pasta - o proximo passo obvio do projeto - TODOS os videos passam a sair 6 dB abaixo do alvo. No YouTube/TikTok, que normalizam por cima, o video fica perceptivelmente mais fraco que os concorrentes no feed; o espectador aumenta o volume ou passa o dedo.

**Correção**

Nunca usar amix cru para voz+musica. Mixar com `normalize=0` e fazer o loudnorm DEPOIS do mix (ver o achado `cadeia-de-audio-ausente` para a cadeia completa):
```
[voice][bgduck]amix=inputs=2:duration=first:normalize=0:dropout_transition=0[a_premix];
[a_premix]alimiter=limit=-1.0dB:attack=5:release=50,aresample=48000[a_out]
```
E adicionar verificacao pos-render obrigatoria: rodar `ffmpeg -i <final.mp4> -af ebur128 -f null -` e falhar/avisar se |I - target_lufs| > 0.8 LU.

---

### `inte-truncado-slice-35` — A palavra truncada 'INTE' NAO vem do parser de metadata: vem de `topic.slice(0, 35)` no script_generator (causa raiz provada)

**Severidade:** ALTO · **Esforço:** trivial · **Categoria:** bug  
**Arquivo:** `pipeline/src/script_generator.js:141`

**Evidência**

script_generator.js:141: ``const hook = `Se você busca dominar ${topic.slice(0, 35)} com verdadeira maestria, existe um princípio silencioso...` ``
Topico da run: 'O Poder do Silêncio e da Calma Interior'. Contagem de caracteres: posicao 35 cai exatamente no 'e' de 'Inte|rior'.
subtitles.srt bloco 3 (00:00:02,550 --> 00:00:03,240): 'E DA CALMA INTE'. E no bloco correspondente a 00:00:21,64 o mesmo topico aparece INTEIRO ('DA CALMA INTERIOR E') porque ali veio do core do roteiro, nao do hook cortado.
Ou seja: o TTS pronunciou fielmente 'inte' porque foi isso que entrou no texto. O parser de wordBoundary esta inocente neste caso especifico.

**Causa-raiz**

Corte cego por numero de caracteres no meio de uma palavra, aplicado a um texto que sera LIDO em voz alta. `slice(0,50)` na linha 140 (titulo) tem o mesmo defeito.

**Impacto no vídeo final**

O espectador ouve o locutor dizendo 'a calma inte' nos primeiros 3 segundos - exatamente na janela do gancho, onde a retencao e decidida. Soa como audio quebrado/bug, e a legenda queimada reforca o erro na tela. Mata a credibilidade do canal no frame mais importante do video.

**Correção**

Truncar por palavra, nunca por caractere:
```js
function truncateWords(str, maxChars) {
  const s = String(str).trim();
  if (s.length <= maxChars) return s;
  const cut = s.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.-]+$/, '');
}
```
Usar `truncateWords(topic, 35)` na linha 141 e `truncateWords(topic, 50)` na 140. Ideal: nao truncar o topico no hook falado - o topico do usuario ja e curto por natureza; aplicar limite so no titulo/metadata.

---

### `duracao-estimada-em-vez-de-ffprobe` — Duracao do audio e ESTIMADA (ultimo wordBoundary +300ms) e fica curta: -0.61s na run real, -11,3% no teste controlado; o `-t` do FFmpeg corta a cauda da locucao

**Severidade:** ALTO · **Esforço:** small · **Categoria:** bug  
**Arquivo:** `pipeline/src/voice_synthesizer.js:86`

**Evidência**

voice_synthesizer.js:84-89 usa `wordBoundaries[last].endMs + 300` e, so como fallback, `stats.size / 6000`.
MEDICOES REAIS (ffprobe do bundle @ffprobe-installer):
  - pipeline/scratch/run_1789161687124_1/narration.mp3: duracao REAL 62.976s | estimativa por wordBoundary 62.37s (ultimo WB termina em 62.070) | erro -0.61s | `stats.size/6000` = 377856/6000 = 62.976s (EXATO).
  - teste controlado gerado agora: duracao REAL 4.632s | estimativa por wordBoundary 4.11s | erro -0.52s = -11,3% | size/6000 = 4.63s (EXATO).
run_pipeline.js:134 soma +0.3 e passa como `totalDurationSeconds`; video_compositor.js:90 emite `-t 62.67`. ffprobe do video final confirma duration=62.670000 contra 62.976 de audio disponivel.

**Causa-raiz**

O ramo PRIMARIO (wordBoundary) e o IMPRECISO; o ramo de FALLBACK (size/bitrate) e o exato - a prioridade esta invertida. O ultimo wordBoundary marca o inicio+duracao do ultimo fonema, nao o fim do arquivo (falta o decaimento, a cauda de reverb do modelo neural e o silencio final). E `size/6000` so e exato por acidente: hardcoda 48 kbps; muda o OUTPUT_FORMAT e quebra silenciosamente.

**Impacto no vídeo final**

~306 ms do final da locucao sao cortados a faca pelo `-t`. Na pratica o CTA ('...qual o seu maior desafio') termina com um corte seco, sem cauda, muitas vezes com click audivel. Em roteiros onde a ultima palavra e longa a perda chega a meia palavra. Alem disso todo o alinhamento de cenas (scene_aligner) e o fade-out da trilha sao calculados sobre um numero errado.

**Correção**

Medir o arquivo real com ffprobe (ja e dependencia do projeto via @ffprobe-installer):
```js
import { execFileSync } from 'child_process';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
const probeDurationSeconds = (file) => {
  const out = execFileSync(process.env.FFPROBE_PATH || ffprobeInstaller.path, [
    '-v','error','-select_streams','a:0',
    '-show_entries','format=duration','-of','default=nw=1:nk=1', file
  ]).toString().trim();
  const d = Number(out);
  if (!Number.isFinite(d) || d <= 0) throw new Error(`ffprobe nao mediu duracao de ${file}`);
  return d;
};
```
E no resolve: `const realSeconds = probeDurationSeconds(outputAudioPath); durationMs = Math.round(realSeconds*1000);` mantendo `lastWordEndMs` como campo separado (util para o CTA/legendas). Retornar tambem `tailSilenceMs = durationMs - lastWordEndMs` para o compositor decidir o fade. E no video_compositor, trocar `-t ${totalDurationSeconds}` por `-shortest` com o audio como referencia, ou `-t ${realAudioDuration + 0.25}`.

---

### `cadeia-de-audio-ausente` — Zero tratamento da voz antes da mixagem: sem HPF, de-esser, EQ, compressor ou limiter - so um loudnorm de passada unica

**Severidade:** ALTO · **Esforço:** medium · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/video_compositor.js:75`

**Evidência**

video_compositor.js:66-76: a cadeia de audio inteira do projeto e literalmente `[1:a]loudnorm=I=-14:TP=-1:LRA=11[a_out]` (caso sem musica) ou loudnorm+volume+amix (caso com musica). Nenhum highpass, nenhum equalizer, nenhum acompressor, nenhum alimiter, nenhum deesser em todo o pipeline (grep por 'acompressor|alimiter|highpass|deesser' em pipeline/src/ retorna zero ocorrencias).
Fonte: mp3 mono 24 kHz / 48 kbps (voice_synthesizer.js:21, AUDIO_24KHZ_48KBITRATE_MONO_MP3). Medicao: I=-20.6 LUFS, LRA=2.5 LU, True Peak -3.4 dBFS.

**Causa-raiz**

O loudnorm foi tratado como 'a cadeia de audio'. Ele so ajusta ganho - nao limpa rumble, nao controla sibilancia, nao da presenca, nao aumenta densidade percebida. E a fonte ja e a mais pobre disponivel (48 kbps), quando a biblioteca expõe formatos melhores.

**Impacto no vídeo final**

A voz sai fina, distante e 'de telefone', sem corpo nem presenca - caracteristica classica de faceless video amador. Em celular com auto-falante mono (onde 80% dos Shorts sao consumidos) a locucao some contra qualquer trilha e o espectador nao 'gruda'. A falta de compressao faz as silabas fracas cairem abaixo do ruido de fundo do ambiente do espectador.

**Correção**

1) Subir a fonte: em voice_synthesizer.js:21 trocar para `'audio-24khz-96kbitrate-mono-mp3'` (exportado como OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3) ou passar a string literal `'audio-48khz-192kbitrate-mono-mp3'` (o valor so e usado como string no JSON de config do servico; funciona com toStream/rawToStream).
2) Cadeia de voz concreta, antes de qualquer mixagem:
```
[1:a]aresample=48000:resampler=soxr,
     highpass=f=85,
     equalizer=f=220:t=q:w=1.2:g=-2.5,      # tira o 'barro' / boxiness
     equalizer=f=3200:t=q:w=1.4:g=+2.5,     # presenca/inteligibilidade
     equalizer=f=8000:t=h:g=+1.5,           # ar
     deesser=i=0.35:m=0.5:f=0.25,
     acompressor=threshold=-18dB:ratio=3:attack=8:release=180:knee=4:makeup=2,
     acompressor=threshold=-9dB:ratio=6:attack=2:release=90:knee=2,  # 2o estagio, densidade
     alimiter=limit=-1.5dB:attack=3:release=40:level=disabled
[voice_dry]
```
3) So depois disso vem o ducking e o loudnorm de 2 passadas.

---

### `sem-ssml-locucao-monotona` — Nenhum SSML: sem <break>, sem <emphasis>, sem variacao de rate/pitch por bloco (hook/core/hack/cta) - LRA de 2,5 LU comprova locucao chapada

**Severidade:** ALTO · **Esforço:** medium · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/voice_synthesizer.js:34`

**Evidência**

voice_synthesizer.js:33-37 envia o roteiro inteiro como uma unica string plana com um unico `{rate, pitch}` global para `toStream`. Nao existe nenhum `<break`, `<emphasis` ou `<prosody` gerado pelo projeto (grep em pipeline/src/ retorna zero).
O perfil psicosegredo.json declara 4 blocos com intencoes dramaticas diferentes (script_profile.structure: hook 'Quebra de padrão verbal', scientific_core, practical_hack, cta) e o scriptData ja carrega essa segmentacao (script_generator.js:202-205), mas ela e DESCARTADA na sintese.
MEDICAO REAL: narration.mp3 -> LRA 2.5 LU (LRA low -22.2 / LRA high -19.8). Video final -> LRA 2.4 LU. Locucao humana engajada em short fica tipicamente entre 6 e 10 LU.

**Causa-raiz**

A API `toStream` foi usada em vez de `rawToStream`. O template padrao da lib envolve tudo num unico `<prosody>` e nao ha camada que converta a estrutura do roteiro em markup prosodico.

**Impacto no vídeo final**

Locucao robotica e sem respiro: nenhuma pausa dramatica antes da revelacao, nenhuma palavra-chave enfatizada, mesma energia no gancho e no CTA. O espectador percebe 'IA lendo texto' nos primeiros 2 segundos e desliza. Somado ao visual repetitivo, e a principal causa de retencao baixa.

**Correção**

Usar `tts.rawToStream(ssml)` com SSML montado por bloco (texto SEMPRE passado por xmlEscape). SSML pt-BR concreto:
```xml
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"
       xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="pt-BR">
 <voice name="pt-BR-AntonioNeural">
  <!-- HOOK 0-3s: rapido, agudo, quebra de padrao -->
  <prosody rate="+10%" pitch="+2st" volume="+6%">
    <emphasis level="strong">Você não é preguiçoso.</emphasis><break time="280ms"/>
    A sua falta de ânimo tem uma explicação <emphasis level="moderate">biológica</emphasis> exata.
  </prosody>
  <break time="420ms"/>
  <!-- CORE 3-45s: didatico, mais lento e grave, pausas nas virgulas -->
  <prosody rate="-3%" pitch="-1st">
    A neurociência explica que a dopamina<break time="160ms"/>
    não é o neurotransmissor do prazer,<break time="180ms"/>
    mas sim da <emphasis level="strong">antecipação</emphasis>.<break time="320ms"/>
    Quando você passa o dia rolando vídeos curtos,<break time="150ms"/>
    seu cérebro recebe descargas rápidas <prosody rate="+6%">sem nenhum esforço real</prosody>.
  </prosody>
  <break time="450ms"/>
  <!-- HACK 45-58s: energico, imperativo -->
  <prosody rate="+7%" pitch="+1st" volume="+4%">
    A regra prática:<break time="200ms"/>
    <emphasis level="strong">a ação precisa vir antes da vontade.</emphasis>
  </prosody>
  <break time="380ms"/>
  <!-- CTA 58-65s: confidencial, proximo -->
  <prosody rate="+2%" pitch="+2st" volume="+8%">
    Siga o Psicosegredo<break time="140ms"/> e aprenda a controlar sua química mental.
  </prosody>
 </voice>
</speak>
```
Regras de geracao automatica: `<break time="150ms"/>` apos virgula, `280ms` apos ponto, `420ms` entre blocos; `<emphasis level="strong">` na 1a ocorrencia de cada termo-chave do topico; rate/pitch por bloco vindos de um mapa `prosody_by_section` novo no channel JSON. IMPORTANTE: `<mstts:express-as>` NAO e suportado por todas as vozes pt-BR (AntonioNeural nao declara styles) - usar apenas prosody/break/emphasis, que sao universais, e so aplicar express-as apos checar `getVoices()`. Os offsets de WordBoundary continuam corretos com <break>, entao as legendas seguem sincronizadas.

---

### `pitch-volume-do-perfil-ignorados` — run_pipeline nao repassa pitch nem volume do voice_profile: todo canal recebe o pitch '-2Hz' hardcoded, contrariando os proprios JSONs

**Severidade:** ALTO · **Esforço:** trivial · **Categoria:** config-drift  
**Arquivo:** `pipeline/src/run_pipeline.js:105`

**Evidência**

run_pipeline.js:100-110 le `voiceProfile.voice_id` e `voiceProfile.rate`, mas NAO le `voiceProfile.pitch` nem `voiceProfile.volume`, e chama `synthesizeVoiceWithTimestamps({ text, voice, rate, outputAudioPath })`.
voice_synthesizer.js:13 aplica entao o default `pitch = '-2Hz'`.
Mas os perfis declaram: curiosidades.json pitch '+0Hz' (voz feminina ThalitaNeural), estoicismo.json '+0Hz', financas.json '+0Hz' (FranciscaNeural), channel_template.json '+0Hz'. Todos os quatro recebem -2Hz.
`volume` ('+0%' em todos) nunca chega na lib, que aplica seu default `volume = 100.0` (Prosody.js:20).

**Causa-raiz**

Assinatura da funcao aceita pitch, mas o chamador nunca passa; e o default do modulo foi calibrado para um unico canal (psicosegredo) em vez de ser neutro.

**Impacto no vídeo final**

Vozes femininas (Thalita, Francisca) saem 2 Hz mais graves do que o perfil especifica - sutil mas consistente, empurrando o timbre para fora da identidade sonora desenhada para o nicho. Pior: qualquer ajuste de pitch que o operador faca no JSON do canal NAO tem efeito nenhum, o que leva a ajustes as cegas e a conclusao errada de que 'o perfil nao funciona'.

**Correção**

run_pipeline.js:
```js
const voiceResult = await synthesizeVoiceWithTimestamps({
  text: scriptData.narrationText,
  voice: voiceProfile.voice_id || 'pt-BR-AntonioNeural',
  rate: voiceProfile.rate ?? '+0%',
  pitch: voiceProfile.pitch ?? '+0Hz',
  volume: voiceProfile.volume ?? '+0%',
  prosodyBySection: voiceProfile.prosody_by_section,
  sections: scriptData.sections,
  outputAudioPath: audioPath
});
```
E em voice_synthesizer.js trocar os defaults para neutros (`rate='+0%'`, `pitch='+0Hz'`, `volume='+0%'`) e repassar `volume` no objeto de options do toStream/rawToStream. Adicionar um log explicito: `console.log('Voz: %s | rate=%s pitch=%s volume=%s', voiceId, rate, pitch, volume)` para tornar o drift visivel.

---

### `audio-profile-totalmente-ignorado` — O bloco audio_profile de TODOS os canais e ignorado: bg_music_volume, target_lufs, fade_out_seconds e voice_volume estao hardcoded no compositor

**Severidade:** ALTO · **Esforço:** small · **Categoria:** config-drift  
**Arquivo:** `pipeline/src/video_compositor.js:69`

**Evidência**

Os 5 JSONs de canal definem `audio_profile: {voice_volume, bg_music_track, bg_music_volume, fade_out_seconds, target_lufs}` (ex.: psicosegredo.json bg_music_volume 0.10 / target_lufs -14.0 / fade_out_seconds 2.0; estoicismo e financas usam 0.08; curiosidades 0.09).
video_compositor.js:69-70 hardcoda `loudnorm=I=-14` e `volume=0.12`; linha 67 hardcoda o fade em 2.5s. `composeFinalVideo` nem recebe o channelProfile como parametro (run_pipeline.js:209-216 passa apenas videoClips/audioPath/subtitles/output/totalDuration/bgMusicPath).
O campo `bg_music_track` (caminho explicito da trilha por canal) tambem nunca e lido: run_pipeline.js:193-203 varre diretorios e pega `musicFiles[0]` arbitrariamente.

**Causa-raiz**

O compositor foi escrito antes/independente do sistema de perfis e nunca recebeu o objeto de configuracao. O acoplamento e por parametros soltos, entao adicionar config exige mudar a assinatura - ninguem mudou.

**Impacto no vídeo final**

Todo canal soa igual, com a mesma mixagem, o mesmo alvo de loudness e a mesma trilha (a primeira alfabetica do diretorio). A diferenciacao sonora entre nichos - que e metade da identidade de um canal faceless - simplesmente nao existe no output. E cada valor que o operador ajusta nos JSONs nao produz nenhuma mudanca audivel, gerando desconfianca no sistema de perfis inteiro.

**Correção**

Passar o perfil e usa-lo:
```js
// run_pipeline.js
await composeFinalVideo({ ..., audioProfile: channelProfile.audio_profile || {}, platform: options.platform });
// video_compositor.js
const ap = audioProfile || {};
const bgVol   = Number(ap.bg_music_volume ?? 0.10);
const fadeSec = Number(ap.fade_out_seconds ?? 2.0);
const targetI = Number(ap.target_lufs ?? -14.0);
const voiceVol= Number(ap.voice_volume ?? 1.0);
const fadeOutStart = Math.max(0.5, realDuration - fadeSec);
```
E resolver a trilha por `audio_profile.bg_music_track` (path.resolve a partir da raiz do repo) ANTES do fallback por varredura de diretorio, com aviso quando o arquivo declarado nao existir.

---

### `sem-ducking-sidechain` — Trilha de fundo com volume FIXO 0.12 e sem ducking sidechain - o SDD promete 'ducking dinamico' que nao existe no codigo

**Severidade:** ALTO · **Esforço:** small · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/video_compositor.js:70`

**Evidência**

video_compositor.js:70: `[2:a]volume=0.12,afade=t=out:st=${fadeOutStart}:d=2.5[a_bg]` - ganho estatico, nenhum `sidechaincompress` em todo o repositorio (grep 'sidechain' em pipeline/src/ = zero).
docs/SDD_Pipeline_Conteudo_IA_v2.md:179 promete literalmente: 'Trilha de fundo com *ducking* dinâmico a 12% durante a locução e fade-out elegante de 2.0 segundos'.
O fade-out tambem esta hardcoded em 2.5s (linha 67) contra os 2.0s do config, e e calculado sobre `totalDurationSeconds`, que ja provamos ser 0,61s MENOR que o audio real.

**Causa-raiz**

Ducking foi especificado no design doc e implementado como 'volume baixinho constante', que e uma coisa diferente. Nao existe deteccao do sinal de voz para modular a musica.

**Impacto no vídeo final**

Com ganho fixo a musica ou mascara consoantes nas frases sussurradas (perda de inteligibilidade) ou fica inaudivel nas pausas (perde a funcao de sustentar a tensao). O resultado e um leito sonoro morto: nao respira com a narracao. Nas pausas dramaticas - justamente onde a musica deveria subir e segurar o espectador - ela continua no mesmo 12%.

**Correção**

Ducking real por sidechain, com a voz JA processada como chave de deteccao:
```
[voice_dry]asplit=2[voice_out][voice_key];
[2:a]volume=${bgVol},aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,
     afade=t=in:st=0:d=1.2,
     afade=t=out:st=${realDuration - fadeSec}:d=${fadeSec}[bg_raw];
[bg_raw][voice_key]sidechaincompress=threshold=0.02:ratio=8:attack=5:release=350:makeup=1:level_sc=1:mix=1[bg_duck];
[voice_out][bg_duck]amix=inputs=2:duration=first:normalize=0:dropout_transition=0[a_premix]
```
attack curto (5ms) abaixa a musica antes da silaba; release longo (350ms) faz ela voltar suavemente nas pausas, sem pumping. Ajustar `threshold` conforme o nivel da voz processada (0.02-0.05 para voz em torno de -16 LUFS).

---

### `diretorio-musica-vazio` — pipeline/assets/music esta VAZIO (so .gitkeep): 100% dos videos saem sem trilha, e o ramo de mixagem nunca executou

**Severidade:** ALTO · **Esforço:** small · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/run_pipeline.js:193`

**Evidência**

`ls -la pipeline/assets/music` -> apenas `.gitkeep` (0 bytes). Nao existe subdiretorio por canal (pipeline/assets/music/psicosegredo nao existe).
run_pipeline.js:192-203 varre os dois diretorios e deixa `bgMusicPath = null`; video_compositor.js:51 `hasBgMusic` = false; cai no ramo else da linha 74-76 (so loudnorm).
Confirmacao no output: ffprobe do video final mostra 1 canal de audio e o ebur128 da LRA 2.4 LU identica a da narracao pura - nao ha nenhum leito musical.
Os configs, porem, apontam trilhas que nao existem: psicosegredo.json 'assets/music/dark_ambient_tension_01.mp3', os demais 'pipeline/assets/music/dark_ambient_loop.mp3'.

**Causa-raiz**

Feature entregue como codigo sem os assets, e sem nenhuma validacao/aviso quando a trilha declarada no perfil nao e encontrada. O fallback silencioso (`bgMusicPath = null`) esconde o problema.

**Impacto no vídeo final**

Video de 62 segundos com voz seca sobre imagens estaticas e ZERO musica. Para o formato faceless/Shorts isso e fatal: sem leito sonoro nao ha tensao, nao ha ritmo, os cortes nao 'batem' em nada e os trechos de silencio entre frases soam como falha tecnica. E o unico eixo emocional continuo do video.

**Correção**

1) Commitar 3-4 loops livres de direitos por estetica (dark ambient, tension pulse, uplifting) em pipeline/assets/music/<canal>/ - fontes: Pixabay Music, Free Music Archive (CC0), ou geracao propria.
2) Fazer o perfil mandar: resolver `audio_profile.bg_music_track` e, se o arquivo nao existir, emitir `console.warn('[AUDIO] Trilha declarada nao encontrada: <path> - renderizando SEM musica')` em vez de seguir mudo.
3) Adicionar um gate no final do pipeline: se `!hasBgMusic`, logar em nivel WARN no resumo do run (hoje o resumo nem menciona audio).
4) Loop correto: `-stream_loop -1` ja esta em video_compositor.js:53, mas precisa vir acompanhado de `atrim=0:${realDuration}` para nao depender apenas do `duration=first` do amix.

---

### `loudnorm-single-pass` — loudnorm de passada unica (modo dinamico) e alvo fixo I=-14/TP=-1 para todas as plataformas

**Severidade:** ALTO · **Esforço:** medium · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/video_compositor.js:75`

**Evidência**

video_compositor.js:69 e 75: `loudnorm=I=-14:TP=-1:LRA=11` sem `measured_I/measured_TP/measured_LRA/measured_thresh`, portanto sem `linear=true` - o filtro opera em modo DINAMICO, comprimindo o sinal janela a janela.
Resultado medido no video final: I=-14.5 LUFS (0.5 LU fora do alvo), LRA 2.4 LU, True Peak -1.0 dBFS.
O alvo e hardcoded apesar de `audio_profile.target_lufs` existir em todos os perfis, e e o mesmo para YOUTUBE_SHORTS/TIKTOK/INSTAGRAM_REELS (options.platform existe em run_pipeline.js:42 mas nunca chega no compositor).

**Causa-raiz**

Single-pass e o caminho de menor esforco: nao exige a passada de medicao. Mas sem measured_* o loudnorm nao pode aplicar ganho linear e vira um compressor de banda larga com constantes de tempo proprias.

**Impacto no vídeo final**

Duas consequencias audiveis: (a) bombeamento/respiracao - o modo dinamico levanta o ruido de fundo do mp3 de 48 kbps nas pausas, criando um 'chiado que pulsa' entre frases; (b) o alvo erra por 0,5 LU, entao a plataforma reaplica normalizacao e o video fica ligeiramente mais baixo que os concorrentes no feed. Com TP -1.0 dBFS exato, a recodificacao lossy da plataforma (AAC/Opus) gera picos intersample acima de 0 dBFS -> clipping audivel em alguns decoders.

**Correção**

Two-pass obrigatorio:
```js
// Pass 1 - medicao
const measure = execFileSync(ffmpegBinary, ['-hide_banner','-nostats','-i', audioPath,
  '-af', `loudnorm=I=${targetI}:TP=${targetTP}:LRA=9:print_format=json`, '-f','null','-']).toString();
const m = JSON.parse(measure.slice(measure.lastIndexOf('{')));
// Pass 2 - aplicacao linear
const ln = `loudnorm=I=${targetI}:TP=${targetTP}:LRA=9:` +
  `measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:` +
  `measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true:print_format=summary`;
```
Alvos por plataforma (aplicar sobre o MIX final, nao sobre a voz):
```js
const LOUDNESS = {
  YOUTUBE_SHORTS:   { I: -14, TP: -1.5, LRA: 9 },
  TIKTOK:           { I: -14, TP: -1.0, LRA: 8 },
  INSTAGRAM_REELS:  { I: -14, TP: -1.0, LRA: 8 },
  DEFAULT:          { I: Number(ap.target_lufs ?? -14), TP: -1.5, LRA: 9 }
};
```
Baixar LRA de 11 para 8-9 (conteudo falado curto) e usar TP -1.5 dBTP para dar margem a recodificacao. Validar pos-render com ebur128.

---

### `parser-metadata-fragil` — Parser do metadataStream sem buffer incremental, com catch mudo e decodificacao UTF-8 por chunk - perde palavras silenciosamente e nunca acusa

**Severidade:** MÉDIO · **Esforço:** small · **Categoria:** bug  
**Arquivo:** `pipeline/src/voice_synthesizer.js:50`

**Evidência**

voice_synthesizer.js:44-77: `chunk.toString('utf8')` -> `split('\r\n')` -> `if (line.startsWith('{') && line.endsWith('}'))` -> `JSON.parse` dentro de um `try` cujo `catch` e vazio (linha 74-76, comentario 'parse silencioso de chunks intermediarios').
Tres defeitos verificaveis:
(a) O payload do Edge (MsEdgeTTS.js `_pushMetadata`) NAO tem terminador `\r\n` - o split e um no-op. Se dois objetos JSON forem entregues no mesmo evento 'data', a string comeca com '{' e termina com '}', o JSON.parse lanca, e AMBAS as palavras somem sem nenhum log.
(b) `chunk.toString('utf8')` num Buffer cortado no meio de um caractere multibyte corrompe acentos (ê, ç, ã) - e o pt-BR e cheio deles.
(c) `sentenceBoundaryEnabled: true` e pedido na linha 23 mas o loop so aceita `meta.Type === 'WordBoundary'` (linha 54) - a segmentacao por sentenca vem de graca e e jogada fora.
Teste empirico: em modo flowing o Node hoje emite 1 evento por push (verificado: 20 pushes -> 20 eventos, 0 perdas), entao o bug (a) NAO e o que causou o 'INTE' - esse veio de script_generator.js:141. Mas continua sendo perda silenciosa esperando um refactor (qualquer `await`, `pipeline()` ou `read()` explicito muda o comportamento).

**Causa-raiz**

Parser escrito assumindo 'um evento = uma linha JSON completa', premissa que o protocolo nao garante, combinado com um catch vazio que transforma qualquer falha em perda invisivel e com a ausencia de qualquer reconciliacao entre o numero de wordBoundaries e o numero de palavras do roteiro.

**Impacto no vídeo final**

Toda palavra perdida no metadata desaparece das legendas queimadas e desloca o alinhamento de cenas: o espectador ve a legenda pular uma palavra que esta sendo falada. Como nao ha log nem validacao, um video sai publicado com legenda dessincronizada sem que ninguem saiba. E os acentos corrompidos apareceriam como tofu/interrogacao na legenda queimada em 1080x1920.

**Correção**

Buffer incremental com StringDecoder e varredura de chaves balanceadas:
```js
import { StringDecoder } from 'string_decoder';
const decoder = new StringDecoder('utf8');
let buf = '';
let parseErrors = 0;

function drain() {
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = 0; i < buf.length; i++) {
    const ch = buf[i];
    if (inStr) {
      if (esc) { esc = false; }
      else if (ch === '\\') { esc = true; }
      else if (ch === '"') { inStr = false; }
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') { if (depth++ === 0) start = i; continue; }
    if (ch === '}') {
      if (--depth === 0 && start >= 0) {
        const slice = buf.slice(start, i + 1);
        try { handleMetadata(JSON.parse(slice)); }
        catch (e) { parseErrors++; console.warn('[TTS] bloco de metadata invalido:', e.message); }
        buf = buf.slice(i + 1); return drain();
      }
    }
  }
}
metadataStream.on('data', c => { buf += decoder.write(c); drain(); });
metadataStream.on('end', () => { buf += decoder.end(); drain(); });
```
`handleMetadata` deve tratar `WordBoundary` E `SentenceBoundary` (guardar em `sentenceBoundaries[]`, usado depois pelo subtitle_generator para quebrar por sentenca em vez de a cada 4 palavras).
E reconciliacao obrigatoria antes do resolve:
```js
const expected = text.trim().split(/\s+/).length;
if (wordBoundaries.length < expected * 0.97) {
  throw new Error(`[TTS] Perda de timestamps: ${wordBoundaries.length}/${expected} palavras mapeadas (${parseErrors} blocos invalidos).`);
}
```

---

### `samplerate-96khz-absurdo` — Audio final sai em AAC 96.000 Hz mono (a partir de uma fonte de 24 kHz) por falta de aresample apos o loudnorm

**Severidade:** MÉDIO · **Esforço:** trivial · **Categoria:** bug  
**Arquivo:** `pipeline/src/video_compositor.js:88`

**Evidência**

ffprobe de pipeline/output/run_1789161687124_1/video_final_9x16.mp4: `codec_name=aac, codec_type=audio, sample_rate=96000, channels=1, bit_rate=185624`.
A fonte e mp3 mono 24.000 Hz / 48 kbps (ffprobe de narration.mp3). video_compositor.js:88-89 pede `-c:a aac -b:a 192k` sem `-ar` e sem `aresample` no final do filtergraph.
O loudnorm faz upsample interno para 192 kHz (deteccao de true peak) e, na ausencia de aresample, entrega 192 kHz ao encoder; o AAC do FFmpeg satura em 96 kHz e reamostra ate la.

**Causa-raiz**

Ausencia de um estagio explicito de formatacao de saida (`aresample`/`aformat`) no fim do filter_complex - o sample rate do output ficou a merce do efeito colateral interno do loudnorm.

**Impacto no vídeo final**

Zero ganho de qualidade (a fonte tem banda ate 12 kHz) e custo real: 192 kbps de AAC a 96 kHz gastos para carregar audio de 24 kHz; o upload fica maior e mais lento. Pior, 96 kHz mono nao e um formato canonico para YouTube/TikTok/Instagram - todos vao transcodificar para 44,1/48 kHz, adicionando uma geracao lossy extra e reamostragem de qualidade desconhecida sobre um sinal que ja passou por dois estagios lossy. Perda liquida de fidelidade.

**Correção**

Fechar o filtergraph com formatacao explicita e declarar o output:
```
...,alimiter=limit=-1.0dB,aresample=48000:resampler=soxr:precision=28,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[a_out]
```
e nas outputOptions:
```
'-c:a aac', '-profile:a aac_low', '-b:a 192k', '-ar 48000', '-ac 2'
```
Stereo (`-ac 2`) e o esperado pelas plataformas e necessario para a trilha musical ter imagem estereo; a voz entra centralizada.

---

### `sem-sfx-de-transicao` — Nenhum SFX de transicao (whoosh/impact) nos 8 cortes de cena - os cortes acontecem em silencio

**Severidade:** MÉDIO · **Esforço:** medium · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/video_compositor.js:66`

**Evidência**

O filtergraph de audio (video_compositor.js:66-76) tem no maximo 2 entradas: voz e trilha. Nao ha nenhuma entrada de SFX, nenhum `adelay`, nenhum diretorio pipeline/assets/sfx (grep por 'whoosh|sfx|impact' em pipeline/src/ = zero ocorrencias).
A run analisada tem 8 cortes visuais (scene_1..scene_8.mp4 no scratch, concat_list.txt com 8 entradas) - 8 momentos de transicao sem nenhuma marcacao sonora.
Os timestamps dos cortes JA existem e sao calculados com precisao de ms por scene_aligner.js (`alignedScenes[i].startTime`), impressos no log do run_pipeline.js:146-151.

**Causa-raiz**

O compositor trata audio como 'voz + musica' e nunca modelou uma camada de efeitos ancorada nos eventos de corte, embora os eventos estejam disponiveis no mesmo escopo.

**Impacto no vídeo final**

Os cortes viram trocas de slide mudas. Em Shorts, o whoosh/impact e o que faz o corte 'ser sentido' e reseta a atencao a cada 2-4 segundos - e um dos mecanismos mais baratos de retencao do formato. Sem ele, combinado com imagens estaticas parecidas entre si, o espectador nao percebe progressao e desliza por volta dos 5-8 segundos.

**Correção**

Camada de SFX ancorada nos cortes reais, montada dinamicamente:
```js
// sfxInputs: whoosh.wav (transicoes), impact.wav (gancho e CTA)
const sfxIdx = hasBgMusic ? 3 : 2;   // indice do primeiro input de SFX
const sfxParts = [];
alignedScenes.slice(1).forEach((s, i) => {
  const delayMs = Math.max(0, Math.round(s.startTime * 1000) - 120); // 120ms de pre-roll
  sfxParts.push(`[${sfxIdx}:a]atrim=0:0.55,asetpts=PTS-STARTPTS,`+
                `volume=0.30,adelay=${delayMs}|${delayMs}[sfx${i}]`);
});
const sfxLabels = sfxParts.map((_, i) => `[sfx${i}]`).join('');
complexFilters.push(...sfxParts);
complexFilters.push(`${sfxLabels}amix=inputs=${sfxParts.length}:normalize=0:duration=longest[sfx_bus]`);
// e no mix final:
// [voice_out][bg_duck][sfx_bus]amix=inputs=3:duration=first:normalize=0[a_premix]
```
Obs: cada copia do SFX exige reusar o input com `asplit` ou declarar o arquivo N vezes como input - com N<=10 cortes, declarar N inputs e mais simples e barato. Volume de 0.25-0.35 (whoosh nao pode competir com a voz) e pre-roll de ~120ms para o som anteceder o corte visual (mesma logica do L-cut).

---

### `sem-silencedetect-para-lcut` — L-cut usa lacunas entre wordBoundaries em vez do silencio REAL do mp3 - cortes caem dentro da cauda da frase

**Severidade:** MÉDIO · **Esforço:** medium · **Categoria:** bug  
**Arquivo:** `pipeline/src/scene_aligner.js:140`

**Evidência**

scene_aligner.js:114-148 (`calculateSceneCutTimestamp`) e 159-192 (`findOptimalPauseCut`) derivam 'pausa' de `currWord.startMs - prevWord.endMs` e cortam a 100ms antes da proxima palavra, ou no ponto medio quando a lacuna e < 120ms. Nenhum `silencedetect` no repositorio inteiro.
O problema: o `endMs` do wordBoundary e `Offset + Duration` do fonema, que NAO inclui a cauda acustica da palavra nem a respiracao. Prova indireta da mesma classe de erro: o ultimo wordBoundary termina em 62.070s mas o audio real vai ate 62.976s - ha 906 ms de sinal apos o 'fim' declarado da ultima palavra. A mesma sub-estimacao ocorre em cada fronteira interna.

**Causa-raiz**

Timestamps do TTS sao um proxy do conteudo acustico, nao uma medicao dele. Sem analisar o mp3 renderizado, o alinhador nao sabe onde ha silencio de verdade nem onde ha respiracao.

**Impacto no vídeo final**

Cortes visuais caem em cima da cauda da ultima silaba da frase anterior, produzindo aquela sensacao de 'corte apressado' que o espectador nao sabe nomear mas percebe como amadorismo. E como a lacuna medida e menor que a real, o ramo do 'ponto medio' (linha 147) e acionado com mais frequencia do que deveria - cortando no meio da fala em vez de na pausa.

**Correção**

Medir o silencio real no mp3 apos a sintese e usar isso como grade de corte:
```js
export function detectSilences(audioPath, { noiseDb = -38, minDur = 0.10 } = {}) {
  const out = execFileSync(ffmpegBinary, ['-hide_banner','-nostats','-i', audioPath,
    '-af', `silencedetect=noise=${noiseDb}dB:d=${minDur}`, '-f','null','-'],
    { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] });
  const starts = [...out.matchAll(/silence_start:\s*([\d.]+)/g)].map(m => +m[1]);
  const ends   = [...out.matchAll(/silence_end:\s*([\d.]+)/g)].map(m => +m[1]);
  return starts.map((s, i) => ({ startMs: s*1000, endMs: (ends[i] ?? s+minDur)*1000 }))
               .map(p => ({ ...p, durMs: p.endMs - p.startMs }));
}
```
Classificacao respiracao vs pausa retorica: `durMs` entre 80 e 260 ms = respiracao (NAO cortar dentro; cortar antes dela); `durMs` > 260 ms = pausa retorica (cortar no ponto de 40% da pausa, dando o pre-roll do L-cut). Para deteccao de respiracao mais fina, rodar um segundo silencedetect sobre a banda de 300-900 Hz (`highpass=f=300,lowpass=f=900,silencedetect=noise=-45dB:d=0.06`), onde o ruido de inspiracao se destaca.
Passar `silences` para `alignScenesWithWordBoundaries` e priorizar: silencio real > lacuna de wordBoundary > ponto medio.

---

### `sem-fade-na-voz-corte-seco` — Voz sem fade-in/fade-out e cortada por `-t` sem padding: risco de click no fim e inicio abrupto

**Severidade:** MÉDIO · **Esforço:** trivial · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/video_compositor.js:90`

**Evidência**

video_compositor.js:69 e 75: a voz recebe apenas loudnorm (e um `volume=1.0` inutil). Nenhum `afade` e aplicado a `[1:a]` - o `afade` da linha 70 age apenas na trilha `[2:a]`, que hoje nunca existe.
A saida e truncada por `-t ${totalDurationSeconds}` (linha 90) num valor que ja provamos ser 0,31s menor que o audio disponivel (62.670 renderizado vs 62.976 reais).
run_pipeline.js:132-135 chama esse padding de '+ 0.3s de respiração natural para fade out', mas nenhum fade-out e efetivamente aplicado a voz em lugar nenhum.

**Causa-raiz**

A intencao (comentario em run_pipeline.js:132) nunca virou filtro. E o corte por `-t` num ponto arbitrario da forma de onda gera descontinuidade de amplitude.

**Impacto no vídeo final**

O video termina com um corte seco no audio: dependendo de onde a onda esta no instante 62.670s, isso produz um 'tec' audivel no ultimo frame - exatamente onde o CTA pede a inscricao. E o primeiro frame comeca com a voz ja em regime, sem os ~60ms de ataque que a percepcao espera.

**Correção**

Aplicar fades explicitos na voz, calculados sobre a duracao REAL medida por ffprobe:
```
[voice_dry]apad=pad_dur=0.35,
           afade=t=in:st=0:d=0.08:curve=exp,
           afade=t=out:st=${realDuration - 0.30}:d=0.30:curve=tri[voice_faded]
```
E alinhar o corte: usar `-t ${realDuration + 0.35}` (a voz ja terminou; o padding fecha o fade em silencio absoluto) em vez do valor estimado, ou `-shortest` com o audio como referencia mais curta.

---

### `sem-verificacao-de-loudness-pos-render` — Nenhuma verificacao de audio no video renderizado: nada mede LUFS, true peak, duracao ou presenca de trilha antes da ingestao

**Severidade:** MÉDIO · **Esforço:** small · **Categoria:** arch  
**Arquivo:** `pipeline/src/video_compositor.js:99`

**Evidência**

video_compositor.js:97-107 (handler 'end') so faz `fs.statSync` e reporta tamanho em MB. `resolve()` devolve `durationSeconds: totalDurationSeconds` - o valor ESTIMADO de entrada, nao o medido do arquivo (por isso o log do run_pipeline.js:234 'Duracao Final: 62.67' diverge do arquivo real).
run_pipeline.js:235 ate decide elegibilidade a TikTok Rewards (`durationSeconds >= 60`) com base nesse numero nao verificado.
Em seguida publisher_ingestor envia o arquivo. Nenhum gate de qualidade de audio existe no caminho.

**Causa-raiz**

O compositor confia nos parametros de entrada como se fossem fatos sobre o artefato de saida. Nao ha etapa de QA automatizada entre render e publicacao.

**Impacto no vídeo final**

Todos os defeitos acima (-6 dB do amix, 96 kHz, alvo de loudness errado, cauda cortada, ausencia de trilha) passam direto para a publicacao sem ninguem ser avisado. O sistema nao tem como saber que esta entregando audio fora de especificacao - e a metrica que ele reporta ao operador ('Duracao Final') e derivada da propria estimativa errada, o que torna o erro auto-confirmante.

**Correção**

Gate de QA obrigatorio apos o render, reutilizando os binarios ja instalados:
```js
function auditFinalAudio(videoPath, { targetI, targetTP, expectedDuration }) {
  const probe = JSON.parse(execFileSync(ffprobeBinary, ['-v','error','-print_format','json',
    '-show_format','-show_streams', videoPath]).toString());
  const a = probe.streams.find(s => s.codec_type === 'audio');
  const log = execFileSync(ffmpegBinary, ['-hide_banner','-nostats','-i', videoPath,
    '-af','ebur128=peak=true','-f','null','-'], { encoding:'utf8', stdio:['ignore','pipe','pipe'] });
  const I   = parseFloat(/I:\s*(-?[\d.]+) LUFS/.exec(log)?.[1]);
  const LRA = parseFloat(/LRA:\s*([\d.]+) LU/.exec(log)?.[1]);
  const TP  = parseFloat(/Peak:\s*(-?[\d.]+) dBFS/.exec(log)?.[1]);
  const issues = [];
  if (Math.abs(I - targetI) > 0.8) issues.push(`Loudness ${I} LUFS (alvo ${targetI})`);
  if (TP > targetTP + 0.2)         issues.push(`True peak ${TP} dBTP (limite ${targetTP})`);
  if (LRA < 4)                     issues.push(`LRA ${LRA} LU - locucao chapada (minimo 4)`);
  if (Number(a.sample_rate) !== 48000) issues.push(`Sample rate ${a.sample_rate} (esperado 48000)`);
  if (Math.abs(Number(probe.format.duration) - expectedDuration) > 0.15)
    issues.push(`Duracao ${probe.format.duration}s (esperado ${expectedDuration}s)`);
  if (issues.length) console.warn('[AUDIO QA] ' + issues.join(' | '));
  return { I, LRA, TP, sampleRate: a.sample_rate, duration: Number(probe.format.duration), issues };
}
```
Retornar esse objeto no `renderResult` e usar `renderResult.audioQa.duration` (medido) no lugar de `totalDurationSeconds` no resumo e na decisao de elegibilidade TikTok.

---

### `sentenceboundary-descartado-quebra-4-palavras` — SentenceBoundary e solicitado ao Edge-TTS e jogado fora; legendas quebram mecanicamente a cada 4 palavras e a heuristica de pontuacao e codigo morto

**Severidade:** MÉDIO · **Esforço:** medium · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/voice_synthesizer.js:54`

**Evidência**

voice_synthesizer.js:23 pede `sentenceBoundaryEnabled: true`, mas a linha 54 filtra `meta.Type === 'WordBoundary'` - toda a informacao de sentenca e descartada.
subtitle_generator.js:53 tenta compensar com `const isPunctuation = /[.?!,;:]$/.test(wb.word)` - mas o Edge-TTS NAO entrega pontuacao no campo `text.Text`. Verificacao empirica: das 40 linhas de texto do subtitles.srt gerado, ZERO contem qualquer caractere de pontuacao. A heuristica nunca dispara; 100% das quebras vem do contador `>= wordsPerChunk` (4).
Resultado no .srt real: 'E DA CALMA INTE' / 'COM VERDADEIRA MAESTRIA EXISTE' / 'UM PRINCÍPIO SILENCIOSO QUE' / 'POUCOS TÊM A CORAGEM' - artigos e conjuncoes orfaos no fim de cada bloco.

**Causa-raiz**

A informacao semantica correta (fim de sentenca) estava disponivel de graca no mesmo stream de metadata e foi filtrada fora; o fallback escolhido (pontuacao no texto da palavra) depende de um campo que o protocolo nao preenche.

**Impacto no vídeo final**

Legenda queimada em 1080x1920 quebrando frases no lugar errado a cada ~1,5s, com palavras orfas ('QUE', 'A', 'E') fechando blocos. O espectador le em trancos, o cerebro reprocessa a cada bloco, e a leitura compete com o audio em vez de reforca-lo. E a legenda e o elemento mais lido de um Short sem som.

**Correção**

1) Em voice_synthesizer, capturar tambem as sentencas:
```js
if (meta.Type === 'SentenceBoundary') {
  sentenceBoundaries.push({
    startMs: Math.round(meta.Data.Offset / 10000),
    endMs:   Math.round((meta.Data.Offset + meta.Data.Duration) / 10000),
    text:    meta.Data.text?.Text || ''
  });
}
```
e retornar `sentenceBoundaries` junto do resultado.
2) Em subtitle_generator, trocar a quebra por contador por uma quebra hierarquica: (a) NUNCA atravessar um `sentenceBoundary.endMs`; (b) dentro da sentenca, quebrar na maior lacuna temporal entre palavras (proxy de virgula/respiracao) que deixe blocos de 2 a 4 palavras; (c) nunca terminar um bloco em stopword - lista pt-BR `['a','o','e','de','do','da','em','um','uma','que','com','por','para','no','na','os','as','se','ao']`: se a ultima palavra do bloco estiver na lista, empurra ela para o bloco seguinte.
3) Ler tambem `visual_profile.subtitles_style` do canal (hoje ignorado - o .ass gerado diz 'Arial,65,...,380' contra 'Montserrat-Black, margin_v 160' do JSON).

---

## Engenharia de Prompt Visual (ai_prompt_generator.js + youtube_analyzer.js + entrega do prompt ao gerador de imagem)

17 achados.

### `stateless-per-scene-llm-no-diversity` — Zero Repeticao e impossivel: cada cena e uma chamada LLM independente que nao conhece as outras

**Severidade:** CRÍTICO · **Esforço:** medium · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/ai_prompt_generator.js:499`

**Evidência**

O system prompt diz `1. STRICT ZERO REPETITION: This is scene #${sceneNum} of ${totalScenes}. The visual subject, composition, and framing MUST be 100% UNIQUE and completely different from any other scene in the narrative.` mas queryGeminiPromptExpansion e chamada 1x por cena, sem historico, sem lista das cenas ja geradas. PROVA EMPIRICA (burst real de 9 chamadas executado hoje contra gemini-flash-lite-latest com o system prompt GHIBLI literal do arquivo): cena3='A weary medieval knight in moss-covered steel armor sits peacefully on a sun-dap...', cena5='A weary medieval knight in moss-covered plate armor resting peacefully beneath t...', cena7='A gentle medieval knight in mossy, rounded steel armor rests peacefully sitting ...', cena8='A gentle medieval knight in moss-covered plate armor resting peacefully beneath ...'. 4 de 6 respostas bem-sucedidas descrevem O MESMO PLANO (cavaleiro musgoso descansando sob arvore).

**Causa-raiz**

Diversidade entre cenas e uma propriedade GLOBAL do conjunto, mas o sistema so faz otimizacao LOCAL (uma cena por vez). Pedir unicidade a um modelo stateless que nao ve as outras cenas e um no-op semantico: o modelo sempre cai no atrator de maior probabilidade do prompt ('cozy ghibli knight' -> cavaleiro sob arvore).

**Impacto no vídeo final**

E exatamente a monotonia visual observada no video final (mesma composicao de cavaleiro sob arvore em cenas diferentes). O espectador percebe que o video 'nao anda', a retencao despenca no meio do Short porque nada muda visualmente entre os beats.

**Correção**

Trocar N chamadas independentes por 1 UNICA chamada que recebe TODAS as frases e devolve TODAS as cenas em JSON (responseMimeType:'application/json' + responseSchema). O modelo passa a ver o conjunto e pode diferenciar de fato. Adicionalmente, impor diversidade por CONSTRUCAO e nao por pedido: passar no prompt uma grade obrigatoria de shot-types que rotaciona ['extreme_closeup','macro_object','medium_two_shot','wide_establishing','over_shoulder','low_angle_hero','top_down','silhouette_backlit'] e uma grade de ambientes, e VALIDAR o retorno rejeitando cenas cujo campo `subject` tenha similaridade de trigramas > 0.45 com qualquer cena anterior (reprompt so das cenas colididas).

---

### `hardcoded-scene-banks-idx-modulo` — Bancos de cenas HARDCODED selecionados por idx % length: o visual nao representa a frase e repete deterministicamente

**Severidade:** CRÍTICO · **Esforço:** large · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/ai_prompt_generator.js:183`

**Evidência**

ghibliScenes(10), animeScenes(8), stoicScenes(7), cyberScenes(6), photoScenes(8) sao arrays literais; o retorno final de cada ramo e `return photoScenes[idx % photoScenes.length]` (L229, L278, L299, L318, L350). PROVA EMPIRICA (rodei deriveVisualSubjectFromPhrase com as 8 frases reais do roteiro estoico): #0 'brain model in dark laboratory', #1 'glowing embers in a rustic stone hearth', #2 'brain model in dark laboratory', #3 'antique brass compass', #4 'brain model in dark laboratory', #5 'night sky Milky Way', #6 'hands holding brass keys', #7 'traveler on mountain peak'. 3 das 8 cenas sao BYTE-A-BYTE IDENTICAS. E a frase #1 'Quando voce se irrita com provocacoes voce entregou o controle emocional' virou 'brasas numa lareira rustica' — zero relacao semantica, foi so idx=1.

**Causa-raiz**

O 'sujeito visual' nao e derivado da frase: e escolhido de um catalogo fechado por indice. Com 8 cenas e um banco de 8, qualquer frase que nao case com as ~8 palavras-chave vira uma funcao do INDICE, nao do CONTEUDO. O banco tambem e universal (o mesmo cavaleiro/cerebro serve para qualquer topico).

**Impacto no vídeo final**

Duas patologias visiveis no video: (a) imagens que nao tem nada a ver com o que esta sendo narrado naquele segundo (descompasso 'silencio e calma interior' -> fogueira/cavaleiro); (b) o mesmo enquadramento aparecendo 2-3x no mesmo Short de 62s. O video parece um slideshow de banco de imagens, nao uma narrativa.

**Correção**

Deletar os 5 bancos. O sujeito deve vir SEMPRE de um beat estruturado retornado pelo LLM (ver finding arch-visual-beat-schema): {subject, action, environment}. Manter apenas um banco de EMERGENCIA de ultimo recurso (rede 100% fora), e nesse caso derivar o indice de um hash da frase (`hashFnv(phrase) % bank.length`) e nao de `idx`, com remocao das opcoes ja usadas no run (pop de um pool embaralhado), garantindo pelo menos nao-repeticao dentro do video.

---

### `substring-includes-false-positives` — Roteamento visual por includes() de substring dispara em sufixos -mente, -cidade, jornada, preparar, esperanca

**Severidade:** CRÍTICO · **Esforço:** small · **Categoria:** bug  
**Arquivo:** `pipeline/src/youtube_analyzer.js:486`

**Evidência**

deduceActionIntent usa `p.includes('mente')`, `p.includes('nada')`, `p.includes('repar')`, `p.includes('espera')`. PROVA EMPIRICA (execucao real da funcao exportada): 'A maioria das pessoas falha constantemente nesse ponto' -> intent=inner_mind (cerebro/neuronios); 'Isso e simplesmente uma distracao irrelevante' -> intent=inner_mind; 'Comece a sua jornada agora mesmo' -> intent=tense_silence (dois vultos em impasse); 'Voce precisa se preparar antes' -> intent=gaze_focus; 'Tenha esperanca no processo' -> intent=tense_silence. O mesmo padrao existe em deriveVisualSubjectFromPhrase (`p.includes('mente')` L343 -> photoScenes[2] cerebro).

**Causa-raiz**

Portugues e uma lingua de sufixacao: TODO adverbio termina em '-mente' e dezenas de substantivos abstratos terminam em '-cidade'. includes() nao respeita fronteira de palavra. Como 'mente' e a 1a-2a condicao testada, ela captura a maioria absoluta das frases de um roteiro de psicologia.

**Impacto no vídeo final**

A maior parte das frases do roteiro cai no MESMO bucket ('inner_mind'), o que colapsa a variedade e produz o cerebro-no-laboratorio / figura-pensativa repetidos. E gera descompasso: uma frase sobre 'falhar constantemente' vira uma imagem de neuronios brilhando.

**Correção**

Substituir todo `p.includes(x)` por regex com fronteira e normalizacao de acentos: `const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f-\u0300-\u036f]/g,'').toLowerCase(); const has = (re) => re.test(norm(p))` e usar `\b(mente|mentes)\b`, `\b(cidade|cidades)\b`, `\b(nada)\b`, `\b(reparar|reparou|repare)\b`. Melhor ainda: eliminar o if/else inteiro e obter `action` do LLM no beat estruturado, deixando o if/else so como fallback offline.

---

### `dictionary-midword-corruption` — VISUAL_SEMANTIC_DICTIONARY corrompe palavras no meio: 'felicidade' vira 'felisoaring skyscraper skyline'

**Severidade:** CRÍTICO · **Esforço:** small · **Categoria:** bug  
**Arquivo:** `pipeline/src/ai_prompt_generator.js:45`

**Evidência**

`{ regex: /arranha-c[eé]us?|cidade/gi, en: 'soaring skyscraper skyline at blue hour...' }` e `{ regex: /mente|consci[eê]ncia/gi, en: 'documentary photograph of thoughtful mature human...' }` — sem \b. PROVA EMPIRICA (translateDirectiveToCinematicEnglish real): 'o caminho da felicidade' -> 'o caminho of the felisoaring skyscraper skyline at blue hour with glowing emerald and cyan financial data lines'; 'pessoas falham constantemente' -> 'pessoas falham constantedocumentary photograph of thoughtful mature human in deep concentration...'. Palavras mutiladas ('feli', 'constante') ficam coladas ao ingles e entram no prompt final.

**Causa-raiz**

Dicionario de 30 regex sem ancoras de palavra aplicado com replace global sobre texto livre em PT. Atinge tambem: velocidade, necessidade, capacidade, publicidade, simplicidade, autenticidade + todos os adverbios -mente.

**Impacto no vídeo final**

O prompt enviado ao gerador contem lixo lexical em PT-EN misturado ('felisoaring'), o que o modelo de difusao tokeniza como ruido, e um SUJEITO ERRADO (arranha-ceus financeiros) num video sobre felicidade/psicologia. Contribui direto para o descompasso tematico observado.

**Correção**

Envolver todas as entradas com fronteira unicode-aware: gerar o regex programaticamente como `new RegExp('(?<=^|[^\\p{L}])(' + termo + ')(?=$|[^\\p{L}])','giu')`. Adicionar teste de regressao com a lista ['felicidade','velocidade','necessidade','constantemente','simplesmente','realmente'] assertando que translateDirectiveToCinematicEnglish nao altera nenhuma delas. Ordenar entradas por especificidade decrescente e aplicar no maximo 1 substituicao por span de texto (marcacao de offsets ja consumidos).

---

### `gemini-burst-timeout-6000` — Promise.all dispara todas as cenas simultaneamente com timeout de 6000ms: 33% das cenas abortam e caem no banco hardcoded

**Severidade:** CRÍTICO · **Esforço:** medium · **Categoria:** bug  
**Arquivo:** `pipeline/src/youtube_analyzer.js:617`

**Evidência**

generateThematicScenes monta `scenePromises = phrases.map(async ...)` e faz `await Promise.all(scenePromises)` (L580-617); dentro, queryGeminiPromptExpansion usa `setTimeout(() => controller.abort(), 6000)` (ai_prompt_generator.js L550), SEM retry, SEM cache, SEM backoff, SEM limite de concorrencia. PROVA EMPIRICA (burst real de 9 chamadas paralelas, wall=6034ms): cenas 1, 4 e 9 retornaram 'AbortError: This operation was aborted'. 3/9 = 33% de perda. O catch em buildProfessionalScenePrompt (L130-132) e um `catch {}` silencioso que cai no heuristico.

**Causa-raiz**

Fan-out sem controle de concorrencia contra um endpoint de free tier, com timeout menor que a cauda de latencia agregada. O erro e engolido sem log, entao a degradacao e invisivel na console.

**Impacto no vídeo final**

Mistura de dois universos visuais DENTRO DO MESMO VIDEO: ~2/3 das cenas com prompt neural rico e ~1/3 com o banco hardcoded (ghibliScenes[0] = 'cavaleiro encostado num carvalho'). Isso explica precisamente o cavaleiro-sob-arvore reaparecendo e a sensacao de video costurado de pedacos. Pior: e nao-deterministico, cada run degrada em cenas diferentes.

**Correção**

(1) Chamada UNICA em batch para todas as cenas (elimina o fan-out por completo). (2) Se mantiver por-cena: pool de concorrencia 2-3 (`p-limit` ou fila manual), timeout 15000ms, 2 retries com backoff exponencial+jitter e tratamento explicito de HTTP 429/503. (3) Cache em disco por chave sha1(phrase+style+blockType) em pipeline/scratch/.prompt_cache/ para reruns nao repagarem latencia. (4) Logar `console.warn` em cada fallback para a degradacao ser visivel.

---

### `compact-prompt-truncation-250` — makeCompactFallbackPrompt descarta 61% do prompt engenheirado antes do UNICO gerador que funciona

**Severidade:** CRÍTICO · **Esforço:** small · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/ai_image_connector.js:153`

**Evidência**

`let compact = clean.length <= 250 ? clean : clean.slice(0, 250).replace(/,[^,]*$/, '')`. MEDICAO REAL: prompt heuristico Ghibli completo = 736 chars; apos makeCompactFallbackPrompt = 290 chars (perda de 61%). O que e cortado sao justamente as camadas finais: 'flat gouache colors, soft watercolor textures, bold clean ink outlines, ... vertical 9:16 framing, cinema composition, no text, no watermark, no captions, no split screen, no blur'. Como Imagen 3 retorna 404 nessa chave, 100% das imagens passam por esse corte.

**Causa-raiz**

A arquitetura de '5 camadas' foi desenhada para o caminho Imagen (que nunca executa) e o unico caminho vivo (Pollinations) aplica um truncamento cego por caractere que decapita as camadas de estilo, lente, iluminacao e anti-artefato — todas posicionadas no FIM da string.

**Impacto no vídeo final**

As imagens perdem o contrato de estilo e os guard-rails textuais ('no text','no watermark','no blur'). Resultado visivel: marca d'agua e texto espurio nas imagens, estilo inconsistente entre cenas, e ausencia de qualquer instrucao de qualidade. Toda a engenharia de prompt do projeto e jogada fora no ultimo metro.

**Correção**

Parar de truncar por caractere. Montar o prompt ja no orcamento do destino: priorizar por camadas com pesos e cortar CAMADAS inteiras de menor prioridade (ordem de descarte: ambiente_detalhe > lente > grading > estilo > acao > sujeito; nunca descartar sujeito+estilo+aspecto). Se o destino exige URL curta, comprimir com um passe deterministico de remocao de adjetivos redundantes, e SEMPRE reanexar o sufixo obrigatorio de controle ('vertical 9:16, no text, no watermark') APOS o corte, nunca antes.

---

### `negative-prompt-noop` — Negative prompt e no-op: ausente no caminho Imagen e ignorado pelo endpoint do Pollinations

**Severidade:** ALTO · **Esforço:** small · **Categoria:** bug  
**Arquivo:** `pipeline/src/ai_image_connector.js:186`

**Evidência**

getNegativePromptForDirective() (L105-131) so e usada para montar `&negative_prompt=${negParam}` nas URLs GET de image.pollinations.ai (L186 e L238). O payload de generateImageWithImagen3 (L31-44) tem apenas {sampleCount, aspectRatio, outputMimeType, personGeneration, safetySetting} — nenhum negativePrompt. E a API GET do Pollinations nao documenta/nao honra `negative_prompt` (evidencia colateral: `model=flux` e `model=turbo` retornaram bytes de tamanho IDENTICO 40532, e `nologo=true` nao removeu a marca d'agua — os query params extras sao ignorados).

**Causa-raiz**

O negativo foi tratado como parametro de transporte de um provider especifico em vez de parte do contrato do prompt. Como o unico transporte vivo ignora o parametro, o negativo nunca chega ao modelo.

**Impacto no vídeo final**

Exatamente os defeitos vistos nos frames: anatomia deformada (cavaleiro sem rosto, elmo derretido), maos erradas, marca d'agua 'pollinations.ai' queimada, textura borrada. Nada disso esta sendo suprimido porque a lista de negativos ('deformed anatomy, bad hands, blurry, watermark') nunca e aplicada.

**Correção**

Tratar negativos como parte do TEXTO do prompt quando o provider nao suporta campo dedicado: anexar sufixo textual '. Avoid: deformed anatomy, extra fingers, malformed hands, blurry, watermark, text overlay, cropped face.' (modelos Flux respondem a negacao textual). Quando migrar para gemini-*-image via :generateContent, colocar os negativos como instrucao explicita no texto, pois esses modelos tambem nao tem campo negativePrompt. E remover do codigo a ilusao de que negative_prompt esta ativo (logar o provider real e se o negativo foi aplicado).

---

### `no-consistency-anchor` — Nenhuma ancoragem de consistencia entre cenas: seed aleatorio por run, sem style token, sem paleta, sem ficha de personagem

**Severidade:** ALTO · **Esforço:** medium · **Categoria:** arch  
**Arquivo:** `pipeline/src/visuals_harvester.js:500`

**Evidência**

`const fixedVideoSeed = Math.floor(Math.random() * 100000)` (L410) e `const sceneSeed = fixedVideoSeed + (i * 1039) + 77` (L500). Nao existe em lugar nenhum: um identificador de personagem persistido, uma paleta fixa (hex), um style token repetido literalmente em todos os prompts, nem imagem de referencia. Cada prompt reconstroi o estilo com frases diferentes (buildHeuristicCinematicPrompt gera 5 wrappers diferentes por estilo, e o Gemini inventa a redacao do estilo a cada chamada — vide o burst: 'weathered brass-trimmed green armor' vs 'moss-covered steel armor' vs 'mossy, rounded steel armor' para o MESMO personagem).

**Causa-raiz**

O sistema randomiza o que deveria ser ESTAVEL (identidade do personagem, paleta, grain, lente) e mantem estavel o que deveria VARIAR (composicao, vinda do banco por indice). E a inversao exata do que produz coerencia cinematografica.

**Impacto no vídeo final**

O 'mesmo' cavaleiro muda de armadura, de cor e de rosto a cada corte — o espectador nao reconhece continuidade e o video parece uma colagem de 8 videos diferentes. Somado a repeticao de composicao, produz a impressao de 'IA generica'. Alem disso, seed aleatorio por run impede reproduzir/reparar um video ruim.

**Correção**

Introduzir um STYLE CONTRACT por run, persistido no manifest: {runSeed: hash(scriptId), styleToken: 'ghibli-gouache-v1', palette:['#2E4A32','#D9B26A','#1B2430'], characterSheet:'a 30-year-old knight, short auburn beard, dented steel sallet helm, faded azure wool cloak, brass pauldrons', filmStock:'Kodak Portra 400', lens:'85mm f/1.4'}. Injetar characterSheet+palette+styleToken LITERALMENTE (mesmas palavras) em TODAS as cenas que contenham o personagem, e derivar sceneSeed = runSeed + i de forma deterministica. Onde o provider suportar (gemini-*-image aceita imagem de referencia no :generateContent), reenviar a cena 1 como referencia de identidade para as cenas seguintes.

---

### `dedup-usedprompts-noop` — Anti-repeticao por usedPrompts e no-op: compara string exata e o sufixo adicionado e depois truncado fora

**Severidade:** ALTO · **Esforço:** medium · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/visuals_harvester.js:428`

**Evidência**

`if (scenePrompt && usedPrompts.has(scenePrompt)) { scenePrompt = `${scenePrompt}, unique composition variation angle #${i + 1}, distinct perspective`; }`. Dois problemas provados: (a) Set.has exige igualdade EXATA — no burst real, 4 prompts descreviam a mesma cena com redacoes diferentes ('A weary medieval knight...' vs 'A gentle medieval knight...'), logo o Set nunca dispara; (b) mesmo quando dispara, o sufixo e anexado no FIM e `makeCompactFallbackPrompt` corta em 250 chars de um prompt de 736 chars — o sufixo e descartado antes de sair na URL.

**Causa-raiz**

Deduplicacao sintatica (identidade de string) aplicada a um problema semantico (similaridade de cena), e aplicada na camada errada (depois da geracao do prompt, antes de um truncamento que a desfaz).

**Impacto no vídeo final**

Nao existe NENHUMA barreira efetiva contra imagens repetidas. E o motivo direto da mesma composicao aparecer em cenas distintas do video final, apesar do codigo e dos system prompts alegarem 'ZERO REPETICAO' em cinco lugares diferentes.

**Correção**

Deduplicar no campo estruturado, nao na string: manter um Set de `${shotType}|${subjectHead}|${environment}` do visual beat, e recusar/reprompter a cena colidida antes de renderizar. Complementar com similaridade de trigramas (Dice) > 0.45 sobre `subject+environment`. Se ainda colidir apos 1 reprompt, forcar o shotType nao usado da grade. E validar a saida tambem em pixel: comparar dHash das imagens geradas e regerar com outro seed se a distancia de Hamming < 10.

---

### `action-intent-dead-code` — deduceActionIntent calcula actionEn mas ele NUNCA entra no prompt de imagem (dead code)

**Severidade:** ALTO · **Esforço:** small · **Categoria:** bug  
**Arquivo:** `pipeline/src/youtube_analyzer.js:583`

**Evidência**

Em generateThematicScenes: `const intent = deduceActionIntent(phrase);` (L583). Nas linhas seguintes o objeto e usado apenas em `visualDesc = ... ${intent.actionPt}` (L598-600) e em `keywords: [..., intent.type]` (L612). O campo `intent.actionEn` ('intense focused eyes holding a direct, unflinching piercing stare...', etc.) NAO e passado para buildProfessionalScenePrompt (L587-596, que recebe apenas spokenPhrase, visualDirective, channelAesthetic, blockType, motionType, apiKey, sceneIndex, totalScenes) e nao aparece em lugar nenhum do prompt final.

**Causa-raiz**

Refatoracao incompleta: a camada de 'acao dramatica' foi escrita para o prompt e acabou usada so para a descricao em portugues do manifest/UI. O prompt real deriva a acao de novo, por dentro, a partir dos bancos hardcoded.

**Impacto no vídeo final**

A unica camada do pipeline que tentava ligar a ACAO da frase a ACAO da imagem esta desconectada. As imagens ficam estaticas e genericas (sujeito parado em chiaroscuro) porque o prompt final so tem sujeito+estilo, sem verbo. Um 'visual beat' sem acao e literalmente um cartao-postal — e isso e o que se ve no video.

**Correção**

Ou remover a funcao, ou (melhor) promove-la a campo de primeira classe do beat: incluir `action` no schema do visual beat e concatena-lo no prompt entre sujeito e ambiente. No fallback heuristico, passar `actionEn` explicitamente: buildProfessionalScenePrompt({..., actionHint: intent.actionEn}) e usar `${subject}, ${actionHint}, ${environment}` em buildHeuristicCinematicPrompt.

---

### `maxoutputtokens-180-margin` — maxOutputTokens=180 opera a 96% do limite e nao ha validacao de finishReason

**Severidade:** ALTO · **Esforço:** trivial · **Categoria:** bug  
**Arquivo:** `pipeline/src/ai_prompt_generator.js:562`

**Evidência**

`generationConfig: { temperature: 0.7, maxOutputTokens: 180 }` (L560-563) e a validacao e apenas `if (text && text.trim().length > 30) return text.trim()...` (L573-575) — `finishReason` nunca e lido. MEDICAO REAL (burst com os system prompts literais do arquivo): candidatesTokenCount = 168 e 172 em duas das seis respostas (93% e 96% do orcamento); 149, 137, 134, 128 nas demais. A margem media e de ~8 tokens.

**Causa-raiz**

Orcamento apertado para caber na latencia de 6s, sem checagem de MAX_TOKENS. Basta o modelo gastar 10 tokens a mais (uma frase introdutoria, um estilo mais verboso) para o prompt sair cortado no meio de uma clausula — e o codigo aceita porque tem >30 chars.

**Impacto no vídeo final**

Prompts truncados perdem exatamente o final da string, onde ficam as instrucoes de estilo/aspecto/anti-texto — mesmo efeito do truncamento de 250 chars, so que estocastico. Gera cenas com estilo inconsistente sem nenhum aviso.

**Correção**

Subir maxOutputTokens para 400-512 (custo irrelevante no flash-lite), e validar: `if (cand.finishReason !== 'STOP') -> descartar e usar fallback/reprompt`. Validar tambem que o texto nao comeca com preambulo ('Here is','Sure','Prompt:'), que tem >=120 chars, que e ASCII/ingles (rejeitar se contiver acentuacao PT densa) e que nao contem recusa de safety. Hoje qualquer string de 31 chars e aceita como prompt cinematografico.

---

### `ghibli-lighting-fireflies-collision` — Regex /fire/ captura 'fireflies' e injeta 'campfire glow + rising embers' numa cena de vaga-lumes ao crepusculo

**Severidade:** ALTO · **Esforço:** trivial · **Categoria:** bug  
**Arquivo:** `pipeline/src/ai_prompt_generator.js:404`

**Evidência**

`if (/campfire|fire|embers|flames|hearth/i.test(subLower)) { lightingAtmosphere = 'warm crackling campfire glow ... rising embers' } else if (/firefl|bioluminescent|twilight/i.test(subLower)) {...}`. O ramo /firefl/ e INALCANCAVEL para qualquer sujeito com 'fireflies', porque 'fireflies' contem 'fire'. PROVA REAL (build do prompt com sceneIndex=4, estilo Ghibli): saida = '...bioluminescent yellow-green fireflies floating softly over a tranquil glassy forest pool, giant willow tree in background, dramatic medium framing, mysterious atmospheric chiaroscuro..., warm crackling campfire glow casting dancing amber highlights and deep twilight shadows, rising embers, flat gouache colors...'. O prompt pede vaga-lumes noturnos E fogueira ao mesmo tempo.

**Causa-raiz**

Cadeia else-if ordenada por generalidade crescente-errada (o padrao mais curto e generico vem primeiro) e sem fronteira de palavra. Erro estrutural identico ao dos includes() em PT.

**Impacto no vídeo final**

Instrucoes de iluminacao contraditorias no mesmo prompt produzem imagens 'lavadas'/incoerentes (o difusor tenta conciliar luz de fogueira quente com penumbra azul de crepusculo). Pior, o mesmo texto 'campfire' faz detectSceneCinemagraphFX (visuals_harvester.js L~145) escolher 'fire_embers' e sobrepor brasas laranja num plano de vaga-lumes — o defeito se propaga ate o motion engine.

**Correção**

Reordenar do mais especifico para o mais generico e ancorar: testar `/\b(fireflies|firefly|bioluminescent)\b/` ANTES de `/\b(campfire|bonfire|hearth|flames?|embers?)\b/`. Melhor: parar de inferir luz por regex sobre o texto do sujeito — a luz deve ser um CAMPO do visual beat (`lighting`), decidido junto com o sujeito, nunca re-adivinhado depois.

---

### `detect-aesthetic-brittle` — detectAestheticStyle: um match errado troca o UNIVERSO visual inteiro, e termos obvios como 'samurai' nao casam

**Severidade:** ALTO · **Esforço:** small · **Categoria:** bug  
**Arquivo:** `pipeline/src/ai_prompt_generator.js:150`

**Evidência**

Cadeia de 5 regex com ordem de precedencia fixa; a primeira que casar vence. PROVA REAL: detectAestheticStyle('samurai da disciplina','Dark Minimalist Chiaroscuro') -> 'REALISTIC_PHOTO', porque o ramo ANIME exige `samurai\s*anime` e nao 'samurai' sozinho. Inversamente, o ramo GHIBLI casa com o token isolado `medieval\s*relaxante|floresta\s*encantada|cozy\s*fantasy` — qualquer diretriz com 'fantasia medieval' leva o video inteiro para gouache Ghibli, inclusive um topico de psicologia ('O Poder do Silencio e da Calma Interior'), que e exatamente o descompasso observado no video renderizado.

**Causa-raiz**

Classificador de 1 bit por regex sobre texto livre do usuario, sem score, sem confianca, sem tie-break, e com vocabulario incompleto. O retorno alimenta 4 decisoes downstream (banco de cenas, wrapper de prompt, system prompt do Gemini, negative prompt), entao um erro se propaga por todo o pipeline.

**Impacto no vídeo final**

Estilo errado no video inteiro (os 8 planos), nao em uma cena. E o modo de falha mais caro do sistema: 62 segundos de fantasia medieval para um topico de neurociencia.

**Correção**

Trocar por classificacao com score somado (cada termo casado soma peso ao seu estilo; vence o maior score) e um limiar minimo — abaixo do limiar, perguntar ao LLM na mesma chamada em batch (campo `style` do JSON) em vez de chutar REALISTIC_PHOTO. Expandir o lexico anime com 'samurai','katana','ronin','mecha','isekai' isolados. Logar o estilo detectado e a confianca no manifest para auditoria. E: detectAestheticStyle e chamada com UM argumento em deriveVisualSubjectFromPhrase (L177), descartando channelAesthetic — padronizar a assinatura em todos os call sites.

---

### `arch-visual-beat-schema` — PROPOSTA: schema de Visual Beat estruturado + chamada unica em JSON + grade de diversidade e contrato de estilo

**Severidade:** ALTO · **Esforço:** large · **Categoria:** arch  
**Arquivo:** `pipeline/src/ai_prompt_generator.js:101`

**Evidência**

Hoje o contrato entre narracao e imagem e uma STRING opaca montada por concatenacao (buildHeuristicCinematicPrompt L416-471 monta 5 arrays de string e faz .join(', ')), sem campos, sem validacao, sem possibilidade de dedup semantica, sem possibilidade de reaproveitar o sujeito no negative prompt, no cinemagraph FX ou na query de stock. Todas as 16 falhas acima derivam dessa escolha.

**Causa-raiz**

Ausencia de uma representacao intermediaria tipada entre 'frase falada' e 'prompt de difusao'. Prompt-as-string impede validar, deduplicar, ancorar e degradar com qualidade.

**Impacto no vídeo final**

Enquanto o contrato for string, cada correcao pontual sera desfeita pela proxima camada (como o sufixo de dedup sendo truncado). A arquitetura abaixo e o que permite visuais que representam a frase, variam entre si e mantem identidade.

**Correção**

1) SCHEMA (um objeto por beat, validado com JSON Schema): {id, phrase, blockType, shotType (enum de 8: extreme_closeup|macro_object|medium_two_shot|wide_establishing|over_shoulder|low_angle_hero|top_down|silhouette_backlit), subject (sintagma nominal concreto, <=12 palavras, DERIVADO da frase), action (verbo no gerundio, o que acontece AGORA), environment (lugar+hora do dia), lighting, lens (ex '85mm f/1.4'), palette (3 hex do styleContract), styleToken (literal, identico em todas as cenas), motionType, cinemagraphFX, negatives[]}. 2) DERIVACAO DO SUJEITO: uma UNICA chamada a gemini-flash-lite-latest com responseMimeType='application/json' + responseSchema (array de beats), recebendo TODAS as frases de uma vez + o styleContract + a grade de shotTypes obrigatoria; instrucao chave: 'subject deve ser o referente CONCRETO e FISICO do que a frase diz — se a frase e abstrata, escolha uma metafora objetual distinta das ja usadas'. Como sao ~9 beats numa chamada, o custo cai ~9x, a latencia vira 1 RTT (usar timeout 20s, 2 retries) e o modelo enxerga o conjunto. 3) VALIDACAO: rejeitar beat com subject vazio/abstrato (lista negra: 'concept','idea','mind','success'), com shotType repetido fora da grade, ou com Dice(subject_i, subject_j) > 0.45; reprompt apenas dos beats invalidos (1 rodada), depois fallback deterministico por hash. 4) RENDERIZACAO: `renderPrompt(beat)` monta a string na ordem canonica sujeito -> acao -> ambiente -> luz -> lente -> estilo/styleToken -> paleta -> aspecto, com orcamento de caracteres por camada e descarte por prioridade (nunca cortar sujeito/estilo/aspecto), e anexa os negativos como sufixo textual quando o provider nao tem campo dedicado. 5) COERENCIA: styleContract persistido no manifest (runSeed deterministico, characterSheet, palette, filmStock, lens) repetido literalmente em todas as cenas; sceneSeed = runSeed + i. 6) DIVERSIDADE: garantida pela grade de shotType+environment imposta no schema, nao por pedido em linguagem natural. 7) OBSERVABILIDADE: gravar todos os beats + prompts finais + provider + seed em pipeline/output/<run>/visual_beats.json para auditar por que uma cena saiu errada (hoje e impossivel).

---

### `staging-action-contradicts-style` — stagingAction injeta 'dark chiaroscuro / mysterious' dentro do estilo Ghibli cozy, contradizendo 'peaceful tranquil mood'

**Severidade:** MÉDIO · **Esforço:** small · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/ai_prompt_generator.js:393`

**Evidência**

O switch(blockType) (L372-398) so tem dois ramos: ANIME_SHONEN e 'o resto'. Para GHIBLI_COZY_FANTASY cai no ramo generico: 'dramatic medium framing, mysterious atmospheric chiaroscuro with subtle dust particles drifting'. Esse texto e concatenado na posicao 2 do promptParts do ramo Ghibli (L416-422), que na posicao 4 diz 'peaceful tranquil mood'. Prompt real medido contem literalmente as duas coisas.

**Causa-raiz**

A camada de encenacao (stagingAction/lensSpec) foi parametrizada por blockType mas nao por style; so o anime recebeu tratamento especial.

**Impacto no vídeo final**

Sinais contraditorios de mood no mesmo prompt -> imagens escuras e sem graca quando o briefing pedia cozy/luminoso, e vice-versa. Contribui para o aspecto 'sujo/borrado' e para a falta de identidade visual entre cenas.

**Correção**

Tornar stagingAction e lensSpec uma matriz (style x blockType), definida em uma tabela de dados e nao em switch: STAGING[style][blockType]. Para GHIBLI_COZY_FANTASY/hook usar 'wide establishing shot, soft depth, gentle rule-of-thirds composition'; nunca herdar tokens de chiaroscuro. Adicionar um linter de prompt que rejeita a coexistencia de pares proibidos (chiaroscuro+cozy, photorealistic+cel-shaded, dark+peaceful).

---

### `directive-fallback-scenes-armor` — Cenas de fallback por diretriz interpolam o texto do usuario em templates de guerra: 'fierce <cozy forest> in ornate dark armor'

**Severidade:** MÉDIO · **Esforço:** small · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/youtube_analyzer.js:632`

**Evidência**

As 6 cenas de fallback (L627-676) sao templates fixos com `${cleanDirective}` interpolado: 'Cinematic vertical 9:16 close-up portrait of fierce ${cleanDirective} in ornate dark armor, intense eyes staring with determination', '${cleanDirective} standing in strategic disciplined formation, ancient council', 'ancient shields and banners in dark fog', 'hands firmly gripping weapons or parchment'. A diretriz e tratada como se fosse SEMPRE um substantivo de personagem guerreiro.

**Causa-raiz**

Templates escritos para um unico caso de uso (guerreiros persas) e generalizados por interpolacao de string, sem verificar a categoria gramatical/semantica da diretriz.

**Impacto no vídeo final**

Qualquer diretriz que nao seja um personagem guerreiro produz prompts gramaticalmente absurdos e visualmente errados ('fierce floresta encantada in ornate dark armor'), e todas as 6 cenas ficam no mesmo universo de batalha independentemente do tema — repeticao garantida por construcao.

**Correção**

Eliminar esses templates. O fallback sem narracao deve reutilizar o mesmo schema de visual beat, preenchendo subject/action/environment a partir da diretriz via LLM, ou (offline) via um template neutro que nao presuma personagem: '${directiveEn}, ${shotType} composition, ${lighting}' com shotType rotacionando pela grade de enquadramentos.

---

### `optimize-directive-dead-branch` — optimizeDirectiveForPrompt: toda a cadeia de .replace abaixo do primeiro return e codigo morto

**Severidade:** BAIXO · **Esforço:** trivial · **Categoria:** bug  
**Arquivo:** `pipeline/src/youtube_analyzer.js:542`

**Evidência**

`const translated = translateDirectiveToCinematicEnglish(directive); if (translated && translated.length > 0) return translated;` — translateDirectiveToCinematicEnglish so retorna '' quando a entrada e falsy/nao-string, caso ja barrado por `if (!directive) return ''` na linha acima. Logo as ~13 chamadas de .replace (L548-560) sao inalcancaveis. Alem disso `directiveEn` (L571) e calculado e nunca usado no ramo principal de visual beats (L574-622).

**Causa-raiz**

Duplicacao historica entre dois tradutores (o dicionario e a cadeia de replace) sem remocao do antigo, mais uma variavel calculada e esquecida.

**Impacto no vídeo final**

Nenhum impacto direto na imagem, mas mascara o problema real: a diretriz do usuario traduzida (`directiveEn`) NAO chega ao prompt no caminho principal — so `cleanDirective` em PT vai para detectAestheticStyle. A intencao do usuario e perdida silenciosamente quando o Gemini falha.

**Correção**

Remover a cadeia morta e usar `directiveEn` de fato: passar `visualDirectiveEn` para buildProfessionalScenePrompt e concatena-lo no prompt heuristico como camada de tema, em vez de usar a diretriz apenas como entrada de um classificador de estilo.

---

## sincronia-e-timing

16 achados.

### `pause-snap-ignora-alvo` — findOptimalPauseCut escolhe a MAIOR pausa de toda a janela e ignora o targetTimeMs — colapsa o video inteiro em 1 cena de 33s

**Severidade:** CRÍTICO · **Esforço:** small · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/scene_aligner.js:178`

**Evidência**

Condicao: `if (pause > 200 && (pause > maxPause || (Math.abs(pause - maxPause) < 100 && dist < closestDist))) {...} else if (maxPause < 200 && dist < closestDist) {...}`. Assim que a primeira pausa >200ms e aceita, maxPause deixa de ser <200 e o ramo 'mais proximo do alvo' fica PERMANENTEMENTE desligado; sobra so 'a maior pausa da janela'. Probe real executado hoje com os wordBoundaries reais do Edge-TTS (160 palavras, 57.18s): `findOptimalPauseCut(wb, 9000, 5890, 48480)` -> 33162ms (erro +24.162s) e `findOptimalPauseCut(wb, 20000, 5890, 48480)` -> 33162ms (erro +13.162s). MESMA saida para alvos 11s distintos = funcao invariante ao alvo. 33162ms e exatamente a maior pausa do audio (822ms, indice 94, palavra 'Nao' @33262ms). Consequencia medida com 8 cenas sem phrase: take1 = 0 -> 33.16s (33.16s!), takes 2-8 espremidos: 5.05 | 11.03 | 1.83 | 1.50 | 1.51 | 1.70 | 1.70.

**Causa-raiz**

A janela [minAllowedCutMs, maxAllowedCutMs] e enorme (ex: 5.9s a 48.5s = 42s de busca) porque maxAllowedCutMs so garante o minimo das cenas restantes, e a heuristica de desempate prioriza magnitude de pausa em vez de proximidade ao alvo. Nao ha janela local em torno do alvo.

**Impacto no vídeo final**

Uma unica imagem estatica (borrada, 576x1024 upscalada) fica 33 segundos na tela = 53% do short sem nenhum corte, e depois 7 cortes atropelados de 1.5s no final. Retencao destruida: o espectador sai nos primeiros 5s de imagem parada. O short nao tem ritmo nenhum — e um slideshow travado seguido de um flicker.

**Correção**

Substituir por busca em JANELA LOCAL com custo composto. (1) Definir searchWindow = ±min(1200ms, 0.35*duracaoAlvoDaCena) ao redor de targetTimeMs. (2) Score de cada candidato i: `score = pauseMs/300 - Math.abs(mid - target)/searchWindow * 2 + (terminaEmPontuacaoForte ? 1.5 : 0)`. (3) Escolher argmax dentro da janela; se nenhum candidato, cortar exatamente em targetTimeMs arredondado para o frame. (4) Corrigir o else-if quebrado trocando `maxPause < 200` por `bestScore === -Infinity`. (5) Passar `boundaryCursor` como indice inicial do loop em vez de sempre 1.

---

### `match-falso-positivo-score2` — findWordSequenceIndex aceita match com score 2.0 casando SO a primeira palavra — frase inexistente casa com o artigo 'a'

**Severidade:** CRÍTICO · **Esforço:** small · **Categoria:** bug  
**Arquivo:** `pipeline/src/scene_aligner.js:95`

**Evidência**

`matchScore += 2.0` no casamento do 1o token (linha 70) e aceite em `matchScore >= 1.5` (linha 95). Logo, casar APENAS a primeira palavra ja passa. Probe real: `findWordSequenceIndex(wb, tokenizePhrase('A inteligencia artificial mudou tudo'), 0, 90)` -> `{boundaryIndex:22, matchedWord:'a', confidence:2}`. A frase NAO existe em lugar nenhum da narracao; o aligner ancorou o corte no artigo 'a' @6871ms com 'confianca' 2.0 e o log do run_pipeline imprime `[Fonetico: "a"]` como se fosse um acerto.

**Causa-raiz**

Threshold (1.5) menor que o peso do primeiro token isolado (2.0). Nao ha normalizacao por numero de tokens casados nem penalidade para stopwords monossilabicas (a, o, e, de, que) que dominam a narracao PT-BR.

**Impacto no vídeo final**

Corte visual cai no meio de uma frase, em cima de uma palatal atona, sem nenhuma relacao com a troca de assunto. O espectador ve a imagem mudar no meio de 'da calma interior' em vez de na virada semantica. Pior: o pipeline reporta sucesso de sincronia fonetica, entao o defeito nunca e detectado.

**Correção**

Score normalizado e threshold relativo: (1) exigir `matchScore >= 0.62 * maxPossibleScore` onde `maxPossibleScore = 2.0 + 1.5*(searchTokens.length-1)`; para 4 tokens = 6.5 -> minimo 4.03 (i.e. 1o token + 2 subsequentes). (2) Blacklist de stopwords: se `searchTokens[0].length <= 2`, nao pontuar 2.0 — deslocar a janela de tokens para comecar na primeira palavra de conteudo (>=4 chars). (3) Usar 6 tokens em vez de 4 (`slice(0,6)`). (4) Retornar `confidence` normalizada 0..1 e propagar; se `< 0.6`, NAO usar o match e cair no pause-snap local (ja corrigido).

---

### `sem-teto-duracao-cena` — Aligner nao tem maxSceneDurationMs — invariante de teto ausente permite take de 33s, e minSceneDurationMs=1500 esmaga todas as cenas restantes

**Severidade:** CRÍTICO · **Esforço:** medium · **Categoria:** arch  
**Arquivo:** `pipeline/src/scene_aligner.js:284`

**Evidência**

`const maxAllowedCutMs = totalDurationMs - (remainingScenes * minSceneDurationMs);` e `const minAllowedCutMs = prevCut + minSceneDurationMs;` — so existe piso (1500ms), nunca teto. Probe real com 20 cenas (densidade shorts) sobre o audio de 57.48s retornou: `15.88 | 7.73 | 5 | 4.55 | 1.5 | 1.61 | 1.71 | 1.5 | 1.5 | 1.5 | 1.5 | 1.5 | 1.5 | 1.5 | 1.5 | 1.5 | 1.5 | 1.5 | 1.5 | 1.5` (min=1.5 max=15.88). As 4 primeiras cenas consomem 33.2s dos 57.5s e as 16 restantes vivem no piso.

**Causa-raiz**

O algoritmo e guloso da esquerda para a direita e so olha para tras (prevCut). Nao ha orcamento de tempo por cena nem redistribuicao global; o erro de cada corte e empurrado integralmente para as cenas seguintes ate baterem no piso.

**Impacto no vídeo final**

Distribuicao patologicamente assimetrica: inicio congelado, final em estroboscopio. A propria invariante #4 declarada no docblock ('Nenhuma cena tera duracao inferior a 1.5 segundos') e o mecanismo que causa o dano, porque forca o resto a colapsar no minimo.

**Correção**

Passar de guloso para resolucao com restricoes: (1) definir `minSceneMs = 1800`, `maxSceneMs = 4500` (ver politica de densidade). (2) Calcular `plannedCut[i]` (alvo proporcional/semantico) e depois projetar o vetor de cortes na regiao viavel com um passo de isotonic/PAVA: para cada i, `cut[i] = clamp(cut[i], cut[i-1]+minSceneMs, cut[i-1]+maxSceneMs)` em varredura para frente, seguida de varredura para tras `cut[i] = clamp(cut[i], cut[i+1]-maxSceneMs, cut[i+1]-minSceneMs)`, iterando ate convergir. (3) Se `numScenes*minSceneMs > totalMs` ou `numScenes*maxSceneMs < totalMs`, ajustar numScenes ANTES (ver finding scene-count-reconciliation) em vez de espremer.

---

### `duracao-audio-nunca-medida` — targetDurationSeconds nunca vem do mp3 real: soma de duas gorduras (+300ms no synth, +0.3s no run_pipeline) que ainda assim TRUNCA o audio verdadeiro

**Severidade:** CRÍTICO · **Esforço:** small · **Categoria:** bug  
**Arquivo:** `pipeline/src/run_pipeline.js:133`

**Evidência**

voice_synthesizer.js:84 `durationMs = wordBoundaries[last].endMs + 300;` e run_pipeline.js:134-136 `targetDurationSeconds = Number((rawAudioDuration + 0.3).toFixed(2))`. ffprobe esta importado em video_compositor.js:5 e visuals_harvester.js:5 mas NUNCA e chamado no narration.mp3. Medicoes reais: (A) run de producao run_1789161687124_1 -> ultimo wordBoundary end = 62.070s (visivel no subtitles.srt: `00:01:00,872 --> 00:01:02,070`), durationSeconds reportado = 62.37, target = 62.67, `ffprobe narration.mp3` = **62.976s** -> **306ms de audio real descartados pelo `-t 62.67`**. (B) reproducao com o mesmo texto hoje: reportado 57.18s, ffprobe do mp3 = **57.720s**, target = 57.48 -> **240ms cortados**. Erro sistematico de -0.94% a -0.96%.

**Causa-raiz**

A duracao e uma ESTIMATIVA derivada do ultimo WordBoundary, que nao inclui a cauda de silencio/decaimento do Edge-TTS (medida em 839ms e 906ms nos dois runs). As duas gorduras somadas (600ms) sao menores que essa cauda, entao o erro e sempre negativo — mas o sinal depende inteiramente da pontuacao final e da voz, entao pode inverter e criar video mais longo que o audio.

**Impacto no vídeo final**

O video sempre encerra com um corte seco no meio da cauda de reverb/respiracao da ultima palavra do CTA. Junto com `afade` da BGM em `target-2.5`, o fade musical e amputado antes de chegar a zero -> pop audivel no final. Se a cauda do TTS for < 600ms (outra voz, texto sem ponto final), o alvo passa a ser MAIOR que o audio e o video termina com video preto sobre silencio. E a duracao e imprevisivel entre runs.

**Correção**

Medir com ffprobe e nunca estimar. Em voice_synthesizer.js, no handler `finish`: `const probed = await ffprobeDuration(outputAudioPath); durationMs = Math.round(probed*1000); durationSecondsMeasured = probed;` mantendo `lastWordEndMs` como campo separado para o aligner. Em run_pipeline.js: `const targetDurationSeconds = Number(voiceResult.durationSecondsMeasured.toFixed(3));` (sem +0.3). A 'respiracao' de saida deve vir do PLANEJAMENTO do roteiro (adicionar um `<break time="600ms"/>` SSML ou ponto final extra), nao de um numero magico no compositor. O aligner usa `lastWordEndMs` para ancorar cortes e `durationSecondsMeasured` como fim da timeline.

---

### `cut-anulado-por-fade-preto` — Os 100ms de L-cut sao anulados por um fade-to-black de 300ms em cada corte (medido: luminancia cai de 61.7 para 17.9)

**Severidade:** CRÍTICO · **Esforço:** medium · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/visuals_harvester.js:192`

**Evidência**

`transitionFade = isHookScene ? ',fade=t=out:st=${fadeOutStart}:d=0.15' : ',fade=t=in:st=0:d=0.15,fade=t=out:st=${fadeOutStart}:d=0.15'` — `fade` sem `color=` faz fade para PRETO. Medicao per-frame no video final real (corte em t=10.233s, fronteira scene_1|scene_2): YAVG 61.69 (t=9.90) -> 61.51 -> 56.86 -> 46.18 -> 35.76 -> 25.82 -> **17.91 (t=10.233, o corte)** -> 22.23 -> 28.71 -> 36.07 -> 43.44 -> 47.34 (t=10.40, estabiliza). Queda de 71% da luminancia, janela escura de ~300ms, em cada um dos 7 cortes.

**Causa-raiz**

O scene_aligner posiciona o corte 100ms ANTES do primeiro fonema (calculateSceneCutTimestamp:143) para o visual anteceder o som, mas o harvester aplica fade-out de 150ms no fim do clip N e fade-in de 150ms no inicio do clip N+1 sobre a MESMA fronteira, sem crossfade. Resultado: a imagem nova so fica visivel em cut+150ms, ou seja 50ms DEPOIS do fonema — o lead de 100ms virou lag de 50ms.

**Impacto no vídeo final**

Sete piscadas escuras no short. Em telas OLED de celular isso le como falha de reproducao/buffering, e e exatamente o 'hard cut' que o SDD:37 prometeu eliminar. Destroi qualquer percepcao de sincronia: a troca visual nao coincide com a troca de frase, coincide com um blackout.

**Correção**

Remover os fades de fronteira dos clips intermediarios e fazer a transicao no COMPOSITOR com `xfade` (como o SDD:37 promete): gerar cada clip com `duracao + 0.2s` de cauda, e no complexFilter encadear `[v0][v1]xfade=transition=fade:duration=0.2:offset=<cut_i - 0.1>[x1]` etc. Manter `fade=t=in` APENAS no clip 0 (a partir do preto) e `fade=t=out` APENAS no ultimo. Alternativa barata se xfade for caro: manter concat mas trocar por `fade=...:color=0x0A0A12:d=0.06` (60ms, cor do grade, nao preto puro) e compensar o offset movendo o corte 60ms para tras.

---

### `densidade-cortes-2x-fora` — 8 cortes em 62.6s = 7.83s por take (max 12.07s) contra os 2-4s prometidos pelo SDD e pelo cuts_interval_seconds do canal

**Severidade:** CRÍTICO · **Esforço:** medium · **Categoria:** config-drift  
**Arquivo:** `pipeline/src/youtube_analyzer.js:413`

**Evidência**

Duracoes reais medidas por ffprobe dos 8 clips do run_1789161687124_1: 4.667 | 5.567 | 6.967 | 8.467 | 5.467 | 10.500 | 12.067 | 8.933 (soma 62.633s, media 7.83s, max 12.07s). SDD_Pipeline_Conteudo_IA_v2.md:28 promete 'takes dinamicos a cada 2 a 4 segundos'. Todos os 5 perfis em pipeline/config/channels/*.json declaram `"cuts_interval_seconds": "2-4"` e `grep -rn "cuts_interval" pipeline/src/ src/` retorna VAZIO — a chave nunca e lida por ninguem. A contagem de cenas e ditada por extractNarrationBeats, que consolida por CONTAGEM DE PALAVRAS (`if (bWords < 12) buffer += ...`), sem nenhum modelo de duracao; produziu 8 beats de 14-30 palavras.

**Causa-raiz**

Nao existe etapa de reconciliacao entre (numero de cenas) e (duracao do audio). O numero de cenas e um subproduto da segmentacao sintatica do texto; o aligner apenas aceita o que recebe e distribui os segundos. Ninguem verifica `totalMs / numScenes` contra a politica do canal.

**Impacto no vídeo final**

Takes de 8 a 12 segundos com UMA imagem estatica de 576x1024 com pan/zoom de 1.03->1.16. Em 12 segundos o Ken Burns percorre 13% de zoom — visualmente e uma foto parada. Combinado com a repeticao de composicao (mesmo cavaleiro sob arvore), o short parece um slideshow de 2012. Queda de retencao a partir de ~4s de imagem imovel.

**Correção**

Introduzir reconciliacao de densidade ANTES do aligner e ANTES do harvester: (1) ler `format.cuts_interval_seconds` do perfil -> `[minCut, maxCut]` (default 2.0-4.0). (2) `targetSceneCount = Math.round(totalAudioSeconds / ((minCut+maxCut)/2))` -> para 62.6s com 2-4s: 21 cenas. (3) Se `beats.length < targetSceneCount`, SUBDIVIDIR cada beat em sub-beats nos limites de virgula/conjuncao/pausa >150ms do proprio wordBoundary ate atingir a contagem (um mesmo prompt/imagem pode gerar 2-3 sub-takes com motionType e crop diferentes — sem custo extra de geracao). (4) Se `beats.length > targetSceneCount`, fundir beats adjacentes. (5) Passar `minSceneMs/maxSceneMs` derivados do perfil para o aligner em vez do 1500 hardcoded.

---

### `cursor-nao-avanca-apos-match` — boundaryCursor e posicionado no INICIO da frase casada, nao no fim — a proxima cena pode casar dentro da frase anterior

**Severidade:** ALTO · **Esforço:** small · **Categoria:** bug  
**Arquivo:** `pipeline/src/scene_aligner.js:301`

**Evidência**

`boundaryCursor = matchResult.boundaryIndex;` — boundaryIndex e o indice da PRIMEIRA palavra da frase da cena i. A busca da cena i+1 comeca em `findWordSequenceIndex(wb, tokens, boundaryCursor, 90)` e so exige `matchResult.boundaryIndex > boundaryCursor`, ou seja, qualquer palavra a partir do inicio da frase anterior — inclusive as ~24 palavras que pertencem a cena i. Combinado com o falso positivo de score 2.0 (artigos), a cena i+1 ancora dentro da cena i. O unico guarda-corpo e `candidateCutMs >= minAllowedCutMs` (prevCut+1500ms), que so barra os casos mais grosseiros.

**Causa-raiz**

Confusao entre 'cursor de consumo' e 'indice de ancoragem'. O cursor deveria avancar para `boundaryIndex + tokensDaFraseAnterior.length` (fim do span consumido), nao para o inicio.

**Impacto no vídeo final**

Cortes que caem 1 a 2 segundos antes da virada real de assunto, encurtando artificialmente takes e alongando os seguintes. A cena visual do topico B aparece enquanto o locutor ainda narra o topico A — exatamente o descompasso semantico que o video final exibe.

**Correção**

`boundaryCursor = matchResult.boundaryIndex + Math.max(1, tokens.length - 2);` para consumir o span da frase casada, e adicionar um segundo cursor `anchorFloor = matchResult.boundaryIndex` usado so como piso de busca. Alternativamente: pre-alinhar TODAS as frases de uma vez com programacao dinamica monotonica (Needleman-Wunsch sobre a sequencia de tokens da narracao vs concatenacao dos tokens das cenas), o que garante monotonicidade e nao-sobreposicao por construcao.

---

### `lookahead-90-cego` — maxLookahead=90 e cego ao tamanho real do beat: com 20 cenas curtas desperdica janela, com beats longos ou match falho estoura o alcance

**Severidade:** ALTO · **Esforço:** trivial · **Categoria:** bug  
**Arquivo:** `pipeline/src/scene_aligner.js:296`

**Evidência**

`findWordSequenceIndex(wordBoundaries, tokens, boundaryCursor, 90)` com janela fixa de 90 palavras. Probe real: a narracao de producao tem 160 wordBoundaries totais; 90 palavras = 56% de todo o audio como janela de busca de UM corte. O beat 7 ('A partir de hoje...') comeca no indice 107; como o cursor ficou preso no inicio do beat 6, a janela [cursor, cursor+90] cobre quase tudo — e a primeira ocorrencia de 'a' dentro dela vence. Na direcao oposta: com a politica de 2-4s serao ~21 cenas de ~7 palavras; 90 de lookahead = 13 cenas de distancia, tornando o falso positivo praticamente garantido.

**Causa-raiz**

Constante absoluta em unidade de palavras, sem relacao com a duracao alvo da cena nem com a densidade de cortes. Deveria ser derivada: `lookahead = ceil(duracaoAlvoDaCena * WPS * 1.8)`.

**Impacto no vídeo final**

Cortes ancorados em ocorrencias erradas da mesma palavra em outro ponto do roteiro -> visual fora de contexto. Agrava a monotonia percebida porque takes adjacentes acabam com durações muito desiguais.

**Correção**

Derivar a janela: `const wps = wordBoundaries.length / (totalDurationMs/1000); const lookahead = Math.max(8, Math.ceil((targetSceneSeconds * wps) * 1.8));` e passar tambem um limite superior em MS (`searchUntilMs = targetTimeMs + 1.5*targetSceneSeconds*1000`), rejeitando matches fora dele mesmo que casem.

---

### `drift-quantizacao-frames` — Cortes em ms com toFixed(2) viram -t fracionario e o ffmpeg trunca para frame: drift cumulativo de -36.7ms medido, ate -0.7s na densidade prometida

**Severidade:** ALTO · **Esforço:** small · **Categoria:** bug  
**Arquivo:** `pipeline/src/visuals_harvester.js:257`

**Evidência**

scene_aligner.js:347-349 arredonda para centesimos (`Number((startMs/1000).toFixed(2))`); visuals_harvester.js:257 passa `-t ${durationSeconds}` com `-framerate 30`. Medicao real dos 8 clips: 140, 167, 209, 254, 164, 315, 362, 268 frames = 4.6667, 5.5667, 6.9667, 8.4667, 5.4667, 10.5, 12.0667, 8.9333s. Soma do concat = **62.6333s**, mas `targetDurationSeconds` = **62.67s** e as legendas foram queimadas na timeline absoluta dos wordBoundaries. `ffprobe -select_streams v:0` do video final confirma: video=62.6333s / audio=62.67s. Delta = -36.7ms acumulado em 8 clips (ate -33.3ms por clip).

**Causa-raiz**

O aligner declara no docblock a invariante 3 ('A soma das duracoes das cenas e matematicamente identica a duracao total do audio'), mas a invariante e verificada em segundos decimais e quebrada depois, na renderizacao, pela quantizacao de frames de cada clip independente. Nenhum clip e gerado com `-frames:v N`.

**Impacto no vídeo final**

Cada corte visual chega progressivamente ADIANTADO em relacao ao audio e as legendas. Com 8 cenas o erro final e imperceptivel (-37ms), mas com as 21 cenas da politica 2-4s o erro esperado e -0.35s a -0.70s no final do video: a ultima troca de imagem acontece quase meio segundo antes do CTA falado, e o video acaba com frame congelado. Alem disso o video final fica 37ms mais curto que o reportado, o que pode derrubar a elegibilidade dos 60s do TikTok Rewards.

**Correção**

Quantizar TUDO em frames na fonte: (1) no aligner, `const FPS = perfil.format.target_fps || 30; cutFrames[i] = Math.round(cutMs[i]/1000*FPS); cutMs[i] = cutFrames[i]/FPS*1000;` e expor `frames` em cada cena. (2) no harvester, trocar `-t ${durationSeconds}` por `-frames:v ${scene.frames}` e `-vsync cfr -r ${FPS}`. (3) no compositor, `-t` passa a ser `totalFrames/FPS` exato e `-vsync cfr`. Isso torna a invariante 3 verdadeira por construcao, sem depender de arredondamento.

---

### `beatduration-135wpm-errado` — beatDuration planejado usa 135 WPM enquanto o Edge-TTS a +5% entrega 168 WPM: 71.2s planejados para 57.2s reais (+24%)

**Severidade:** ALTO · **Esforço:** small · **Categoria:** config-drift  
**Arquivo:** `pipeline/src/youtube_analyzer.js:578`

**Evidência**

`const totalDurationEst = (totalWords / 135) * 60;` e `beatDuration = Math.max(3.2, ((phraseWords/totalWords)*totalDurationEst).toFixed(1))`. Probe real com a narracao de topico livre: 160 palavras, beatDurations = 6.7, 6.7, 6.2, 9.8, 7.6, 10.2, 13.3, 10.7 -> **soma 71.20s**. Audio real do Edge-TTS pt-BR-AntonioNeural rate '+5%' = **57.18s** (ffprobe 57.72s). WPM efetivo = 160/57.18*60 = **167.9**, nao 135. Erro de +24.5%. O mesmo 135 aparece em script_generator.js:163 `estimatedDurationSeconds` e em :213, usado para decidir `rewardsEligible`.

**Causa-raiz**

Constante de WPM de locucao humana lenta, nao calibrada para a voz/rate reais do TTS. E nunca corrigida a posteriori porque a duracao real so aparece depois da sintese.

**Impacto no vídeo final**

No caminho feliz o erro se cancela (as durações viram apenas RAZOES na hora de escalar), mas: (a) `rewardsEligible` e decidido com esse numero inflado -> roteiros de ~135 palavras sao marcados como elegiveis para TikTok Rewards (>=60s) quando na verdade renderizam ~48s e sao INELEGIVEIS; (b) o fallback `proportional_fallback_no_boundaries` do aligner depende dessas duracoes; (c) o alvo proporcional do pause-snap herda a distorcao. Tambem impede planejar a densidade de cortes antes da sintese.

**Correção**

(1) Substituir a constante por um mapa calibrado por voz+rate: `const WPM_BY_VOICE = {'pt-BR-AntonioNeural': {base: 160, ratePct: 1.0}}` e `wpm = base * (1 + ratePct/100)`. (2) Melhor ainda: inverter a ordem do pipeline — sintetizar a voz PRIMEIRO, e so entao chamar generateThematicScenes com a duracao MEDIDA e os wordBoundaries reais, para que beats e cenas nascam ja dentro do orcamento de tempo. (3) `rewardsEligible` so pode ser calculado apos o ffprobe do mp3, nunca no script_generator.

---

### `rewards-eligibility-nao-medida` — Elegibilidade TikTok Rewards (>=60s) e reportada a partir de um numero estimado que o proprio compositor devolve sem medir

**Severidade:** ALTO · **Esforço:** trivial · **Categoria:** bug  
**Arquivo:** `pipeline/src/video_compositor.js:103`

**Evidência**

video_compositor.js:103 `durationSeconds: totalDurationSeconds` — devolve o parametro de entrada, nunca faz ffprobe do arquivo gerado (apesar de `ffmpeg.setFfprobePath` estar configurado na linha 11). run_pipeline.js:235 `Elegivel TikTok Rewards: ${renderResult.durationSeconds >= 60 ? 'SIM (>= 60s)' : 'NAO'}`. Cadeia de erro medida: lastWordEnd(62.070) +0.3 +0.3 = 62.67 reportado; video real = 62.67s (audio) mas track de video = 62.633s. Em cenarios de fronteira (roteiro que estima 60.1s) o video pode sair com 59.9s de video util e o pipeline anuncia 'SIM'.

**Causa-raiz**

Nenhuma verificacao pos-render. O contrato do compositor assume que `-t` sempre e atingido, o que e falso quando o concat e mais curto que `-t`.

**Impacto no vídeo final**

Video ingerido e agendado para publicacao com promessa de monetizacao que a plataforma vai rejeitar. Custo de negocio direto, invisivel nos logs.

**Correção**

No `on('end')` do compositor: `const probed = await new Promise(r => ffmpeg.ffprobe(outputVideoPath, (e,d)=>r(d)));` e retornar `durationSeconds: probed.format.duration`, `videoStreamSeconds`, `audioStreamSeconds`. Falhar (ou re-renderizar com padding) se `Math.abs(video - audio) > 0.08` ou se `duration < 60` quando `rewardsEligible` foi prometido.

---

### `lcut-e-na-verdade-jcut` — O 'L-cut de 100ms' e na verdade um J-cut e nao existe crossfade de audio — nomenclatura e implementacao divergem do SDD

**Severidade:** MÉDIO · **Esforço:** trivial · **Categoria:** arch  
**Arquivo:** `pipeline/src/scene_aligner.js:143`

**Evidência**

`const cutCandidate = currWord.startMs - 100; return Math.max(prevWord.endMs + 20, cutCandidate);` — o corte VISUAL antecede o audio da nova frase em ate 100ms. Isso e um J-cut (video entra antes do audio). Um L-cut real e o oposto: o audio da cena anterior se estende sobre o video da nova. SDD:96 diz 'inserindo L-Cuts cinematograficos de 100ms'. Alem disso o guard `prevWord.endMs + 20` significa que, quando a pausa e de exatamente 120ms, o corte cai a 20ms do fim da palavra anterior (nao os 100ms pretendidos) — o lead real varia de 20ms a 100ms dependendo da pausa.

**Causa-raiz**

Confusao de terminologia + guard que colide com o threshold: com `pauseDurationMs >= 120` e `cutCandidate = start-100`, o candidato fica a `pause-100` ms do fim da palavra anterior, ou seja entre 20ms e (pause-100)ms. Para pausas de 120-200ms o clamp domina e o lead efetivo cai para 20-100ms.

**Impacto no vídeo final**

O lead prometido de 100ms nao e entregue de forma consistente (varia 5x entre cortes), e de qualquer modo ele e engolido pelo fade-to-black de 150ms. Sem xfade de audio, nenhum corte tem a suavidade de L/J-cut real.

**Correção**

(1) Renomear para `applyJCutLead` e documentar corretamente. (2) Tornar o lead deterministico: `const lead = Math.min(100, Math.max(40, pauseDurationMs*0.5)); return Math.round(currWord.startMs - lead);` garantindo `>= prevWord.endMs`. (3) Para L-cut de verdade, o corte visual deve ocorrer em `prevWord.endMs + 30` enquanto o audio continua — o que so importa quando houver audio por cena; hoje o audio e uma unica faixa continua, entao o conceito de L-cut nao se aplica e o SDD deve ser corrigido.

---

### `cena-zero-sem-alinhamento` — Cena 0 nunca e alinhada e o silencio de entrada de ~100ms do TTS nao e considerado

**Severidade:** MÉDIO · **Esforço:** trivial · **Categoria:** bug  
**Arquivo:** `pipeline/src/scene_aligner.js:272`

**Evidência**

`cutMs[0] = 0;` e `alignmentDetails[0] = { type: 'audio_start', ... }` — o loop comeca em i=1, entao a frase da cena 0 nunca e verificada contra os wordBoundaries. No subtitles.ass real a primeira palavra comeca em `0:00:00.10` (100ms de silencio de entrada). O video comeca com o hook em fade (isHookScene usa so fade-out), entao o primeiro frame ja esta em plena luz sobre silencio.

**Causa-raiz**

Assume-se que a cena 0 sempre corresponde ao inicio absoluto do audio. Isso e verdade, mas significa que uma eventual falha de correspondencia da cena 0 (frase da cena 0 na verdade comeca no meio do audio) passa silenciosa e desloca TODAS as cenas.

**Impacto no vídeo final**

Baixo isoladamente, mas elimina a unica oportunidade de validar se a lista de cenas esta de fato alinhada com o roteiro narrado. Se generateThematicScenes devolver cenas de outra ordem, ninguem percebe.

**Correção**

Validar a cena 0: `const m0 = findWordSequenceIndex(wb, tokenizePhrase(scenes[0].phrase), 0, lookahead);` e se `m0.boundaryIndex > 3` (ou a confianca normalizada < 0.6), emitir warning explicito `[ALIGNER] cena 0 nao corresponde ao inicio da narracao` e marcar o run como degradado. Manter `cutMs[0]=0` mas ancorar o inicio visual em `Math.max(0, wb[0].startMs - 120)`.

---

### `sem-ancoragem-em-beats-musicais` — Zero analise de trilha: nenhum BPM, onset ou beat detection — os cortes ignoram completamente a musica de fundo

**Severidade:** MÉDIO · **Esforço:** large · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/video_compositor.js:67`

**Evidência**

`grep -rn "bpm|onset|beat_track|ebur128|silencedetect|astats" pipeline/src/ src/` retorna VAZIO. A BGM entra so como `[2:a]volume=0.12,afade=t=out:st=${fadeOutStart}:d=2.5` com `-stream_loop -1`: o loop e cortado em ponto arbitrario (nao em compasso), o volume 0.12 e hardcoded ignorando `audio_profile.bg_music_volume`, e nenhum corte visual e ancorado em um downbeat. Os cortes reais caem em 4.667, 10.233, 17.200, 25.667, 31.133, 41.633, 53.700 — intervalos de 4.67/5.57/6.97/8.47/5.47/10.50/12.07s, sem nenhuma relacao harmonica entre si nem com qualquer grade de tempo.

**Causa-raiz**

O design so tem uma fonte de verdade temporal (wordBoundaries da fala). A trilha e tratada como decoracao pos-render, nao como grade ritmica.

**Impacto no vídeo final**

Cortes 'fora do tempo' da musica. Mesmo quando a sincronia fonetica esta correta, o video soa amador porque o ritmo visual briga com o ritmo musical — e o efeito 'satisfatorio' de shorts de alta retencao vem justamente de cortes no downbeat. Alem disso o loop da BGM emenda no meio de um compasso, criando um salto audivel a cada repeticao.

**Correção**

Grade hibrida fala+musica: (1) extrair o BPM da trilha uma vez e cachear ao lado do mp3 (`meta.json` com `bpm`, `firstDownbeatMs`); se nao houver lib, usar `ffmpeg -af ebur128=metadata=1` ou `aubio`/`music-tempo` (npm, offline). (2) `beatGridMs(k) = firstDownbeatMs + k * (60000/bpm)`. (3) Depois de resolver `cutMs[i]` pela fala, fazer SNAP magnetico: `if (|cutMs[i] - nearestBeat| <= 120ms) cutMs[i] = nearestBeat;` — tolerancia curta para nunca quebrar a sincronia fonetica, mas alinhando a maioria dos cortes ao downbeat. (4) Escolher o comprimento do loop da BGM em multiplos inteiros de compasso e fazer crossfade de 1 compasso na emenda (`acrossfade` em vez de `-stream_loop`).

---

### `ordem-geracao-imagem-ok-mas-prompt-precede` — A imagem e gerada DEPOIS do alinhamento (ordem correta), mas o PROMPT e escrito antes de existir audio — a cena nao sabe quantos segundos vai durar

**Severidade:** MÉDIO · **Esforço:** medium · **Categoria:** arch  
**Arquivo:** `pipeline/src/run_pipeline.js:154`

**Evidência**

Ordem real verificada: run_pipeline.js:105 sintetiza voz -> :138 `alignScenesWithWordBoundaries` -> :154 `harvestVisualScenes({ scenes: alignedScenes })` -> visuals_harvester.js:457/484/532/541 usa `scene.duration` (ja alinhada). Portanto a IMAGEM usa a duracao correta. PORem o `prompt` de cada cena nasce em script_generator.js:170 -> youtube_analyzer.js:587 `buildProfessionalScenePrompt`, que roda ANTES da sintese de voz (run_pipeline.js:86 vem antes de :105) e recebe apenas `beatDuration` estimado a 135 WPM (probe: 13.3s planejados para uma cena que alinhou em 11.03s). O `motionType` tambem e escolhido nessa etapa (`motionTypes[idx % 5]`), sem saber se o take tera 1.5s ou 12s.

**Causa-raiz**

O pipeline e linear texto->voz->alinhamento->visual, mas a etapa de geracao de prompt esta embutida dentro da geracao de roteiro (etapa 1), antes de qualquer informacao temporal existir.

**Impacto no vídeo final**

Motion engine inadequado a duracao: `push_in` de 1.03->1.16 em 12s e imperceptivel (parece foto parada); o mesmo push_in em 1.5s e um zoom brusco. A composicao do prompt tambem nao pode pedir 'plano com profundidade para sustentar 10 segundos' vs 'plano fechado de impacto para 2 segundos'. Contribui diretamente para a monotonia visual observada (mesma composicao repetida).

**Correção**

Separar em duas fases: `planScenes()` (segmentacao + intencao dramatica, sem prompt) antes da voz, e `renderScenePrompts(alignedScenes)` DEPOIS do alinhamento, recebendo `scene.duration` real. Selecionar o motion pela duracao: `duration < 2.5 -> 'punch_in' (zoom 1.0->1.25)`, `2.5-4.5 -> 'push_in'/'pan'`, `> 4.5 -> 'atmospheric_drift' com amplitude proporcional`. E escalar a amplitude do zoom: `zoomEnd = 1.03 + 0.045 * duration` limitado a 1.30, para que a velocidade aparente de camera seja constante entre takes de duracoes diferentes.

---

### `fallback-608-silencioso` — Fallback de 60.8s quando a duracao do audio e 0 renderiza um video inteiro contra um mp3 possivelmente vazio

**Severidade:** BAIXO · **Esforço:** trivial · **Categoria:** bug  
**Arquivo:** `pipeline/src/run_pipeline.js:136`

**Evidência**

`const targetDurationSeconds = rawAudioDuration > 0 ? Number((rawAudioDuration + 0.3).toFixed(2)) : 60.8;` — `rawAudioDuration` so e 0 se `voiceResult.durationSeconds` for 0/NaN, o que acontece quando `wordBoundaries` esta vazio E `stats.size` e 0. Nesse caso o aligner tambem cai no ramo `proportional_fallback_no_boundaries` (scene_aligner.js:241) e o pipeline segue ate o fim gerando 60.8s de video com audio mudo, imprime 'TAKE CONCLUIDO COM SUCESSO' e faz a ingestao no backend.

**Causa-raiz**

Ausencia de fail-fast. O numero magico 60.8 existe para 'garantir' elegibilidade de 60s mesmo sem audio.

**Impacto no vídeo final**

Publicacao agendada de um video de 60.8s completamente mudo. Falha catastrofica silenciosa.

**Correção**

Remover o fallback: `if (!(rawAudioDuration > 5) || voiceResult.wordBoundaries.length < 10) throw new Error('Sintese de voz falhou: duracao=' + rawAudioDuration + 's, ' + voiceResult.wordBoundaries.length + ' wordBoundaries');`. Validar tambem `fs.statSync(audioPath).size > 20000`.

---

## Legendas Dinâmicas (subtitle_generator.js → .ass → queima no video_compositor.js)

16 achados.

### `chunk-rigido-modulo-4` — groupWordsIntoChunks quebra a cada 4 palavras ignorando frase/pausa — o branch de pontuação é CÓDIGO MORTO

**Severidade:** CRÍTICO · **Esforço:** medium · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/subtitle_generator.js:51`

**Evidência**

Linha 51-52: `const isPunctuation = /[.?!,;:]$/.test(wb.word); if (currentWords.length >= wordsPerChunk || isPunctuation || ...)`. Os wordBoundaries do Edge-TTS NÃO contêm pontuação. Verificado no .ass real: extraí só o campo Text de todos os 160 Dialogue de pipeline/scratch/run_1789161687124_1/subtitles.ass e rodei `grep -o "[.?!,;:]"` → ZERO ocorrências. Logo `isPunctuation` é sempre false e o agrupamento é puro módulo-4. Resultado nos 40 chunks distintos: "E DA CALMA INTE" | "COM VERDADEIRA MAESTRIA EXISTE" | "DAS PESSOAS FALHA CONSTANTEMENTE" | "DISTRACAO IRRELEVANTE PROTEJA A" | "CLAREZA ABSOLUTA DESCARTE QUALQUER" — todos atravessam fronteira de oração. Bônus: não houve órfã de 1 palavra nesta run por SORTE (160 palavras ÷ 4 = 40 exato); com 161 ou 163 palavras o último card vira órfão de 1-3 palavras.

**Causa-raiz**

O agrupamento é sintático-cego: opera sobre o array de wordBoundaries sem nunca consultar o narrationText (que tem a pontuação) nem os gaps de silêncio entre palavras (endMs[i] → startMs[i+1]), que são o sinal prosódico real de fim de sintagma.

**Impacto no vídeo final**

O espectador lê blocos que não são unidades de sentido. Cada card exige recomeçar o parsing mental; em 62s o cérebro faz 40 reparsings. Isso derruba retenção nos primeiros 3s (o hook "SE VOCÊ BUSCA DOMINAR" / "O PODER DO SILÊNCIO" / "E DA CALMA INTE" é fatiado em 3 cards sem sintaxe) e é a assinatura visual de vídeo gerado por bot, não de canal editorial.

**Correção**

Substituir por agrupamento prosódico em 2 passes. Passe 1 — segmentar por pausa: calcular `gap[i] = wb[i+1].startMs - wb[i].endMs`; marcar fronteira forte onde `gap >= 260ms` (fim de frase) e fronteira fraca onde `gap >= 110ms` (vírgula/respiração). Passe 2 — reconciliar com o texto: alinhar wordBoundaries ao `narrationText` normalizado (Levenshtein por token, já disponível no call site do run_pipeline) e promover a fronteira forte todo token seguido de `[.?!]` e a fraca todo token seguido de `[,;:]`. Depois empacotar em cards respeitando, nesta ordem de prioridade: (a) nunca cruzar fronteira forte; (b) `charsTotal <= 2 * maxCharsPerLine`; (c) `durationMs` entre 700 e 2200ms; (d) preferir cortar em fronteira fraca; (e) nunca deixar card final com < 2 palavras (faz merge com o anterior se `charsTotal` permitir, senão rouba uma palavra do anterior). Assinatura nova: `groupWordsIntoCards({ wordBoundaries, narrationText, maxCharsPerLine, maxLines: 2, minCardMs: 700, maxCardMs: 2200, strongGapMs: 260, weakGapMs: 110 })`.

---

### `reflow-fscx108-jitter` — \fscx108 na palavra ativa altera a métrica da linha e faz o bloco inteiro pular horizontal e verticalmente a cada ~250ms

**Severidade:** CRÍTICO · **Esforço:** trivial · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/subtitle_generator.js:120`

**Evidência**

Linha 120: `return `{\\c${activeWordColor}\\fscx108\\fscy108}${upper}{\\r}`;`. `\fscx` é fator de ESCALA HORIZONTAL: muda o avanço dos glifos, logo muda a largura da linha. Renderizei o .ass real com o ffmpeg empacotado do repo (node_modules/@ffmpeg-installer/win32-x64, N-92722, --enable-libass --enable-fontconfig) sobre color=black:1080x1920 e comparei frames do MESMO chunk "CLAREZA ABSOLUTA DESCARTE QUALQUER": com CLAREZA ativa a linha 1 mede ~1.08x a largura de quando QUALQUER está ativa, e o bloco (centrado, Alignment=2) desloca horizontalmente ~15-20px. Pior: o header tem `WrapStyle: 0` (quebra automática) e MarginL=MarginR=40 → largura útil 1000px; a 65px Arial Bold o avanço médio medido é `0.596*fontSize + spacing` ≈ 39.8px/char, ou seja ~25 chars/linha. Chunks de 30-34 chars ("CLAREZA ABSOLUTA DESCARTE QUALQUER"=34, "DAS PESSOAS FALHA CONSTANTEMENTE"=32) ficam EXATAMENTE no limiar: a mesma frase pode caber em 1 linha num evento e transbordar para 2 no evento seguinte, só porque outra palavra virou 108%. Como Alignment=2 ancora pela base, ganhar uma linha empurra o bloco ~78px PARA CIMA e depois de volta.

**Causa-raiz**

Uso de uma propriedade que afeta layout (escala de glifo) como recurso de ÊNFASE, dentro de eventos que se sucedem a cada palavra. Toda troca de evento re-executa o line-breaking do libass com métricas diferentes.

**Impacto no vídeo final**

Legenda 'tremendo'/'respirando' o vídeo inteiro: o bloco de texto oscila lateralmente 4x por card e ocasionalmente salta uma linha inteira de altura. É percebido como bug de render, não como animação. Em tela pequena (feed do TikTok) o olho perde a âncora de leitura e o espectador desiste.

**Correção**

NUNCA usar \fscx/\fscy inline para destacar palavra. Enfatizar apenas com propriedades que não alteram métrica: cor (`\c`), espessura de contorno (`\bord`) e glow (`\blur`) — todas expandem só o bitmap, o avanço do glifo é idêntico. Trocar a linha 120 por `{\c${activeWordColor}\bord${outlineWidth+3}\blur3}` e a 122 por `{\c${primaryColor}}`. Validei por render: o bloco fica PIXEL-IDÊNTICO em posição e largura nos 4 frames com palavras ativas diferentes. Se quiser o 'pop' de escala, aplicá-lo APENAS na entrada do card com `\t` e retornar a 100% antes do 2º evento (ver finding anim-inexistente), pois aí o reflow acontece uma única vez, durante o fade-in, e é lido como animação intencional.

---

### `config-canal-ignorada` — visual_profile.subtitles_style do perfil do canal é 100% morto — zero leitores no repositório inteiro

**Severidade:** CRÍTICO · **Esforço:** small · **Categoria:** config-drift  
**Arquivo:** `pipeline/src/run_pipeline.js:120`

**Evidência**

run_pipeline.js:120-127 chama `generateAssSubtitles({ wordBoundaries, outputAssPath })` e `generateSrtSubtitles({ wordBoundaries, outputSrtPath })` — o `channelProfile` já está carregado na linha 97 (`loadChannelProfile(options.channel)`) e NÃO é passado. `grep -rn "subtitles_style|margin_v|font_name" --include=*.js --include=*.java pipeline/ src/` retorna APENAS as 3 linhas de defaults hardcoded dentro do próprio subtitle_generator.js (73, 80, 95). Nenhum leitor. Resultado: psicosegredo.json declara `font_name: Montserrat-Black, font_size: 65, margin_v: 160, outline_width: 4, alignment: 2, secondary_accent_color: &H00FFE500` e o .ass gerado diz literalmente `Style: Default,Arial,65,&H00FFFFFF,&H0000D7FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,2,2,40,40,380,1` — Arial em vez de Montserrat-Black, marginV 380 em vez de 160, e `secondary_accent_color` nunca usado.

**Causa-raiz**

generateAssSubtitles foi escrito com todos os parâmetros de estilo como defaults de destructuring (linhas 71-80) em vez de exigir um objeto de estilo; o call site nunca foi atualizado quando o perfil de canal ganhou subtitles_style. Multi-canal é ilusório: trocar --channel não muda NADA na legenda.

**Impacto no vídeo final**

Identidade visual do canal não existe. Todo canal (psicosegredo, estoico, milionaria) sai com a MESMA legenda Arial branca/dourada na mesma posição. O perfil de canal, que é o produto central do pipeline, é decorativo para legendas.

**Correção**

1) Em subtitle_generator.js, aceitar `channelProfile` e derivar: `const st = channelProfile?.visual_profile?.subtitles_style || {}` e mapear snake_case→camelCase com fallback (`fontName = st.font_name ?? 'Liberation Sans'`, `fontSize = st.font_size ?? 76`, `marginV = st.margin_v ?? 560`, `alignment = st.alignment ?? 2`, `outlineWidth = st.outline_width ?? 6`, `primaryColor = st.primary_color ?? '&H00FFFFFF'`, `activeWordColor = st.active_word_color ?? '&H0000D7FF'`, `accentColor = st.secondary_accent_color`). 2) Em run_pipeline.js:120 passar `channelProfile` e também `format` (`playResX/playResY` de `channelProfile.format.resolution`). 3) Adicionar validação fail-fast: se `st` existir mas alguma chave declarada não for consumida, logar `[Subtitles] AVISO: chave subtitles_style.X declarada e ignorada`. 4) Adicionar teste de regressão que faz `generateAssSubtitles` com um perfil sintético e asserta que a linha `Style:` contém exatamente os valores do perfil.

---

### `evento-por-palavra-explosao` — Explosão combinatória: 1 evento Dialogue por (palavra ativa × palavras do card) — 160 eventos e 26,6KB para 160 palavras

**Severidade:** ALTO · **Esforço:** medium · **Categoria:** cost  
**Arquivo:** `pipeline/src/subtitle_generator.js:103`

**Evidência**

Loop aninhado linhas 103-128: `for (const chunk of chunks) { for (let i = 0; i < chunk.words.length; i++) { ... eventLines.push(...) } }`. Cada evento re-emite o TEXTO INTEIRO do card com todas as tags. Medido no arquivo real: `grep -c '^Dialogue' pipeline/scratch/run_1789161687124_1/subtitles.ass` = 160 eventos para 40 cards distintos, `wc -c` = 26.632 bytes. Cada palavra é serializada 4 vezes (uma por posição ativa do card) e cada evento carrega 4 blocos de override. Custo de render: 160 re-layouts completos + 640 shapings de palavra, contra 40 layouts / 160 shapings de uma arquitetura por card.

**Causa-raiz**

Ausência de uso das transformações temporais do ASS (\t), que permitem animar cor DENTRO de um único evento. O autor emulou karaokê por força bruta em eventos separados.

**Impacto no vídeo final**

Além do custo, é a CAUSA ESTRUTURAL do flicker: como cada palavra é um evento novo, o libass descarta e recria o bitmap a cada troca, e qualquer diferença de métrica (ver reflow-fscx108-jitter) ou qualquer gap de timing (ver gap-entre-chunks) vira um pisca visível. O texto não 'anima', ele é substituído 160 vezes.

**Correção**

Migrar para UM Dialogue por card com sweep de cor via \t por palavra. Validei por render que funciona no libass do ffmpeg empacotado — os tempos de \t são relativos ao início do evento, em ms. Linha literal validada:

Dialogue: 0,0:00:00.00,0:00:02.00,Cap,,0,0,0,,{\fad(70,90)\t(0,110,\fscx103\fscy103)\t(110,200,\fscx100\fscy100)}{\c&H00FFFFFF&\t(0,60,\c&H0000D7FF&)\t(440,500,\c&H00FFFFFF&)}CLAREZA {\c&H00FFFFFF&\t(440,500,\c&H0000D7FF&)\t(940,1000,\c&H00FFFFFF&)}ABSOLUTA\N{\c&H00FFFFFF&\t(940,1000,\c&H0000D7FF&)\t(1440,1500,\c&H00FFFFFF&)}DESCARTE {\c&H00FFFFFF&\t(1440,1500,\c&H0000D7FF&)}QUALQUER

GOTCHA CRÍTICO confirmado empiricamente: cada bloco de palavra PRECISA declarar a cor-base explicitamente (`\c&H00FFFFFF&`) ANTES dos `\t`. Sem isso o libass pré-aplica os \t ainda não iniciados e TODAS as palavras aparecem douradas desde o frame 1 (reproduzi esse bug). Ganho: 160 → 40 eventos (-75%), ~26,6KB → ~7KB, zero reflow, e a transição de cor vira um crossfade de 60ms em vez de corte seco.

---

### `palavra-truncada-inte` — Palavra "INTERIOR" aparece como "INTE" na legenda queimada e no SRT — topic.slice(0,35) corta no meio da palavra

**Severidade:** ALTO · **Esforço:** small · **Categoria:** bug  
**Arquivo:** `pipeline/src/script_generator.js:141`

**Evidência**

script_generator.js:141: ``const hook = `Se você busca dominar ${topic.slice(0, 35)} com verdadeira maestria, existe um princípio silencioso...`;``. O tópico da run foi "O Poder do Silêncio e da Calma Interior" (39 chars). `.slice(0,35)` produz "O Poder do Silêncio e da Calma Inte" — o corte cai exatamente entre o 'e' e o 'r' de Interior. Confirmado no artefato final: subtitles.ass linhas 24-27 contêm `{\c&H00FFFFFF}INTE{\r}` e subtitles.srt bloco 3 diz `00:00:02,550 --> 00:00:03,240 / E DA CALMA INTE`. O Edge-TTS também LOCUTOU "inte", então o áudio está corrompido junto. Não existe nenhuma reconciliação no subtitle_generator: ele confia cegamente no array de wordBoundaries e não tem acesso ao narrationText canônico (run_pipeline.js:120 não o passa).

**Causa-raiz**

Truncamento por contagem de CARACTERES sobre texto que vai para síntese de voz e legenda, sem respeitar fronteira de palavra. Agravado pela ausência de qualquer validação/reconciliação do lado da legenda.

**Impacto no vídeo final**

Palavra sem sentido queimada no vídeo publicado e no CC do YouTube. Sinaliza produto quebrado ao espectador logo aos 2,5s (dentro da janela de retenção crítica) e degrada o SEO do CC. Afeta TODO tópico livre com mais de 35 caracteres — ou seja, a maioria.

**Correção**

Dois consertos independentes, ambos necessários. (1) script_generator.js:141 (e todos os `.slice()` sobre topic, incl. linha 140 `topic.slice(0,50)`): usar truncamento por palavra — `const clip = (s, n) => s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n)).trim();` e, para o hook narrado, NÃO truncar de forma alguma (o tópico inteiro deve ser locutado). (2) subtitle_generator: receber `narrationText` e rodar um guard de integridade — normalizar (NFD, lowercase, sem pontuação) e verificar que a concatenação dos `wordBoundaries[].word` é subsequência do narrationText; qualquer token que não case exatamente com um token do texto canônico é substituído pelo token canônico alinhado, e emite-se `[Subtitles] AVISO: token TTS "inte" reconciliado para "interior"`. Isso também cura word boundaries perdidos pelo parser frágil de metadata do voice_synthesizer.js (linha 48: `if (line.startsWith('{') && line.endsWith('}'))` descarta silenciosamente qualquer JSON partido entre chunks TCP).

---

### `sem-escape-ass` — Zero escape de caracteres especiais ASS — texto entre { } é silenciosamente ENGOLIDO pelo libass

**Severidade:** ALTO · **Esforço:** trivial · **Categoria:** bug  
**Arquivo:** `pipeline/src/subtitle_generator.js:117`

**Evidência**

Linhas 115-124 fazem `w.word.toUpperCase()` e interpolam direto na linha Dialogue. Não há sanitização de `{`, `}`, `\`, nem de quebras de linha. Provei o efeito renderizando com o ffmpeg do repo um Dialogue com o texto `FOCO {MENTAL} E 100% PURO`: o frame renderizado mostra apenas `FOCO  E 100% PURO` — a palavra MENTAL DESAPARECEU, porque `{...}` é a sintaxe de bloco de override do ASS e o libass tentou parsear 'MENTAL' como tags. Um `\` no texto vira sequência de escape (`\N` quebra linha, `\h` espaço fixo, `\b` negrito). O caminho de entrada é direto e não confiável: `--topic` do CLI (run_pipeline.js:42) → script_generator.js:141 interpola cru em `narrationText` → Edge-TTS → wordBoundaries → .ass.

**Causa-raiz**

Geração de formato estruturado por concatenação de string sem camada de escaping, com dados de origem externa (argumento de CLI / tópico vindo do backend Java via AiPipelineService).

**Impacto no vídeo final**

Palavras somem do vídeo final sem nenhum erro no log (falha silenciosa). Com um tópico contendo chave ou barra invertida, uma frase inteira pode desaparecer ou toda a formatação do card pode ser destruída. Como não há teste nem validação, isso chegaria publicado.

**Correção**

Adicionar e aplicar a TODO texto antes de interpolar na linha Dialogue:
```js
const escapeAssText = (s) => String(s)
  .replace(/\\/g, '\\\\')      // barra invertida literal
  .replace(/\{/g, '\\{')       // chave de abertura
  .replace(/\}/g, '\\}')       // chave de fechamento
  .replace(/\r?\n/g, ' ')      // newline real quebraria o registro Dialogue
  .replace(/\s+/g, ' ')
  .trim();
```
Usar `escapeAssText(w.word)` nas linhas 117/120/122. Atenção: a quebra de linha INTENCIONAL (`\N`) deve ser inserida DEPOIS do escape, pelo layout engine, nunca vir do texto de origem. Para o SRT, escape distinto: apenas neutralizar `<`/`>` (o YouTube interpreta tags) e garantir que nenhuma linha em branco apareça dentro do bloco.

---

### `fonte-inexistente-fallback-silencioso` — Montserrat-Black não existe em lugar nenhum (pipeline/assets/fonts vazio, Docker sem ela) e o filtro subtitles não passa fontsdir — honrar o perfil hoje causaria fallback silencioso

**Severidade:** ALTO · **Esforço:** small · **Categoria:** config-drift  
**Arquivo:** `Dockerfile:38`

**Evidência**

(a) `pipeline/assets/fonts/` contém APENAS `.gitkeep` (0 arquivos de fonte); `find` por *.ttf/*.otf no repo só acha codicon do playwright. (b) Dockerfile linhas 36-44 instalam `fontconfig font-liberation font-noto ttf-dejavu` — nenhuma dessas é Arial nem Montserrat, e nenhuma é peso Black/display. (c) Na máquina de dev: `C:/Windows/Fonts` tem arial.ttf/arialbd.ttf mas ZERO Montserrat (checado também em %LOCALAPPDATA%/Microsoft/Windows/Fonts). (d) video_compositor.js monta `[graded]subtitles='${escapedAssPath}'[v_out]` SEM `fontsdir=` nem `force_style=`, então o libass depende 100% do fontconfig do sistema. (e) O Dockerfile NÃO copia pipeline/assets/fonts para /usr/share/fonts. Nota honesta: o Arial atual sobrevive no container porque o fontconfig do Alpine traz 30-metric-aliases.conf que mapeia Arial→Liberation Sans (metricamente compatível, larguras idênticas) — ou seja o bug de fonte hoje é latente, não visível. Ele se torna VISÍVEL no instante em que alguém 'consertar' a leitura do perfil e passar Montserrat-Black, para a qual não existe alias.

**Causa-raiz**

Dependência em fonte do sistema declarada por nome, sem empacotamento do arquivo de fonte junto ao artefato e sem verificação de disponibilidade em runtime.

**Impacto no vídeo final**

Corrigir o finding config-canal-ignorada SEM corrigir este quebra o vídeo: Montserrat-Black (peso 900, muito condensado e alto) cai para Liberation Sans Regular/Bold, que tem altura-x, avanço e peso completamente diferentes. Todo o cálculo de chars-por-linha e o marginV ficam errados de uma vez, e o canal perde o look 'shorts' (tipografia pesada é o que dá legibilidade em tela de celular).

**Correção**

1) Versionar o arquivo real em `pipeline/assets/fonts/Montserrat-Black.ttf` (SIL OFL, redistribuição livre). 2) No Dockerfile, antes do `fc-cache -f -v`, adicionar `COPY --chown=appuser:appgroup pipeline/assets/fonts/ /usr/share/fonts/autopublisher/` e mover o `fc-cache` para DEPOIS desse COPY (hoje ele roda antes de qualquer fonte custom existir). 3) Em video_compositor.js, passar o diretório explicitamente e não depender do fontconfig: `subtitles='${escapedAssPath}':fontsdir='${escapedFontsDir}'`. 4) Em subtitle_generator.js, verificar em runtime: se o .ttf do `font_name` não existe em pipeline/assets/fonts e o nome não é uma das famílias garantidas ('Liberation Sans','DejaVu Sans','Noto Sans'), lançar erro em vez de degradar em silêncio — `throw new Error('[Subtitles] Fonte "'+fontName+'" nao empacotada; o libass faria fallback e quebraria o layout')`. 5) Default seguro para quem não empacotar nada: 'Liberation Sans' (presente no container E aliasada de/para Arial no Windows), nunca 'Arial'.

---

### `sem-quebra-controlada-N` — Nenhum \N no .ass — libass quebra a linha sozinho com WrapStyle 0 e a quebra muda entre eventos do mesmo card

**Severidade:** ALTO · **Esforço:** medium · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/subtitle_generator.js:87`

**Evidência**

Header linha 87: `WrapStyle: 0` (quebra automática 'inteligente', linhas de tamanho parecido, linha de baixo mais larga). Verificado: `grep -cF '\N'` no campo de texto dos 160 Dialogue = 0 — nenhuma quebra explícita. Com MarginL=MarginR=40 a largura útil é 1000px; medi por render que o avanço médio de caixa alta em Arial Bold é `0.596*fontSize + spacing` px/char (medi "CLAREZA ABSOLUTA" = 16 chars = 818px a fs=84 → 51,1px/char → 0,596em), logo a fs=65 cabem ~25 chars. Os cards reais vão de 14 a 34 chars: "SE VOCÊ BUSCA DOMINAR" (21) fica em 1 linha e "CLAREZA ABSOLUTA DESCARTE QUALQUER" (34) em 2 — render confirma. O ponto de quebra é decidido pelo libass com a métrica DAQUELE evento, e como \fscx108 muda a métrica, o MESMO card pode quebrar em lugares diferentes ao longo dos seus 4 eventos.

**Causa-raiz**

Nenhum layout engine do lado do gerador: a decisão tipográfica foi delegada ao renderer, que não conhece a semântica (não sabe que não deve separar 'A' de 'MAIORIA', nem preposição da palavra seguinte).

**Impacto no vídeo final**

Número de linhas do card é imprevisível → o bloco de texto muda de altura de card para card (e às vezes dentro do card), fazendo o texto pular verticalmente ~78px. Quebras caem em lugares ruins (artigo/preposição sozinhos no fim da linha). É o que se vê nos frames do vídeo final.

**Correção**

Trocar o header para `WrapStyle: 2` (NENHUMA quebra automática — só \N é respeitado; validei que o libass obedece) e inserir \N calculado pelo gerador. Algoritmo: `maxCharsPerLine = Math.floor((playResX - marginL - marginR) / (advancePerEm * fontSize + spacing))`, com `advancePerEm` vindo de uma tabela por família medida uma vez (Arial/Liberation Sans Bold caixa alta = 0.596; Montserrat-Black ≈ 0.62) ou, melhor, medido de verdade com opentype.js sobre o .ttf empacotado somando `glyph.advanceWidth` — aí a largura é EXATA por string, não estimada. Quebrar com balanceamento: escolher o ponto de espaço que minimiza `|larguraLinha1 - larguraLinha2|` PROIBINDO terminar linha em palavra de <= 2 chars (A, O, E, DE, DA, NO, EM). ATENÇÃO com WrapStyle 2: ele não protege contra overflow — validei que "SE VOCÊ BUSCA DOMINAR" a fs=84 mede 1043px e VAZA das margens. Portanto o cálculo de maxCharsPerLine passa a ser obrigatório, e se um card ainda estourar após a quebra em 2 linhas, reduzir dinamicamente o fontSize daquele card (`\fs`) ou dividir o card.

---

### `safe-area-marginv` — marginV 380 hardcoded vs 160 do perfil — e AMBOS são inseguros para a UI real de Shorts/TikTok/Reels

**Severidade:** ALTO · **Esforço:** trivial · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/subtitle_generator.js:80`

**Evidência**

Linha 80: `marginV = 380 // Safe zone otimizada para Shorts/Reels/TikTok`. psicosegredo.json declara `margin_v: 160`. Com Alignment=2 o MarginV é a distância da BASE da última linha até a borda inferior, em unidades de PlayRes (1920). Medi no render real do .ass do repo: a linha de texto fica centrada em y≈1504-1560, isto é 360-416px do fundo. O overlay inferior do TikTok (@usuario + caption de 2 linhas + ticker de música) ocupa até ~460px do fundo em 1080x1920, e a coluna de ações fica em x>940 entre y≈1050 e 1500; o Shorts ocupa ~300px (título, canal, barra de progresso) e o Reels ~340px. Logo: 380 encosta/colide com a caption do TikTok, e os 160 do perfil colocariam a legenda COMPLETAMENTE embaixo da UI das três plataformas.

**Causa-raiz**

Valor único hardcoded escolhido 'no olho' para uma plataforma, sem modelo de safe area por plataforma, e um valor de perfil que nunca foi validado porque nunca foi lido.

**Impacto no vídeo final**

Legenda parcialmente ou totalmente coberta pela interface no TikTok e Reels. O espectador não lê a frase — e legenda é o principal driver de retenção em faceless video, já que a maioria assiste com áudio desligado no primeiro segundo. Corrigir a leitura do perfil SEM corrigir este valor piora o vídeo (380 → 160).

**Correção**

Modelar safe area por plataforma e tomar a interseção, já que o mesmo MP4 vai para YOUTUBE_SHORTS, TIKTOK e INSTAGRAM_REELS (publishing_profile.platforms). Valores para PlayResY=1920: bottom-unsafe = Shorts 320, Reels 360, TikTok 470 → usar `marginV = 470 + 90 (folga de respiro) = 560`. Laterais: MarginL=60 e MarginR=140 (a coluna de ações do TikTok invade a direita); com texto centrado isso mantém o bloco entre x=140 e x=940. Corrigir `margin_v` em psicosegredo.json de 160 para 560 e adicionar `margin_l: 60, margin_r: 140, safe_area_preset: "multi_platform"`. Expor um preset por plataforma no perfil e escolher via `options.platform` quando o render for single-platform. Adicionar um guard: `if (marginV < 320) console.warn('[Subtitles] margin_v=' + marginV + ' fica sob a UI de Shorts/TikTok')`.

---

### `anim-inexistente` — Zero animação real: nenhum \fad, \t, \move, \blur, \pos — só troca de cor em corte seco e escala estática

**Severidade:** ALTO · **Esforço:** medium · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/subtitle_generator.js:115`

**Evidência**

Varredura do .ass gerado: as ÚNICAS tags presentes são `\c`, `\fscx108`, `\fscy108` e `\r`. Nenhuma ocorrência de `\fad`, `\t`, `\move`, `\blur`, `\be`, `\pos`, `\clip`, `\k`. O card aparece instantaneamente no frame do primeiro `startMs` e some instantaneamente — sem fade-in/out. A 'animação' anunciada como 'karaokê animado' no SDD (docs/SDD_Pipeline_Conteudo_IA_v2.md linhas 29 e 95) é apenas um corte duro de cor a cada palavra. Além disso `SecondaryColour` no Style (linha 95) recebe `activeWordColor`, mas SecondaryColour só é usada por karaokê `\k` — que nunca é emitido. Campo inerte. E `{\r}` nas linhas 120/122 depois de `{\c${primaryColor}}` é redundante, já que primaryColor é idêntica à PrimaryColour do Style.

**Causa-raiz**

Implementação por substituição de eventos em vez de uso do motor de animação do ASS. O formato oferece interpolação temporal nativa (\t) e fades (\fad) que nunca foram usados.

**Impacto no vídeo final**

Legenda estática e sem vida ao lado de concorrentes (CapCut/Submagic) que fazem pop-in elástico, glow na palavra ativa e fade. Somado à troca dura de 160 eventos, a percepção é de 'texto piscando', não de motion design — exatamente o oposto do prometido no SDD.

**Correção**

Camada de animação concreta, toda validada por render com o ffmpeg do repo (tempos de \t e \fad em ms relativos ao início do evento). Por card: entrada `{\fad(70,90)\t(0,110,\fscx103\fscy103)\t(110,200,\fscx100\fscy100)}` — fade-in 70ms, fade-out 90ms e pop-in que sobe a 103% em 110ms e retorna a 100% em mais 90ms (o reflow ocorre só durante o fade-in, onde é invisível e lido como animação). Por palavra: `{\c<base>\t(inMs,inMs+60,\c<gold>)\t(outMs,outMs+60,\c<base>)}` — crossfade de 60ms em vez de corte. Ênfase extra sem custo de layout: somar `\blur3` e `\bord+3` na palavra ativa. Para o card do hook (primeiros 3s), opcionalmente `\move(540,1620,540,1560,0,180)` para uma entrada por baixo. Regra de ouro: só `\fad`, `\c`, `\bord`, `\blur`, `\alpha` e `\move` — nunca `\fscx/\fscy` fora da janela de entrada.

---

### `caixa-alta-forcada` — toUpperCase() incondicional no ASS e no SRT — grito permanente e perda dos sinais de leitura da palavra

**Severidade:** MÉDIO · **Esforço:** small · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/subtitle_generator.js:117`

**Evidência**

Linha 117: `const upper = w.word.toUpperCase();` — aplicado a 100% das palavras, sem opção. Linha 150 (SRT): `chunk.words.map(w => w.word.toUpperCase())`. Resultado no vídeo: todos os 40 cards em caixa alta, incluindo `INSCREVA-SE NO CANAL` e `DEIXE SEU LIKE SE`. Em português, caixa alta remove o contorno de ascendentes/descendentes (b,d,f,h,k,l / g,j,p,q,y) que é o que permite reconhecimento de palavra por forma; força leitura letra-a-letra. Também anula a distinção de nomes próprios e siglas.

**Causa-raiz**

Escolha estética hardcoded, não parametrizada, aplicada uniformemente em vez de usada como recurso de ênfase seletiva.

**Impacto no vídeo final**

Velocidade de leitura cai (~10-15% mais lenta para blocos longos em caixa alta), e o tom vira 'gritado' — o que conflita diretamente com o tone declarado do canal em psicosegredo.json: 'Analítico, misterioso, confiante'. Um canal de neurociência calma comunicando em CAPS LOCK o tempo todo é incoerente com a marca.

**Correção**

Parametrizar como `text_case` no subtitles_style, com três modos: `"upper"` (atual), `"sentence"` (padrão recomendado: primeira letra do card maiúscula, resto como no narrationText, preservando acentuação e nomes próprios) e `"keyword_upper"` (caixa alta apenas nas palavras-chave). Para keyword_upper, derivar a lista de palavras de ênfase do próprio roteiro — substantivos/verbos com mais de 4 letras que aparecem nos `broll_keywords` ou no `topic` do canal — e combinar com a cor de destaque `secondary_accent_color` (&H00FFE500) que hoje está declarada e nunca usada. Sempre respeitar a caixa canônica do narrationText como fonte (os wordBoundaries do Edge-TTS já vêm com a caixa original).

---

### `srt-caixa-alta-acessibilidade` — SRT gerado em CAIXA ALTA e herdando a segmentação de 4 palavras — ruim para CC do YouTube e para SEO

**Severidade:** MÉDIO · **Esforço:** small · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/subtitle_generator.js:150`

**Evidência**

Linha 150: `const text = chunk.words.map(w => w.word.toUpperCase()).join(' ');`. Arquivo real pipeline/scratch/run_1789161687124_1/subtitles.srt: `1 / 00:00:00,102 --> 00:00:01,483 / SE VOCÊ BUSCA DOMINAR`, `3 / 00:00:02,550 --> 00:00:03,240 / E DA CALMA INTE`. O SRT ainda reusa `groupWordsIntoChunks` (linha 145), herdando a mesma segmentação módulo-4, e propaga a corrupção 'INTE'. Blocos de ~1s com 4 palavras e zero pontuação.

**Causa-raiz**

O SRT foi tratado como subproduto do ASS (mesmo chunker, mesmo uppercase) em vez de um artefato com requisitos próprios: legenda de acessibilidade tem regras diferentes de legenda decorativa queimada.

**Impacto no vídeo final**

Leitores de tela leem caixa alta letra-a-letra ou mudam a entonação. O CC do YouTube é indexado para busca e usado para geração de capítulos/tradução automática — texto sem pontuação, todo em caps e com 'INTE' degrada tradução automática e SEO. O SRT é o artefato que sai do vídeo e vira metadado da plataforma; ele carrega o defeito para fora do frame.

**Correção**

Desacoplar o SRT: (1) NUNCA aplicar toUpperCase no SRT — usar o texto canônico do narrationText com caixa e pontuação originais; (2) usar um chunker próprio com as convenções de CC: 1-2 linhas, até 42 caracteres por linha, duração entre 1,0s e 6,0s, e quebra preferencial em fronteira de oração; (3) aplicar o mesmo guard de reconciliação com narrationText (ver palavra-truncada-inte) para que a pontuação real (. , ? !) apareça no SRT; (4) garantir que o arquivo termina com linha em branco e que os índices são contíguos. Manter o ASS (decorativo, caixa configurável) e o SRT (acessibilidade, caixa natural) como dois formatadores independentes sobre a MESMA lista de cards prosódicos.

---

### `gap-entre-chunks` — Buracos de 10-30ms entre o último evento de um card e o primeiro do próximo → legenda some por 1 frame

**Severidade:** MÉDIO · **Esforço:** trivial · **Categoria:** bug  
**Arquivo:** `pipeline/src/subtitle_generator.js:111`

**Evidência**

Linha 111-112: `const effectiveEndMs = nextWord ? nextWord.startMs : chunk.endMs;` — o comentário da linha 110 diz 'Previne flicker na tela', mas a proteção só vale DENTRO do card: `nextWord` é `chunk.words[i+1]`, que é `undefined` no último índice, então o último evento termina em `chunk.endMs` (= endMs da última palavra) e o card seguinte só começa em `startMs` da sua primeira palavra. Medido no SRT real: card 1 termina em 00:00:01,483 e card 2 começa em 00:00:01,495 (12ms de buraco); card 2 → 3: 2,537 → 2,550 (13ms); card 3 → 4: 3,240 → 3,253 (13ms). Some-se o arredondamento: `formatAssTime` usa `Math.floor((ms % 1000) / 10)`, truncando para centissegundos — o fim é arredondado PARA BAIXO, ampliando o buraco em até 9ms.

**Causa-raiz**

A continuidade temporal foi tratada como propriedade local do card em vez de propriedade global da trilha de legendas.

**Impacto no vídeo final**

A 30fps o frame dura 33ms, então um buraco de 12-22ms normalmente cai dentro de um frame — mas quando cai sobre uma fronteira de frame, a legenda desaparece por 1 frame inteiro, 40 vezes ao longo de 62s. Percebido como piscada. Combinado com a troca de 160 eventos, é o flicker reportado nos frames.

**Correção**

Depois de montar a lista de cards, rodar um passe de 'costura': `for (let i=0;i<cards.length-1;i++) cards[i].endMs = Math.max(cards[i].endMs, cards[i+1].startMs);` de modo que cada card encoste no seguinte, e estender o último card em +250ms (respiro final). No formatador de tempo, arredondar o START para baixo e o END para CIMA (`Math.ceil`) em centissegundos, nunca ambos para baixo. Com a arquitetura de 1 evento por card (ver evento-por-palavra-explosao), este problema desaparece quase totalmente — restam apenas 40 fronteiras em vez de 160, todas costuradas.

---

### `escape-caminho-ass-ffmpeg` — Escaping do caminho do .ass no filtro subtitles cobre só ':' — aspas, vírgula e colchetes no caminho quebram o filtergraph

**Severidade:** MÉDIO · **Esforço:** trivial · **Categoria:** bug  
**Arquivo:** `pipeline/src/video_compositor.js:35`

**Evidência**

Linha 35: `const escapedAssPath = subtitlesAssPath.replace(/\\/g, '/').replace(/:/g, '\\:');` e linha ~70 `[graded]subtitles='${escapedAssPath}'[v_out]`. Só ':' é tratado. O parser do ffmpeg quebra o argumento de filtro em ':' (separador de opções), ',' (separador de filtros), '[' ']' (labels) e "'" (quoting). Demonstrei o efeito ao vivo: rodando o ffmpeg do repo com um caminho contendo `C:` sem escape, o erro foi `Unable to parse option value "/Users/..." as image size` / `Error setting option original_size` — ou seja o parser interpretou a segunda metade do caminho como o parâmetro `original_size` do filtro subtitles. Qualquer pasta do usuário com vírgula (comum em Windows: 'Projetos, Pessoal') ou apóstrofo mata a renderização. Também falta `original_size` e `fontsdir` no filtro.

**Causa-raiz**

Escaping ad-hoc por replace de um único caractere, em vez de escaping completo da gramática de filtro do ffmpeg.

**Impacto no vídeo final**

Falha de render dependente do caminho da máquina — o vídeo sai SEM legenda ou o job inteiro aborta. Frágil justamente na transição dev Windows → container Linux, onde os caminhos mudam.

**Correção**

Escapar a gramática inteira, na ordem correta (barra invertida primeiro): `const esc = p => p.replace(/\\/g,'/').replace(/\\/g,'\\\\\\\\').replace(/([:'\\[\\],;])/g,'\\\\$1');` e então emitir `subtitles=filename='${esc(assPath)}':fontsdir='${esc(fontsDir)}':original_size=1080x1920`. Alternativa mais robusta: copiar o .ass para um nome fixo e simples dentro do scratchDir (ex.: `subs.ass`), rodar o ffmpeg com `cwd` no scratchDir e referenciar `subtitles=subs.ass` — validei que esse caminho relativo funciona sem nenhum escaping. Passar `original_size` explicitamente evita que o libass escale a PlayRes caso o pipeline mude de resolução.

---

### `zero-teste-legendas` — Nenhum teste automatizado para o gerador de legendas — os defeitos só aparecem no MP4 publicado

**Severidade:** MÉDIO · **Esforço:** small · **Categoria:** arch  
**Arquivo:** `pipeline/src/subtitle_generator.js:43`

**Evidência**

Busca por arquivos *test*/*spec* relacionados a subtitle no repo retorna apenas artefatos binários de scratch (test_audio.mp3, test_cinemagraph.gif, etc.) — nenhum teste de código. Nenhuma asserção cobre: a linha `Style:` refletir o perfil, a inexistência de caracteres não escapados, a contiguidade temporal dos eventos, o limite de chars por linha, ou a ausência de tokens que não existam no narrationText. Todos os 5 defeitos mais graves deste relatório (chunk módulo-4, reflow, config ignorada, 'INTE', escape) seriam capturados por asserções triviais sobre a string do .ass.

**Causa-raiz**

O .ass é tratado como saída intermediária descartável, não como artefato versionável e verificável — embora seja determinístico dado (wordBoundaries, perfil), o que o torna o componente mais fácil de testar de todo o pipeline.

**Impacto no vídeo final**

Regressões de legenda chegam ao vídeo publicado. Como não há validação, a única detecção é inspeção visual manual de frames — que foi exatamente como estes defeitos foram encontrados, depois de renderizar 62s de vídeo.

**Correção**

Criar `pipeline/test/subtitle_generator.test.mjs` (node:test, zero dependência nova) com um fixture de wordBoundaries sintético + o psicosegredo.json real, asserindo: (1) `assert.match(ass, /^Style: Cap,Montserrat-Black,76,/m)` — perfil realmente aplicado; (2) nenhum `{` não escapado fora de bloco de override válido, via regex sobre o campo Text; (3) para todo par de eventos consecutivos, `end[i] >= start[i+1]` (sem buraco); (4) toda linha entre `\N` tem `length <= maxCharsPerLine`; (5) a união dos tokens do .ass é subsequência dos tokens de narrationText (pega 'INTE'); (6) nenhum card cruza um gap >= 260ms; (7) nenhum card final com < 2 palavras; (8) contagem de eventos == contagem de cards (regressão da explosão combinatória). Adicionar um teste de smoke visual opcional que renderiza 3 frames com o ffmpeg empacotado e checa que o bounding box do texto é idêntico entre eventos do mesmo card (regressão do reflow).

---

### `header-ass-subotimo` — Header ASS com YCbCr Matrix: None, fontSize 65 subdimensionado para 1920p e SecondaryColour inerte

**Severidade:** BAIXO · **Esforço:** trivial · **Categoria:** quality-killer  
**Arquivo:** `pipeline/src/subtitle_generator.js:89`

**Evidência**

Header linhas 84-95: `YCbCr Matrix: None` — com 'None' o libass não aplica conversão de matriz, mas a saída é BT.709 (1080x1920, libx264, yuv420p em video_compositor.js), então branco e dourado saem levemente fora do alvo. `fontSize = 65` em PlayResY=1920 é 3,4% da altura — legendas de shorts competitivos ficam entre 4,5% e 6% (86 a 115px); medi que 'SE VOCÊ BUSCA DOMINAR' a 65px ocupa só ~835px de 1000 disponíveis, desperdiçando área de leitura em tela de celular. `SecondaryColour` no Style recebe `activeWordColor` mas só é lida por karaokê `\k`, nunca emitido — campo morto. Shadow=2 com BorderStyle=1 e Outline=4 gera sombra deslocada que, sobre imagem escura, só suja o contorno. `Spacing: 0` deixa a caixa alta apertada.

**Causa-raiz**

Header montado por cópia de template genérico sem calibrar para o caso concreto (9:16, 1920p, caixa alta, fundo cinematográfico escuro).

**Impacto no vídeo final**

Legenda menor do que deveria (menos legível no feed), contorno sujo e cores levemente deslocadas. Isoladamente é sutil, mas soma com os demais defeitos para a percepção de 'amador'.

**Correção**

Header calibrado: `WrapStyle: 2`, `YCbCr Matrix: TV.709`, `PlayResX/Y` vindos de `channelProfile.format.resolution`. Style recomendado (validado por render): `Style: Cap,Montserrat-Black,76,&H00FFFFFF,&H00FFE500,&H00000000,&HA0000000,-1,0,0,0,100,100,1,0,1,6,0,2,60,140,560,1` — fontSize 76 (4,0% de 1920, com Montserrat-Black que é mais alta que Arial), Spacing 1 para arejar a caixa alta, Outline 6 e Shadow 0 (contorno grosso e limpo em vez de sombra suja), BackColour com alpha A0 disponível caso se queira BorderStyle=3 (caixa sólida) sobre fundos claros. Passar `secondary_accent_color` (&H00FFE500) para uso real como cor de palavra-chave, não como SecondaryColour inerte. Atenção: ao subir para 76px o `maxCharsPerLine` cai para ~20 — o layout engine do finding sem-quebra-controlada-N precisa recalcular, não pode ser constante.

---
