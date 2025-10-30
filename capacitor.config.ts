import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.resqlink.mesh',
  appName: 'ResQLink',
  webDir: 'dist',
  bundledWebRuntime: false,
  backgroundColor: '#1976d2',

  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    }
  },

  ios: {
    contentInset: 'automatic',
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#1976d2',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      spinnerColor: '#ffffff'
    }
  }
};

export default config;
