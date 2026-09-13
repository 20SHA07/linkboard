import { describe, expect, it } from 'vitest';
import { whatsappUrl } from '../lib/whatsapp';

describe('WhatsApp chat links', () => {
  it.each(['+971 50 123 4567', '971501234567', '+971 (50) 123-4567'])(
    'converts an international number: %s',
    (number) => {
      expect(whatsappUrl(number)).toBe('https://wa.me/971501234567');
    },
  );
  it.each([
    '0501234567',
    '123',
    '+1<script>',
    'javascript:alert(1)',
    'https://whatsapp.com.evil.example/',
    'https://user:pass@wa.me/1234567',
  ])('rejects invalid input: %s', (value) => expect(whatsappUrl(value)).toBeNull());
  it('retains existing chat/group links and encoded messages', () => {
    const link = 'https://wa.me/971501234567?text=Hello%20there';
    expect(whatsappUrl(link)).toBe(link);
    expect(whatsappUrl('https://chat.whatsapp.com/valid-group')).toBe(
      'https://chat.whatsapp.com/valid-group',
    );
  });
});
