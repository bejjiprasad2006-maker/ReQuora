import type { ReQuoraRunRecord } from './types';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderFullReportMarkdown(run: ReQuoraRunRecord): string {
  const lines: string[] = [];

  lines.push(`# ReQuora AI — Complete E-Commerce Engineering Specification`);
  lines.push('');
  lines.push(`**Project:** ${run.projectName}`);
  lines.push(`**Domain:** E-Commerce`);
  lines.push(`**Generated:** ${run.createdAt}`);
  lines.push(`**Input Brief:** ${run.brief}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Part 1: Detailed Project Overview
  lines.push('## Part 1: Detailed Project Overview');
  lines.push('');
  lines.push(`### Executive Summary\n${run.overview.executiveSummary}\n`);
  lines.push(`### Business Case\n${run.overview.businessCase}\n`);
  lines.push(`### Operational Concept\n${run.overview.operationalConcept}\n`);

  lines.push('### In-Scope Capabilities');
  run.overview.inScope.forEach((item) => lines.push(`- ${item}`));
  lines.push('');

  lines.push('### Out-of-Scope Boundaries');
  run.overview.outOfScope.forEach((item) => lines.push(`- ${item}`));
  lines.push('');

  lines.push('### Stakeholders');
  lines.push('| Role | Description | Proficiency | Primary Concerns |');
  lines.push('| --- | --- | --- | --- |');
  run.overview.stakeholders.forEach((s) =>
    lines.push(`| ${s.role} | ${s.description} | ${s.technicalProficiency} | ${s.primaryConcerns} |`),
  );
  lines.push('');

  lines.push('### Assumptions & Constraints');
  run.overview.assumptions.forEach((a) =>
    lines.push(`- **${a.id}:** ${a.statement}${a.needsValidation ? ' `[NEEDS-VALIDATION]`' : ''}`),
  );
  run.overview.constraints.forEach((c) => lines.push(`- **Constraint:** ${c}`));
  lines.push('');
  lines.push('---');
  lines.push('');

  // Part 2: SDLC Recommendation & Percentages
  lines.push('## Part 2: SDLC Selection, Percentages & Comparative Justification');
  lines.push('');
  lines.push(`### Recommended SDLC: **${run.sdlc.recommendedName} (${run.sdlc.recommendedPercentage}%)**`);
  lines.push('');
  lines.push(run.sdlc.perfectFitSummary);
  lines.push('');

  lines.push('### All SDLC Models Ranked (MCDA Suitability Percentages)');
  lines.push('| Rank | SDLC Model | Suitability % | Status | Why It Fits / Why Not Primary |');
  lines.push('| --- | --- | --- | --- | --- |');
  run.sdlc.rankings.forEach((r) =>
    lines.push(
      `| #${r.rank} | **${r.name}** | **${r.percentage}%** | ${r.isRecommended ? 'RECOMMENDED' : 'Evaluated Alternative'} | ${r.whyFitsOrSummary} ${!r.isRecommended ? `**Not selected because:** ${r.whyNotChosenOrTradeoffs}` : ''} |`,
    ),
  );
  lines.push('');

  lines.push('### Project-Specific SDLC Workflow');
  run.sdlc.workflowPhases.forEach((p) => {
    lines.push(`#### ${p.phase}`);
    lines.push(`- **Objective:** ${p.objective}`);
    lines.push(`- **Activities:** ${p.activities.join('; ')}`);
    lines.push(`- **Roles:** ${p.roles.join(', ')}`);
    lines.push(`- **Deliverables:** ${p.deliverables.join(', ')}`);
    lines.push(`- **Security/Compliance Checkpoint:** ${p.securityComplianceCheckpoint}`);
    lines.push(`- **Entry Criteria:** ${p.entryCriteria}`);
    lines.push(`- **Exit Criteria:** ${p.exitCriteria}`);
    lines.push(`- **Requirements Covered:** ${p.requirementIds.join(', ')}`);
    lines.push('');
  });
  lines.push('---');
  lines.push('');

  // Part 3: Requirements Summary (Min 6+)
  lines.push(`## Part 3: Structured Requirements Summary (${run.requirements.length} Requirements)`);
  lines.push('');
  lines.push('| ID | Type | Category | Priority | Requirement Statement | Verification | Confidence |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  run.requirements.forEach((req) =>
    lines.push(
      `| **${req.id}** | ${req.type} | ${req.category} | ${req.priority} | ${req.statement.replace(/\|/g, '/')} | ${req.verificationMethod} | ${req.confidence}% |`,
    ),
  );
  lines.push('');
  lines.push('---');
  lines.push('');

  // Part 4: IEEE 830-1998 Standard SRS
  lines.push('## Part 4: IEEE 830-1998 Standard Software Requirements Specification');
  lines.push('');
  lines.push(run.srs.markdown);

  return lines.join('\n');
}

export function renderFullReportHtml(run: ReQuoraRunRecord): string {
  const markdown = renderFullReportMarkdown(run);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(run.projectName)} — ReQuora AI IEEE 830-1998 Specification</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.8.1/github-markdown.min.css" />
  <style>
    body { box-sizing: border-box; min-width: 240px; max-width: 1020px; margin: 0 auto; padding: 40px 28px; background: #ffffff; color: #111827; }
    .banner { border: 1px solid #e5e7eb; border-left: 5px solid #4f46e5; padding: 14px 18px; border-radius: 8px; margin-bottom: 24px; background: #f8fafc; font-family: system-ui, sans-serif; }
    .banner strong { color: #1e1b4b; }
    @media print { .no-print { display: none; } body { padding: 12px; } }
  </style>
</head>
<body class="markdown-body">
  <div class="banner">
    <strong>ReQuora AI</strong> • Domain: E-Commerce • Recommended SDLC: <strong>${escapeHtml(run.sdlc.recommendedName)} (${run.sdlc.recommendedPercentage}%)</strong> • ${run.requirements.length} Requirements • IEEE Std 830-1998
  </div>
  <div id="content"></div>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <script>
    document.getElementById('content').innerHTML = marked.parse(${JSON.stringify(markdown)});
  </script>
</body>
</html>`;
}
