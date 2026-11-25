import { setDefaultResultOrder } from 'node:dns';

setDefaultResultOrder('ipv4first');

const value = (name: string, fallback?: string): string => {
  const configured = process.env[name]?.trim();
  if (configured) return configured;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${name}`);
};

const modelUrl=value('LM_STUDIO_BASE_URL','http://127.0.0.1:1234/v1');
const parsedModelUrl=new URL(modelUrl);
if(parsedModelUrl.protocol!=='https:'&&!(parsedModelUrl.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(parsedModelUrl.hostname)))throw new Error('Non-loopback model endpoints must use HTTPS.');
export const config = {
  lmStudio: {
    baseURL: modelUrl,
    apiKey: value('LM_STUDIO_API_KEY', 'lm-studio'),
    model: value('LM_STUDIO_MODEL', 'qwen/qwen3.5-9b'),
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN?.trim(),
    botUsername: process.env.TELEGRAM_BOT_USERNAME?.trim(),
    mode: value('TELEGRAM_MODE', 'polling') as 'auto' | 'polling' | 'webhook',
    allowedUserIds:(process.env.TELEGRAM_ALLOWED_USER_IDS??'').split(',').map(id=>id.trim()).filter(Boolean),
  },
};
