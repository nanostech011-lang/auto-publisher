# ADR 0007: Modos de Áudio, Vídeo Puramente Visual e Salvaguardas de Áudio Próprio (SOURCE_AUDIO)

## Status
**Aprovado** (Data: 2026-10-07)

---

## Contexto e Motivação

O pipeline de geração automatizada de conteúdo do **AutoPublisher Pro** foi originalmente concebido operando exclusivamente com síntese de voz neural Text-to-Speech (Edge-TTS). No entanto, estratégias modernas de crescimento orgânico e monetização em plataformas verticais (YouTube Shorts, TikTok, Instagram Reels) exigem flexibilidade operacional para:
1. **Vídeos Puramente Visuais (`audioMode: NONE`):** Conteúdo contemplativo, estético ou focado em música ambiente/trilha sonora (vídeos de estética, paisagens, rotinas, meditação ou mensagens com legendas dinâmicas silenciosas).
2. **Reaproveitamento de Áudio Original (`audioMode: SOURCE_AUDIO`):** Cenários em que o criador de conteúdo deseja manter a locução, entrevista, fala original ou música do vídeo fonte extraído via YouTube.
3. **Locução Neural Ultra-Natural (`audioMode: TTS`):** Síntese enriquecida com prosódia PT-BR nativa, respiração e acentuação gramatical rigorosa.

Entretanto, o reaproveitamento indiscriminado de áudio externo acarreta sérios riscos de **reivindicações de direitos autorais (Content ID)**, perda de monetização no YouTube Partner Program (YPP) e bloqueio algorítmico no TikTok.

---

## Decisões Tomadas

### 1. Enum de Domínio `AudioMode`
Foi introduzido o modelo de domínio puro `com.autopublisher.domain.model.AudioMode`:
* `TTS` (Padrão): Locução neural gerada pelo Edge-TTS com timestamps milimétricos por palavra.
* `NONE`: Vídeo sem locução neural. Pode conter apenas trilha sonora de fundo (`bgMusicPath`) com volume destacado ou áudio estéreo silencioso sintético de conformidade.
* `SOURCE_AUDIO`: Extração e normalização do áudio do vídeo de origem, com restrições e quarentena contratual.

### 2. Salvaguarda Fail-Closed e Quarentena de Direitos Autorais (`REVISAO_MANUAL`)
* **Flag de Proteção:** A extração de áudio externo opera em modo *fail-closed*. Se a variável de ambiente `ENABLE_SOURCE_AUDIO` for diferente de `true`, o pipeline bloqueia imediatamente a tentativa com erro explicativo de conformidade.
* **Status `REVISAO_MANUAL`:** Todo post gerado com `audioMode: SOURCE_AUDIO` é obrigatoriamente registrado no Google Sheets e no banco com o status `REVISAO_MANUAL` (e não `PENDENTE`).
* **Trava de Auto-Publishing:** O `GoogleSheetsAdapter` e o `PublishScheduledPostsService` ignoram estritamente qualquer post com status `REVISAO_MANUAL`. O post só será agendado/publicado após um operador humano inspecionar a trilha de áudio e alterar manualmente a coluna para `PENDENTE`.

### 3. Grafo de Áudio FFmpeg Universal (`buildAudioFilterGraph`)
O `video_compositor.js` foi refatorado para desacoplar a presença de voz e trilha sonora via função pura:
* **Voz + Trilha:** Highpass 80Hz + compressor + sidechain ducking + mixagem + EBU R128 (`-14 LUFS`).
* **Apenas Trilha (`NONE` com BGM):** Trilha sonora com volume expandido (ganho compensatório de 2.5x) e normalização EBU R128 com fade out nos créditos finais.
* **Silêncio Sintético (`NONE` sem BGM):** Geração de áudio estéreo nulo via `aevalsrc=0:d={dur}:s=48000:c=stereo`, garantindo que o MP4 final contenha uma stream AAC 48kHz válida exigida pelos decodificadores do TikTok e YouTube.

### 4. Estimador de Cadência Visual (`timing_estimator.js`)
Para suportar legendas dinâmicas sincronizadas no modo `NONE`, o módulo `timing_estimator.js` estima a cadência de leitura humana (~2.5 palavras por segundo e pausas de pontuação), permitindo que `generateAssSubtitles` renderize legendas perfeitamente cadenciadas mesmo sem um arquivo de áudio falado.

---

## Consequências

### Positivas
* **Flexibilidade Criativa:** Suporte imediato a formatos *aesthetic*, vídeos sem locução e reaproveitamento de cortes.
* **Segurança Jurídica:** Risco de strike por Content ID mitigado pela trava de `REVISAO_MANUAL`.
* **Zero Falhas de Renderização:** O pipeline gera streams de vídeo e áudio 100% compatíveis com os validadores do Cloud Run e redes sociais.

### Negativas / Trade-offs
* O modo `SOURCE_AUDIO` requer aprovação manual humana na planilha antes do disparo automático.
* No modo `NONE` com legendas, a sincronia é estimada matematicamente baseada em pesos silábicos e pontuação, não em fonemas reais.
