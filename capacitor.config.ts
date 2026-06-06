import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rebh.app',
  appName: 'ربح',
  webDir: 'dist',
  // NOTE: For production builds (Google Play / App Store) keep `server` removed
  // so the app loads the local bundle. Re-enable only for live-reload dev.
  // server: {
  //   url: 'https://e0c2beb0-a826-419c-887f-0db86053f7ed.lovableproject.com?forceHideBadge=true',
  //   cleartext: true,
  // },
  plugins: {
    AdMob: {
      appId: 'ca-app-pub-4098736191122679~4275235624',
    },
    SocialLogin: {
      // قيم runtime تأتي من src/lib/nativeGoogleAuth.ts عبر initialize()
    },
  },
};

export default config;
