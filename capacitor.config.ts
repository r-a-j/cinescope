import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rajcinescope.app',
  appName: 'Cinescope',
  webDir: 'www',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    cleartext: false
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      splashFullScreen: true,
      splashImmersive: true,
      launchFadeOutDuration: 200
    }
  }
};

export default config;
