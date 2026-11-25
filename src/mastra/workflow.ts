import { createStep, createWorkflow } from '@mastra/core/workflows';
import { briefSchema } from '../domain/schemas';
import { prepareAnalysis, extractRequirements, selectLifecycle, exportAnalysis, preparedSchema, extractedSchema, plannedSchema, outputSchema } from '../domain/analysis';
import { liveAgents } from './generation';
import { workspaceRoot } from './workspace';
import type { ProjectProfile } from '../domain/profile';

const prepare = createStep({
  id: 'prepare-ecommerce-brief', description: 'Validate and redact input; retrieve allowlisted domain evidence.',
  inputSchema: briefSchema, outputSchema: preparedSchema,
  execute: async ({ inputData }) => prepareAnalysis(inputData.prompt, workspaceRoot, [], inputData),
});
const requirements = createStep({
  id: 'list-requirements', description: 'Agent (i): structured requirements, stories, use cases, risks, factors and reference checks.',
  inputSchema: preparedSchema, outputSchema: extractedSchema,
  execute: async ({ inputData }) => extractRequirements(inputData, liveAgents),
});
const lifecycle = createStep({
  id: 'select-sdlc', description: 'Rank seven models, then Agent (ii) explains the choice and builds delivery gates.',
  inputSchema: extractedSchema, outputSchema: plannedSchema,
  execute: async ({ inputData }) => selectLifecycle(inputData, liveAgents),
});
const publish = createStep({
  id: 'write-review-artifacts', description: 'Export draft HTML, PDF, Markdown, JSON, traceability CSV and audit history.',
  inputSchema: plannedSchema, outputSchema,
  execute: async ({ inputData }) => exportAnalysis(inputData, workspaceRoot),
});
export const requirementsThenSdlc = createWorkflow({
  id: 'requirements-then-sdlc', description: 'Domain-specific requirements agent -> validation -> ranked SDLC agent -> review artifacts.',
  inputSchema: briefSchema, outputSchema,
}).then(prepare).then(requirements).then(lifecycle).then(publish).commit();

export const runRequirementsThenSdlc = async (prompt: string,profile:Partial<ProjectProfile>={}) => {
  const run = await requirementsThenSdlc.createRun();
  const result = await run.start({ inputData: { prompt,...profile } });
  if (result.status !== 'success') throw new Error(`Workflow failed: ${result.status === 'failed' ? result.error.message : result.status}`);
  return result.result;
};
