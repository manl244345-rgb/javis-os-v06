import * as IntentLauncher from 'expo-intent-launcher';
import * as Contacts from 'expo-contacts';
import * as Linking from 'expo-linking';
import { Platform, Alert } from 'react-native';
import { useJavis } from '../stores/javis';

export interface CommandResult {
  success: boolean;
  message: string;
}

// ─── App launcher ────────────────────────────────────────────────────────────
const APP_PACKAGES: Record<string, string> = {
  whatsapp: 'com.whatsapp',
  youtube: 'com.google.android.youtube',
  chrome: 'com.android.chrome',
  gmail: 'com.google.android.gm',
  maps: 'com.google.android.apps.maps',
  camera: 'com.android.camera2',
  settings: 'com.android.settings',
  calculator: 'com.android.calculator2',
  calendar: 'com.android.calendar',
  clock: 'com.android.deskclock',
  contacts: 'com.android.contacts',
  messages: 'com.android.mms',
  photos: 'com.google.android.apps.photos',
  spotify: 'com.spotify.music',
  telegram: 'org.telegram.messenger',
  facebook: 'com.facebook.katana',
  instagram: 'com.instagram.android',
  twitter: 'com.twitter.android',
  tiktok: 'com.zhiliaoapp.musically',
  zoom: 'us.zoom.videomeetings',
  netflix: 'com.netflix.mediaclient',
  files: 'com.android.documentsui',
  gallery: 'com.miui.gallery',
  music: 'com.miui.player',
  browser: 'com.android.browser',
};

export async function openApp(appName: string): Promise<CommandResult> {
  if (Platform.OS !== 'android') {
    return { success: false, message: 'App launching only works on Android.' };
  }
  const lower = appName.toLowerCase().trim();
  const pkg = Object.entries(APP_PACKAGES).find(([k]) => lower.includes(k))?.[1];

  if (pkg) {
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.MAIN', {
        packageName: pkg,
        flags: 0x10000000, // FLAG_ACTIVITY_NEW_TASK
      });
      return { success: true, message: `${appName} opened.` };
    } catch {
      // Try via Linking
      try {
        await Linking.openURL(`${pkg}://`);
        return { success: true, message: `${appName} launched.` };
      } catch {
        return { success: false, message: `Could not open ${appName}. It may not be installed.` };
      }
    }
  }
  return { success: false, message: `I don't know the package for "${appName}". Say the exact app name.` };
}

// ─── Contacts & calling ──────────────────────────────────────────────────────
export async function callContact(name: string): Promise<CommandResult> {
  try {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      return { success: false, message: 'Contacts permission required.' };
    }
    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
    });
    const match = data.find(c =>
      c.name?.toLowerCase().includes(name.toLowerCase())
    );
    if (!match?.phoneNumbers?.length) {
      return { success: false, message: `No contact found matching "${name}".` };
    }
    const phone = match.phoneNumbers[0].number ?? '';
    await Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
    return { success: true, message: `Calling ${match.name}.` };
  } catch (e) {
    return { success: false, message: `Call failed: ${(e as Error).message}` };
  }
}

// ─── Alarms ──────────────────────────────────────────────────────────────────
export async function setAlarm(timeStr: string): Promise<CommandResult> {
  if (Platform.OS !== 'android') {
    return { success: false, message: 'Alarm creation only works on Android.' };
  }
  try {
    // Parse time string like "7:30 AM", "22:00", "7 AM"
    const cleaned = timeStr.toLowerCase().trim();
    let hours = 0;
    let minutes = 0;

    const match12 = cleaned.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
    const match24 = cleaned.match(/^(\d{1,2}):(\d{2})$/);

    if (match12) {
      hours = parseInt(match12[1], 10);
      minutes = parseInt(match12[2] ?? '0', 10);
      if (match12[3] === 'pm' && hours !== 12) hours += 12;
      if (match12[3] === 'am' && hours === 12) hours = 0;
    } else if (match24) {
      hours = parseInt(match24[1], 10);
      minutes = parseInt(match24[2], 10);
    } else {
      return { success: false, message: `I couldn't parse "${timeStr}". Say something like "7:30 AM" or "22:00".` };
    }

    await IntentLauncher.startActivityAsync('android.intent.action.SET_ALARM', {
      extra: {
        'android.intent.extra.alarm.HOUR': hours,
        'android.intent.extra.alarm.MINUTES': minutes,
        'android.intent.extra.alarm.SKIP_UI': true,
        'android.intent.extra.alarm.MESSAGE': 'JAVIS Alarm',
      },
    });
    const h = hours % 12 || 12;
    const ampm = hours < 12 ? 'AM' : 'PM';
    return { success: true, message: `Alarm set for ${h}:${String(minutes).padStart(2, '0')} ${ampm}.` };
  } catch (e) {
    return { success: false, message: `Could not set alarm: ${(e as Error).message}` };
  }
}

// ─── Settings ────────────────────────────────────────────────────────────────
export async function openSettings(section?: string): Promise<CommandResult> {
  if (Platform.OS !== 'android') return { success: false, message: 'Android only.' };
  const actions: Record<string, string> = {
    wifi: 'android.settings.WIFI_SETTINGS',
    bluetooth: 'android.settings.BLUETOOTH_SETTINGS',
    battery: 'android.intent.action.POWER_USAGE_SUMMARY',
    display: 'android.settings.DISPLAY_SETTINGS',
    sound: 'android.settings.SOUND_SETTINGS',
    apps: 'android.settings.APPLICATION_SETTINGS',
    default: 'android.settings.SETTINGS',
  };
  const action = section ? (actions[section.toLowerCase()] ?? actions.default) : actions.default;
  try {
    await IntentLauncher.startActivityAsync(action);
    return { success: true, message: `Opening ${section ?? 'settings'}.` };
  } catch {
    return { success: false, message: 'Could not open settings.' };
  }
}

// ─── WhatsApp ────────────────────────────────────────────────────────────────
export async function sendWhatsApp(contact: string, message: string): Promise<CommandResult> {
  try {
    const url = message
      ? `whatsapp://send?text=${encodeURIComponent(message)}`
      : `whatsapp://`;
    await Linking.openURL(url);
    return { success: true, message: `Opening WhatsApp${contact ? ` to message ${contact}` : ''}.` };
  } catch {
    return { success: false, message: 'WhatsApp is not installed or could not be opened.' };
  }
}

// ─── Execute AI action ───────────────────────────────────────────────────────
export async function executeAction(
  action: string | null,
  target: string | null,
  data: Record<string, unknown>,
): Promise<CommandResult | null> {
  if (!action || action === 'NONE' || action === 'ERROR') return null;

  switch (action) {
    case 'OPEN_APP':
      return target ? openApp(target) : null;
    case 'CALL_CONTACT':
      return target ? callContact(target) : null;
    case 'SET_ALARM':
      return target ? setAlarm(target) : null;
    case 'OPEN_SETTINGS':
      return openSettings(target ?? undefined);
    case 'OPEN_WHATSAPP':
    case 'OPEN_WHATSAPP_SEND':
      return sendWhatsApp(target ?? '', (data.message as string) ?? '');
    case 'REMEMBER_NAME': {
      if (target) useJavis.getState().setUserName(target);
      return null;
    }
    case 'REMEMBER': {
      if (target) {
        useJavis.getState().addMemory({ key: 'note', value: target, category: 'personal' });
      }
      return null;
    }
    default:
      return null;
  }
}
