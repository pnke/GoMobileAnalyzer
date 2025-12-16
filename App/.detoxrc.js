/** @type {Detox.DetoxConfig} */
module.exports = {
    testRunner: {
        args: {
            '$0': 'jest',
            config: 'e2e/jest.config.js'
        },
        jest: {
            setupTimeout: 120000
        }
    },
    apps: {
        'android.debug': {
            type: 'android.apk',
            binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
            build: 'cd android && gradlew.bat assembleDebug assembleAndroidTest -DtestBuildType=debug',
            reversePorts: [8081]
        },
        'android.release': {
            type: 'android.apk',
            binaryPath: 'android/app/build/outputs/apk/release/app-release.apk',
            build: 'cd android && gradlew.bat assembleRelease assembleAndroidTest -DtestBuildType=release'
        }
    },
    devices: {
        emulator: {
            type: 'android.emulator',
            device: {
                avdName: 'Pixel_8_Pro'
            }
        },
        attached: {
            type: 'android.attached',
            device: {
                adbName: '.*'
            }
        }
    },
    configurations: {
        'android.emu.debug': {
            device: 'emulator',
            app: 'android.debug'
        },
        'android.emu.release': {
            device: 'emulator',
            app: 'android.release'
        },
        'android.att.debug': {
            device: 'attached',
            app: 'android.debug'
        }
    }
};
