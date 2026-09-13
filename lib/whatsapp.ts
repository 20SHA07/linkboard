import { safeUrl } from './validation';

/** https://faq.whatsapp.com/5913398998672934 */
export function whatsappUrl(value: string): string | null {
  const input = value.trim();
  if (/^https:\/\//i.test(input) && safeUrl(input)) {
    const host = new URL(input).hostname.toLowerCase();
    return host === 'wa.me' || host === 'whatsapp.com' || host.endsWith('.whatsapp.com')
      ? new URL(input).href
      : null;
  }
  if (!/^\+?[0-9 ()-]+$/.test(input)) return null;
  const number = input.replace(/[+ ()-]/g, '');
  return /^[1-9][0-9]{6,14}$/.test(number) ? `https://wa.me/${number}` : null;
}
