/**
 * JAVIS Offline AI Engine
 * NLP-based intent classification + contextual response generation
 * Runs 100% offline. No internet required.
 * Uses compromise.js for NLP + a scored intent matcher.
 */
import nlp from 'compromise';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Intent {
  name: string;
  confidence: number;
  entities: Record<string, string>;
  action: string | null;
  target: string | null;
}

export interface OfflineResponse {
  reply: string;
  action: string | null;
  target: string | null;
  data: Record<string, unknown>;
  confidence: number;
  offline: true;
}

// ─── Intent patterns ─────────────────────────────────────────────────────────

interface Pattern {
  intent: string;
  action: string | null;
  patterns: RegExp[];
  weight: number;
  responder: (doc: ReturnType<typeof nlp>, entities: Record<string, string>, userName: string) => string;
}

const INTENT_PATTERNS: Pattern[] = [
  // ── Time & Date ──────────────────────────────────────────────────────────
  {
    intent: 'time',
    action: null,
    weight: 0.95,
    patterns: [/\btime\b/, /what time/, /current time/, /clock/],
    responder: (_d, _e, name) => {
      const t = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return `Current time is ${t}, ${name}.`;
    },
  },
  {
    intent: 'date',
    action: null,
    weight: 0.95,
    patterns: [/\bdate\b/, /today/, /what day/, /day of the week/],
    responder: (_d, _e, name) => {
      const d = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      return `Today is ${d}, ${name}.`;
    },
  },

  // ── Greetings ────────────────────────────────────────────────────────────
  {
    intent: 'greeting',
    action: null,
    weight: 0.9,
    patterns: [/\bhello\b/, /\bhi\b/, /\bhey\b/, /good (morning|evening|afternoon|night)/, /greetings/],
    responder: (_d, _e, name) => {
      const h = new Date().getHours();
      const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
      const lines = [
        `${g}, ${name}. JAVIS is fully operational.`,
        `${g}, ${name}. All systems are running at optimal capacity.`,
        `${g}, ${name}. How may I assist you today?`,
      ];
      return lines[Math.floor(Math.random() * lines.length)];
    },
  },

  // ── Open App ─────────────────────────────────────────────────────────────
  {
    intent: 'open_app',
    action: 'OPEN_APP',
    weight: 0.92,
    patterns: [/open (.+)/, /launch (.+)/, /start (.+)/, /run (.+)/],
    responder: (_d, e, name) => `Opening ${e.app ?? 'the app'}, ${name}.`,
  },

  // ── Call ─────────────────────────────────────────────────────────────────
  {
    intent: 'call',
    action: 'CALL_CONTACT',
    weight: 0.93,
    patterns: [/call (.+)/, /ring (.+)/, /phone (.+)/, /dial (.+)/],
    responder: (_d, e, name) => `Initiating call to ${e.contact ?? 'the contact'}, ${name}.`,
  },

  // ── Alarm ────────────────────────────────────────────────────────────────
  {
    intent: 'alarm',
    action: 'SET_ALARM',
    weight: 0.92,
    patterns: [/set (an? )?alarm/, /wake me (at|up)/, /alarm (at|for)/, /remind me at/],
    responder: (_d, e, name) => `Setting alarm for ${e.time ?? 'the specified time'}, ${name}.`,
  },

  // ── Remember ─────────────────────────────────────────────────────────────
  {
    intent: 'remember',
    action: 'REMEMBER',
    weight: 0.88,
    patterns: [/remember (that )?(.+)/, /don'?t forget/, /note (that|this)/, /save (this|that)/],
    responder: (_d, e, name) => `Memory stored, ${name}. I'll remember: "${e.thing ?? 'it'}".`,
  },

  // ── Battery ──────────────────────────────────────────────────────────────
  {
    intent: 'battery',
    action: 'CHECK_BATTERY',
    weight: 0.9,
    patterns: [/battery/, /power level/, /charge level/, /how much battery/],
    responder: (_d, _e, name) => `Checking power levels now, ${name}.`,
  },

  // ── Weather ──────────────────────────────────────────────────────────────
  {
    intent: 'weather',
    action: null,
    weight: 0.85,
    patterns: [/weather/, /temperature/, /forecast/, /raining/, /sunny/],
    responder: (_d, _e, name) => `I don't have weather sensors offline, ${name}. Connect to the internet for live weather data.`,
  },

  // ── Identity ─────────────────────────────────────────────────────────────
  {
    intent: 'identity',
    action: null,
    weight: 0.9,
    patterns: [/who are you/, /your name/, /what are you/, /introduce yourself/],
    responder: (_d, _e, name) => `I am JAVIS — Just A Rather Very Intelligent System. Your personal AI companion and assistant. At your service, ${name}.`,
  },

  // ── Capabilities ─────────────────────────────────────────────────────────
  {
    intent: 'capabilities',
    action: null,
    weight: 0.85,
    patterns: [/what can you do/, /your capabilities/, /help me/, /\bhelp\b/, /commands/],
    responder: (_d, _e, name) => `I can help you with: opening apps, calling contacts, setting alarms, remembering information, checking time and date, answering questions, and controlling your device. What do you need, ${name}?`,
  },

  // ── WhatsApp ─────────────────────────────────────────────────────────────
  {
    intent: 'whatsapp',
    action: 'OPEN_WHATSAPP',
    weight: 0.9,
    patterns: [/whatsapp/, /send (a )?message/, /text (.+)/],
    responder: (_d, e, name) => `Opening WhatsApp${e.contact ? ` to message ${e.contact}` : ''}, ${name}.`,
  },

  // ── Settings ─────────────────────────────────────────────────────────────
  {
    intent: 'settings',
    action: 'OPEN_SETTINGS',
    weight: 0.87,
    patterns: [/open settings/, /wifi settings/, /bluetooth settings/, /system settings/],
    responder: (_d, _e, name) => `Opening device settings, ${name}.`,
  },

  // ── Math ─────────────────────────────────────────────────────────────────
  {
    intent: 'math',
    action: null,
    weight: 0.88,
    patterns: [/\bwhat is\b.*\d.*[+\-*/]/, /calculate/, /compute/, /\d+\s*[+\-*/]\s*\d+/],
    responder: (d, _e, name) => {
      const text = d.text().replace(/what is|calculate|compute/gi, '').trim();
      try {
        // Safe eval for basic math only
        const result = Function(`"use strict"; return (${text.replace(/[^0-9+\-*/.() ]/g, '')})`)();
        return `The answer is ${result}, ${name}.`;
      } catch {
        return `I couldn't compute that offline, ${name}. Let me know the exact expression.`;
      }
    },
  },

  // ── Name ─────────────────────────────────────────────────────────────────
  {
    intent: 'set_name',
    action: 'REMEMBER_NAME',
    weight: 0.9,
    patterns: [/my name is (.+)/, /call me (.+)/, /i('?m| am) (.+)/],
    responder: (_d, e, name) => `Understood. I will address you as ${e.name ?? name} from now on.`,
  },

  // ── Status / Are you there ────────────────────────────────────────────────
  {
    intent: 'status',
    action: null,
    weight: 0.85,
    patterns: [/are you there/, /status/, /system status/, /diagnostics/],
    responder: (_d, _e, name) => `All systems operational, ${name}. JAVIS AI Engine running offline. Memory banks active. Awaiting your command.`,
  },

  // ── Shutdown / Sleep ─────────────────────────────────────────────────────
  {
    intent: 'shutdown',
    action: null,
    weight: 0.85,
    patterns: [/\bgoodbye\b/, /\bbye\b/, /sleep mode/, /stand by/, /power down/],
    responder: (_d, _e, name) => `Understood, ${name}. JAVIS entering standby mode. I'll be here when you need me.`,
  },
];

// ─── Entity extraction ────────────────────────────────────────────────────────

function extractEntities(text: string, intent: string): Record<string, string> {
  const entities: Record<string, string> = {};
  const lower = text.toLowerCase();

  if (intent === 'open_app') {
    const m = lower.match(/(?:open|launch|start|run)\s+(.+)/);
    if (m) entities.app = m[1].trim();
  }
  if (intent === 'call') {
    const m = lower.match(/(?:call|ring|phone|dial)\s+(.+)/);
    if (m) entities.contact = m[1].trim();
  }
  if (intent === 'alarm') {
    const m = lower.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)|(?:\d{1,2}:\d{2}))/i);
    if (m) entities.time = m[1].trim();
    const mWake = lower.match(/(?:wake me (?:at|up)|alarm (?:at|for)|remind me at)\s+(.+)/);
    if (!entities.time && mWake) entities.time = mWake[1].trim();
  }
  if (intent === 'remember') {
    const m = lower.match(/remember(?:\s+that)?\s+(.+)/);
    if (m) entities.thing = m[1].trim();
  }
  if (intent === 'set_name') {
    const m = lower.match(/(?:my name is|call me|i(?:'m| am))\s+(.+)/i);
    if (m) entities.name = m[1].trim();
  }
  if (intent === 'whatsapp') {
    const m = lower.match(/(?:message|text)\s+(.+)/);
    if (m) entities.contact = m[1].trim();
  }

  return entities;
}

// ─── Score intents ────────────────────────────────────────────────────────────

function scoreIntents(text: string): { pattern: Pattern; score: number; entities: Record<string, string> }[] {
  const lower = text.toLowerCase();
  const results: { pattern: Pattern; score: number; entities: Record<string, string> }[] = [];

  for (const pattern of INTENT_PATTERNS) {
    let score = 0;
    for (const regex of pattern.patterns) {
      if (regex.test(lower)) {
        score = pattern.weight;
        break;
      }
    }
    if (score > 0) {
      const entities = extractEntities(text, pattern.intent);
      results.push({ pattern, score, entities });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

// ─── Intelligent fallback responses ──────────────────────────────────────────

const FALLBACK_RESPONSES = [
  (name: string) => `Processing that query offline has limitations, ${name}. Connect to the internet for advanced AI responses, or try a more specific command.`,
  (name: string) => `My offline knowledge base doesn't cover that specifically, ${name}. I can help with apps, calls, alarms, and information commands.`,
  (name: string) => `Interesting query, ${name}. For complex reasoning I recommend enabling online AI. Offline, I excel at commands and factual lookups.`,
];

// ─── Main offline AI function ─────────────────────────────────────────────────

export function runOfflineAI(text: string, userName: string): OfflineResponse {
  const doc = nlp(text);
  const scored = scoreIntents(text);

  if (scored.length > 0 && scored[0].score >= 0.85) {
    const best = scored[0];
    const reply = best.pattern.responder(doc, best.entities, userName);
    const action = best.pattern.action;

    // Determine target from entities
    let target: string | null = null;
    const e = best.entities;
    if (e.app) target = e.app;
    else if (e.contact) target = e.contact;
    else if (e.time) target = e.time;
    else if (e.name) target = e.name;
    else if (e.thing) target = e.thing;

    return {
      reply,
      action,
      target,
      data: best.entities,
      confidence: best.score,
      offline: true,
    };
  }

  // Low confidence — generate intelligent fallback
  const nouns = doc.nouns().out('array') as string[];
  const verbs = doc.verbs().out('array') as string[];
  const topics = [...nouns, ...verbs].filter(w => w.length > 3).slice(0, 3);

  let reply: string;
  if (topics.length > 0) {
    reply = `I understand you're asking about "${topics.join(', ')}", ${userName}. For detailed information, please connect online. Offline I handle commands and quick facts.`;
  } else {
    const idx = Math.floor(Math.random() * FALLBACK_RESPONSES.length);
    reply = FALLBACK_RESPONSES[idx](userName);
  }

  return {
    reply,
    action: null,
    target: null,
    data: {},
    confidence: 0.3,
    offline: true,
  };
}

// ─── Check if text needs online AI ───────────────────────────────────────────

export function needsOnlineAI(text: string): boolean {
  const scored = scoreIntents(text);
  if (scored.length > 0 && scored[0].score >= 0.85) return false;
  return true;
}
