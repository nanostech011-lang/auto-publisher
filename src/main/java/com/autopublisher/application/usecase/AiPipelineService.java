package com.autopublisher.application.usecase;

import com.autopublisher.application.port.in.PipelineJobStatus;
import com.autopublisher.application.port.in.PipelineRunRequest;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Servico de orquestracao e monitoramento da esteira Upstream de IA (Node.js/FFmpeg/Edge-TTS).
 */
@Service
public class AiPipelineService {

    private static final Logger log = LoggerFactory.getLogger(AiPipelineService.class);

    private final ObjectMapper objectMapper;
    private final String geminiApiKey;
    private final String pexelsApiKey;
    private final String pixabayApiKey;
    private final Map<String, PipelineJobStatus> jobRepository = new ConcurrentHashMap<>();
    private final Map<String, List<String>> jobLogs = new ConcurrentHashMap<>();

    @org.springframework.beans.factory.annotation.Autowired
    public AiPipelineService(
            ObjectMapper objectMapper,
            @org.springframework.beans.factory.annotation.Value("${autopublisher.ai.gemini-api-key:}") String geminiApiKey,
            @org.springframework.beans.factory.annotation.Value("${autopublisher.ai.pexels-api-key:}") String pexelsApiKey,
            @org.springframework.beans.factory.annotation.Value("${autopublisher.ai.pixabay-api-key:}") String pixabayApiKey
    ) {
        this.objectMapper = objectMapper;
        this.geminiApiKey = geminiApiKey;
        this.pexelsApiKey = pexelsApiKey;
        this.pixabayApiKey = pixabayApiKey;
    }

    public AiPipelineService(ObjectMapper objectMapper, String geminiApiKey) {
        this(objectMapper, geminiApiKey, null, null);
    }

    public AiPipelineService() {
        this(new ObjectMapper(), null, null, null);
    }

    /**
     * Lista todos os perfis de canais configurados na pasta pipeline/config/channels/
     */
    public List<Map<String, Object>> listChannels() {
        List<Map<String, Object>> channels = new ArrayList<>();
        File channelsDir = new File("pipeline/config/channels");

        if (!channelsDir.exists() || !channelsDir.isDirectory()) {
            log.warn("Diretorio de canais nao encontrado: {}", channelsDir.getAbsolutePath());
            return channels;
        }

        File[] files = channelsDir.listFiles((dir, name) -> name.toLowerCase().endsWith(".json"));
        if (files != null) {
            for (File file : files) {
                try {
                    Map<String, Object> channelData = objectMapper.readValue(file, new TypeReference<>() {});
                    channels.add(channelData);
                } catch (Exception e) {
                    log.error("Erro ao ler perfil do canal {}: {}", file.getName(), e.getMessage());
                }
            }
        }

        return channels;
    }

    private Map<String, Object> scriptMap(Object... kvs) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < kvs.length; i += 2) {
            map.put((String) kvs[i], kvs[i + 1]);
        }
        return map;
    }

    /**
     * Gera ou recupera a pre-visualizacao do roteiro estruturado com base no catalogo e perfil do canal.
     */
    public Map<String, Object> previewScript(String channelId, String topic, Integer scriptIndex) {
        return previewScript(channelId, topic, scriptIndex, null);
    }

    /**
     * Gera ou recupera a pre-visualizacao do roteiro estruturado (com suporte a analise de video do YouTube).
     */
    public Map<String, Object> previewScript(String channelId, String topic, Integer scriptIndex, String sourceUrl) {
        return previewScript(channelId, topic, scriptIndex, sourceUrl, null);
    }

    /**
     * Gera ou recupera a pre-visualizacao do roteiro estruturado com diretriz visual personalizada.
     */
    public Map<String, Object> previewScript(String channelId, String topic, Integer scriptIndex, String sourceUrl, String visualDirective) {
        return previewScript(channelId, topic, scriptIndex, sourceUrl, visualDirective, null, null, null, null);
    }

    /**
     * Gera ou recupera a pre-visualizacao do roteiro estruturado com suporte a perfil de canal 100% dinamico do dashboard.
     */
    public Map<String, Object> previewScript(String channelId, String topic, Integer scriptIndex, String sourceUrl,
                                             String visualDirective, String channelName, String channelNiche,
                                             String voiceId, String affiliateUrl) {
        String finalChannel = (channelId != null && !channelId.isBlank()) ? channelId.trim() : (channelName != null ? channelName.replace("@", "").trim() : "canal");
        int index = (scriptIndex != null) ? scriptIndex : 0;

        if (sourceUrl != null && !sourceUrl.isBlank()) {
            return analyzeYouTubeVideo(sourceUrl, channelId, visualDirective, channelName, channelNiche, voiceId, affiliateUrl);
        }

        try {
            List<String> command = List.of(
                    "node",
                    "-e",
                    "import('./pipeline/src/script_generator.js').then(m => {" +
                            "  const customProfile = (process.argv[6] || process.argv[7] || process.argv[8] || process.argv[9]) ? {" +
                            "    channel_id: process.argv[1]," +
                            "    name: process.argv[6] || ('@' + process.argv[1])," +
                            "    channelName: process.argv[6] || ('@' + process.argv[1])," +
                            "    niche: process.argv[7] || 'Geral'," +
                            "    voice_profile: { voice_id: process.argv[8] || 'pt-BR-AntonioNeural' }," +
                            "    publishing_profile: {" +
                            "      affiliate_cta: {" +
                            "        description_template: process.argv[9] ? ('👉 Acesse o link oficial: ' + process.argv[9]) : undefined," +
                            "        first_comment: process.argv[9] ? ('👉 Link oficial fixado: ' + process.argv[9]) : undefined" +
                            "      }" +
                            "    }" +
                            "  } : null;" +
                            "  return m.generateScript({" +
                            "    channelId: process.argv[1]," +
                            "    topic: process.argv[2] || null," +
                            "    scriptIndex: parseInt(process.argv[3], 10)," +
                            "    sourceUrl: process.argv[4] || null," +
                            "    visualDirective: process.argv[5] || null," +
                            "    customProfile: customProfile," +
                            "    geminiKey: process.env.GEMINI_API_KEY || process.env.GEMINI_AI_API_KEY || process.env.GOOGLE_AI_API_KEY" +
                            "  });" +
                            "}).then(r => console.log('JSON_START' + JSON.stringify(r) + 'JSON_END')).catch(e => { console.error(e); process.exit(1); });",
                    finalChannel,
                    topic != null ? topic : "",
                    String.valueOf(index),
                    sourceUrl != null ? sourceUrl : "",
                    visualDirective != null ? visualDirective : "",
                    channelName != null ? channelName : "",
                    channelNiche != null ? channelNiche : "",
                    voiceId != null ? voiceId : "",
                    affiliateUrl != null ? affiliateUrl : ""
            );

            ProcessBuilder pb = new ProcessBuilder(command);
            injectEnvironment(pb);
            Process process = pb.start();

            StringBuilder out = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    out.append(line).append("\n");
                }
            }

            int exitCode = process.waitFor();
            String fullOutput = out.toString();
            int startIdx = fullOutput.indexOf("JSON_START");
            int endIdx = fullOutput.indexOf("JSON_END");
            if (startIdx != -1 && endIdx > startIdx) {
                String json = fullOutput.substring(startIdx + "JSON_START".length(), endIdx).trim();
                Map<String, Object> parsed = objectMapper.readValue(json, new TypeReference<>() {});
                if (parsed != null && !parsed.isEmpty()) {
                    return parsed;
                }
            }
        } catch (Exception e) {
            log.warn("Erro ao gerar roteiro dinâmico via Node ({}), usando fallback contextual: {}", e.getMessage(), e);
        }

        // Fallback analítico genérico e contextual
        String finalTopic = (topic != null && !topic.isBlank()) ? topic.trim() : "Alta Performance e Foco";
        String channelDisplayName = (channelName != null && !channelName.isBlank()) ? channelName.trim() : ("@" + finalChannel);
        return scriptMap(
                "channelId", finalChannel,
                "channelName", channelDisplayName,
                "scriptId", "script-auto",
                "topic", finalTopic,
                "title", finalTopic + " #Shorts",
                "wordCount", 150,
                "estimatedDurationSeconds", 65,
                "rewardsEligible", true,
                "narrationText", "Roteiro dinâmico gerado para o canal " + channelDisplayName + " abordando: " + finalTopic + ". A mecânica prática transforma consistência em resultados exponenciais. Siga para mais conteúdos.",
                "blocks", List.of(
                        Map.of("title", "Gancho (0-3s)", "text", "Quebra de padrão provocativa."),
                        Map.of("title", "Foco Central (3-45s)", "text", "Mecanismo prático simplificado."),
                        Map.of("title", "Hack Prático (45-58s)", "text", "Ação prática imediata."),
                        Map.of("title", "CTA (58-65s)", "text", "Siga " + channelDisplayName + " e acesse o link no comentário fixado.")
                ),
                "firstComment", (affiliateUrl != null && !affiliateUrl.isBlank()) ? ("👉 Link oficial fixado: " + affiliateUrl) : "Link com conteúdo exclusivo no primeiro comentário fixado.",
                "tags", "shorts, foco, " + finalChannel
        );
    }

    /**
     * Analisa o conteudo de um video do YouTube e gera um roteiro adaptado nos 4 blocos de retencao.
     */
    public Map<String, Object> analyzeYouTubeVideo(String sourceUrl, String channelId) {
        return analyzeYouTubeVideo(sourceUrl, channelId, null);
    }

    private void injectEnvironment(ProcessBuilder pb) {
        Map<String, String> env = pb.environment();
        for (String key : List.of("GEMINI_API_KEY", "GEMINI_AI_API_KEY", "GOOGLE_AI_API_KEY", "PEXELS_API_KEY", "PIXABAY_API_KEY", "AUTOPUBLISHER_API_KEY")) {
            String sysProp = System.getProperty(key);
            if (sysProp != null && !sysProp.isBlank()) {
                env.put(key, sysProp.trim());
            }
            String sysEnv = System.getenv(key);
            if (sysEnv != null && !sysEnv.isBlank()) {
                env.put(key, sysEnv.trim());
            }
        }
        if (this.geminiApiKey != null && !this.geminiApiKey.isBlank()) {
            env.put("GEMINI_API_KEY", this.geminiApiKey.trim());
            env.put("GEMINI_AI_API_KEY", this.geminiApiKey.trim());
            env.put("GOOGLE_AI_API_KEY", this.geminiApiKey.trim());
        }
        if (this.pexelsApiKey != null && !this.pexelsApiKey.isBlank()) {
            env.put("PEXELS_API_KEY", this.pexelsApiKey.trim());
        }
        if (this.pixabayApiKey != null && !this.pixabayApiKey.isBlank()) {
            env.put("PIXABAY_API_KEY", this.pixabayApiKey.trim());
        }
    }

    /**
     * Analisa o conteudo de um video do YouTube com diretriz visual personalizada.
     */
    public Map<String, Object> analyzeYouTubeVideo(String sourceUrl, String channelId, String visualDirective) {
        return analyzeYouTubeVideo(sourceUrl, channelId, visualDirective, null, null, null, null);
    }

    /**
     * Analisa o conteudo de um video do YouTube com perfil de canal 100% dinamico do dashboard.
     */
    public Map<String, Object> analyzeYouTubeVideo(String sourceUrl, String channelId, String visualDirective,
                                                  String channelName, String channelNiche, String voiceId, String affiliateUrl) {
        String finalChannel = (channelId != null && !channelId.isBlank()) ? channelId.trim() : (channelName != null ? channelName.replace("@", "").trim() : "canal");
        try {
            List<String> command = List.of(
                    "node",
                    "-e",
                    "import('./pipeline/src/script_generator.js').then(m => {" +
                            "  const customProfile = (process.argv[4] || process.argv[5] || process.argv[6] || process.argv[7]) ? {" +
                            "    channel_id: process.argv[1]," +
                            "    name: process.argv[4] || ('@' + process.argv[1])," +
                            "    channelName: process.argv[4] || ('@' + process.argv[1])," +
                            "    niche: process.argv[5] || 'Geral'," +
                            "    voice_profile: { voice_id: process.argv[6] || 'pt-BR-AntonioNeural' }," +
                            "    publishing_profile: {" +
                            "      affiliate_cta: {" +
                            "        description_template: process.argv[7] ? ('👉 Acesse o link oficial: ' + process.argv[7]) : undefined," +
                            "        first_comment: process.argv[7] ? ('👉 Link oficial fixado: ' + process.argv[7]) : undefined" +
                            "      }" +
                            "    }" +
                            "  } : null;" +
                            "  return m.generateScript({" +
                            "    channelId: process.argv[1]," +
                            "    sourceUrl: process.argv[2]," +
                            "    visualDirective: process.argv[3] || null," +
                            "    customProfile: customProfile," +
                            "    geminiKey: process.env.GEMINI_API_KEY || process.env.GEMINI_AI_API_KEY || process.env.GOOGLE_AI_API_KEY" +
                            "  });" +
                            "}).then(r => console.log('JSON_START' + JSON.stringify(r) + 'JSON_END')).catch(e => { console.error(e); process.exit(1); });",
                    finalChannel,
                    sourceUrl,
                    visualDirective != null ? visualDirective : "",
                    channelName != null ? channelName : "",
                    channelNiche != null ? channelNiche : "",
                    voiceId != null ? voiceId : "",
                    affiliateUrl != null ? affiliateUrl : ""
            );

            ProcessBuilder pb = new ProcessBuilder(command);
            pb.directory(new File("."));
            pb.redirectErrorStream(true);
            injectEnvironment(pb);
            Process process = pb.start();

            StringBuilder out = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    out.append(line).append("\n");
                }
            }

            int exitCode = process.waitFor();
            String fullOutput = out.toString();
            int startIdx = fullOutput.indexOf("JSON_START");
            int endIdx = fullOutput.indexOf("JSON_END");
            if (startIdx != -1 && endIdx > startIdx) {
                String json = fullOutput.substring(startIdx + "JSON_START".length(), endIdx).trim();
                return objectMapper.readValue(json, new TypeReference<>() {});
            } else {
                log.warn("Node YouTube analysis retornou sem delimitadores JSON (exitCode={}). Output: {}", exitCode, fullOutput);
            }
        } catch (Exception e) {
            log.error("Erro ao analisar vídeo do YouTube via Node: {}", e.getMessage(), e);
        }

        // Fallback analítico se offline ou sem Node
        return scriptMap(
                "source", "youtube",
                "sourceUrl", sourceUrl,
                "channelId", finalChannel,
                "channelName", "@" + finalChannel,
                "scriptId", "yt_fallback",
                "topic", "Análise de Conteúdo Viral",
                "visualDirective", visualDirective,
                "title", "A Verdade Oculta que Quase Ninguém Percebeu #Shorts",
                "wordCount", 154,
                "estimatedDurationSeconds", 68,
                "rewardsEligible", true,
                "narrationText", "Se você assistiu ao vídeo sobre este tema, pare tudo agora: existe um detalhe crucial que quase ninguém percebeu. A mecânica real por trás desse assunto revela que quando observamos o comportamento humano em profundidade, nosso cérebro reage de forma imediata à expectativa e à pressão do ambiente. Não se trata de sorte, mas de método. A regra prática: em vez de reagir no calor do momento, dê um passo para trás e filtre as reais intenções. Siga o canal para mais análises estratégicas diárias.",
                "blocks", List.of(
                        Map.of("title", "Gancho (0-3s)", "text", "Se você assistiu a esse vídeo, pare tudo agora: existe um detalhe crucial oculto."),
                        Map.of("title", "Foco Central (3-45s)", "text", "A mecânica real revela como a mente humana responde à pressão do ambiente."),
                        Map.of("title", "Hack Prático (45-58s)", "text", "Dê um passo para trás antes de reagir e filtre as reais intenções."),
                        Map.of("title", "CTA & Retenção (58-65s)", "text", "Siga o canal para mais análises estratégicas.")
                ),
                "firstComment", "♟️ Qual foi sua maior percepção sobre esse vídeo? Veja o link fixado!",
                "tags", "shorts, viral, youtube, analise, estrategias"
        );
    }

    /**
     * Inicia a execucao assincrona do pipeline de video em uma Virtual Thread.
     */
    public PipelineJobStatus startPipelineJob(PipelineRunRequest request) {
        String jobId = "job_" + System.currentTimeMillis();
        String channel = request.getChannelIdOrDefault();
        String platform = request.getPlatformOrDefault();
        String topic = request.topic();
        String sourceUrl = request.getSourceUrl();
        String visualDirective = request.getVisualDirective();
        String visualMode = request.getVisualModeOrDefault();
        int scriptIndex = request.getScriptIndexOrDefault();

        List<String> logs = Collections.synchronizedList(new ArrayList<>());
        jobLogs.put(jobId, logs);

        PipelineJobStatus initialStatus = new PipelineJobStatus(
                jobId,
                "RUNNING",
                5,
                "Iniciando Esteira de IA...",
                channel,
                platform,
                topic != null ? topic : (sourceUrl != null ? "YouTube Repurpose" : "Catálogo"),
                LocalDateTime.now(),
                null,
                logs,
                null,
                null,
                null,
                null,
                null
        );
        jobRepository.put(jobId, initialStatus);

        // Execucao assincrona em thread do sistema
        Thread.ofVirtual().name("ai-pipeline-" + jobId).start(() -> {
            runProcess(jobId, request, logs);
        });

        return initialStatus;
    }

    private void runProcess(String jobId, PipelineRunRequest request, List<String> logs) {
        String channel = request.getChannelIdOrDefault();
        String platform = request.getPlatformOrDefault();
        String topic = request.topic();
        int scriptIndex = request.getScriptIndexOrDefault();
        String sourceUrl = request.getSourceUrl();
        String visualDirective = request.getVisualDirective();
        String visualMode = request.getVisualModeOrDefault();

        log.info("Iniciando processo do pipeline para Job ID: {} (Canal: {}, Modo Visual: {})", jobId, channel, visualMode);
        logs.add("[" + LocalDateTime.now().toString().substring(11, 19) + "] [INFO] Iniciando pipeline de geracao automatizada (Modo Visual: " + visualMode + ")...");
        try {
            // Cria pasta de scratch e arquivo de configuração dinâmica
            File scratchDir = new File("pipeline/scratch");
            if (!scratchDir.exists()) {
                scratchDir.mkdirs();
            }
            File configFile = new File(scratchDir, "job_" + jobId + "_config.json");
            Map<String, Object> configMap = new LinkedHashMap<>();
            configMap.put("channel", channel);
            configMap.put("platform", platform);
            configMap.put("scriptIndex", scriptIndex);
            configMap.put("topic", topic);
            configMap.put("sourceUrl", sourceUrl);
            configMap.put("visualDirective", visualDirective);
            configMap.put("visualMode", visualMode);
            configMap.put("channelName", request.getChannelName());
            configMap.put("niche", request.getChannelNiche());
            configMap.put("voiceId", request.getVoiceId());
            configMap.put("affiliateUrl", request.getAffiliateUrl());
            configMap.put("subtitlesTheme", request.getSubtitlesTheme());
            configMap.put("flowClipsDir", request.getFlowClipsDir());
            configMap.put("enableSubtitles", request.isSubtitlesEnabled());
            configMap.put("title", request.getTitle());
            configMap.put("narrationText", request.getNarrationText());
            configMap.put("firstComment", request.getFirstComment());
            if (geminiApiKey != null && !geminiApiKey.isBlank()) configMap.put("geminiKey", geminiApiKey.trim());
            if (pexelsApiKey != null && !pexelsApiKey.isBlank()) configMap.put("pexelsKey", pexelsApiKey.trim());

            try {
                objectMapper.writeValue(configFile, configMap);
            } catch (Exception err) {
                log.warn("Nao foi possivel gravar config temporaria do job: {}", err.getMessage());
            }

            List<String> command = new ArrayList<>();
            command.add("node");
            command.add("pipeline/src/run_pipeline.js");
            command.add("--config-file");
            command.add(configFile.getAbsolutePath());
            command.add("--channel");
            command.add(channel);
            command.add("--platform");
            command.add(platform);
            command.add("--script");
            command.add(String.valueOf(scriptIndex));

            if (visualMode != null && !visualMode.isBlank()) {
                command.add("--visual-mode");
                command.add(visualMode.trim());
            }

            if (topic != null && !topic.isBlank()) {
                command.add("--topic");
                command.add(topic.trim());
            }

            if (sourceUrl != null && !sourceUrl.isBlank()) {
                command.add("--url");
                command.add(sourceUrl.trim());
            }

            if (visualDirective != null && !visualDirective.isBlank()) {
                command.add("--visual-directive");
                command.add(visualDirective.trim());
            }

            if (request.getChannelName() != null) {
                command.add("--channel-name");
                command.add(request.getChannelName());
            }

            if (request.getChannelNiche() != null) {
                command.add("--niche");
                command.add(request.getChannelNiche());
            }

            if (request.getVoiceId() != null) {
                command.add("--voice");
                command.add(request.getVoiceId());
            }

            if (request.getAffiliateUrl() != null) {
                command.add("--affiliate-url");
                command.add(request.getAffiliateUrl());
            }

            if (request.getSubtitlesTheme() != null) {
                command.add("--subtitles-theme");
                command.add(request.getSubtitlesTheme());
            }

            if (request.getFlowClipsDir() != null) {
                command.add("--flow-clips-dir");
                command.add(request.getFlowClipsDir());
            }

            if (!request.isSubtitlesEnabled()) {
                command.add("--no-subtitles");
            }

            if (geminiApiKey != null && !geminiApiKey.isBlank()) {
                command.add("--gemini-key");
                command.add(geminiApiKey.trim());
            }

            if (pexelsApiKey != null && !pexelsApiKey.isBlank()) {
                command.add("--pexels-key");
                command.add(pexelsApiKey.trim());
            }

            ProcessBuilder pb = new ProcessBuilder(command);
            pb.directory(new File("."));
            pb.redirectErrorStream(true);
            injectEnvironment(pb);

            Process process = pb.start();

            String generatedVideoPath = null;
            String generatedThumbnailPath = null;
            Double duration = null;
            Boolean rewardsEligible = null;

            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    logs.add(line);
                    log.info("[Pipeline {}] {}", jobId, line);

                    // Atualizacao heuristica de progresso a partir dos logs
                    int currentPercent = 10;
                    String step = "Processando...";

                    if (line.contains("[1/6]")) {
                        currentPercent = 20;
                        step = "Roteirização Estruturada";
                    } else if (line.contains("[2/6]")) {
                        currentPercent = 35;
                        step = "Síntese de Voz Neural Edge-TTS";
                    } else if (line.contains("[3/6]")) {
                        currentPercent = 50;
                        step = "Compilando Legendas Dinâmicas Karaokê";
                    } else if (line.contains("[4/6]")) {
                        currentPercent = 65;
                        step = "Gerando Cenas Visuais 9:16 & Thumbnail";
                    } else if (line.contains("[5/6]")) {
                        currentPercent = 80;
                        step = "Renderização Headless com FFmpeg";
                    } else if (line.contains("[6/6]")) {
                        currentPercent = 95;
                        step = "Ingestão no AutoPublisher Pro";
                    }

                    if (line.contains("Video MP4:")) {
                        generatedVideoPath = line.substring(line.indexOf("Video MP4:") + 10).trim();
                    }
                    if (line.contains("Thumbnail PNG:")) {
                        generatedThumbnailPath = line.substring(line.indexOf("Thumbnail PNG:") + 14).trim();
                    }
                    if (line.contains("Duracao Final:")) {
                        try {
                            String durStr = line.replaceAll("[^0-9.]", "");
                            duration = Double.parseDouble(durStr);
                        } catch (Exception ignored) {}
                    }
                    if (line.contains("Elegivel TikTok Rewards:")) {
                        rewardsEligible = line.contains("SIM");
                    }

                    PipelineJobStatus prev = jobRepository.get(jobId);
                    if (prev != null && "RUNNING".equals(prev.status())) {
                        jobRepository.put(jobId, new PipelineJobStatus(
                                jobId,
                                "RUNNING",
                                currentPercent,
                                step,
                                channel,
                                platform,
                                topic,
                                prev.startedAt(),
                                null,
                                logs,
                                generatedVideoPath,
                                generatedThumbnailPath,
                                duration,
                                rewardsEligible,
                                null
                        ));
                    }
                }
            }

            int exitCode = process.waitFor();
            if (exitCode == 0) {
                log.info("Pipeline {} finalizado com sucesso.", jobId);
                PipelineJobStatus current = jobRepository.get(jobId);
                jobRepository.put(jobId, new PipelineJobStatus(
                        jobId,
                        "COMPLETED",
                        100,
                        "Vídeo Gerado com Sucesso!",
                        channel,
                        platform,
                        topic,
                        current != null ? current.startedAt() : LocalDateTime.now(),
                        LocalDateTime.now(),
                        logs,
                        generatedVideoPath,
                        generatedThumbnailPath,
                        duration != null ? duration : 68.0,
                        rewardsEligible != null ? rewardsEligible : true,
                        null
                ));
            } else {
                log.error("Pipeline {} falhou com codigo de saida {}", jobId, exitCode);
                PipelineJobStatus current = jobRepository.get(jobId);
                jobRepository.put(jobId, new PipelineJobStatus(
                        jobId,
                        "FAILED",
                        0,
                        "Falha na Execução do Pipeline",
                        channel,
                        platform,
                        topic,
                        current != null ? current.startedAt() : LocalDateTime.now(),
                        LocalDateTime.now(),
                        logs,
                        null,
                        null,
                        null,
                        false,
                        "Processo encerrou com código de erro: " + exitCode
                ));
            }

        } catch (Exception e) {
            log.error("Excecao fatal na execucao do pipeline {}: {}", jobId, e.getMessage(), e);
            logs.add("[ERRO FATAL] " + e.getMessage());
            PipelineJobStatus current = jobRepository.get(jobId);
            jobRepository.put(jobId, new PipelineJobStatus(
                    jobId,
                    "FAILED",
                    0,
                    "Erro ao disparar processo",
                    channel,
                    platform,
                    topic,
                    current != null ? current.startedAt() : LocalDateTime.now(),
                    LocalDateTime.now(),
                    logs,
                    null,
                    null,
                    null,
                    false,
                    e.getMessage()
            ));
        }
    }

    public PipelineJobStatus getJobStatus(String jobId) {
        return jobRepository.get(jobId);
    }

    /**
     * Gera pacote completo para produção no Google Flow (Veo),
     * incluindo roteiro, áudio neural, legendas, prompts calibrados e linha da planilha.
     */
    public Map<String, Object> generateFlowPackage(PipelineRunRequest request) {
        String channel = request.getChannelIdOrDefault();
        String topic = request.topic() != null ? request.topic().trim() : "";
        String visual = request.getVisualDirective() != null ? request.getVisualDirective().trim() : "";

        try {
            long ts = System.currentTimeMillis();
            File scratchDir = new File("pipeline/scratch");
            if (!scratchDir.exists()) {
                scratchDir.mkdirs();
            }
            File configFile = new File(scratchDir, "flow_" + ts + "_config.json");
            Map<String, Object> configMap = new LinkedHashMap<>();
            configMap.put("channel", channel);
            configMap.put("platform", (request.platform() != null && !request.platform().isBlank()) ? request.platform() : "YOUTUBE_SHORTS");
            configMap.put("scriptIndex", request.getScriptIndexOrDefault());
            configMap.put("topic", topic);
            configMap.put("visualDirective", visual);
            configMap.put("channelName", request.getChannelName());
            configMap.put("niche", request.getChannelNiche());
            configMap.put("voiceId", request.getVoiceId());
            configMap.put("affiliateUrl", request.getAffiliateUrl());
            configMap.put("subtitlesTheme", request.getSubtitlesTheme());
            configMap.put("title", request.getTitle());
            configMap.put("narrationText", request.getNarrationText());
            configMap.put("firstComment", request.getFirstComment());
            if (geminiApiKey != null && !geminiApiKey.isBlank()) configMap.put("geminiKey", geminiApiKey.trim());

            try {
                objectMapper.writeValue(configFile, configMap);
            } catch (Exception err) {
                log.warn("Nao foi possivel gravar config temporaria do flow: {}", err.getMessage());
            }

            List<String> command = new ArrayList<>();
            command.add("node");
            command.add("pipeline/scripts/generate_flow_package.js");
            command.add("--config-file");
            command.add(configFile.getAbsolutePath());
            command.add("--channel");
            command.add(channel);
            if (!topic.isBlank()) {
                command.add("--topic");
                command.add(topic);
            }
            if (!visual.isBlank()) {
                command.add("--visual-directive");
                command.add(visual);
            }

            if (request.getChannelName() != null) {
                command.add("--channel-name");
                command.add(request.getChannelName());
            }

            if (request.getChannelNiche() != null) {
                command.add("--niche");
                command.add(request.getChannelNiche());
            }

            if (request.getVoiceId() != null) {
                command.add("--voice");
                command.add(request.getVoiceId());
            }

            if (request.getAffiliateUrl() != null) {
                command.add("--affiliate-url");
                command.add(request.getAffiliateUrl());
            }

            if (request.getSubtitlesTheme() != null) {
                command.add("--subtitles-theme");
                command.add(request.getSubtitlesTheme());
            }

            if (request.platform() != null && !request.platform().isBlank()) {
                command.add("--platform");
                command.add(request.platform());
            }

            ProcessBuilder pb = new ProcessBuilder(command);
            pb.directory(new File("."));
            injectEnvironment(pb);
            Process process = pb.start();

            StringBuilder out = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    out.append(line).append("\n");
                }
            }

            int exitCode = process.waitFor();
            log.info("generateFlowPackage finalizou com exitCode: {}", exitCode);

            File outputDir = new File("pipeline/output");
            if (outputDir.exists() && outputDir.isDirectory()) {
                File[] runs = outputDir.listFiles((dir, name) -> name.startsWith("flow_") && new File(dir, name).isDirectory());
                if (runs != null && runs.length > 0) {
                    java.util.Arrays.sort(runs, (a, b) -> Long.compare(b.lastModified(), a.lastModified()));
                    File latest = runs[0];
                    File manifest = new File(latest, "flow_manifest.json");
                    if (manifest.exists() && manifest.isFile()) {
                        Map<String, Object> result = objectMapper.readValue(manifest, new TypeReference<>() {});
                        if (result.get("sheetsRow") instanceof List<?> list && result.get("cronogramaRowTsv") == null) {
                            result.put("cronogramaRowTsv", list.stream().map(Object::toString).collect(java.util.stream.Collectors.joining("\t")));
                        }
                        if (result.get("scenes") instanceof List<?> scenes) {
                            for (Object sc : scenes) {
                                if (sc instanceof Map<?, ?> smap) {
                                    @SuppressWarnings("unchecked")
                                    Map<String, Object> mutMap = (Map<String, Object>) smap;
                                    Object p = mutMap.get("flowPrompt");
                                    if (p != null) {
                                        mutMap.putIfAbsent("googleFlowPrompt", p);
                                        mutMap.putIfAbsent("prompt", p);
                                    }
                                }
                            }
                        }
                        File guide = new File(latest, "GOOGLE_FLOW_GUIDE.md");
                        if (guide.exists()) {
                            result.put("guideMarkdown", java.nio.file.Files.readString(guide.toPath(), StandardCharsets.UTF_8));
                        }
                        result.put("outputDir", latest.getAbsolutePath());
                        return result;
                    }
                }
            }
        } catch (Exception e) {
            log.error("Erro ao executar generateFlowPackage via Node: {}", e.getMessage(), e);
        }

        return Map.of("error", "Falha ao gerar pacote do Google Flow");
    }
}
