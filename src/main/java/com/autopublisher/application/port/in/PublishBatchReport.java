package com.autopublisher.application.port.in;

import java.util.List;

/**
 * DTO que resume a execucao de um lote de publicacoes disparado pelo agendador.
 */
public record PublishBatchReport(
        int totalFound,
        int successCount,
        int failureCount,
        boolean quotaExceeded,
        long executionTimeMillis,
        List<String> logs
) {
    public static PublishBatchReport empty() {
        return new PublishBatchReport(0, 0, 0, false, 0, List.of("Nenhum post pendente para publicacao no momento."));
    }
}
