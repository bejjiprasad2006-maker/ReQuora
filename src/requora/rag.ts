import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { workspaceRoot } from '../mastra/workspace';

export interface EvidencePassage {
  id: string;
  excerpt: string;
  score: number;
}

interface CorpusChunk {
  id: string;
  text: string;
  tokens: Set<string>;
}

const MAX_EXCERPT_CHARS = 280;
const SKIP_PATTERN = /(?:clarify|specify|analyze)-command|finance[\\/]|problem-statement/i;

let cachedChunks: CorpusChunk[] | null = null;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);
}

async function collectTextFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTextFiles(fullPath)));
    } else if (/\.(txt|md)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

async function loadCorpus(): Promise<CorpusChunk[]> {
  if (cachedChunks) return cachedChunks;
  const ingestedDir = join(workspaceRoot, 'docs', 'ingested');
  const files = await collectTextFiles(ingestedDir);
  const chunks: CorpusChunk[] = [];

  for (const file of files) {
    const rel = relative(workspaceRoot, file).replace(/\\/g, '/');
    if (SKIP_PATTERN.test(rel)) continue;
    const content = await readFile(file, 'utf8').catch(() => '');
    if (!content.trim()) continue;

    // Split large files into ~1500-char overlapping chunks so small corpus queries stay fast
    // ponytail: in-memory BM25-style scan over ~15 files; upgrade to vector DB if corpus exceeds 500 docs.
    const normalized = content.replace(/\s+/g, ' ').trim();
    const step = 1300;
    const cap = Math.min(normalized.length, 15000);
    for (let offset = 0; offset < cap; offset += step) {
      const slice = normalized.slice(offset, offset + 1600);
      chunks.push({
        id: rel,
        text: slice,
        tokens: new Set(tokenize(slice)),
      });
    }
  }

  cachedChunks = chunks;
  return chunks;
}

export async function retrieveEcommerceEvidence(
  query: string,
  topK = 3,
): Promise<EvidencePassage[]> {
  const chunks = await loadCorpus();
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return [];

  const scored: EvidencePassage[] = [];
  const seenFiles = new Map<string, number>();

  for (const chunk of chunks) {
    let score = 0;
    for (const token of qTokens) {
      if (chunk.tokens.has(token)) {
        score += chunk.id.includes('docs/ingested/ecommerce/') ? 2.5 : 1;
      }
    }
    if (score > 0) {
      const count = seenFiles.get(chunk.id) ?? 0;
      if (count >= 2) continue;
      seenFiles.set(chunk.id, count + 1);
      scored.push({
        id: chunk.id,
        excerpt: chunk.text.slice(0, MAX_EXCERPT_CHARS),
        score,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

export function formatEvidenceBlock(passages: EvidencePassage[]): string {
  if (passages.length === 0) {
    return 'No local knowledge-base passages matched; mark unverified external thresholds NEEDS-VALIDATION.';
  }
  return passages
    .map((p, idx) => `[${idx + 1}] Source: ${p.id}\n${p.excerpt}`)
    .join('\n\n');
}
