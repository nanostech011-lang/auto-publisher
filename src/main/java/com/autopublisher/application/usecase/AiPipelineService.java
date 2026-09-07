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
    private final Map<String, PipelineJobStatus> jobRepository = new ConcurrentHashMap<>();
    private final Map<String, List<String>> jobLogs = new ConcurrentHashMap<>();

    public AiPipelineService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
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
        if (sourceUrl != null && !sourceUrl.isBlank()) {
            return analyzeYouTubeVideo(sourceUrl, channelId);
        }

        String finalChannel = (channelId != null && !channelId.isBlank()) ? channelId.trim() : "psicosegredo";
        int index = (scriptIndex != null) ? scriptIndex : 0;

        // Se for psicosegredo e index 0 ou tema silêncio
        if ("psicosegredo".equalsIgnoreCase(finalChannel)) {
            if (topic != null && topic.toLowerCase().contains("motiva")) {
                index = 1;
            }

            if (index == 1) {
                return scriptMap(
                        "channelId", "psicosegredo",
                        "channelName", "@psicosegredo",
                        "scriptId", "script-02",
                        "topic", "Dopamina & Procrastinação",
                        "title", "A Mentira da Falta de Motivação #Shorts",
                        "wordCount", 152,
                        "estimatedDurationSeconds", 68,
                        "rewardsEligible", true,
                        "narrationText", "Você não é preguiçoso, e a sua falta de ânimo para mudar de vida tem uma explicação biológica exata. A neurociência explica que a dopamina não é o neurotransmissor do prazer, mas sim da antecipação e da motivação para agir. Quando você passa o dia rolando vídeos curtos, seu cérebro recebe descargas rápidas de dopamina sem nenhum esforço real. Quando você tenta sentar para estudar, treinar ou construir um projeto difícil, sua mente interpreta aquilo como sofrimento extremo, simplesmente porque a recompensa demora a chegar. O nome disso não é incapacidade; é dessensibilização dos seus receptores dopaminérgicos. A regra prática para reiniciar esse circuito: a ação precisa vir antes da vontade. A dopamina só é liberada de forma sustentável depois que os primeiros 5 minutos de uma tarefa começam. Pare de esperar a motivação cair do céu. Force o primeiro movimento. Siga o Psicosegredo e aprenda a controlar sua química mental.",
                        "blocks", List.of(
                                Map.of("title", "Gancho (0-3s)", "text", "Você não é preguiçoso: a neurociência explica o motivo."),
                                Map.of("title", "Foco Científico (3-45s)", "text", "Dopamina da antecipação vs dessensibilização dos receptores dopaminérgicos."),
                                Map.of("title", "Hack Prático (45-58s)", "text", "Regra dos 5 minutos: a ação precisa vir antes da vontade."),
                                Map.of("title", "CTA & Retenção (58-65s)", "text", "Siga o @psicosegredo para dominar sua química mental.")
                        ),
                        "firstComment", "♟️ Quer aprender a controlar sua dopamina e eliminar a procrastinação em 21 dias? O método completo está no link fixado: https://meulink.com/psicosegredo",
                        "tags", "neurociencia, dopamina, procrastinacao, foco, produtividade, shorts"
                );
            }

            // Roteiro 1 (Default)
            return scriptMap(
                    "channelId", "psicosegredo",
                    "channelName", "@psicosegredo",
                    "scriptId", "script-01",
                    "topic", "Linguagem Corporal & Silêncio",
                    "title", "O Truque do Silêncio e a Dopamina da Dúvida #Shorts",
                    "wordCount", 149,
                    "estimatedDurationSeconds", 66,
                    "rewardsEligible", true,
                    "narrationText", "Se você desconfia que alguém está mentindo ou escondendo algo de você, nunca confronte a pessoa na hora. Existe um truque da neurociência muito mais poderoso. Quando a pessoa terminar de falar, não diga absolutamente nada. Apenas faça uma pausa e continue mantendo contato visual direto nos olhos dela. O que acontece no cérebro humano nesse momento é fascinante: o cérebro detesta o vácuo de informação. O silêncio prolongado ativa a amígdala cerebral, gerando um pico imediato de ansiedade e insegurança. A pessoa subconscientemente assume que o seu silêncio significa que você já sabe da verdade. Para tentar preencher o vazio e aliviar o desconforto mental, ela começa a falar mais do que deveria e entrega detalhes que pretendia esconder. O silêncio sob controle sempre entrega mais poder do que qualquer argumento verbal. Siga o Psicosegredo para dominar sua mente antes que usem isso contra você.",
                    "blocks", List.of(
                            Map.of("title", "Gancho (0-3s)", "text", "Nunca confronte quem mente: use este truque de neurociência."),
                            Map.of("title", "Foco Científico (3-45s)", "text", "Vácuo de informação, ativação da amígdala cerebral e desconforto subconsciente."),
                            Map.of("title", "Hack Prático (45-58s)", "text", "Pausa e contato visual prolongado forçam a pessoa a entregar detalhes."),
                            Map.of("title", "CTA & Retenção (58-65s)", "text", "Siga o @psicosegredo para dominar sua mente.")
                    ),
                    "firstComment", "♟️ Protocolo completo de Leitura Comportamental e Detecção de Mentiras no link fixado: https://meulink.com/psicosegredo",
                    "tags", "neurociencia, linguagem corporal, psicologia escura, shorts, autodominio"
            );
        }

        // Generic fallback para outros canais
        String finalTopic = (topic != null && !topic.isBlank()) ? topic.trim() : "Alta Performance e Foco";
        return scriptMap(
                "channelId", finalChannel,
                "channelName", "@" + finalChannel,
                "scriptId", "script-auto",
                "topic", finalTopic,
                "title", finalTopic + " #Shorts",
                "wordCount", 150,
                "estimatedDurationSeconds", 65,
                "rewardsEligible", true,
                "narrationText", "Roteiro dinâmico estruturado para o canal " + finalChannel + " abordando: " + finalTopic + ". A mecânica prática transforma consistência em resultados exponenciais. Siga para mais conteúdos.",
                "blocks", List.of(
                        Map.of("title", "Gancho (0-3s)", "text", "Quebra de padrão provocativa."),
                        Map.of("title", "Foco Central (3-45s)", "text", "Mecanismo prático simplificado."),
                        Map.of("title", "Hack Prático (45-58s)", "text", "Ação prática imediata."),
                        Map.of("title", "CTA (58-65s)", "text", "Chamada de conversão e link no comentário fixado.")
                ),
                "firstComment", "Link com conteúdo exclusivo nos comentários.",
                "tags", "shorts, foco, alta performance"
        );
    }

    /**
     * Analisa o conteudo de um video do YouTube e gera um roteiro adaptado nos 4 blocos de retencao.
     */
    public Map<String, Object> analyzeYouTubeVideo(String sourceUrl, String channelId) {
        String finalChannel = (channelId != null && !channelId.isBlank()) ? channelId.trim() : "psicosegredo";
        try {
            List<String> command = List.of(
                    "node",
                    "-e",
                    "import('./pipeline/src/script_generator.js').then(m => m.generateScript({ channelId: process.argv[1], sourceUrl: process.argv[2] })).then(r => console.log('JSON_START' + JSON.stringify(r) + 'JSON_END')).catch(e => { console.error(e); process.exit(1); });",
                    finalChannel,
                    sourceUrl
            );

            ProcessBuilder pb = new ProcessBuilder(command);
            pb.directory(new File("."));
            Process process = pb.start();

            StringBuilder out = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    out.append(line).append("\n");
                }
            }

            process.waitFor();
            String fullOutput = out.toString();
            int startIdx = fullOutput.indexOf("JSON_START");
            int endIdx = fullOutput.indexOf("JSON_END");
            if (startIdx != -1 && endIdx > startIdx) {
                String json = fullOutput.substring(startIdx + "JSON_START".length(), endIdx).trim();
                return objectMapper.readValue(json, new TypeReference<>() {});
            }
        } catch (Exception e) {
            log.error("Erro ao analisar vídeo do YouTube via Node: {}", e.getMessage());
        }

        // Fallback analítico se offline ou sem Node
        return scriptMap(
                "source", "youtube",
                "sourceUrl", sourceUrl,
                "channelId", finalChannel,
                "channelName", "@" + finalChannel,
                "scriptId", "yt_fallback",
                "topic", "Análise de Conteúdo Viral",
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
            runProcess(jobId, channel, platform, topic, scriptIndex, sourceUrl, logs);
        });

        return initialStatus;
    }

    private void runProcess(String jobId, String channel, String platform, String topic, int scriptIndex, String sourceUrl, List<String> logs) {
        log.info("Iniciando processo do pipeline para Job ID: {} (Canal: {})", jobId, channel);
        logs.add("[" + LocalDateTime.now().toString().substring(11, 19) + "] [INFO] Iniciando pipeline de geracao automatizada...");

        try {
            List<String> command = new ArrayList<>();
            command.add("node");
            command.add("pipeline/src/run_pipeline.js");
            command.add("--channel");
            command.add(channel);
            command.add("--platform");
            command.add(platform);
            command.add("--script");
            command.add(String.valueOf(scriptIndex));

            if (topic != null && !topic.isBlank()) {
                command.add("--topic");
                command.add(topic.trim());
            }

            if (sourceUrl != null && !sourceUrl.isBlank()) {
                command.add("--url");
                command.add(sourceUrl.trim());
            }

            ProcessBuilder pb = new ProcessBuilder(command);
            pb.directory(new File("."));
            pb.redirectErrorStream(true);

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
}
