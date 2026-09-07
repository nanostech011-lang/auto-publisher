# ==============================================================================
# AutoPublisher Pro - High-Performance Multi-Stage Dockerfile
# Java 21 LTS (Project Loom Virtual Threads) + FFmpeg Headless + Alpine Linux
# Custo Zero, Baixo Consumo de Memória (< 256MB) e Inicialização Instantânea
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build & Compilação Otimizada
# ------------------------------------------------------------------------------
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /build

# Copia configurações do Maven e wrapper para cache de camadas
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw dependency:go-offline -B --no-transfer-progress

# Copia código-fonte e assets
COPY src/ src/
RUN ./mvnw clean package -DskipTests --no-transfer-progress

# ------------------------------------------------------------------------------
# Stage 2: Runtime Ultraleve e Seguro
# ------------------------------------------------------------------------------
FROM eclipse-temurin:21-jre-alpine AS runtime

LABEL maintainer="AutoPublisher Pro Team"
LABEL description="AutoPublisher Pro - Autonomous Social Media Publisher & AI Studio"

WORKDIR /app

# Instalação de utilitários headless essenciais em camada única
# FFmpeg para renderização 9:16, Node.js para upstream pipeline e fontes TrueType
RUN apk add --no-cache \
    ffmpeg \
    nodejs \
    npm \
    fontconfig \
    ttf-dejavu \
    ca-certificates \
    tzdata \
    curl && \
    npm install -g pnpm && \
    rm -rf /var/cache/apk/* /root/.npm

# Criação de usuário não-root com permissões mínimas (Segurança Cloud Run / Kubernetes)
RUN addgroup -S appgroup -g 10001 && \
    adduser -S appuser -u 10001 -G appgroup -h /app -s /bin/sh

# Diretórios de trabalho do pipeline com permissão de escrita para o usuário appuser
RUN mkdir -p /app/pipeline/scratch /app/pipeline/output /app/logs && \
    chown -R appuser:appgroup /app

# Copia o JAR compilado do builder
COPY --from=builder --chown=appuser:appgroup /build/target/*.jar /app/app.jar

# Copia scripts do pipeline e package.json
COPY --chown=appuser:appgroup package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
COPY --chown=appuser:appgroup pipeline/ ./pipeline/

# Instala dependências de produção do pipeline Node.js
RUN pnpm install --prod --ignore-scripts && \
    chown -R appuser:appgroup /app/node_modules

# Alterna para o usuário não-privilegiado
USER appuser

# Parâmetros JVM otimizados para contêineres e Cloud Run (Scale-to-Zero e < 256MB RAM)
ENV JAVA_OPTS="-XX:+UseContainerSupport \
               -XX:MaxRAMPercentage=75.0 \
               -XX:InitialRAMPercentage=25.0 \
               -XX:+UseG1GC \
               -XX:+ExitOnOutOfMemoryError \
               -Djava.security.egd=file:/dev/./urandom \
               -Dspring.threads.virtual.enabled=true"

ENV PORT=8080
ENV SPRING_PROFILES_ACTIVE=prod
ENV TZ=America/Sao_Paulo

EXPOSE 8080

# Healthcheck interno para orquestradores (Docker Compose / Cloud Run)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/api/v1/health || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar --server.port=${PORT:-8080}"]
