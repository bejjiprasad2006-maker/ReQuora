import 'dotenv/config';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { workspaceRoot } from './mastra/workspace';
import { renderFullReportHtml, renderFullReportMarkdown } from './requora/export';
import { checkLlmHealth } from './requora/llm';
import { runReQuoraPipeline } from './requora/pipeline';
import { getRunById, listRunSummaries } from './requora/storage';

const PORT = Number(process.env.PORT ?? 3456);
const HOST = process.env.HOST?.trim() || '127.0.0.1';
const publicDir = join(workspaceRoot, 'public');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

function sendJson(res: ServerResponse, statusCode: number, data: unknown) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > 64 * 1024) {
      throw new Error('Request payload too large');
    }
    chunks.push(buf);
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  return JSON.parse(text) as Record<string, unknown>;
}

async function serveStatic(res: ServerResponse, fileName: string) {
  const ext = fileName.slice(fileName.lastIndexOf('.'));
  const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
  const filePath = join(publicDir, fileName);
  const content = await readFile(filePath, 'utf8');
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(content);
}

const server = createServer(async (req, res) => {
  const method = req.method ?? 'GET';
  const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);
  const path = url.pathname;

  try {
    if (method === 'GET' && path === '/') {
      await serveStatic(res, 'index.html');
      return;
    }
    if (method === 'GET' && (path === '/styles.css' || path === '/app.js')) {
      await serveStatic(res, path.slice(1));
      return;
    }

    if (method === 'GET' && path === '/api/health') {
      const llm = await checkLlmHealth();
      sendJson(res, 200, {
        app: 'ReQuora AI',
        domain: 'E-Commerce',
        standard: 'IEEE 830-1998 (No-UML)',
        llm,
      });
      return;
    }

    if (method === 'GET' && path === '/api/runs') {
      const runs = await listRunSummaries();
      sendJson(res, 200, { runs });
      return;
    }

    if (method === 'GET' && path.startsWith('/api/runs/')) {
      const id = decodeURIComponent(path.slice('/api/runs/'.length));
      const run = await getRunById(id);
      if (!run) {
        sendJson(res, 404, { error: 'Run not found' });
        return;
      }
      sendJson(res, 200, { run });
      return;
    }

    if (method === 'GET' && path.startsWith('/api/export/')) {
      const parts = path.slice('/api/export/'.length).split('/');
      const id = decodeURIComponent(parts[0] ?? '');
      const format = (parts[1] ?? 'md').toLowerCase();
      const run = await getRunById(id);
      if (!run) {
        sendJson(res, 404, { error: 'Run not found' });
        return;
      }

      const slug =
        run.projectName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'requora-spec';

      if (format === 'json') {
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${slug}-requora.json"`,
        });
        res.end(JSON.stringify(run, null, 2));
        return;
      }
      if (format === 'html') {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="${slug}-ieee830.html"`,
        });
        res.end(renderFullReportHtml(run));
        return;
      }
      if (format === 'srs-md') {
        res.writeHead(200, {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="${slug}-ieee830-srs.md"`,
        });
        res.end(run.srs.markdown);
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${slug}-full-report.md"`,
      });
      res.end(renderFullReportMarkdown(run));
      return;
    }

    if (method === 'POST' && path === '/api/generate') {
      const body = await readJsonBody(req);
      const brief = typeof body.brief === 'string' ? body.brief : '';
      const stream = body.stream !== false;

      if (!stream) {
        const run = await runReQuoraPipeline(brief);
        sendJson(res, 200, { run });
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      });

      const sendEvent = (event: string, data: unknown) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      try {
        const run = await runReQuoraPipeline(brief, (progress) => {
          sendEvent('progress', progress);
        });
        sendEvent('complete', { run });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Pipeline generation failed';
        sendEvent('error', { error: message });
      } finally {
        res.end();
      }
      return;
    }

    sendJson(res, 404, { error: 'Endpoint not found' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    if (!res.headersSent) {
      sendJson(res, 400, { error: message });
    } else {
      res.end();
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n  ReQuora AI (E-Commerce Requirements & IEEE 830-1998 SRS Studio)`);
  console.log(`  Open in browser: http://${HOST}:${PORT}\n`);
});
