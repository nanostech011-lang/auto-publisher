package com.autopublisher.infrastructure.controller;

import com.autopublisher.application.port.in.CreateTenantCommand;
import com.autopublisher.application.port.in.ManageTenantUseCase;
import com.autopublisher.application.port.in.TenantSummaryDto;
import com.autopublisher.domain.model.TenantConfig;
import com.autopublisher.domain.model.TenantContextHolder;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Controller REST para gestao administrativa de Tenants (SaaS Multi-Tenant).
 * Acessivel apenas com privilegios de Master Admin.
 */
@RestController
@RequestMapping("/api/v1/tenants")
public class TenantController {

    private final ManageTenantUseCase tenantUseCase;

    public TenantController(ManageTenantUseCase tenantUseCase) {
        this.tenantUseCase = tenantUseCase;
    }

    @PostMapping
    public ResponseEntity<?> createTenant(@RequestBody CreateTenantCommand command) {
        if (!isMasterAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Forbidden", "message", "Apenas o Master Admin pode criar novos tenants."));
        }
        try {
            TenantConfig created = tenantUseCase.createTenant(command);
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Bad Request", "message", e.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<?> listTenants() {
        if (!isMasterAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Forbidden", "message", "Apenas o Master Admin pode listar tenants."));
        }
        List<TenantSummaryDto> list = tenantUseCase.listTenants();
        return ResponseEntity.ok(list);
    }

    @GetMapping("/{tenantId}")
    public ResponseEntity<?> getTenant(@PathVariable String tenantId) {
        if (!isMasterAdmin() && !isCurrentTenant(tenantId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Forbidden", "message", "Sem permissao para acessar este tenant."));
        }
        return tenantUseCase.getTenant(tenantId)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{tenantId}/rotate-key")
    public ResponseEntity<?> rotateApiKey(@PathVariable String tenantId) {
        if (!isMasterAdmin() && !isCurrentTenant(tenantId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Forbidden", "message", "Sem permissao para rotacionar chave deste tenant."));
        }
        try {
            TenantConfig updated = tenantUseCase.rotateApiKey(tenantId);
            return ResponseEntity.ok(Map.of(
                "tenantId", updated.tenantId(),
                "newApiKey", updated.apiKey(),
                "message", "Chave de API rotacionada com sucesso."
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PatchMapping("/{tenantId}/status")
    public ResponseEntity<?> updateStatus(@PathVariable String tenantId, @RequestBody Map<String, Boolean> body) {
        if (!isMasterAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Forbidden", "message", "Apenas o Master Admin pode alterar status de tenants."));
        }
        Boolean active = body.get("active");
        if (active == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Parametro 'active' e obrigatorio."));
        }
        try {
            TenantConfig updated = tenantUseCase.updateTenantStatus(tenantId, active);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{tenantId}")
    public ResponseEntity<?> deleteTenant(@PathVariable String tenantId) {
        if (!isMasterAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Forbidden", "message", "Apenas o Master Admin pode remover tenants."));
        }
        boolean deleted = tenantUseCase.deleteTenant(tenantId);
        if (deleted) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    private boolean isMasterAdmin() {
        return TenantContextHolder.get()
            .map(c -> c.isMasterAdmin())
            .orElse(false);
    }

    private boolean isCurrentTenant(String tenantId) {
        return TenantContextHolder.get()
            .map(c -> c.tenantId().equalsIgnoreCase(tenantId))
            .orElse(false);
    }
}
