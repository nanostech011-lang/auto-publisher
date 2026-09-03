package com.autopublisher.domain.model;

/**
 * Nivel de privacidade da publicacao de video.
 */
public enum PrivacyStatus {
    PUBLIC("public"),
    PRIVATE("private"),
    UNLISTED("unlisted");

    private final String apiValue;

    PrivacyStatus(String apiValue) {
        this.apiValue = apiValue;
    }

    public String getApiValue() {
        return apiValue;
    }

    public static PrivacyStatus fromString(String value) {
        if (value == null || value.trim().isEmpty()) {
            return PUBLIC;
        }
        try {
            return PrivacyStatus.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return PUBLIC;
        }
    }
}
