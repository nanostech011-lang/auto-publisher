package com.autopublisher;

import io.github.cdimascio.dotenv.Dotenv;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.io.File;

@SpringBootApplication
public class AutoPublisherApplication {

    private static final Logger log = LoggerFactory.getLogger(AutoPublisherApplication.class);

    public static void main(String[] args) {
        // Carrega .env localmente se o arquivo existir, sem sobrescrever variáveis de ambiente reais do sistema
        loadLocalEnvIfPresent();

        SpringApplication.run(AutoPublisherApplication.class, args);
        log.info("AutoPublisher Pro inicializado com sucesso em Java 21 (Virtual Threads habilitadas)!");
    }

    private static void loadLocalEnvIfPresent() {
        File envFile = new File(".env");
        if (envFile.exists()) {
            try {
                Dotenv dotenv = Dotenv.configure().ignoreIfMissing().load();
                dotenv.entries().forEach(entry -> {
                    if (System.getProperty(entry.getKey()) == null && System.getenv(entry.getKey()) == null) {
                        System.setProperty(entry.getKey(), entry.getValue());
                    }
                });
                log.info("Arquivo .env local carregado com sucesso para ambiente de desenvolvimento.");
            } catch (Exception e) {
                log.warn("Nao foi possivel carregar o arquivo .env: {}", e.getMessage());
            }
        }
    }
}
