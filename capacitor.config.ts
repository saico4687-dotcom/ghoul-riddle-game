import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rebh.app',
  appName: 'ربح',
  webDir: 'dist',

  // server: {   // أبقِه معلق للـ Production
  //   url: 'https://...',
  //   cleartext: true,
  // },

  plugins: {
    AdMob: {
      appId: 'ca-app-pub-4098736191122679~4275235624',
      // إعدادات إضافية موصى بها
      requestTrackingAuthorization: true,
      initializeForTesting: false,   // غيّر إلى true أثناء الاختبار
    },
  },
};

export default config;
