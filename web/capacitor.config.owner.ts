import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.miracle.ownerapp',
  appName: 'Miracle Owner App',
  webDir: 'empty_dir',
  server: {
    url: 'https://miracle.vigilantitsolution.com/owner',
    cleartext: true
  },
  plugins: {
    CapacitorCookies: {
      enabled: true,
    },
    CapacitorHttp: {
      enabled: true,
    }
  }
};

export default config;
