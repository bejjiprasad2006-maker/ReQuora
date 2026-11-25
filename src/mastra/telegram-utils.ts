export const requestsPdf = (text: string) => /(^|\s)\/pdf\b/i.test(text);

export const isSessionCommand = (text: string) =>
  /^\/(start|new|help|compact)(\b|$)/i.test(text.trim());

export const cleanAgentText = (text: string) => {
  let out = text.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '');
  const unclosed = out.match(/<think\b[^>]*>([\s\S]*)$/i);
  if (unclosed) out = out.slice(0, unclosed.index);
  out = out.replace(/<\/?think\b[^>]*>/gi, '');
  return out.replace(/\n{3,}/g, '\n\n').trim();
};

export const textFromGenerateResult = (result: {
  text?: string;
  reasoning?: unknown;
  reasoningText?: string;
}) => {
  return cleanAgentText(result.text ?? '');
};
