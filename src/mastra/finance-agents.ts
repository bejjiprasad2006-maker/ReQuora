import { Agent } from '@mastra/core/agent';
import { chatModel } from './lm-studio';
import { REQUIREMENTS_PROMPT, SDLC_PROMPT } from './prompts';
import { ragContextProcessor } from './rag';
import { architectWorkspace } from './workspace';

const options = {
  modelSettings: { maxOutputTokens: 3500 },
  providerOptions: { lmStudio: { reasoningEffort: 'none', enable_thinking: false } },
} as const;

export const requirementsAgent = new Agent({
  id: 'requirements-agent',
  name: 'ReQuora Requirements Agent',
  description: '(i) Generate detailed e-commerce overview and minimum 6+ IEEE 830-1998 requirements (no UML).',
  instructions: REQUIREMENTS_PROMPT,
  model: chatModel,
  defaultOptions: options,
  workspace: architectWorkspace,
  inputProcessors: [ragContextProcessor],
});

export const sdlcSelectionAgent = new Agent({
  id: 'sdlc-selection-agent',
  name: 'ReQuora SDLC Selection Agent',
  description: '(ii) Score all 6 SDLC models with percentages, justify the winner, and build the project workflow.',
  instructions: SDLC_PROMPT,
  model: chatModel,
  defaultOptions: {
    ...options,
    modelSettings: { maxOutputTokens: 3000 },
  },
  workspace: architectWorkspace,
  inputProcessors: [ragContextProcessor],
});
