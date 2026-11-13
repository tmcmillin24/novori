import type { ConfigContext, ExpoConfig } from 'expo/config';

// Merge app.json so local EAS ownership, signing and bundle settings survive.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Novori',
  slug: config.slug ?? 'Novori',
  extra: { ...config.extra, eas: { projectId: '30e6f9f0-79ba-4420-9217-433fa022e460', ...config.extra?.eas } },
  plugins: [
    ...(config.plugins ?? []).filter(plugin => (typeof plugin === 'string' ? plugin : plugin[0]) !== 'expo-notifications'),
    ['expo-notifications', { color: '#AD8738', defaultChannel: 'novori' }],
  ],
});
