import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { createTelegramAdapter } from '@chat-adapter/telegram';
import type { ChannelHandler, ChannelHandlers } from '@mastra/core/channels';
import { config } from './config';
import { isSessionCommand, requestsPdf } from './telegram-utils';
import { runRequirementsThenSdlc } from './workflow';

const busy = new Set<string>();
const help = 'Send a project brief; prefix /finance for a financial project (20-18,000 characters). Agent (i) extracts requirements; agent (ii) explains a ranked SDLC and delivery workflow. Add /pdf to receive the PDF. Reports are drafts for human review. Each message starts an independent run; to refine, resend the full brief with your changes.';
const handler: ChannelHandler = async (thread, message) => {
  if(!config.telegram.allowedUserIds.includes(String(message.author.userId))){await thread.post({markdown:'Access to this bot is not enabled for your Telegram account.'});return;}
  const text = message.text.trim();
  if (isSessionCommand(text)) { await thread.post({ markdown: help }); return; }
  if (busy.has(thread.id)) { await thread.post({ markdown: 'A run is already processing in this thread. Wait for it to finish.' }); return; }
  busy.add(thread.id);
  try {
    const finance=/^\/finance(?:\s|$)/i.test(text);
    const prompt = text.replace(/^\/finance\b/i,' ').replace(/(^|\s)\/pdf\b/gi, ' ').trim();
    if (prompt.length < 20 || prompt.length > 18000) { await thread.post({ markdown: help }); return; }
    await thread.post({ markdown: 'Analysing requirements, checking traceability, then ranking SDLC models...' });
    const result = await runRequirementsThenSdlc(prompt,finance?{domain:'finance',useCase:'other',regulatedEntity:'unknown'}:{});
    const path = requestsPdf(text) ? result.pdfPath : result.markdownPath;
    await thread.post({ markdown: `Requirements and SDLC draft generated. Run: ${result.runId}. Human review is required.`, files: [{ data: await readFile(path), filename: basename(path), mimeType: requestsPdf(text) ? 'application/pdf' : 'text/markdown' }] });
  } catch (error) {
    console.error('[telegram-ecommerce] request failed:', error instanceof Error ? error.message : 'Unknown error');
    await thread.post({ markdown: 'Analysis failed. Check LM Studio connectivity, structured-output support, and the server log. No successful report was produced.' });
  } finally { busy.delete(thread.id); }
};
const slashHandler: NonNullable<ChannelHandlers['onSlashCommand']> = async (_event, defaultHandler) => { await defaultHandler(); };
export const telegramChannels = config.telegram.botToken ? {
  adapters: { telegram: { adapter: createTelegramAdapter({ botToken: config.telegram.botToken, userName: config.telegram.botUsername, mode: config.telegram.mode, longPolling: { deleteWebhook: false, retryDelayMs: 5000 } }), streaming: false, toolDisplay: 'text' as const } },
  handlers: { onDirectMessage: handler, onMention: false as const, onSubscribedMessage: false as const, onSlashCommand: slashHandler },
  resolveResourceId: ({ message }: { message: typeof import('chat').Message.prototype }) => `telegram:${message.author.userId}`,
  resolveThreadId: ({ thread }: { thread: import('chat').Thread }) => `telegram:${thread.id}`,
} : undefined;
