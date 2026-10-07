export function getLinkConfig(env, bundleId) {
  const teamId = env.NOVORI_APPLE_TEAM_ID?.trim() || '';
  if (teamId && !/^[A-Z0-9]{10}$/.test(teamId)) throw new Error('NOVORI_APPLE_TEAM_ID must be the 10-character Apple Developer Team ID.');
  const appStoreUrl = env.NOVORI_IOS_APP_STORE_URL?.trim() || '';
  if (appStoreUrl) {
    const url = new URL(appStoreUrl);
    if (url.protocol !== 'https:' || url.hostname !== 'apps.apple.com' || !/\/id\d+\/?$/.test(url.pathname) || url.username || url.password) {
      throw new Error('NOVORI_IOS_APP_STORE_URL must be the real HTTPS apps.apple.com listing URL.');
    }
  }
  return {
    download: { ios: appStoreUrl },
    association: teamId ? {
      applinks: { apps: [], details: [{ appID: `${teamId}.${bundleId}`, paths: ['/book/*', '/post/*', '/stack/*', '/reader/*', '/club/*', '/club-event/*'] }] },
    } : null,
  };
}
