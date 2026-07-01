import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'executing' | 'speaking' | 'done';
export type AIProvider = 'groq' | 'openrouter' | 'offline';
export type VoiceProfile = 'jarvis' | 'professional' | 'friendly' | 'deep';

export interface Message {
  id: string;
  role: 'user' | 'javis';
  text: string;
  timestamp: number;
  action?: string | null;
}

export interface MemoryItem {
  id: string;
  key: string;
  value: string;
  category: 'personal' | 'preference' | 'habit' | 'contact' | 'goal' | 'task';
  timestamp: number;
}

export interface JavisState {
  // Core
  orbState: OrbState;
  isListening: boolean;
  currentTask: string | null;

  // Messages
  messages: Message[];

  // Memory
  memory: MemoryItem[];
  userName: string;

  // AI
  aiProvider: AIProvider;
  groqKey: string;

  // Voice
  voiceProfile: VoiceProfile;
  voiceEnabled: boolean;
  ttsOnline: boolean;

  // Actions
  setOrbState: (s: OrbState) => void;
  setListening: (v: boolean) => void;
  setCurrentTask: (t: string | null) => void;
  addMessage: (m: Message) => void;
  clearMessages: () => void;
  addMemory: (item: Omit<MemoryItem, 'id' | 'timestamp'>) => void;
  removeMemory: (id: string) => void;
  setUserName: (name: string) => void;
  setAIProvider: (p: AIProvider) => void;
  setGroqKey: (k: string) => void;
  setVoiceProfile: (p: VoiceProfile) => void;
  setVoiceEnabled: (v: boolean) => void;
  setTtsOnline: (v: boolean) => void;
  loadPersisted: () => Promise<void>;
  persist: () => Promise<void>;
}

const STORAGE_KEY = '@javis_os_state';

export const useJavis = create<JavisState>((set, get) => ({
  orbState: 'idle',
  isListening: false,
  currentTask: null,
  messages: [
    {
      id: 'boot',
      role: 'javis',
      text: 'JAVIS OS online. All systems operational. How can I assist you today?',
      timestamp: Date.now(),
    },
  ],
  memory: [],
  userName: 'Sir',
  aiProvider: 'groq',
  groqKey: '',
  voiceProfile: 'jarvis',
  voiceEnabled: true,
  ttsOnline: true,

  setOrbState: (orbState) => set({ orbState }),
  setListening: (isListening) => set({ isListening }),
  setCurrentTask: (currentTask) => set({ currentTask }),

  addMessage: (m) => {
    set((s) => ({ messages: [m, ...s.messages].slice(0, 200) }));
    get().persist();
  },

  clearMessages: () => {
    set({
      messages: [{
        id: 'reset',
        role: 'javis',
        text: 'Memory cleared. New session started.',
        timestamp: Date.now(),
      }],
    });
    get().persist();
  },

  addMemory: (item) => {
    const newItem: MemoryItem = {
      ...item,
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      timestamp: Date.now(),
    };
    set((s) => ({ memory: [...s.memory.filter(m => m.key !== item.key), newItem] }));
    get().persist();
  },

  removeMemory: (id) => {
    set((s) => ({ memory: s.memory.filter(m => m.id !== id) }));
    get().persist();
  },

  setUserName: (userName) => {
    set({ userName });
    get().persist();
  },

  setAIProvider: (aiProvider) => set({ aiProvider }),
  setGroqKey: (groqKey) => {
    set({ groqKey });
    get().persist();
  },
  setVoiceProfile: (voiceProfile) => {
    set({ voiceProfile });
    get().persist();
  },
  setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
  setTtsOnline: (ttsOnline) => set({ ttsOnline }),

  loadPersisted: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      set({
        messages: saved.messages ?? get().messages,
        memory: saved.memory ?? [],
        userName: saved.userName ?? 'Sir',
        groqKey: saved.groqKey ?? '',
        voiceProfile: saved.voiceProfile ?? 'jarvis',
      });
    } catch { /* ignore */ }
  },

  persist: async () => {
    try {
      const s = get();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
        messages: s.messages.slice(0, 100),
        memory: s.memory,
        userName: s.userName,
        groqKey: s.groqKey,
        voiceProfile: s.voiceProfile,
      }));
    } catch { /* ignore */ }
  },
}));
