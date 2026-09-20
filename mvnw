#!/bin/sh
# ----------------------------------------------------------------------------
# Maven Start Up Script for Unix/Linux
# ----------------------------------------------------------------------------

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
WRAPPER_JAR="$DIR/.mvn/wrapper/maven-wrapper.jar"

if [ ! -f "$WRAPPER_JAR" ]; then
    mkdir -p "$DIR/.mvn/wrapper"
    echo "[INFO] maven-wrapper.jar not found, downloading..."
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.3.2/maven-wrapper-3.3.2.jar -o "$WRAPPER_JAR"
    elif command -v wget >/dev/null 2>&1; then
        wget -q -O "$WRAPPER_JAR" https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.3.2/maven-wrapper-3.3.2.jar
    else
        echo "[ERROR] curl or wget required to download maven-wrapper.jar"
        exit 1
    fi
fi

if [ -n "$JAVA_HOME" ] && [ -x "$JAVA_HOME/bin/java" ]; then
    JAVACMD="$JAVA_HOME/bin/java"
else
    JAVACMD="java"
fi

exec "$JAVACMD" \
  "-Dmaven.multiModuleProjectDirectory=$DIR" \
  -cp "$WRAPPER_JAR" \
  org.apache.maven.wrapper.MavenWrapperMain "$@"
