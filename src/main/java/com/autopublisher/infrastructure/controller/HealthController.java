package com.autopublisher.infrastructure.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

/**
 * Endpoint de liveness e readiness para orquestradores (Docker, Kubernetes, Cloud Run).
 * Nao requer autenticacao e responde imediatamente com status 200 OK.
 */
@RestController
@RequestMapping("/api/v1/health")
public class HealthController {

    @GetMapping
    public ResponseEntity<Map<String, Object>> checkHealth() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "service", "autopublisher-pro",
                "version", "2.0.0-pro",
                "timestamp", Instant.now().toString(),
                "virtualThreads", true
        ));
    }
}
