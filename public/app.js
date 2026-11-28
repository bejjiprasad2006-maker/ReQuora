const state = {
  currentRun: null,
  reqFilter: 'ALL',
  abortController: null,
};

const el = (id) => document.getElementById(id);

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Lightweight, offline-safe Markdown renderer tailored for IEEE 830-1998 SRS documents.
 */
function renderMarkdown(md) {
  const lines = String(md ?? '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let inList = false;
  let inTable = false;
  let tableHeaderDone = false;

  const closeList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };
  const closeTable = () => {
    if (inTable) {
      out.push('</tbody></table>');
      inTable = false;
      tableHeaderDone = false;
    }
  };

  const inline = (text) =>
    escapeHtml(text)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\((#[^)]+)\)/g, '<a href="$2">$1</a>');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      closeList();
      closeTable();
      continue;
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      closeList();
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());

      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) {
        tableHeaderDone = true;
        continue;
      }

      if (!inTable) {
        out.push('<table><thead><tr>');
        cells.forEach((c) => out.push(`<th>${inline(c)}</th>`));
        out.push('</tr></thead><tbody>');
        inTable = true;
        tableHeaderDone = false;
      } else {
        out.push('<tr>');
        cells.forEach((c) => out.push(`<td>${inline(c)}</td>`));
        out.push('</tr>');
      }
      continue;
    }
    closeTable();

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      const title = headingMatch[2];
      const anchor = slugify(title);
      out.push(`<h${level} id="${anchor}">${inline(title)}</h${level}>`);
      continue;
    }

    if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      const itemText = trimmed.replace(/^[-*]\s+|^\d+\.\s+/, '');
      out.push(`<li>${inline(itemText)}</li>`);
      continue;
    }

    closeList();
    if (trimmed === '---') {
      out.push('<hr/>');
    } else {
      out.push(`<p>${inline(trimmed)}</p>`);
    }
  }

  closeList();
  closeTable();
  return out.join('\n');
}

async function refreshHealth() {
  const pill = el('healthPill');
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    if (data.llm?.reachable) {
      pill.className = 'health-pill health-ok';
      pill.textContent = `LLM Connected: ${data.llm.configuredModel}`;
    } else {
      pill.className = 'health-pill health-warn';
      pill.textContent = `LLM Offline (${data.llm?.baseURL ?? '127.0.0.1:1234'})`;
    }
  } catch {
    pill.className = 'health-pill health-warn';
    pill.textContent = 'Server Unreachable';
  }
}

async function refreshHistory() {
  try {
    const res = await fetch('/api/runs');
    const data = await res.json();
    const runs = data.runs ?? [];
    el('historyCount').textContent = String(runs.length);
    const list = el('historyList');
    if (runs.length === 0) {
      list.innerHTML = '<p class="muted small">No saved specifications yet. Generate your first e-commerce SRS above.</p>';
      return;
    }
    list.innerHTML = runs
      .map(
        (r) => `
      <button class="history-item" data-run-id="${escapeHtml(r.id)}" type="button">
        <div style="font-weight:700;margin-bottom:4px;">${escapeHtml(r.projectName)}</div>
        <div class="small muted" style="margin-bottom:6px;">${escapeHtml(r.brief.slice(0, 110))}${r.brief.length > 110 ? '…' : ''}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <span class="badge badge-green">${escapeHtml(r.recommendedSdlc)} (${r.recommendedPercentage}%)</span>
          <span class="badge">${r.requirementCount} reqs</span>
        </div>
      </button>`,
      )
      .join('');

    list.querySelectorAll('.history-item').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-run-id');
        const detailRes = await fetch(`/api/runs/${encodeURIComponent(id)}`);
        const detailData = await detailRes.json();
        if (detailData.run) {
          el('briefInput').value = detailData.run.brief || '';
          el('charInfo').textContent = `${el('briefInput').value.length} / 1200 characters.`;
          el('pipelinePanel').classList.add('hidden');
          el('errorBanner').classList.add('hidden');
          renderRun(detailData.run);
          el('historyDrawer').classList.add('hidden');
        }
      });
    });
  } catch {
    // ignore
  }
}

function renderOverview(run) {
  const o = run.overview;
  el('tab-overview').innerHTML = `
    <div class="card">
      <h3>Executive Summary</h3>
      <p>${escapeHtml(o.executiveSummary)}</p>
      <div class="grid-2" style="margin-top:14px;">
        <div class="req-box">
          <strong>Business Case</strong>
          <div>${escapeHtml(o.businessCase)}</div>
        </div>
        <div class="req-box">
          <strong>Operational Concept</strong>
          <div>${escapeHtml(o.operationalConcept)}</div>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h3>In-Scope Capabilities (Will Do)</h3>
        <ul>${o.inScope.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>
      </div>
      <div class="card">
        <h3>Out-of-Scope Boundaries (Will Not Do)</h3>
        <ul>${o.outOfScope.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>
      </div>
    </div>

    <div class="card">
      <h3>Stakeholders & User Classes</h3>
      <table>
        <thead><tr><th>User Class / Role</th><th>Description</th><th>Technical Proficiency</th><th>Primary Concerns</th></tr></thead>
        <tbody>
          ${o.stakeholders
            .map(
              (s) => `<tr>
                <td><strong>${escapeHtml(s.role)}</strong></td>
                <td>${escapeHtml(s.description)}</td>
                <td>${escapeHtml(s.technicalProficiency)}</td>
                <td>${escapeHtml(s.primaryConcerns)}</td>
              </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>

    <div class="grid-2">
      <div class="card">
        <h3>Assumptions</h3>
        <ul>
          ${o.assumptions
            .map(
              (a) =>
                `<li><strong>${escapeHtml(a.id)}:</strong> ${escapeHtml(a.statement)} ${
                  a.needsValidation ? '<span class="badge badge-amber">NEEDS-VALIDATION</span>' : ''
                }</li>`,
            )
            .join('')}
        </ul>
      </div>
      <div class="card">
        <h3>Regulatory & Operational Constraints</h3>
        <ul>${o.constraints.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul>
      </div>
    </div>

    <div class="card">
      <h3>Risk Register & SDLC Impact</h3>
      <table>
        <thead><tr><th>ID</th><th>Risk</th><th>Severity</th><th>Mitigation Control</th><th>SDLC Impact</th></tr></thead>
        <tbody>
          ${o.risks
            .map(
              (r) => `<tr>
                <td><strong>${escapeHtml(r.id)}</strong></td>
                <td><strong>${escapeHtml(r.title)}</strong><div class="small muted">${escapeHtml(r.description)}</div></td>
                <td><span class="badge ${r.severity === 'High' ? 'badge-red' : r.severity === 'Medium' ? 'badge-amber' : 'badge-green'}">${escapeHtml(r.severity)}</span></td>
                <td>${escapeHtml(r.mitigation)}</td>
                <td>${escapeHtml(r.sdlcImpact)}</td>
              </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderSdlc(run) {
  const s = run.sdlc;
  el('tab-sdlc').innerHTML = `
    <div class="card sdlc-winner">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px;">
        <div>
          <span class="badge badge-green">Recommended SDLC (#1)</span>
          <h2 style="margin-top:6px;">${escapeHtml(s.recommendedName)} — ${s.recommendedPercentage}% Match</h2>
        </div>
        <div class="kpi" style="min-width:140px;text-align:center;">
          <div class="kpi-val" style="color:#34d399;">${s.recommendedPercentage}%</div>
          <div class="kpi-lbl">MCDA Suitability</div>
        </div>
      </div>
      <p><strong>Why This SDLC Is the Perfect Fit:</strong> ${escapeHtml(s.perfectFitSummary)}</p>
    </div>

    <div class="card">
      <h3>All Evaluated SDLC Models & Percentages</h3>
      <p class="muted small" style="margin-bottom:12px;">
        Suitability percentages are calculated deterministically via Multi-Criteria Decision Analysis (MCDA) across 13 project decision factors, paired with architectural tradeoff justifications.
      </p>
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${s.rankings
          .map(
            (m) => `
          <div class="sdlc-bar-row ${m.isRecommended ? 'winner' : ''}">
            <div class="sdlc-bar-top">
              <div>
                <strong>#${m.rank} ${escapeHtml(m.name)}</strong>
                ${m.isRecommended ? '<span class="badge badge-green" style="margin-left:8px;">PERFECT FIT</span>' : '<span class="badge" style="margin-left:8px;">Alternative Evaluated</span>'}
                <div class="small muted">${escapeHtml(m.tagline)}</div>
              </div>
              <div style="font-size:1.25rem;font-weight:800;color:${m.isRecommended ? '#34d399' : '#93c5fd'};">${m.percentage}%</div>
            </div>
            <div class="sdlc-track"><div class="sdlc-fill" style="width:${m.percentage}%"></div></div>
            <div class="small"><strong>Fit Assessment:</strong> ${escapeHtml(m.whyFitsOrSummary)}</div>
            <div class="small muted"><strong>${m.isRecommended ? 'Tradeoffs to Manage:' : 'Why Not Selected as Primary:'}</strong> ${escapeHtml(m.whyNotChosenOrTradeoffs)}</div>
          </div>`,
          )
          .join('')}
      </div>
    </div>

    <div class="card">
      <h3>13 Decision Factors Extracted from Brief & Requirements</h3>
      <table>
        <thead><tr><th>Decision Factor</th><th>Score (1–5)</th><th>Rationale</th></tr></thead>
        <tbody>
          ${run.overview.decisionFactors
            .map(
              (f) => `<tr>
                <td><strong>${escapeHtml(f.label)}</strong></td>
                <td><span class="badge badge-accent">${f.score} / 5</span></td>
                <td>${escapeHtml(f.rationale)}</td>
              </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h3>Tailored Project-Specific SDLC Workflow (${escapeHtml(s.recommendedName)})</h3>
      <div style="display:flex;flex-direction:column;gap:12px;margin-top:10px;">
        ${s.workflowPhases
          .map(
            (p) => `
          <div class="req-box">
            <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
              <strong style="font-size:0.95rem;color:#c7d2fe;text-transform:none;">${escapeHtml(p.phase)}</strong>
              <span class="badge">${p.requirementIds.map(escapeHtml).join(', ')}</span>
            </div>
            <div class="small" style="margin-bottom:6px;"><strong>Objective:</strong> ${escapeHtml(p.objective)}</div>
            <div class="req-meta-grid">
              <div><strong>Activities:</strong> ${escapeHtml(p.activities.join('; '))}</div>
              <div><strong>Roles:</strong> ${escapeHtml(p.roles.join(', '))}</div>
              <div><strong>Deliverables:</strong> ${escapeHtml(p.deliverables.join(', '))}</div>
              <div><strong>Security / Compliance Gate:</strong> ${escapeHtml(p.securityComplianceCheckpoint)}</div>
              <div><strong>Entry Criteria:</strong> ${escapeHtml(p.entryCriteria)}</div>
              <div><strong>Exit Criteria:</strong> ${escapeHtml(p.exitCriteria)}</div>
            </div>
          </div>`,
          )
          .join('')}
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h3>Mandatory Human-Approval Gates</h3>
        <ul>${s.humanApprovalGates.map((g) => `<li>${escapeHtml(g)}</li>`).join('')}</ul>
      </div>
      <div class="card">
        <h3>Residual Risks</h3>
        <ul>${s.residualRisks.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
      </div>
    </div>
  `;
}

function renderRequirements(run) {
  const reqs = run.requirements;
  const frCount = reqs.filter((r) => r.type === 'FR').length;
  const nfrCount = reqs.length - frCount;
  const mustCount = reqs.filter((r) => r.priority === 'Must').length;
  const avgConf = Math.round(reqs.reduce((acc, r) => acc + r.confidence, 0) / Math.max(1, reqs.length));

  const filtered = reqs.filter((r) => {
    if (state.reqFilter === 'ALL') return true;
    if (state.reqFilter === 'FR') return r.type === 'FR';
    if (state.reqFilter === 'NFR') return r.type === 'NFR';
    if (state.reqFilter === 'MUST') return r.priority === 'Must';
    if (state.reqFilter === 'SEC') return ['Security', 'Privacy', 'Compliance', 'Audit'].includes(r.category);
    return true;
  });

  el('tab-requirements').innerHTML = `
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-val">${reqs.length}</div><div class="kpi-lbl">Total Requirements</div></div>
      <div class="kpi"><div class="kpi-val">${frCount}</div><div class="kpi-lbl">Functional (FR)</div></div>
      <div class="kpi"><div class="kpi-val">${nfrCount}</div><div class="kpi-lbl">Non-Functional (NFR)</div></div>
      <div class="kpi"><div class="kpi-val">${mustCount}</div><div class="kpi-lbl">Must-Have Priority</div></div>
      <div class="kpi"><div class="kpi-val">${avgConf}%</div><div class="kpi-lbl">Avg Confidence</div></div>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
        <strong>Filter Requirements</strong>
        <div class="examples-row" style="margin:0;">
          ${[
            ['ALL', `All (${reqs.length})`],
            ['FR', `Functional (${frCount})`],
            ['NFR', `Non-Functional (${nfrCount})`],
            ['MUST', `Must Priority (${mustCount})`],
            ['SEC', 'Security / Privacy / Compliance'],
          ]
            .map(
              ([key, label]) =>
                `<button type="button" class="chip req-filter-btn ${state.reqFilter === key ? 'active' : ''}" data-filter="${key}">${label}</button>`,
            )
            .join('')}
        </div>
      </div>
    </div>

    ${filtered
      .map(
        (r) => `
      <div class="card req-card ${r.type === 'NFR' ? 'nfr' : ''}">
        <div class="req-head">
          <div>
            <span class="badge ${r.type === 'FR' ? 'badge-accent' : ''}">${escapeHtml(r.id)}</span>
            <strong style="margin-left:8px;font-size:1.02rem;">${escapeHtml(r.title)}</strong>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <span class="badge">${escapeHtml(r.category)}</span>
            <span class="badge ${r.priority === 'Must' ? 'badge-red' : r.priority === 'Should' ? 'badge-amber' : 'badge-green'}">${escapeHtml(r.priority)}</span>
            <span class="badge badge-green">${r.confidence}% conf.</span>
          </div>
        </div>
        <p style="margin:4px 0;"><strong>Specification:</strong> ${escapeHtml(r.statement)}</p>
        <div class="req-meta-grid">
          <div class="req-box"><strong>Overview</strong>${escapeHtml(r.overview)}</div>
          <div class="req-box"><strong>Inputs</strong>${escapeHtml(r.inputs)}</div>
          <div class="req-box"><strong>Processing & Error Handling</strong>${escapeHtml(r.processingAndErrors)}</div>
          <div class="req-box"><strong>Outputs</strong>${escapeHtml(r.outputs)}</div>
        </div>
        <div class="req-box">
          <strong>Acceptance Criteria</strong>
          <ul>${r.acceptanceCriteria.map((ac) => `<li>${escapeHtml(ac)}</li>`).join('')}</ul>
        </div>
        <div class="small muted">
          <strong>Verification:</strong> ${escapeHtml(r.verificationMethod)} •
          <strong>Source:</strong> ${escapeHtml(r.stakeholderSource)} •
          <strong>Compliance:</strong> ${escapeHtml(r.complianceRef)} •
          <strong>Citation:</strong> <code>${escapeHtml(r.citation)}</code>
        </div>
      </div>`,
      )
      .join('')}
  `;

  el('tab-requirements').querySelectorAll('.req-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.reqFilter = btn.getAttribute('data-filter') || 'ALL';
      renderRequirements(run);
    });
  });
}

function renderSrs(run) {
  const srs = run.srs;
  const checksHtml = srs.compliance.checks
    .map(
      (c) =>
        `<span class="badge ${c.passed ? 'badge-green' : 'badge-red'}" title="${escapeHtml(c.detail)}">${c.passed ? 'PASS' : 'FAIL'}: ${escapeHtml(c.name)}</span>`,
    )
    .join('');

  const srsSections = [
    ['1-introduction', '1. Introduction'],
    ['11-purpose', '1.1 Purpose'],
    ['12-scope', '1.2 Scope'],
    ['13-definitions-acronyms-and-abbreviations', '1.3 Definitions & Acronyms'],
    ['14-references', '1.4 References'],
    ['15-overview', '1.5 Overview'],
    ['2-overall-description', '2. Overall Description'],
    ['21-product-perspective', '2.1 Product Perspective'],
    ['22-product-functions', '2.2 Product Functions'],
    ['23-user-characteristics', '2.3 User Characteristics'],
    ['24-constraints', '2.4 Constraints'],
    ['25-assumptions-and-dependencies', '2.5 Assumptions & Dependencies'],
    ['3-specific-requirements', '3. Specific Requirements'],
    ['31-external-interfaces', '3.1 External Interfaces'],
    ['32-functions', '3.2 Functions'],
    ['33-performance-requirements', '3.3 Performance Requirements'],
    ['34-logical-database-requirements', '3.4 Logical Database Requirements'],
    ['35-design-constraints', '3.5 Design Constraints'],
    ['36-software-system-quality-attributes', '3.6 System Quality Attributes'],
    ['appendices', 'Appendices (RTM, Decision Table, Risks)'],
    ['index', 'Index'],
  ];

  el('tab-srs').innerHTML = `
    <div class="card no-print">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
        <strong>IEEE Std 830-1998 Compliance Audit</strong>
        <span class="badge ${srs.compliance.isCompliant ? 'badge-green' : 'badge-amber'}">
          ${srs.compliance.isCompliant ? '100% IEEE 830-1998 Compliant' : 'Review Checks'}
        </span>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">${checksHtml}</div>
    </div>

    <div class="srs-layout">
      <aside class="card srs-nav no-print">
        <strong style="display:block;margin-bottom:8px;">IEEE 830-1998 Sections</strong>
        ${srsSections.map(([id, label]) => `<a href="#${id}">${escapeHtml(label)}</a>`).join('')}
      </aside>
      <article class="srs-paper">${renderMarkdown(srs.markdown)}</article>
    </div>
  `;
}

function renderRun(run) {
  state.currentRun = run;
  state.reqFilter = 'ALL';

  el('resultsSection').classList.remove('hidden');
  el('resProjectTitle').textContent = run.projectName;
  el('resMeta').textContent = `Domain: E-Commerce • Recommended SDLC: ${run.sdlc.recommendedName} (${run.sdlc.recommendedPercentage}%) • ${run.requirements.length} Requirements • Generated in ${(run.durationMs / 1000).toFixed(1)}s using ${run.modelUsed}`;
  el('reqTabCount').textContent = String(run.requirements.length);

  renderOverview(run);
  renderSdlc(run);
  renderRequirements(run);
  renderSrs(run);
}

function setPipelineStage(stage, status, message, pct) {
  el('pipelinePanel').classList.remove('hidden');
  el('pipelineMessage').textContent = message;
  el('pipelinePct').textContent = `${pct}%`;
  el('progressBar').style.width = `${pct}%`;

  const stepEl = document.querySelector(`.agent-step[data-stage="${stage}"]`);
  if (stepEl) {
    stepEl.classList.remove('running', 'done');
    if (status === 'running' || status === 'done') {
      stepEl.classList.add(status);
    }
  }
}

function resetPipelineUi() {
  document.querySelectorAll('.agent-step').forEach((s) => s.classList.remove('running', 'done'));
  el('errorBanner').classList.add('hidden');
  setPipelineStage('rag', 'running', 'Initializing ReQuora AI agents…', 5);
}

function startNewChat() {
  if (state.abortController) {
    state.abortController.abort();
    state.abortController = null;
  }

  state.currentRun = null;
  state.reqFilter = 'ALL';

  el('briefInput').value = '';
  el('charInfo').textContent = 'Enter 1–2 concise sentences (min 10 characters).';
  document.querySelectorAll('.examples-row .chip[data-brief]').forEach((c) => c.classList.remove('active'));

  el('resultsSection').classList.add('hidden');
  el('pipelinePanel').classList.add('hidden');
  el('errorBanner').classList.add('hidden');
  el('historyDrawer').classList.add('hidden');
  document.querySelectorAll('.agent-step').forEach((s) => s.classList.remove('running', 'done'));

  ['tab-overview', 'tab-sdlc', 'tab-requirements', 'tab-srs'].forEach((id) => {
    el(id).innerHTML = '';
  });

  document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
  const firstTab = document.querySelector('.tab[data-tab="overview"]');
  if (firstTab) firstTab.classList.add('active');
  el('tab-overview').classList.add('active');

  const btn = el('generateBtn');
  btn.disabled = false;
  btn.textContent = 'Generate Overview, SDLC & IEEE 830 SRS';

  window.scrollTo({ top: 0, behavior: 'smooth' });
  el('briefInput').focus();
}

async function handleGenerate(e) {
  e.preventDefault();
  const brief = el('briefInput').value.trim();
  if (brief.length < 10) {
    el('errorBanner').textContent = 'Please enter at least 10 characters (1–2 lines describing your e-commerce project).';
    el('errorBanner').classList.remove('hidden');
    return;
  }

  if (state.abortController) {
    state.abortController.abort();
  }
  const controller = new AbortController();
  state.abortController = controller;

  const btn = el('generateBtn');
  btn.disabled = true;
  btn.textContent = 'Generating Specification…';
  resetPipelineUi();

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief, stream: true }),
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`HTTP ${response.status} starting generation`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';

      for (const frame of frames) {
        const eventLine = frame.split('\n').find((l) => l.startsWith('event: '));
        const dataLine = frame.split('\n').find((l) => l.startsWith('data: '));
        if (!eventLine || !dataLine) continue;

        const eventName = eventLine.slice(7).trim();
        const payload = JSON.parse(dataLine.slice(6));

        if (eventName === 'progress') {
          setPipelineStage(payload.stage, payload.status, payload.message, payload.progressPct);
        } else if (eventName === 'complete') {
          setPipelineStage('srs', 'done', 'All agents finished! Specification ready.', 100);
          renderRun(payload.run);
          refreshHistory();
        } else if (eventName === 'error') {
          throw new Error(payload.error || 'Generation failed');
        }
      }
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return;
    el('errorBanner').textContent = err instanceof Error ? err.message : 'Unexpected error occurred.';
    el('errorBanner').classList.remove('hidden');
  } finally {
    if (state.abortController === controller) {
      state.abortController = null;
      btn.disabled = false;
      btn.textContent = 'Generate Overview, SDLC & IEEE 830 SRS';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  refreshHealth();
  refreshHistory();

  el('briefForm').addEventListener('submit', handleGenerate);
  el('newChatBtn').addEventListener('click', startNewChat);
  el('composerResetBtn').addEventListener('click', startNewChat);

  el('briefInput').addEventListener('input', (e) => {
    const len = e.target.value.trim().length;
    el('charInfo').textContent = `${len} / 1200 characters (keep it concise, 1–2 lines is ideal).`;
  });

  document.querySelectorAll('.examples-row .chip[data-brief]').forEach((chip) => {
    chip.addEventListener('click', () => {
      el('briefInput').value = chip.getAttribute('data-brief') || '';
      el('charInfo').textContent = `${el('briefInput').value.length} / 1200 characters.`;
    });
  });

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      el(`tab-${target}`).classList.add('active');
    });
  });

  el('historyBtn').addEventListener('click', () => {
    refreshHistory();
    el('historyDrawer').classList.remove('hidden');
  });
  el('closeHistoryBtn').addEventListener('click', () => {
    el('historyDrawer').classList.add('hidden');
  });

  const downloadExport = (format) => {
    if (!state.currentRun) return;
    window.location.href = `/api/export/${encodeURIComponent(state.currentRun.id)}/${format}`;
  };
  el('exportMdBtn').addEventListener('click', () => downloadExport('md'));
  el('exportSrsBtn').addEventListener('click', () => downloadExport('srs-md'));
  el('exportHtmlBtn').addEventListener('click', () => downloadExport('html'));
  el('exportJsonBtn').addEventListener('click', () => downloadExport('json'));
  el('printBtn').addEventListener('click', () => window.print());
});
