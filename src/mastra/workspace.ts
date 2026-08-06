import { LocalFilesystem, Workspace } from '@mastra/core/workspace';
import { LibSQLVector } from '@mastra/libsql';
import { embedMany } from 'ai';
import { config } from './config';
import { embeddingModel } from './lm-studio';

export const architectureVectorStore = new LibSQLVector({
  id: 'architecture-vector-store',
  url: config.vector.databaseUrl,
});

export const architectWorkspace = new Workspace({
  id: 'architect-workspace',
  filesystem: new LocalFilesystem({ basePath: '.', readOnly: true }),
  vectorStore: architectureVectorStore,
  embedder: Object.assign(
    async (values: string[]) =>
      (await embedMany({ model: embeddingModel, values })).embeddings,
    { batch: true as const },
  ),
  searchIndexName: 'architect_docs',
  autoIndexPaths: ['docs'],
  skills: ['skills'],
  checkSkillFileMtime: true,
  tools: {
    enabled: false,
    mastra_workspace_search: { enabled: true },
  },
});
