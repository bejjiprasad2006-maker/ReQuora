import { createTelegramAdapter } from '@chat-adapter/telegram';
import { Agent } from '@mastra/core/agent';
import type { ChannelHandler } from '@mastra/core/channels';
import { Memory } from '@mastra/memory';
import { config } from './config';
import { chatModel } from './lm-studio';
import { ARCHITECT_PROMPT } from './prompts';

const WORKING_MEMORY_TEMPLATE = `# Project context
- Objective and confirmed requirements
- Constraints and decisions made
- Open questions`;

const COMPACT_CHECKPOINT_PROMPT =
  'Summarize this session: requirements, decisions, constraints, open questions, next action. Return only the checkpoint.';

export const architectMemory = new Memory({
  options: {
    lastMessages: 24,
    workingMemory: {
      enabled: true,
      scope: 'resource',
      template: WORKING_MEMORY_TEMPLATE,
    },
  },
});

const mastraThreadId = (platformThreadId: string) =>
  `telegram:${platformThreadId}`;

const resourceId = (telegramUserId: string) =>
  `telegram:${telegramUserId}`;

const telegramMessageHandler: ChannelHandler = async (
  thread,
  message,
  defaultHandler,
) => {
  const command = message.text.trim().split(/\s+/, 1)[0]?.toLowerCase();
  const threadId = mastraThreadId(thread.id);
  const userResourceId = resourceId(message.author.userId);

  if (command === '/new') {
    await architectMemory.deleteThread(threadId);
    await thread.post({
      markdown: 'New architect session started. What are we building?',
    });
    return;
  }

  if (command === '/compact') {
    const checkpoint = await architectAgent.generate(COMPACT_CHECKPOINT_PROMPT, {
      memory: { resource: userResourceId, thread: threadId },
    });

    await architectMemory.deleteThread(threadId);
    await architectAgent.generate(
      `Continue from this checkpoint:\n\n${checkpoint.text}`,
      { memory: { resource: userResourceId, thread: threadId } },
    );
    await thread.post({
      markdown: 'Session compacted. Important context has been preserved.',
    });
    return;
  }

  await defaultHandler(thread, message);
};

const telegramChannels = config.telegram.botToken
  ? {
      adapters: {
        telegram: {
          adapter: createTelegramAdapter({
            botToken: config.telegram.botToken,
            userName: config.telegram.botUsername,
            mode: config.telegram.mode,
          }),
          streaming: true,
          toolDisplay: 'text' as const,
        },
      },
      handlers: {
        onDirectMessage: telegramMessageHandler,
        onMention: telegramMessageHandler,
        onSubscribedMessage: telegramMessageHandler,
      },
      resolveResourceId: ({ message }: { message: typeof import('chat').Message.prototype }) =>
        resourceId(message.author.userId),
      resolveThreadId: ({ thread }: { thread: import('chat').Thread }) =>
        mastraThreadId(thread.id),
    }
  : undefined;

export const architectAgent = new Agent({
  id: 'architect-agent',
  name: 'AI Software Architect',
  description: 'A rigorous software architecture partner for designing and delivering production systems.',
  instructions: ARCHITECT_PROMPT,
  model: chatModel,
  defaultOptions: {
    modelSettings: {
      maxOutputTokens: 900,
    },
    providerOptions: {
      lmStudio: { reasoningEffort: 'medium' },
    },
  },
  memory: architectMemory,
  channels: telegramChannels,
});
