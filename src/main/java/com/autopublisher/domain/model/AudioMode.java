package com.autopublisher.domain.model;

/**
 * Define o modo de áudio a ser gerado ou aproveitado no pipeline de vídeo.
 */
public enum AudioMode {
    TTS,
    SOURCE_AUDIO,
    NONE;

    public static AudioMode fromString(String value) {
        if (value == null || value.isBlank()) {
            return TTS;
        }
        for (AudioMode mode : values()) {
            if (mode.name().equalsIgnoreCase(value.trim())) {
                return mode;
            }
        }
        return TTS;
    }
}
