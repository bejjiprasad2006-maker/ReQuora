import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const createPdf = async (title: string, markdown: string) => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.setTitle(title); pdf.setProducer('RikuAI');
  const ascii = markdown.replace(/[\u2010-\u2015]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[^\x20-\x7e\n\r\t]/g, '?');
  let page = pdf.addPage([595, 842]), y = 792, pageNumber = 1;
  const footer = () => page.drawText(`RikuAI | DRAFT - human review required | ${pageNumber}`, { x: 40, y: 24, size: 8, font, color: rgb(0.4, 0.5, 0.5) });
  footer();
  for (const sourceLine of ascii.split(/\r?\n/)) {
    let line = '';
    // Break long URLs/hashes as well as prose; no content can run beyond the page edge.
    const chunks = sourceLine.match(/.{1,90}(?:\s|$)|.{1,90}/g) ?? [''];
    for (const chunk of chunks) {
      const heading = /^#{1,3} /.test(chunk), size = heading ? 12 : 9;
      line = chunk.replace(/^#{1,6} /, '');
      while (font.widthOfTextAtSize(line, size) > 515 && line.length) {
        // Conservative 90-character wrapping normally fits; this handles wide glyph sequences.
        const fit = Math.max(1, Math.floor(line.length * 510 / font.widthOfTextAtSize(line, size)));
        if (y < 52) { page = pdf.addPage([595, 842]); y = 792; pageNumber++; footer(); }
        page.drawText(line.slice(0, fit), { x: 40, y, size, font }); y -= 15;
        line = line.slice(fit);
      }
      if (y < 52) { page = pdf.addPage([595, 842]); y = 792; pageNumber++; footer(); }
      page.drawText(line, { x: 40, y, size, font }); y -= heading ? 20 : 14;
    }
  }
  return pdf.save();
};
export const renderEcommercePdf = async (title: string, markdown: string) => {
  const directory = resolve('artifacts/ecommerce/pdf');
  await mkdir(directory, { recursive: true });
  const pdfPath = join(directory, `${randomUUID()}.pdf`);
  await writeFile(pdfPath, await createPdf(title, markdown));
  return pdfPath;
};
// Preserve the former public export for integrations.
export const renderFinancePdf = renderEcommercePdf;
export const renderPdfTool = createTool({
  id: 'render-ecommerce-pdf', description: 'Render a completed e-commerce SRS and SDLC report to a local PDF.',
  inputSchema: z.object({ title: z.string().min(3).max(120), markdown: z.string().min(100) }),
  outputSchema: z.object({ pdfPath: z.string() }),
  execute: async ({ title, markdown }) => ({ pdfPath: await renderEcommercePdf(title, markdown) }),
});
