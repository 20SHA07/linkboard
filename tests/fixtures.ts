import type { Profile } from '../lib/types';

// Test-only data. No application code imports this file.
export const testProfile: Profile = {
  id: '00000000-0000-4000-8000-000000000001',
  username: 'test-owner',
  name: 'Test Owner',
  bio: '',
  avatarUrl: '',
  theme: 'sand',
  backgroundColor: '#ede7db',
  published: true,
  links: [
    {
      id: 'website',
      title: 'Portfolio',
      url: 'https://example.com',
      platform: 'website',
      enabled: true,
    },
  ],
};
