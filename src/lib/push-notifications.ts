import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export type PushStatus = 'checking' | 'enabled' | 'off' | 'denied' | 'unavailable' | 'error';
const KEY = 'novori:push-install:v1';
type Installation = { id: string; secret: string };
let installation: Promise<Installation> | undefined;
let native: Promise<typeof import('expo-notifications') | null> | undefined;
let serial: Promise<unknown> = Promise.resolve();
let syncing = false;
export const isPushSyncInProgress = () => syncing;
let status: PushStatus = 'checking';
const observers = new Set<() => void>();
export const getPushStatus = () => status;
export const subscribePushStatus = (listener: () => void) => { observers.add(listener); return () => { observers.delete(listener); }; };
function update(value: PushStatus) { status = value; observers.forEach(fn => fn()); }
export function nativeNotifications() {
  if (!native) native = (async () => {
    if (Platform.OS === 'web' || !Device.isDevice) return null;
    try {
      if (!requireOptionalNativeModule('ExpoPushTokenManager')) {
        console.warn('[Novori push] Native capability missing: ExpoPushTokenManager.', JSON.stringify({ environment: Constants.executionEnvironment, build: Constants.nativeBuildVersion, registeredUnderClassName: Boolean(requireOptionalNativeModule('PushTokenModule')), permissionsModule: Boolean(requireOptionalNativeModule('ExpoNotificationPermissionsModule')) }));
        return null;
      }
      return await import('expo-notifications');
    }
    catch { return null; } // An older installed development binary needs a rebuild.
  })();
  return native;
}
async function getInstallation() {
  if (!installation) installation = (async () => {
    const saved = await AsyncStorage.getItem(KEY);
    if (saved) {
      const value = JSON.parse(saved);
      if (typeof value.id === 'string' && typeof value.secret === 'string' && /^[a-f0-9]{64}$/.test(value.secret)) return value as Installation;
    }
    const crypto = await import('expo-crypto');
    const value = { id: crypto.randomUUID(), secret: crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '') };
    await AsyncStorage.setItem(KEY, JSON.stringify(value));
    return value;
  })().catch(error => { installation = undefined; throw error; });
  return installation;
}
async function unregister() {
  // Proof of installation allows removal after Supabase has cleared the session.
  const saved = await AsyncStorage.getItem(KEY);
  if (!saved) return;
  const install = await getInstallation();
  const { error } = await supabase.rpc('novori_unregister_push_device', { p_install: install.id, p_secret: install.secret });
  if (error) throw error;
}
export function syncPushDevice(requestPermission = false) {
  // Serialize foreground/sign-in/sign-out/token-refresh events, including logout.
  const work = async () => {
    const notifications = await nativeNotifications();
    if (!notifications) { update('unavailable'); return; }
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) { await unregister(); update('off'); return; }
    if (Platform.OS === 'android') await notifications.setNotificationChannelAsync('novori', { name: 'Novori updates', importance: notifications.AndroidImportance.DEFAULT });
    let permission = await notifications.getPermissionsAsync();
    if (requestPermission && !permission.granted && permission.canAskAgain) permission = await notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
    const allowed = permission.granted || permission.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL;
    if (!allowed) { await unregister(); update(permission.canAskAgain ? 'off' : 'denied'); return; }
    const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) throw new Error('Missing EAS project configuration.');
    const token = (await notifications.getExpoPushTokenAsync({ projectId })).data;
    const install = await getInstallation();
    // Verify the same account is still signed in after network/native operations.
    const current = (await supabase.auth.getSession()).data.session;
    if (current?.user.id !== session.user.id) { await unregister(); return; }
    const { error } = await supabase.rpc('novori_register_push_device', { p_install: install.id, p_secret: install.secret, p_token: token, p_platform: Platform.OS, p_project: projectId });
    if (error) throw error;
    update('enabled');
  };
  const run = async () => { syncing = true; try { return await work(); } finally { syncing = false; } };
  const result = serial.then(run, run).catch(error => { update('error'); throw error; });
  serial = result.catch(() => undefined);
  return result;
}
export async function sendTestPush() {
  const { error } = await supabase.rpc('novori_test_push');
  if (error) throw error;
}
