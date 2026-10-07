package com.autopublisher.domain.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DomainModelsTest {

    @Test
    @DisplayName("VideoMetadata: Deve validar título vazio e tamanho máximo de 100 caracteres")
    void shouldValidateVideoMetadataTitle() {
        assertThatThrownBy(() -> new VideoMetadata("", "desc", List.of(), 24, false, PrivacyStatus.PUBLIC))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("titulo do video nao pode ser vazio");

        String longTitle = "A".repeat(101);
        assertThatThrownBy(() -> new VideoMetadata(longTitle, "desc", List.of(), 24, false, PrivacyStatus.PUBLIC))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("nao pode exceder 100 caracteres");
    }

    @Test
    @DisplayName("VideoMetadata: Deve validar descrição máxima de 5000 caracteres")
    void shouldValidateVideoMetadataDescription() {
        String longDesc = "D".repeat(5001);
        assertThatThrownBy(() -> new VideoMetadata("Titulo", longDesc, List.of(), 24, false, PrivacyStatus.PUBLIC))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("nao pode exceder 5000 caracteres");
    }

    @Test
    @DisplayName("VideoMetadata: withShortsOptimization deve adicionar #Shorts caso não esteja presente")
    void shouldOptimizeShortsTitle() {
        VideoMetadata metadata = new VideoMetadata("Meu Video Incrivel", "desc", List.of(), 24, false, PrivacyStatus.PUBLIC);
        VideoMetadata optimized = metadata.withShortsOptimization();

        assertThat(optimized.title()).isEqualTo("Meu Video Incrivel #Shorts");

        // Já possui #Shorts
        VideoMetadata alreadyHasShorts = new VideoMetadata("Meu Video #Shorts", "desc", List.of(), 24, false, PrivacyStatus.PUBLIC);
        assertThat(alreadyHasShorts.withShortsOptimization().title()).isEqualTo("Meu Video #Shorts");
    }

    @Test
    @DisplayName("PostSchedule: Deve validar campos obrigatórios e índice de linha >= 2")
    void shouldValidatePostScheduleFields() {
        VideoMetadata metadata = new VideoMetadata("Titulo", "desc", List.of(), 24, false, PrivacyStatus.PUBLIC);

        assertThatThrownBy(() -> new PostSchedule("", 2, LocalDateTime.now(), Platform.YOUTUBE_SHORTS, "vid", null, metadata, PublishStatus.PENDENTE, 0))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("ID do agendamento");

        assertThatThrownBy(() -> new PostSchedule("P1", 1, LocalDateTime.now(), Platform.YOUTUBE_SHORTS, "vid", null, metadata, PublishStatus.PENDENTE, 0))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("maior ou igual a 2");

        assertThatThrownBy(() -> new PostSchedule("P1", 2, null, Platform.YOUTUBE_SHORTS, "vid", null, metadata, PublishStatus.PENDENTE, 0))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Horario de agendamento");

        assertThatThrownBy(() -> new PostSchedule("P1", 2, LocalDateTime.now(), null, "vid", null, metadata, PublishStatus.PENDENTE, 0))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Plataforma e obrigatoria");

        assertThatThrownBy(() -> new PostSchedule("P1", 2, LocalDateTime.now(), Platform.YOUTUBE_SHORTS, "", null, metadata, PublishStatus.PENDENTE, 0))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("ID do arquivo de video");
    }

    @Test
    @DisplayName("PostSchedule: isDue deve retornar true para datas passadas e false para futuras")
    void shouldCheckIsDueCorrectly() {
        VideoMetadata metadata = new VideoMetadata("Titulo", "desc", List.of(), 24, false, PrivacyStatus.PUBLIC);
        LocalDateTime now = LocalDateTime.now();

        PostSchedule pastPost = new PostSchedule("P-Past", 2, now.minusMinutes(10), Platform.YOUTUBE_SHORTS, "v1", null, metadata, PublishStatus.PENDENTE, 0);
        PostSchedule futurePost = new PostSchedule("P-Future", 3, now.plusMinutes(10), Platform.YOUTUBE_SHORTS, "v2", null, metadata, PublishStatus.PENDENTE, 0);

        assertThat(pastPost.isDue(now)).isTrue();
        assertThat(futurePost.isDue(now)).isFalse();
    }

    @Test
    @DisplayName("Enums: fromString deve tratar maiúsculas/minúsculas e valores desconhecidos")
    void shouldParseEnumsCorrectly() {
        assertThat(Platform.fromString("youtube_shorts")).isEqualTo(Platform.YOUTUBE_SHORTS);
        assertThat(PublishStatus.fromString("PUBLICADO")).isEqualTo(PublishStatus.PUBLICADO);
        assertThat(PublishStatus.fromString("DESCONHECIDO")).isEqualTo(PublishStatus.PENDENTE);
        assertThat(PrivacyStatus.fromString("unlisted")).isEqualTo(PrivacyStatus.UNLISTED);
        assertThat(PrivacyStatus.fromString("invalid")).isEqualTo(PrivacyStatus.PUBLIC);
    }

    @Test
    @DisplayName("AudioMode: fromString deve tratar maiúsculas/minúsculas e valores desconhecidos")
    void shouldParseAudioModeCorrectly() {
        assertThat(AudioMode.fromString("tts")).isEqualTo(AudioMode.TTS);
        assertThat(AudioMode.fromString("source_audio")).isEqualTo(AudioMode.SOURCE_AUDIO);
        assertThat(AudioMode.fromString("none")).isEqualTo(AudioMode.NONE);
        assertThat(AudioMode.fromString(null)).isEqualTo(AudioMode.TTS);
        assertThat(AudioMode.fromString("")).isEqualTo(AudioMode.TTS);
        assertThat(AudioMode.fromString("desconhecido")).isEqualTo(AudioMode.TTS);
    }

    @Test
    @DisplayName("Exceções de Domínio: Devem inicializar corretamente com mensagem e causa")
    void shouldInitializeDomainExceptions() {
        com.autopublisher.domain.exception.QuotaExceededException qe = new com.autopublisher.domain.exception.QuotaExceededException("quota");
        assertThat(qe.getMessage()).isEqualTo("quota");

        com.autopublisher.domain.exception.ScheduleValidationException se = new com.autopublisher.domain.exception.ScheduleValidationException("validation");
        assertThat(se.getMessage()).isEqualTo("validation");

        com.autopublisher.domain.exception.MediaStreamingException me = new com.autopublisher.domain.exception.MediaStreamingException("stream", new RuntimeException("cause"));
        assertThat(me.getMessage()).isEqualTo("stream");
        assertThat(me.getCause()).isNotNull();

        com.autopublisher.domain.exception.AutoPublisherException ae = new com.autopublisher.domain.exception.AutoPublisherException("app", new RuntimeException("cause"));
        assertThat(ae.getMessage()).isEqualTo("app");
    }
}
