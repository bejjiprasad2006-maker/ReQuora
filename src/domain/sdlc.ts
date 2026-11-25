import { factorKeys, models, type DecisionFactors, type Model } from './schemas';

// Decision policy v2: sixteen explained factors. Scores are NOT probabilities.
export const profiles: Record<Model, readonly number[]> = {
  Agile: [4,1,2,1,3,4,1,0,0,0,1,1,3,4,0,1], DevSecOps: [3,4,1,3,4,3,2,2,2,2,3,3,2,3,2,3],
  Spiral: [3,4,4,3,1,3,4,2,1,3,4,4,1,1,3,4], 'V-Model': [0,3,1,4,0,2,3,4,4,4,3,3,2,1,4,4],
  Waterfall: [0,1,0,3,0,1,2,4,4,2,2,2,3,1,2,2], 'Agile + DevSecOps': [4,4,2,3,4,4,2,2,1,2,3,3,2,3,2,3],
  'Agile + V-Model': [3,3,2,4,2,3,3,4,2,4,3,3,2,2,4,4],
};
export const rankSdlc = (factors: DecisionFactors) => models.map(model => {
  const contributions = factorKeys.map((factor, index) => {
    const actual = factors[factor].rating, target = profiles[model][index]!;
    return { factor, actual, target, fit: 4 - Math.abs(actual - target), rationale: factors[factor].rationale, requirementIds: factors[factor].requirementIds };
  });
  const score = Math.round(contributions.reduce((sum, item) => sum + item.fit, 0) / (factorKeys.length * 4) * 100);
  return { model, score, contributions };
}).sort((a, b) => b.score - a.score || models.indexOf(a.model) - models.indexOf(b.model));
