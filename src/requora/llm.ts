import { z } from 'zod';
import { config } from '../mastra/config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmHealthStatus {
  reachable: boolean;
  baseURL: string;
  configuredModel: string;
  availableModels: string[];
  error?: string;
}

const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?previous\s+instructions/gi,
  /disregard\s+system\s+prompt/gi,
  /<\/?system>/gi,
];

/**
 * Sanitizes user project briefs to prevent prompt injection and enforce length bounds.
 */
export function sanitizeUserBrief(raw: string): string {
  let cleaned = raw.replace(/\r\n/g, '\n').trim();
  for (const pattern of INJECTION_PATTERNS) {
    cleaned = cleaned.replace(pattern, '[filtered]');
  }
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  if (cleaned.length < 10) {
    throw new Error('Please enter a project brief of at least 10 characters (1-2 sentences describing your e-commerce project).');
  }
  if (cleaned.length > 1200) {
    cleaned = cleaned.slice(0, 1200).trim();
  }
  return cleaned;
}

/**
 * Removes any residual <think> blocks or extra blank lines from local LLM text output.
 */
export function stripThinkingTags(text: string): string {
  let out = text.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '');
  const unclosed = out.match(/<think\b[^>]*>([\s\S]*)$/i);
  if (unclosed) out = unclosed[1] ?? '';
  out = out.replace(/<\/?think\b[^>]*>/gi, '');
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

export async function checkLlmHealth(): Promise<LlmHealthStatus> {
  const baseURL = config.lmStudio.baseURL.replace(/\/+$/, '');
  try {
    const res = await fetch(`${baseURL}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.lmStudio.apiKey}`,
      },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      return {
        reachable: false,
        baseURL,
        configuredModel: config.lmStudio.model,
        availableModels: [],
        error: `HTTP ${res.status} from inference server`,
      };
    }
    const data = (await res.json()) as { data?: Array<{ id?: string }> };
    const availableModels = (data.data ?? [])
      .map((item) => item.id)
      .filter((id): id is string => Boolean(id));
    return {
      reachable: true,
      baseURL,
      configuredModel: config.lmStudio.model,
      availableModels,
    };
  } catch (err) {
    return {
      reachable: false,
      baseURL,
      configuredModel: config.lmStudio.model,
      availableModels: [],
      error: err instanceof Error ? err.message : 'Unable to reach inference server',
    };
  }
}

export async function callLlmText(
  messages: ChatMessage[],
  options: {
    maxTokens?: number;
    temperature?: number;
    timeoutMs?: number;
    onChunk?: (accumulatedChars: number) => void;
  } = {},
): Promise<string> {
  const baseURL = config.lmStudio.baseURL.replace(/\/+$/, '');
  const maxTokens = options.maxTokens ?? 2200;
  const temperature = options.temperature ?? 0.15;
  const timeoutMs = options.timeoutMs ?? 600_000;
  const startedAt = Date.now();

  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.lmStudio.apiKey}`,
    },
    body: JSON.stringify({
      model: config.lmStudio.model,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: true,
      reasoning_effort: 'none',
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`LLM server error (${response.status}): ${errBody.slice(0, 300)}`);
  }

  if (!response.body) {
    throw new Error('LLM server returned no stream body.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let contentAcc = '';
  let reasoningAcc = '';
  let finishReason = 'unknown';
  let lastReportChars = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) continue;
      const dataStr = line.slice(5).trim();
      if (!dataStr || dataStr === '[DONE]') continue;

      try {
        const chunk = JSON.parse(dataStr) as {
          choices?: Array<{
            finish_reason?: string | null;
            delta?: { content?: string; reasoning_content?: string };
          }>;
        };
        const choice = chunk.choices?.[0];
        if (choice?.finish_reason) finishReason = choice.finish_reason;
        const delta = choice?.delta;
        if (delta?.content) contentAcc += delta.content;
        if (delta?.reasoning_content) reasoningAcc += delta.reasoning_content;

        if (options.onChunk && contentAcc.length - lastReportChars >= 100) {
          lastReportChars = contentAcc.length;
          options.onChunk(contentAcc.length);
        }
      } catch {
        // ignore partial keepalive frames
      }
    }
  }

  const cleaned = stripThinkingTags(contentAcc.trim() || reasoningAcc.trim());
  console.log(
    `[ReQuora LLM] done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s, chars=${cleaned.length}, finish=${finishReason}`,
  );
  if (!cleaned) {
    throw new Error('LLM returned an empty response. Verify LM Studio has the model loaded.');
  }
  return cleaned;
}

/**
 * Deterministically extracts and repairs slightly malformed/truncated JSON without firing an extra slow LLM call.
 */
export function extractAndRepairJson(raw: string): string {
  const cleaned = stripThinkingTags(raw);
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : cleaned;

  const firstBrace = candidate.indexOf('{');
  const firstBracket = candidate.indexOf('[');
  let start = -1;
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    start = firstBrace;
  } else if (firstBracket !== -1) {
    start = firstBracket;
  }

  if (start === -1) {
    throw new Error('No JSON object or array found in model output.');
  }

  let jsonText = candidate.slice(start).trim();
  // Strip any trailing markdown fence if model started ```json without closing
  jsonText = jsonText.replace(/```[\s\S]*$/, '').trim();
  // Remove trailing commas before closing brackets/braces
  jsonText = jsonText.replace(/,\s*([}\]])/g, '$1');

  // First try direct parse on slice up to last matching closer
  const lastClose = Math.max(jsonText.lastIndexOf('}'), jsonText.lastIndexOf(']'));
  if (lastClose > 0) {
    const directSlice = jsonText.slice(0, lastClose + 1).replace(/,\s*([}\]])/g, '$1');
    try {
      JSON.parse(directSlice);
      return directSlice;
    } catch {
      // Fall through to deterministic structural repair
    }
  }

  // Deterministic structural balance repair for truncated JSON
  let inString = false;
  let escaped = false;
  const stack: string[] = [];
  for (let i = 0; i < jsonText.length; i++) {
    const ch = jsonText[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === '{') stack.push('}');
      else if (ch === '[') stack.push(']');
      else if ((ch === '}' || ch === ']') && stack.length > 0 && stack[stack.length - 1] === ch) {
        stack.pop();
      }
    }
  }

  let repaired = jsonText;
  if (inString) repaired += '"';
  // Remove dangling partial property or trailing comma/colon
  repaired = repaired.replace(/,\s*$/, '').replace(/:\s*$/, ': null');
  while (stack.length > 0) {
    repaired += stack.pop();
  }
  repaired = repaired.replace(/,\s*([}\]])/g, '$1');
  return repaired;
}

export async function callLlmJson<T>(
  messages: ChatMessage[],
  schema: z.ZodType<T>,
  options: {
    maxTokens?: number;
    temperature?: number;
    onChunk?: (accumulatedChars: number) => void;
  } = {},
): Promise<{ data: T; repaired: boolean }> {
  const raw = await callLlmText(messages, {
    maxTokens: options.maxTokens ?? 2200,
    temperature: options.temperature ?? 0.15,
    onChunk: options.onChunk,
  });

  const candidate = extractAndRepairJson(raw);
  const parsed = JSON.parse(candidate);
  return { data: schema.parse(parsed), repaired: candidate.length !== raw.trim().length };
}
