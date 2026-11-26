import type { ConfigContext, ExpoConfig } from 'expo/config';

const launchBackground = {
  backgroundColor: '#242321',
  image: './assets/images/novori-launch-background.png',
  imageWidth: 200,
};

// Merge app.json so local EAS ownership, signing and bundle settings survive.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Novori',
  slug: config.slug ?? 'Novori',
  extra: { ...config.extra, eas: { projectId: '30e6f9f0-79ba-4420-9217-433fa022e460', ...config.extra?.eas } },
  plugins: [
    ...(config.plugins ?? []).filter(plugin => {
      const name = typeof plugin === 'string' ? plugin : plugin[0];
      return name !== 'expo-notifications' && name !== 'expo-splash-screen';
    }),
    // The native launch view supplies just the background for LaunchTrace.
    ['expo-splash-screen', launchBackground],
    ['expo-notifications', { color: '#AD8738', defaultChannel: 'novori' }],
  ],
});
