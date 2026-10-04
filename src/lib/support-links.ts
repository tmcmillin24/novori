import Constants from 'expo-constants';
import { Alert, Linking, Platform } from 'react-native';

export const NOVORI_WEBSITE_URL = 'https://novori.link';
export const NOVORI_SUPPORT_URL = `${NOVORI_WEBSITE_URL}/support/`;
export const NOVORI_SUPPORT_EMAIL = 'support@novori.link';
export const NOVORI_APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

type SupportRequest = 'support' | 'problem' | 'suggestion';
const subjects: Record<SupportRequest, string> = {
  support: 'Novori support', problem: 'Novori problem report', suggestion: 'Novori feature request',
};

export async function openNovoriWebsite(url = NOVORI_WEBSITE_URL) {
  try { await Linking.openURL(url); }
  catch { Alert.alert('Could not open the website', `Visit ${url} in your browser.`); }
}

export async function contactNovoriSupport(kind: SupportRequest = 'support') {
  const prompt = kind === 'problem'
    ? 'What happened?\n\nSteps to reproduce:\n\nWhat did you expect?\n\nPhone model:\n'
    : kind === 'suggestion' ? 'My idea:\n\nHow it would help:\n' : 'How can we help?\n';
  const body = `${prompt}\n\nNovori ${NOVORI_APP_VERSION} · ${Platform.OS}`;
  const url = `mailto:${NOVORI_SUPPORT_EMAIL}?subject=${encodeURIComponent(subjects[kind])}&body=${encodeURIComponent(body)}`;
  try { await Linking.openURL(url); }
  catch {
    Alert.alert('Email support', `Email ${NOVORI_SUPPORT_EMAIL} from your preferred email app.`, [
      { text: 'Close', style: 'cancel' },
      { text: 'Support website', onPress: () => { void openNovoriWebsite(NOVORI_SUPPORT_URL); } },
    ]);
  }
}
