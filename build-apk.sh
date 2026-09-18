#!/usr/bin/env bash
# Builds crown-court.apk with the toolchain in .toolchain/ (nothing global).
#
# jdk.net.unixdomain.tmpdir: this machine's default TEMP blocks AF_UNIX sockets,
# which makes java.nio Selector.open() - and therefore every Gradle daemon
# connection - fail with "Unable to establish loopback connection". Pointing it
# at a directory inside the project works around it.
#
# Usage: bash build-apk.sh [assembleDebug|assembleRelease]
set -e

TASK="${1:-assembleDebug}"
SHORT='C:/Users/HENASA~2/SLAMDU~1'

export JAVA_HOME='C:\Users\HENASA~2\SLAMDU~1\TOOLCH~1\jdk'
export ANDROID_HOME='C:\Users\HENASA~2\SLAMDU~1\TOOLCH~1\android-sdk'
export GRADLE_USER_HOME='C:\Users\HENASA~2\SLAMDU~1\TOOLCH~1\gradle-home'
export JAVA_TOOL_OPTIONS="-Djdk.net.unixdomain.tmpdir=$SHORT/.toolchain/afu"

node build-www.mjs
npx cap copy android

cd android
./gradlew.bat --no-daemon "$TASK"
cd ..

if [ "$TASK" = "assembleRelease" ]; then
  APK=android/app/build/outputs/apk/release/app-release-unsigned.apk
else
  APK=android/app/build/outputs/apk/debug/app-debug.apk
fi

cp "$APK" ./crown-court.apk
ls -la crown-court.apk
