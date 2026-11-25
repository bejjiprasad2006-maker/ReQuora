import { requirementsAgent, sdlcSelectionAgent, qualityReviewAgent, clarificationAgent } from './ecommerce-agents';
import { generatedSpecificationSchema, sdlcSchema, semanticReviewSchema, interviewSchema } from '../domain/schemas';
import { config } from './config';
import type { AgentFunctions } from '../domain/analysis';

export const liveAgents: AgentFunctions = {
  inferenceKind:'model-inference',
  modelId:`${config.lmStudio.model}@${process.env.RIKU_MODEL_REVISION??'unversioned'}`,
  quality:async prompt=>semanticReviewSchema.parse((await qualityReviewAgent.generate(prompt,{structuredOutput:{schema:semanticReviewSchema},abortSignal:AbortSignal.timeout(600_000)})).object),
  clarify:async prompt=>interviewSchema.parse((await clarificationAgent.generate(prompt,{structuredOutput:{schema:interviewSchema},abortSignal:AbortSignal.timeout(300_000)})).object),
  requirements: async prompt => {
    const response = await requirementsAgent.generate(prompt, { structuredOutput: { schema: generatedSpecificationSchema }, abortSignal: AbortSignal.timeout(600_000) });
    return generatedSpecificationSchema.parse(response.object);
  },
  sdlc: async prompt => {
    const response = await sdlcSelectionAgent.generate(prompt, { structuredOutput: { schema: sdlcSchema }, abortSignal: AbortSignal.timeout(600_000) });
    return sdlcSchema.parse(response.object);
  },
};
