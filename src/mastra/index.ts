import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { architectAgent } from './architect-agent';
import { requirementsAgent, sdlcSelectionAgent, qualityReviewAgent, clarificationAgent } from './ecommerce-agents';
import { assertCorpusSearchable } from './rag';
import { requirementsThenSdlc } from './workflow';
import { architectWorkspace } from './workspace';

export const mastra = new Mastra({
  server: { host: '127.0.0.1' },
  agents: { architectAgent, requirementsAgent, sdlcSelectionAgent, qualityReviewAgent, clarificationAgent },
  workflows: { requirementsThenSdlc },
  storage: new LibSQLStore({
    id: 'architect-storage',
    url: process.env.MASTRA_DATABASE_URL ?? 'file:./architect.db',
  }),
  workspace: architectWorkspace,
});

await architectWorkspace.init();
await assertCorpusSearchable();
