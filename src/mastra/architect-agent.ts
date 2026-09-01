import { Agent } from '@mastra/core/agent';
import { chatModel } from './lm-studio';
import { telegramChannels } from './telegram-finance';

export const architectAgent = new Agent({
  id: 'architect-agent',
  name: 'Riku Coordinator',
  description: 'Telegram entry: runs Requirements Agent then SDLC Selection Agent. Use the workflow in Studio for the same pipeline.',
  instructions: 'Do not draft requirements or an SDLC yourself. The Telegram handler runs the two-agent workflow.',
  model: chatModel,
  defaultOptions: {
    modelSettings: { maxOutputTokens: 200 },
    providerOptions: { lmStudio: { reasoningEffort: 'none', enable_thinking: false } },
  },
  channels: telegramChannels,
});
