import { LibSQLVector } from '@mastra/libsql';
import { config } from '../config';

export const architectureVectorStore = new LibSQLVector({
  id: 'architecture-vector-store',
  url: config.vector.databaseUrl,
});
