export const redactSensitiveData = (input: string) => {
  let redactions = 0;
  const mask = () => { redactions++; return '[REDACTED]'; };
  const text = input.replace(/-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z]+ )?PRIVATE KEY-----/g,mask)
    .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9+/_=.-]{8,}/gi,mask)
    .replace(/\b(?:sk-[A-Za-z0-9_-]{16,}|AKIA[A-Z0-9]{16})\b/g,mask)
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,mask)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, mask)
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g,mask)
    .replace(/\b[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}\b/g,mask)
    .replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g,mask)
    .replace(/\b(?:account[ _-]?(?:number|no)|a\/c)\s*[:=]\s*\d(?:[ -]?\d){5,33}\b/gi,mask)
    .replace(/\b(?:\d[ -]?){12,18}\d\b/g, mask)
    .replace(/\b(?:password|api[_ -]?key|secret|token)\s*[:=]\s*\S+/gi, mask)
    .replace(/(?:\+\d{1,3}[ -]?)?\b\d{10}\b/g, mask);
  return { text, redactions };
};
