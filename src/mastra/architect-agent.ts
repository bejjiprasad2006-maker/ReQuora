import { Agent } from '@mastra/core/agent';
import { chatModel } from './lm-studio';
import { telegramChannels } from './telegram-finance';

export const architectAgent = new Agent({
  id: 'requora-coordinator',
  name: 'ReQuora Coordinator',
  description: 'Entry coordinator for ReQuora AI (E-Commerce Requirements, SDLC Percentages, and IEEE 830-1998 SRS).',
  instructions:
    'Do not draft requirements or an SDLC yourself. Route briefs through the ReQuora AI workflow (requora-ecommerce-srs) or the web studio.',
  model: chatModel,
  defaultOptions: {
    modelSettings: { maxOutputTokens: 200 },
    providerOptions: { lmStudio: { reasoningEffort: 'none', enable_thinking: false } },
  },
  channels: telegramChannels,
});
