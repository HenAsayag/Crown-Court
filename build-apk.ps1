param([switch]$Offline)
$ErrorActionPreference = 'Stop'
$projectDir = $PSScriptRoot
$previousJava = $env:JAVA_HOME
$previousAndroid = $env:ANDROID_HOME
$previousGradle = $env:GRADLE_USER_HOME
$previousJavaOptions = $env:JAVA_TOOL_OPTIONS
Push-Location -LiteralPath $projectDir
try {
  $env:JAVA_HOME = Join-Path $projectDir '.toolchain/jdk'
  $env:ANDROID_HOME = Join-Path $projectDir '.toolchain/android-sdk'
  $env:GRADLE_USER_HOME = Join-Path $projectDir '.toolchain/gradle-home'
  $socketDir = (Join-Path $projectDir '.toolchain/afu').Replace('\','/')
  $env:JAVA_TOOL_OPTIONS = '-Djdk.net.unixdomain.tmpdir="' + $socketDir + '"'
  & node build-www.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Web asset build failed' }
  & node node_modules/@capacitor/cli/bin/capacitor copy android
  if ($LASTEXITCODE -ne 0) { throw 'Android asset copy failed' }
  Push-Location android
  try {
    $gradleArgs = @('--no-daemon', ('-Dorg.gradle.jvmargs=-Xmx1536m "-Djdk.net.unixdomain.tmpdir=' + $socketDir + '"'), 'assembleDebug')
    if ($Offline) { $gradleArgs += '--offline' }
    & ./gradlew.bat @gradleArgs
    if ($LASTEXITCODE -ne 0) { throw 'Android build failed' }
  } finally { Pop-Location }
  Copy-Item -LiteralPath 'android/app/build/outputs/apk/debug/app-debug.apk' -Destination 'crown-court-v2.apk'
  Get-Item crown-court-v2.apk | Select-Object FullName,Length
} finally {
  $env:JAVA_HOME = $previousJava
  $env:ANDROID_HOME = $previousAndroid
  $env:GRADLE_USER_HOME = $previousGradle
  $env:JAVA_TOOL_OPTIONS = $previousJavaOptions
  Pop-Location
}
