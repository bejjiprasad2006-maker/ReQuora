import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { LocalFilesystem, Workspace } from '@mastra/core/workspace';

export const workspaceRoot = [
  process.env.REQUORA_WORKSPACE_ROOT,
  process.env.RIKU_WORKSPACE_ROOT,
  process.env.INIT_CWD,
  process.cwd(),
  resolve(process.cwd(), '../../..'),
].find((path): path is string => Boolean(path && existsSync(join(path, 'docs/ingested'))))
  ?? process.cwd();

export const architectWorkspace = new Workspace({
  id: 'requora-workspace',
  filesystem: new LocalFilesystem({ basePath: workspaceRoot, readOnly: true }),
  bm25: true,
  autoIndexPaths: [
    'docs/ingested/ecommerce/**/*.txt',
    'docs/ingested/product/**/*.txt',
    'docs/ingested/requirements/**/*.txt',
    'docs/ingested/security/**/*.txt',
  ],
  skills: ['skills'],
  tools: { enabled: false },
});
