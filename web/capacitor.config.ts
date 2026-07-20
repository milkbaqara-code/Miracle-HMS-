import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.miracle.guestapp',
  appName: 'Miracle Guest App',
  webDir: 'empty_dir',
  server: {
    url: 'https://miracle.vigilantitsolution.com/guest',
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
