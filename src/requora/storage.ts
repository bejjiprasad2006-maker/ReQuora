import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { workspaceRoot } from '../mastra/workspace';
import { renderFullReportHtml, renderFullReportMarkdown } from './export';
import type { ReQuoraRunRecord } from './types';

const dataDir = join(workspaceRoot, 'data');
const runsFile = join(dataDir, 'runs.json');
const artifactsDir = join(workspaceRoot, 'artifacts', 'requora');

export interface RunSummary {
  id: string;
  createdAt: string;
  projectName: string;
  brief: string;
  recommendedSdlc: string;
  recommendedPercentage: number;
  requirementCount: number;
  durationMs: number;
}

async function readAllRuns(): Promise<ReQuoraRunRecord[]> {
  try {
    const raw = await readFile(runsFile, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ReQuoraRunRecord[]) : [];
  } catch {
    return [];
  }
}

export async function listRunSummaries(): Promise<RunSummary[]> {
  const runs = await readAllRuns();
  return runs.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    projectName: r.projectName,
    brief: r.brief,
    recommendedSdlc: r.sdlc.recommendedName,
    recommendedPercentage: r.sdlc.recommendedPercentage,
    requirementCount: r.requirements.length,
    durationMs: r.durationMs,
  }));
}

export async function getRunById(id: string): Promise<ReQuoraRunRecord | null> {
  const runs = await readAllRuns();
  return runs.find((r) => r.id === id) ?? null;
}

export async function saveRun(record: ReQuoraRunRecord): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  await mkdir(artifactsDir, { recursive: true });

  const existing = await readAllRuns();
  // Keep latest 30 runs locally
  const updated = [record, ...existing.filter((r) => r.id !== record.id)].slice(0, 30);
  await writeFile(runsFile, JSON.stringify(updated, null, 2), 'utf8');

  const md = renderFullReportMarkdown(record);
  const html = renderFullReportHtml(record);
  await writeFile(join(artifactsDir, 'latest.md'), md, 'utf8');
  await writeFile(join(artifactsDir, 'latest.html'), html, 'utf8');
  await writeFile(join(artifactsDir, 'latest-srs.md'), record.srs.markdown, 'utf8');
}
