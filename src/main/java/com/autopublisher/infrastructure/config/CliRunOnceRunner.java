package com.autopublisher.infrastructure.config;

import com.autopublisher.application.port.in.PublishBatchReport;
import com.autopublisher.application.port.in.PublishScheduledPostsUseCase;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ApplicationContext;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Runner CLI ativado exclusivamente em execuções de lote Serverless / CI/CD (ex: GitHub Actions Cron).
 * Quando acionado com --autopublisher.run-once=true, processa a fila de agendamentos pendentes
 * e encerra o processo da JVM imediatamente após a conclusão.
 */
@Component
@Order(100)
public class CliRunOnceRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(CliRunOnceRunner.class);

    private final PublishScheduledPostsUseCase publishUseCase;
    private final ApplicationContext applicationContext;
    private final boolean runOnce;

    public CliRunOnceRunner(
            PublishScheduledPostsUseCase publishUseCase,
            ApplicationContext applicationContext,
            @Value("${autopublisher.run-once:false}") boolean runOnce
    ) {
        this.publishUseCase = publishUseCase;
        this.applicationContext = applicationContext;
        this.runOnce = runOnce;
    }

    @Override
    public void run(String... args) {
        if (!runOnce) {
            return;
        }

        log.info("================================================================================");
        log.info("  AutoPublisher Pro - Modo CLI Run-Once Ativado (GitHub Actions / Serverless)   ");
        log.info("================================================================================");

        try {
            PublishBatchReport report = publishUseCase.execute();
            log.info("Relatorio de Execucao Concluido:");
            log.info("  Total Encontrados: {}", report.totalFound());
            log.info("  Sucessos:          {}", report.successCount());
            log.info("  Falhas:            {}", report.failureCount());
            log.info("  Cota Esgotada:     {}", report.quotaExceeded());
            log.info("  Tempo Total:       {}ms", report.executionTimeMillis());

            if (report.logs() != null && !report.logs().isEmpty()) {
                log.info("Logs detalhados da orquestracao:");
                report.logs().forEach(line -> log.info("  [LOTE] {}", line));
            }

            int exitCode = report.failureCount() > 0 ? 1 : 0;
            log.info("Finalizando processo da aplicacao com exit code: {}", exitCode);
            int springExitCode = SpringApplication.exit(applicationContext, () -> exitCode);
            System.exit(springExitCode);
        } catch (Exception e) {
            log.error("Erro fatal durante execucao do modo CLI Run-Once: {}", e.getMessage(), e);
            int springExitCode = SpringApplication.exit(applicationContext, () -> 1);
            System.exit(springExitCode);
        }
    }
}
