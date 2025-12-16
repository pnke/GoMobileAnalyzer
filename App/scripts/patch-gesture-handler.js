/* eslint-env node */
// Patch react-native-gesture-handler to fix duplicate JNI libs issue
// This is needed for Detox E2E testing with React Native 0.81+
const fs = require('fs');
const path = require('path');

const buildGradlePath = path.join(
    __dirname,
    '../node_modules/react-native-gesture-handler/android/build.gradle'
);

if (!fs.existsSync(buildGradlePath)) {
    console.log('⚠️ react-native-gesture-handler not found, skipping patch');
    process.exit(0);
}

let content = fs.readFileSync(buildGradlePath, 'utf8');

if (content.includes('pickFirst')) {
    console.log('✅ react-native-gesture-handler already patched');
    process.exit(0);
}

content = content.replace(
    /android\s*{/,
    `android {
    packagingOptions {
        pickFirst 'lib/arm64-v8a/libfbjni.so'
        pickFirst 'lib/armeabi-v7a/libfbjni.so'
        pickFirst 'lib/x86/libfbjni.so'
        pickFirst 'lib/x86_64/libfbjni.so'
        pickFirst 'lib/arm64-v8a/libc++_shared.so'
        pickFirst 'lib/armeabi-v7a/libc++_shared.so'
        pickFirst 'lib/x86/libc++_shared.so'
        pickFirst 'lib/x86_64/libc++_shared.so'
    }`
);

fs.writeFileSync(buildGradlePath, content);
console.log('✅ Patched react-native-gesture-handler for Detox compatibility');
