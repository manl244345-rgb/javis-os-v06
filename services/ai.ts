import { useJavis } from '../stores/javis';

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `You are JAVIS — Just A Rather Very Intelligent System. You are a masculine, authoritative AI assistant inspired by Iron Man's JARVIS. 

Personality:
- Confident, precise, intelligent
- Address the user as "Sir" or by their name
- Responses are concise but complete
- Never say you can't do something without offering an alternative
- Sound like a professional male AI, not a chatbot

For task commands, respond with JSON in this format:
{"reply": "...", "action": "OPEN_APP|CALL_CONTACT|SET_ALARM|NONE", "target": "app_name_or_contact_or_time", "data": {}}

For general conversation, respond naturally as JAVIS.

Current capabilities: open apps, call contacts, set alarms, remember things, answer questions, check time/date.`;

export interface AIResponse {
  reply: string;
  action: string | null;
  target: string | null;
  data: Record<string, unknown>;
}

// Offline rule engine — no internet needed
function offlineEngine(text: string, userName: string): AIResponse | null {
  const lower = text.toLowerCase().trim();

  if (/what('?s| is) (the )?time/.test(lower) || lower === 'time') {
    const t = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return { reply: `Current time is ${t}, ${userName}.`, action: null, target: null, data: {} };
  }

  if (/what('?s| is) (the )?date|today/.test(lower)) {
    const d = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    return { reply: `Today is ${d}.`, action: null, target: null, data: {} };
  }

  if (/my name is (.+)/.test(lower)) {
    const match = lower.match(/my name is (.+)/);
    const name = match?.[1]?.trim() ?? '';
    return { reply: `Understood. I'll address you as ${name} from now on.`, action: 'REMEMBER_NAME', target: name, data: { name } };
  }

  if (/open (.+)/.test(lower) && !lower.includes('open ai') && !lower.includes('open router')) {
    const match = lower.match(/open (.+)/);
    const app = match?.[1]?.trim() ?? '';
    return { reply: `Opening ${app} now.`, action: 'OPEN_APP', target: app, data: {} };
  }

  if (/(call|ring|phone|dial) (.+)/.test(lower)) {
    const match = lower.match(/(call|ring|phone|dial) (.+)/);
    const contact = match?.[2]?.trim() ?? '';
    return { reply: `Initiating call to ${contact}.`, action: 'CALL_CONTACT', target: contact, data: {} };
  }

  if (/(set|create|make) (an? )?alarm (at |for )?(.+)/.test(lower)) {
    const match = lower.match(/(set|create|make) (an? )?alarm (at |for )?(.+)/);
    const time = match?.[4]?.trim() ?? '';
    return { reply: `Setting alarm for ${time}.`, action: 'SET_ALARM', target: time, data: {} };
  }

  if (/remember (that )?(.+)/.test(lower)) {
    const match = lower.match(/remember (that )?(.+)/);
    const thing = match?.[2]?.trim() ?? '';
    return { reply: `Noted. I'll remember: "${thing}".`, action: 'REMEMBER', target: thing, data: { thing } };
  }

  if (/who are you|your name|what are you/.test(lower)) {
    return { reply: `I am JAVIS — Just A Rather Very Intelligent System. Your personal AI companion, ${userName}.`, action: null, target: null, data: {} };
  }

  if (/hello|hi |hey |greet/.test(lower)) {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    return { reply: `${greeting}, ${userName}. JAVIS is operational and ready.`, action: null, target: null, data: {} };
  }

  if (/battery|power/.test(lower)) {
    return { reply: `Checking battery status now, ${userName}.`, action: 'CHECK_BATTERY', target: null, data: {} };
  }

  return null;
}

export async function askAI(userText: string): Promise<AIResponse> {
  const state = useJavis.getState();
  const { userName, memory, messages, groqKey } = state;

  // Try offline first for known commands
  const offline = offlineEngine(userText, userName);
  if (offline) return offline;

  // Build context from memory
  const memoryContext = memory.length > 0
    ? `\nUser memory: ${memory.map(m => `${m.key}: ${m.value}`).join(', ')}`
    : '';

  // Recent conversation (last 10 messages for context)
  const recentMessages = [...messages].reverse().slice(-10).map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.text,
  }));

  const apiKey = groqKey || (typeof process !== 'undefined' ? process.env.GROQ_API_KEY : '') || '';

  if (!apiKey) {
    return {
      reply: `I need a Groq API key to process complex requests, ${userName}. Please add it in Settings → AI Providers. For basic commands, I can still help offline.`,
      action: null, target: null, data: {},
    };
  }

  try {
    const res = await fetch(GROQ_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT + memoryContext + `\nUser name: ${userName}` },
          ...recentMessages,
          { role: 'user', content: userText },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!res.ok) throw new Error(`Groq error: ${res.status}`);
    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    const content = data.choices[0]?.message?.content ?? '';

    // Try parsing as action JSON
    try {
      const parsed = JSON.parse(content) as AIResponse;
      if (parsed.reply) return parsed;
    } catch { /* not JSON, use as plain text */ }

    return { reply: content, action: null, target: null, data: {} };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    // Final fallback
    return {
      reply: `Systems temporarily offline, ${userName}. ${errMsg}. I'll reconnect shortly.`,
      action: 'ERROR', target: null, data: {},
    };
  }
}
