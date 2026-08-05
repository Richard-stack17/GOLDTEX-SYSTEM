import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.goltex.pos',
  appName: 'Goltex POS',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  }
};

export default config;
