import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.raj.cinescope',
  appName: 'Cinescope',
  webDir: 'www',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    CapacitorSQLite: {
      androidIsEncryption: false,
      androidBiometric: {
          biometricAuth : false,
          biometricTitle : "Biometric login for capacitor sqlite",
          biometricSubTitle : "Log in using your biometric"
      }
    }
  }
};

export default config;
