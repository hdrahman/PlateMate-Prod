// Import the base app.json configuration
const appConfig = require('./app.json');

export default ({ config }) => {
  return {
    ...appConfig.expo,
    extra: {
      // Merge existing extra fields from app.json
      ...appConfig.expo.extra,
      // Expose EAS Build environment variables to the app runtime
      // These are set in eas.json for each build profile
      REVENUECAT_API_KEY_IOS: process.env.REVENUECAT_API_KEY_IOS || 'appl_fAiSHChcrfBqSjsPhTXyymnXnbo',
      REVENUECAT_API_KEY_ANDROID: process.env.REVENUECAT_API_KEY_ANDROID || 'goog_KQRoCcYPcMGUcdeSPJcJbyxBVWA',
      SUPABASE_URL: process.env.SUPABASE_URL || 'https://noyieuwbhalbmdntoxoj.supabase.co',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5veWlldXdiaGFsYm1kbnRveG9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3MDIxNDQsImV4cCI6MjA2NjI3ODE0NH0.OwnfpOt6LhXv7sWQoF56I619sLSOS0pKLjGxsDyc7rA',
      GOOGLE_WEB_CLIENT_ID: process.env.GOOGLE_WEB_CLIENT_ID || '570062506772-cpu39g8uv42ukse74ggn694h65ekl8rq.apps.googleusercontent.com',
      GOOGLE_IOS_CLIENT_ID: process.env.GOOGLE_IOS_CLIENT_ID || '570062506772-qtvk2v9k0utvi7j0fuuho8auk549eh45.apps.googleusercontent.com',
      GOOGLE_ANDROID_CLIENT_ID: process.env.GOOGLE_ANDROID_CLIENT_ID || '570062506772-meo6cc6n9o4kjrvhqnp0gtti59da4vvn.apps.googleusercontent.com',
    }
  };
};

