import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { architectAgent } from './architect-agent';
import { architectWorkspace, architectureVectorStore } from './workspace';

export const mastra = new Mastra({
  agents: { architectAgent },
  storage: new LibSQLStore({
    id: 'architect-storage',
    url: process.env.MASTRA_DATABASE_URL ?? 'file:./architect.db',
  }),
  workspace: architectWorkspace,
  vectors: {
    architecture: architectureVectorStore,
  },
});
