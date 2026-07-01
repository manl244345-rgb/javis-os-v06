import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import { useJavis } from '../stores/javis';

// Voice profiles — pitch & rate settings for expo-speech fallback
const VOICE_CONFIGS = {
  jarvis:       { pitch: 0.72, rate: 0.88 },
  professional: { pitch: 0.78, rate: 0.90 },
  friendly:     { pitch: 0.82, rate: 0.95 },
  deep:         { pitch: 0.62, rate: 0.85 },
};

// Edge TTS voice mapping (online, via API server)
const EDGE_VOICES = {
  jarvis:       'en-US-GuyNeural',
  professional: 'en-US-ChristopherNeural',
  friendly:     'en-US-BrianNeural',
  deep:         'en-US-GuyNeural',
};

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : '/api';

let currentSound: Audio.Sound | null = null;

async function stopSpeaking() {
  try {
    if (currentSound) {
      await currentSound.stopAsync();
      await currentSound.unloadAsync();
      currentSound = null;
    }
    Speech.stop();
  } catch { /* ignore */ }
}

async function speakOnline(text: string, voice: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
    });
    if (!res.ok) return false;

    const data = await res.json() as { audioUrl?: string; base64?: string };

    if (data.audioUrl) {
      const { sound } = await Audio.Sound.createAsync({ uri: data.audioUrl });
      currentSound = sound;
      await sound.playAsync();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function speakOffline(
  text: string,
  profile: keyof typeof VOICE_CONFIGS,
  onDone?: () => void,
) {
  const config = VOICE_CONFIGS[profile];
  Speech.speak(text, {
    language: 'en-US',
    pitch: config.pitch,
    rate: config.rate,
    onDone,
    onStopped: onDone,
    onError: onDone,
  });
}

export async function speak(text: string, onDone?: () => void): Promise<void> {
  if (Platform.OS === 'web') { onDone?.(); return; }

  const { voiceProfile, ttsOnline, voiceEnabled } = useJavis.getState();
  if (!voiceEnabled) { onDone?.(); return; }

  await stopSpeaking();

  if (ttsOnline) {
    const edgeVoice = EDGE_VOICES[voiceProfile];
    const success = await speakOnline(text, edgeVoice);
    if (success) {
      // Poll for completion
      const checkDone = setInterval(async () => {
        if (!currentSound) { clearInterval(checkDone); onDone?.(); return; }
        try {
          const status = await currentSound.getStatusAsync();
          if ('isLoaded' in status && status.isLoaded && !status.isPlaying) {
            clearInterval(checkDone);
            onDone?.();
          }
        } catch {
          clearInterval(checkDone);
          onDone?.();
        }
      }, 500);
      return;
    }
  }

  // Fallback to offline
  speakOffline(text, voiceProfile, onDone);
}

export function stopVoice() {
  stopSpeaking();
}

// Recording
let activeRecording: Audio.Recording | null = null;

export async function startListening(): Promise<boolean> {
  try {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') return false;
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    activeRecording = recording;
    return true;
  } catch {
    return false;
  }
}

export async function stopListening(): Promise<string | null> {
  if (!activeRecording) return null;
  try {
    await activeRecording.stopAndUnloadAsync();
    const uri = activeRecording.getURI();
    activeRecording = null;
    if (!uri) return null;

    const groqKey = useJavis.getState().groqKey
      || (typeof process !== 'undefined' ? process.env.GROQ_API_KEY : '')
      || '';

    if (!groqKey) return null;

    const form = new FormData();
    form.append('file', { uri, name: 'voice.m4a', type: 'audio/m4a' } as unknown as Blob);
    form.append('model', 'whisper-large-v3');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}` },
      body: form,
    });

    if (!res.ok) return null;
    const data = await res.json() as { text: string };
    return data.text?.trim() || null;
  } catch {
    activeRecording = null;
    return null;
  }
}
