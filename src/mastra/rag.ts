import type { InputProcessorOrWorkflow, ProcessInputArgs, ProcessInputResult } from '@mastra/core/processors';
import { searchEvidence, evidenceContext } from '../domain/retrieval';
import { redactSensitiveData } from '../domain/privacy';
import { workspaceRoot } from './workspace';

export const retrieveEvidence = (query: string) => searchEvidence(workspaceRoot, query);
export const formatEvidence = evidenceContext;
export const assertCorpusSearchable = async () => {
  if (!(await retrieveEvidence('ecommerce checkout inventory payment lifecycle')).length) throw new Error('E-commerce evidence corpus is missing or empty.');
};
export const ragContextProcessor = {
  id: 'ecommerce-rag-context', name: 'E-commerce RAG context',
  async processInput({ messages, systemMessages }: ProcessInputArgs): Promise<ProcessInputResult> {
    // The workflow has already redacted input and attached the exact audited evidence set.
    if (JSON.stringify(messages).includes('RIKU_EVIDENCE_ATTACHED')) return { messages, systemMessages };
    const safeMessages = messages.map(message => {
      if (message.role !== 'user') return message;
      const parts = message.content.parts.map(part => part.type === 'text' ? { ...part, text: redactSensitiveData(part.text).text } : part);
      return { ...message, content: { ...message.content, parts, content: typeof message.content.content === 'string' ? redactSensitiveData(message.content.content).text : message.content.content } };
    });
    const latest = [...safeMessages].reverse().find(message => message.role === 'user');
    const query = latest?.content.parts.flatMap(part => part.type === 'text' ? [part.text] : []).join('\n') ?? '';
    const domain = /"domain"\s*:\s*"finance"/.test(query) ? 'finance' : 'ecommerce';
    const evidence = await searchEvidence(workspaceRoot, query + ' software security SDLC', domain);
    return { messages: safeMessages, systemMessages: [...systemMessages, { role: 'system', content: formatEvidence(evidence) }] };
  },
} as InputProcessorOrWorkflow;
