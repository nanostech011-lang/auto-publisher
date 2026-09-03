#!/bin/sh
# ----------------------------------------------------------------------------
# Maven Start Up Batch script for Unix/Linux
# ----------------------------------------------------------------------------

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
WRAPPER_JAR="$DIR/.mvn/wrapper/maven-wrapper.jar"

if [ -n "$JAVA_HOME" ] && [ -x "$JAVA_HOME/bin/java" ]; then
    JAVACMD="$JAVA_HOME/bin/java"
else
    JAVACMD="java"
fi

exec "$JAVACMD" -jar "$WRAPPER_JAR" "$@"
