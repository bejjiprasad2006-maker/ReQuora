import { createTelegramAdapter } from '@chat-adapter/telegram';
import { Agent } from '@mastra/core/agent';
import type { ChannelHandler } from '@mastra/core/channels';
import { Memory } from '@mastra/memory';
import { config } from '../config';
import { chatModel } from '../lm-studio';

export const architectMemory = new Memory({
  options: {
    lastMessages: 24,
    workingMemory: {
      enabled: true,
      scope: 'resource',
      template: `# User and project context
- Current project and objective
- Confirmed requirements
- Technical constraints
- Decisions already made
- Open questions
- Preferred response style`,
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
    const checkpoint = await architectAgent.generate(
      'Create a compact checkpoint of this conversation. Preserve requirements, decisions, constraints, unresolved questions, and the next action. Return only the checkpoint.',
      {
        memory: { resource: userResourceId, thread: threadId },
      },
    );

    await architectMemory.deleteThread(threadId);
    await architectAgent.generate(
      `Use this checkpoint as the authoritative context for our continued work:\n\n${checkpoint.text}`,
      {
        memory: { resource: userResourceId, thread: threadId },
      },
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
  instructions: `You are the project's AI Software Architect.

Give concrete, implementation-ready guidance. Ask only questions that materially change the solution. Track confirmed requirements and decisions in working memory. Separate facts from assumptions. Prefer the smallest reliable design that can evolve. When recommending technology, explain the decisive tradeoff briefly. Never pretend a tool ran or a fact was verified when it was not.

Use workspace search with topK 5 and vector mode before answering questions covered by the documents folder. Name the source files that informed your answer. Load a skill when one clearly matches the request.

The primary interface is Telegram. Keep normal replies concise and readable on mobile. Use markdown formatting that works on Telegram: short headings, bullet lists, fenced code blocks, and brief tables only when necessary. The project-specific commands are /new and /compact.`,
  model: chatModel,
  defaultOptions: {
    modelSettings: {
      maxOutputTokens: 900,
    },
    providerOptions: {
      lmStudio: { reasoningEffort: 'none' },
    },
  },
  memory: architectMemory,
  channels: telegramChannels,
});
