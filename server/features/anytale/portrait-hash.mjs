import crypto from 'crypto';

export function portraitPromptHash(prompt) {
  const normalized = prompt
    .split(',')
    .map(t => t.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(',');
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}
