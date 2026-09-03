package com.autopublisher.domain.model;

import java.util.Collections;
import java.util.List;

/**
 * Value Object imutavel que contem os metadados necessarios para publicacao e SEO.
 */
public record VideoMetadata(
        String title,
        String description,
        List<String> tags,
        Integer categoryId,
        boolean madeForKids,
        PrivacyStatus privacy
) {
    public VideoMetadata {
        if (title == null || title.trim().isEmpty()) {
            throw new IllegalArgumentException("O titulo do video nao pode ser vazio");
        }
        if (title.length() > 100) {
            throw new IllegalArgumentException("O titulo do video nao pode exceder 100 caracteres. Tamanho atual: " + title.length());
        }
        if (description != null && description.length() > 5000) {
            throw new IllegalArgumentException("A descricao do video nao pode exceder 5000 caracteres");
        }
        tags = tags == null ? Collections.emptyList() : List.copyOf(tags);
        categoryId = categoryId == null ? 24 : categoryId; // 24 = Entretenimento
        privacy = privacy == null ? PrivacyStatus.PUBLIC : privacy;
    }

    /**
     * Retorna uma nova instancia garantindo a presenca da hashtag #Shorts se for formato Shorts.
     */
    public VideoMetadata withShortsOptimization() {
        if (title.toLowerCase().contains("#shorts")) {
            return this;
        }
        String optimizedTitle = title + " #Shorts";
        if (optimizedTitle.length() > 100) {
            optimizedTitle = title; // Mantem o original se ultrapassar 100 caracteres
        }
        return new VideoMetadata(optimizedTitle, description, tags, categoryId, madeForKids, privacy);
    }
}
