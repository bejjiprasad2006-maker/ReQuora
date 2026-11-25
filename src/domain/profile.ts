import { z } from 'zod';

export const domains = ['ecommerce', 'finance'] as const;
export const useCases = ['other', 'storefront', 'returns', 'digital-banking', 'loan-processing', 'payments', 'fraud-detection', 'insurance', 'investment', 'regulatory-reporting', 'customer-onboarding', 'financial-analytics'] as const;
export const regulatedEntities = ['unknown', 'not-applicable', 'commercial-bank', 'nbfc', 'payment-provider', 'insurer', 'securities-entity', 'other'] as const;
export const profileFields = {
  domain: z.enum(domains).optional(), useCase: z.enum(useCases).optional(), regulatedEntity: z.enum(regulatedEntities).optional(),
};
export type ProjectProfile = { domain: typeof domains[number]; useCase: typeof useCases[number]; regulatedEntity: typeof regulatedEntities[number] };
export const projectProfile = (input: Partial<ProjectProfile> = {}): ProjectProfile => {
  const parsed = z.object(profileFields).parse(input);
  const profile: ProjectProfile = { domain: parsed.domain ?? 'ecommerce', useCase: parsed.useCase ?? 'other', regulatedEntity: parsed.regulatedEntity ?? 'unknown' };
  if (profile.domain === 'finance' && ['storefront', 'returns'].includes(profile.useCase)) throw new Error('Choose a financial use case for a finance project.');
  if (profile.domain === 'ecommerce' && !['other', 'storefront', 'returns', 'payments'].includes(profile.useCase)) throw new Error('Choose an e-commerce use case or change the project domain to finance.');
  if (profile.domain === 'ecommerce' && !['unknown', 'not-applicable'].includes(profile.regulatedEntity)) throw new Error('A declared regulated financial entity requires the finance domain.');
  return profile;
};
