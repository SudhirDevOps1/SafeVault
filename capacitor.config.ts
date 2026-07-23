import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.safevault.app',
  appName: 'SafeVault',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
