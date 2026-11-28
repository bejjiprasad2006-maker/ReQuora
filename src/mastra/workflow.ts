import { join } from 'node:path';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { renderFullReportMarkdown } from '../requora/export';
import { runReQuoraPipeline } from '../requora/pipeline';
import { workspaceRoot } from './workspace';

const artifactsDir = join(workspaceRoot, 'artifacts', 'requora');

const runFullReQuora = createStep({
  id: 'run-requora-ecommerce-pipeline',
  description: 'Runs Overview, Requirements (min 6+), MCDA SDLC Percentages, and IEEE 830-1998 SRS (no UML).',
  inputSchema: z.object({ prompt: z.string() }),
  outputSchema: z.object({
    requirements: z.string(),
    sdlc: z.string(),
    document: z.string(),
    markdownPath: z.string(),
    htmlPath: z.string(),
  }),
  execute: async ({ inputData }) => {
    const run = await runReQuoraPipeline(inputData.prompt);
    const document = renderFullReportMarkdown(run);
    const requirements = run.requirements
      .map((r) => `- **${r.id} [${r.type}/${r.category}/${r.priority}]:** ${r.statement}`)
      .join('\n');
    const sdlc = `Recommended: **${run.sdlc.recommendedName} (${run.sdlc.recommendedPercentage}%)**\n\n${run.sdlc.perfectFitSummary}`;
    return {
      requirements,
      sdlc,
      document,
      markdownPath: join(artifactsDir, 'latest.md'),
      htmlPath: join(artifactsDir, 'latest.html'),
    };
  },
});

export const requirementsThenSdlc = createWorkflow({
  id: 'requora-ecommerce-srs',
  description:
    'ReQuora AI E-Commerce Pipeline: generates detailed overview, SDLC percentages & comparison, min 6+ requirements, and IEEE 830-1998 SRS (no UML).',
  inputSchema: z.object({ prompt: z.string() }),
  outputSchema: z.object({
    requirements: z.string(),
    sdlc: z.string(),
    document: z.string(),
    markdownPath: z.string(),
    htmlPath: z.string(),
  }),
})
  .then(runFullReQuora)
  .commit();

export const runRequirementsThenSdlc = async (prompt: string) => {
  const run = await requirementsThenSdlc.createRun();
  const result = await run.start({ inputData: { prompt } });
  if (result.status !== 'success') {
    const message = result.status === 'failed' ? result.error.message : result.status;
    throw new Error(`Workflow failed: ${message}`);
  }
  return result.result;
};
