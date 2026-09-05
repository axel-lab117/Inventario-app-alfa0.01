import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lab117.wms.picker',
  appName: 'WMS Picker',
  webDir: 'out',
  server: {
    url: process.env.CAPACITOR_SERVER_URL || 'http://localhost:3001',
    cleartext: true,
  },
  plugins: {
    Camera: {
      permissions: ['camera'],
    },
    BarcodeScanner: {
      formats: ['CODE_128', 'CODE_39', 'EAN_13', 'EAN_8', 'QR_CODE'],
      lensFacing: 'back',
      torchEnabled: true,
    },
    Haptics: {},
    CapacitorHttp: {
      enabled: true,
    },
    CapacitorCookies: {
      enabled: true,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#0ea5e9',
      sound: 'beep.wav',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    BackgroundTask: {
      enabled: true,
    },
    BackgroundMode: {
      enabled: true,
    },
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: process.env.NODE_ENV === 'development',
    permissions: [
      'camera',
      'vibrate',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.WAKE_LOCK',
    ],
    buildOptions: {
      keystorePath: process.env.KEYSTORE_PATH,
      keystorePassword: process.env.KEYSTORE_PASSWORD,
      keystoreAlias: process.env.KEYSTORE_ALIAS,
      keystoreAliasPassword: process.env.KEYSTORE_ALIAS_PASSWORD,
      releaseType: 'APK',
    },
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: false,
    scheme: 'wms-picker',
  },
};

export default config;