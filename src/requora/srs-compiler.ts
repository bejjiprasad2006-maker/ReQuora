import type {
  DecisionTableRule,
  Ieee830ComplianceReport,
  Ieee830SrsDocument,
  ProjectOverview,
  RequirementItem,
} from './types';

export interface SrsSectionNarrative {
  purpose: string;
  audience: string[];
  definitions: Array<{ term: string; definition: string }>;
  references: Array<{ id: string; title: string; source: string }>;
  externalInterfaces: {
    userInterfaces: string;
    hardwareInterfaces: string;
    softwareInterfaces: string;
    communicationsInterfaces: string;
  };
  logicalDatabaseEntities: Array<{
    entity: string;
    description: string;
    keyAttributes: string[];
    relationships: string;
    retentionRule: string;
  }>;
  designConstraints: string[];
  decisionTableName: string;
  decisionTableConditions: string[];
  decisionTableRules: DecisionTableRule[];
}

const REQUIRED_SECTIONS = [
  '## Table of Contents',
  '## 1. Introduction',
  '### 1.1 Purpose',
  '### 1.2 Scope',
  '### 1.3 Definitions, Acronyms, and Abbreviations',
  '### 1.4 References',
  '### 1.5 Overview',
  '## 2. Overall Description',
  '### 2.1 Product Perspective',
  '### 2.2 Product Functions',
  '### 2.3 User Characteristics',
  '### 2.4 Constraints',
  '### 2.5 Assumptions and Dependencies',
  '## 3. Specific Requirements',
  '### 3.1 External Interfaces',
  '### 3.2 Functions',
  '### 3.3 Performance Requirements',
  '### 3.4 Logical Database Requirements',
  '### 3.5 Design Constraints',
  '### 3.6 Software System Quality Attributes',
  '## Appendices',
  '## Index',
];

const UML_FORBIDDEN_PATTERN =
  /^\s*#{2,4}\s*3\.7\b|^\s*#{2,4}\s*object-oriented models\b|```(?:mermaid|plantuml|uml)\b/im;

export function stripAnyUmlBlocks(markdown: string): string {
  return markdown
    .replace(/```(?:mermaid|plantuml|uml)[\s\S]*?```/gi, '')
    .replace(/###\s*3\.7[^\n]*[\s\S]*?(?=\n##\s|$)/gi, '')
    .trim();
}

export function validateIeee830Srs(
  markdown: string,
  requirements: RequirementItem[],
): Ieee830ComplianceReport {
  const missingSections = REQUIRED_SECTIONS.filter((heading) => !markdown.includes(heading));
  const frCount = requirements.filter((r) => r.type === 'FR').length;
  const hasMinReqs = requirements.length >= 6 && frCount >= 6;
  const umlExcluded = !UML_FORBIDDEN_PATTERN.test(markdown);

  const perfSectionMatch = markdown.match(/### 3\.3 Performance Requirements([\s\S]*?)### 3\.4/);
  const hasMeasurablePerf = Boolean(
    perfSectionMatch && /\d+\s*(?:%|ms|sec|second|seconds|rps|users|req)/i.test(perfSectionMatch[1]),
  );

  const hasRtm = markdown.includes('### Appendix A: Requirements Traceability Matrix');
  const allIdsInRtm = requirements.every((req) => markdown.includes(req.id));

  const checks = [
    {
      name: 'IEEE 830-1998 Section Structure (1.1–1.5, 2.1–2.5, 3.1–3.6, Appendices, Index)',
      passed: missingSections.length === 0,
      detail:
        missingSections.length === 0
          ? 'All 22 required IEEE 830-1998 sections and headings verified.'
          : `Missing: ${missingSections.join(', ')}`,
    },
    {
      name: 'Minimum 6 Requirements (Black-Box Functional + Non-Functional)',
      passed: hasMinReqs,
      detail: `${frCount} functional requirements and ${requirements.length - frCount} non-functional requirements (${requirements.length} total, minimum 6 satisfied).`,
    },
    {
      name: 'UML Exclusion Rule',
      passed: umlExcluded,
      detail: umlExcluded
        ? 'No UML diagrams or Section 3.7 Object-Oriented Models included.'
        : 'Detected forbidden UML reference or diagram block.',
    },
    {
      name: 'Verifiable & Measurable Performance / Quality Targets',
      passed: hasMeasurablePerf,
      detail: hasMeasurablePerf
        ? 'Numeric latency, throughput, or availability thresholds present.'
        : 'Performance section lacks explicit numeric thresholds.',
    },
    {
      name: 'Requirements Traceability Matrix (RTM) Coverage',
      passed: hasRtm && allIdsInRtm,
      detail:
        hasRtm && allIdsInRtm
          ? `100% of ${requirements.length} requirement IDs mapped in Appendix A.`
          : 'Some requirement IDs are missing from the Traceability Matrix.',
    },
  ];

  return {
    isCompliant: checks.every((c) => c.passed),
    umlExcluded,
    requirementCount: requirements.length,
    functionalRequirementCount: frCount,
    missingSections,
    checks,
  };
}

export function compileIeee830SrsDocument(params: {
  overview: ProjectOverview;
  requirements: RequirementItem[];
  narrative: SrsSectionNarrative;
  evidenceCitations: string[];
}): Ieee830SrsDocument {
  const { overview, requirements, narrative, evidenceCitations } = params;
  const dateStr = new Date().toISOString().slice(0, 10);
  const docId = `SRS-RQ-${dateStr.replace(/-/g, '')}`;
  const title = `Software Requirements Specification (SRS) — ${overview.projectName}`;

  const frs = requirements.filter((r) => r.type === 'FR');
  const nfrs = requirements.filter((r) => r.type !== 'FR');

  const perfNfrs = nfrs.filter((r) => r.category === 'Performance' || r.category === 'Availability');
  const qualityNfrs = nfrs.filter((r) => r.category !== 'Performance' && r.category !== 'Availability');

  const combinedReferences = [
    {
      id: 'REF-1',
      title: 'IEEE Std 830-1998 — IEEE Recommended Practice for Software Requirements Specifications',
      source: 'IEEE Computer Society (No-UML Profile)',
    },
    ...narrative.references,
    ...evidenceCitations.slice(0, 5).map((path, i) => ({
      id: `REF-KB-${i + 1}`,
      title: `Grounded Knowledge Base Evidence (${path.split('/').pop()})`,
      source: path,
    })),
  ];

  const lines: string[] = [];

  // Title & Metadata
  lines.push(`# ${title}`);
  lines.push('');
  lines.push('| Document Attribute | Value |');
  lines.push('| --- | --- |');
  lines.push(`| **Document ID** | \`${docId}\` |`);
  lines.push(`| **Version** | 1.0 (Baseline Draft) |`);
  lines.push(`| **Date** | ${dateStr} |`);
  lines.push(`| **Standard** | IEEE Std 830-1998 (UML Omitted per Specification Profile) |`);
  lines.push(`| **Domain** | E-Commerce |`);
  lines.push(`| **Prepared By** | ReQuora AI Requirements Engineering Platform |`);
  lines.push(`| **Project Brief** | ${overview.brief} |`);
  lines.push('');

  // Table of Contents
  lines.push('## Table of Contents');
  lines.push('');
  lines.push('1. [1. Introduction](#1-introduction)');
  lines.push('   - 1.1 [Purpose](#11-purpose)');
  lines.push('   - 1.2 [Scope](#12-scope)');
  lines.push('   - 1.3 [Definitions, Acronyms, and Abbreviations](#13-definitions-acronyms-and-abbreviations)');
  lines.push('   - 1.4 [References](#14-references)');
  lines.push('   - 1.5 [Overview](#15-overview)');
  lines.push('2. [2. Overall Description](#2-overall-description)');
  lines.push('   - 2.1 [Product Perspective](#21-product-perspective)');
  lines.push('   - 2.2 [Product Functions](#22-product-functions)');
  lines.push('   - 2.3 [User Characteristics](#23-user-characteristics)');
  lines.push('   - 2.4 [Constraints](#24-constraints)');
  lines.push('   - 2.5 [Assumptions and Dependencies](#25-assumptions-and-dependencies)');
  lines.push('3. [3. Specific Requirements](#3-specific-requirements)');
  lines.push('   - 3.1 [External Interfaces](#31-external-interfaces)');
  lines.push('   - 3.2 [Functions](#32-functions)');
  lines.push('   - 3.3 [Performance Requirements](#33-performance-requirements)');
  lines.push('   - 3.4 [Logical Database Requirements](#34-logical-database-requirements)');
  lines.push('   - 3.5 [Design Constraints](#35-design-constraints)');
  lines.push('   - 3.6 [Software System Quality Attributes](#36-software-system-quality-attributes)');
  lines.push('4. [Appendices](#appendices)');
  lines.push('   - Appendix A: Requirements Traceability Matrix');
  lines.push('   - Appendix B: Decision Table for Complex E-Commerce Logic');
  lines.push('   - Appendix C: Risk & Compliance Control Mapping');
  lines.push('5. [Index](#index)');
  lines.push('');

  // Section 1
  lines.push('## 1. Introduction');
  lines.push('');
  lines.push('### 1.1 Purpose');
  lines.push('');
  lines.push(narrative.purpose);
  lines.push('');
  lines.push('**Intended Audience:**');
  for (const aud of narrative.audience) {
    lines.push(`- ${aud}`);
  }
  lines.push('');

  lines.push('### 1.2 Scope');
  lines.push('');
  lines.push(`**System Name:** ${overview.projectName}`);
  lines.push('');
  lines.push(overview.executiveSummary);
  lines.push('');
  lines.push('**What the System Will Do (In-Scope):**');
  for (const item of overview.inScope) {
    lines.push(`- ${item}`);
  }
  lines.push('');
  lines.push('**What the System Will Not Do (Out-of-Scope):**');
  for (const item of overview.outOfScope) {
    lines.push(`- ${item}`);
  }
  lines.push('');

  lines.push('### 1.3 Definitions, Acronyms, and Abbreviations');
  lines.push('');
  lines.push('| Term / Acronym | Definition |');
  lines.push('| --- | --- |');
  for (const def of narrative.definitions) {
    lines.push(`| **${def.term.replace(/\|/g, '/')}** | ${def.definition.replace(/\|/g, '/')} |`);
  }
  lines.push('');

  lines.push('### 1.4 References');
  lines.push('');
  lines.push('| Ref ID | Document / Standard | Source |');
  lines.push('| --- | --- | --- |');
  for (const ref of combinedReferences) {
    lines.push(`| ${ref.id} | ${ref.title.replace(/\|/g, '/')} | \`${ref.source.replace(/\|/g, '/')}\` |`);
  }
  lines.push('');

  lines.push('### 1.5 Overview');
  lines.push('');
  lines.push(
    'This SRS is organized in accordance with IEEE Std 830-1998 (No-UML Profile). Section 1 establishes the purpose, scope, glossary, and reference baseline. Section 2 presents the black-box overall product perspective, high-level e-commerce capabilities, user classes, constraints, and labeled assumptions. Section 3 details all verifiable external interfaces, functional requirements (minimum 6), performance targets, logical database entities, design constraints, and system quality attributes. The Appendices provide full requirement traceability, a decision table for complex e-commerce logic, and risk/compliance mappings, followed by an Index.',
  );
  lines.push('');

  // Section 2
  lines.push('## 2. Overall Description');
  lines.push('');
  lines.push('### 2.1 Product Perspective');
  lines.push('');
  lines.push(`**Business Case:** ${overview.businessCase}`);
  lines.push('');
  lines.push(`**Operational Concept:** ${overview.operationalConcept}`);
  lines.push('');
  lines.push(
    'The system operates as an externally observable black-box e-commerce platform interacting with shoppers, merchants, administrators, PCI-DSS compliant payment gateways, shipping/logistics providers, and notification services over authenticated HTTPS APIs.',
  );
  lines.push('');

  lines.push('### 2.2 Product Functions');
  lines.push('');
  lines.push('At a high level, the platform provides the following major e-commerce functions:');
  for (const fr of frs) {
    lines.push(`- **${fr.id} — ${fr.title}:** ${fr.overview}`);
  }
  lines.push('');

  lines.push('### 2.3 User Characteristics');
  lines.push('');
  lines.push('| User Class | Role Description | Technical Proficiency | Primary Concerns |');
  lines.push('| --- | --- | --- | --- |');
  for (const st of overview.stakeholders) {
    lines.push(
      `| **${st.role.replace(/\|/g, '/')}** | ${st.description.replace(/\|/g, '/')} | ${st.technicalProficiency.replace(/\|/g, '/')} | ${st.primaryConcerns.replace(/\|/g, '/')} |`,
    );
  }
  lines.push('');

  lines.push('### 2.4 Constraints');
  lines.push('');
  for (const c of overview.constraints) {
    lines.push(`- ${c}`);
  }
  lines.push('');

  lines.push('### 2.5 Assumptions and Dependencies');
  lines.push('');
  for (const a of overview.assumptions) {
    lines.push(
      `- **${a.id}:** ${a.statement}${a.needsValidation ? ' `[NEEDS-VALIDATION]`' : ''}`,
    );
  }
  lines.push('');

  // Section 3
  lines.push('## 3. Specific Requirements');
  lines.push('');
  lines.push('### 3.1 External Interfaces');
  lines.push('');
  lines.push(`- **3.1.1 User Interfaces:** ${narrative.externalInterfaces.userInterfaces}`);
  lines.push(`- **3.1.2 Hardware Interfaces:** ${narrative.externalInterfaces.hardwareInterfaces}`);
  lines.push(`- **3.1.3 Software Interfaces:** ${narrative.externalInterfaces.softwareInterfaces}`);
  lines.push(`- **3.1.4 Communications Interfaces:** ${narrative.externalInterfaces.communicationsInterfaces}`);
  lines.push('');

  lines.push('### 3.2 Functions');
  lines.push('');
  lines.push(
    `Each functional requirement below is specified as a black-box stimulus-response contract (${frs.length} functional requirements specified; minimum 6 required).`,
  );
  lines.push('');

  for (const fr of frs) {
    lines.push(`#### ${fr.id}: ${fr.title}`);
    lines.push(`- **Priority:** ${fr.priority} | **Category:** ${fr.category} | **Source:** ${fr.stakeholderSource} | **Confidence:** ${fr.confidence}%`);
    lines.push(`- **Requirement Statement:** ${fr.statement}`);
    lines.push(`- **Overview:** ${fr.overview}`);
    lines.push(`- **Inputs:** ${fr.inputs}`);
    lines.push(`- **Processing & Abnormal Situations:** ${fr.processingAndErrors}`);
    lines.push(`- **Outputs:** ${fr.outputs}`);
    lines.push(`- **Acceptance Criteria:**`);
    for (const ac of fr.acceptanceCriteria) {
      lines.push(`  - ${ac}`);
    }
    lines.push(`- **Verification Method:** ${fr.verificationMethod} | **Compliance/Evidence:** \`${fr.complianceRef}\` (${fr.citation})`);
    lines.push('');
  }

  lines.push('### 3.3 Performance Requirements');
  lines.push('');
  if (perfNfrs.length > 0) {
    for (const nfr of perfNfrs) {
      lines.push(`- **${nfr.id} (${nfr.title} — ${nfr.priority}):** ${nfr.statement} *Verification:* ${nfr.verificationMethod} (${nfr.acceptanceCriteria.join('; ')}).`);
    }
  } else {
    lines.push(
      '- **PERF-001:** 90% of catalog search and product-detail requests shall return a response within 1.0 second under peak seasonal load.',
    );
    lines.push(
      '- **PERF-002:** Checkout payment-intent initiation shall complete within 2.0 seconds at p95 latency with idempotent retry support.',
    );
  }
  lines.push('');

  lines.push('### 3.4 Logical Database Requirements');
  lines.push('');
  lines.push(
    'The logical data model is expressed in structured tabular form (UML class/ER diagrams are intentionally omitted per specification profile):',
  );
  lines.push('');
  lines.push('| Entity | Purpose | Key Attributes | Logical Relationships | Integrity & Retention |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const entity of narrative.logicalDatabaseEntities) {
    lines.push(
      `| **${entity.entity.replace(/\|/g, '/')}** | ${entity.description.replace(/\|/g, '/')} | ${entity.keyAttributes.join(', ').replace(/\|/g, '/')} | ${entity.relationships.replace(/\|/g, '/')} | ${entity.retentionRule.replace(/\|/g, '/')} |`,
    );
  }
  lines.push('');

  lines.push('### 3.5 Design Constraints');
  lines.push('');
  for (const dc of narrative.designConstraints) {
    lines.push(`- ${dc}`);
  }
  lines.push('');

  lines.push('### 3.6 Software System Quality Attributes');
  lines.push('');
  if (qualityNfrs.length > 0) {
    for (const q of qualityNfrs) {
      lines.push(
        `- **${q.id} [${q.category}] (${q.title} — ${q.priority}):** ${q.statement} *Acceptance:* ${q.acceptanceCriteria.join('; ')}. *Verification:* ${q.verificationMethod}. *Ref:* \`${q.complianceRef}\``,
      );
    }
  } else {
    lines.push(
      '- **QUAL-001 [Security]:** All payment card operations shall use tokenized gateway sessions without storing raw PAN/CVV on platform servers (PCI-DSS v4.0).',
    );
  }
  lines.push('');

  // Appendices
  lines.push('## Appendices');
  lines.push('');
  lines.push('### Appendix A: Requirements Traceability Matrix');
  lines.push('');
  lines.push('| Req ID | Type | Category | Priority | Stakeholder Source | Compliance / Evidence | Verification |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const r of requirements) {
    lines.push(
      `| **${r.id}** | ${r.type} | ${r.category} | ${r.priority} | ${r.stakeholderSource.replace(/\|/g, '/')} | \`${r.complianceRef.replace(/\|/g, '/')}\` | ${r.verificationMethod} |`,
    );
  }
  lines.push('');

  lines.push('### Appendix B: Decision Table for Complex E-Commerce Logic');
  lines.push('');
  lines.push(`**Rule Domain:** ${narrative.decisionTableName}`);
  lines.push('');
  const condHeaders = narrative.decisionTableConditions;
  lines.push(`| Rule / Scenario | ${condHeaders.join(' | ')} | System Actions |`);
  lines.push(`| --- | ${condHeaders.map(() => '---').join(' | ')} | --- |`);
  for (const rule of narrative.decisionTableRules) {
    const condCells = condHeaders.map((c) => (rule.conditions[c] ?? '—').replace(/\|/g, '/'));
    lines.push(
      `| **${rule.scenario.replace(/\|/g, '/')}** | ${condCells.join(' | ')} | ${rule.actions.join('; ').replace(/\|/g, '/')} |`,
    );
  }
  lines.push('');

  lines.push('### Appendix C: Risk & Compliance Control Mapping');
  lines.push('');
  lines.push('| Risk ID | Risk Title | Severity | Mitigation Control | SDLC Impact |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const risk of overview.risks) {
    lines.push(
      `| **${risk.id}** | ${risk.title.replace(/\|/g, '/')} | ${risk.severity} | ${risk.mitigation.replace(/\|/g, '/')} | ${risk.sdlcImpact.replace(/\|/g, '/')} |`,
    );
  }
  lines.push('');

  // Index
  lines.push('## Index');
  lines.push('');
  const indexTerms = [
    ...narrative.definitions.map((d) => d.term),
    ...requirements.map((r) => `${r.id} (${r.title})`),
    ...narrative.logicalDatabaseEntities.map((e) => `${e.entity} (Entity)`),
    'IEEE Std 830-1998',
    'PCI-DSS v4.0',
    'Requirements Traceability Matrix (Appendix A)',
    'Decision Table (Appendix B)',
  ];
  const uniqueIndex = Array.from(new Set(indexTerms)).sort((a, b) => a.localeCompare(b));
  lines.push(uniqueIndex.map((t) => `- ${t}`).join('\n'));
  lines.push('');

  const markdown = stripAnyUmlBlocks(lines.join('\n'));
  const compliance = validateIeee830Srs(markdown, requirements);

  return {
    title,
    documentId: docId,
    version: '1.0',
    date: dateStr,
    standard: 'IEEE Std 830-1998 (No-UML Profile)',
    markdown,
    compliance,
  };
}
