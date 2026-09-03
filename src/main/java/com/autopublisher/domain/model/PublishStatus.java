package com.autopublisher.domain.model;

/**
 * Estados do ciclo de vida de uma postagem no agendador.
 */
public enum PublishStatus {
    PENDENTE,
    PROCESSANDO,
    PUBLICADO,
    ERRO_TEMPORARIO,
    COTA_ESGOTADA;

    public static PublishStatus fromString(String value) {
        if (value == null || value.trim().isEmpty()) {
            return PENDENTE;
        }
        try {
            return PublishStatus.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return PENDENTE;
        }
    }
}
