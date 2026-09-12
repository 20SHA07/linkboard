import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const PROFILE_KEY = 'linkboard:demo:profile:v1';
const EVENTS_KEY = 'linkboard:demo:events:v1';
let values: Map<string, string>;
let storage: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.resetModules();
  values = new Map();
  storage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
  };
  vi.stubGlobal('window', { localStorage: storage });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('local demo resilience', () => {
  it('opens a safe default when local JSON is corrupt', async () => {
    values.set(PROFILE_KEY, '{broken json');
    values.set(EVENTS_KEY, '{broken json');
    const demo = await import('../lib/demo');
    expect(demo.loadDemoProfile()).toEqual(demo.demoProfile);
    expect(demo.loadDemoEvents()).toEqual([]);
  });

  it('rejects persisted executable links and another account ID', async () => {
    const demo = await import('../lib/demo');
    const unsafe = structuredClone(demo.demoProfile);
    unsafe.links[0].url = 'javascript:alert(1)';
    values.set(PROFILE_KEY, JSON.stringify(unsafe));
    expect(demo.loadDemoProfile()).toEqual(demo.demoProfile);
    values.set(PROFILE_KEY, JSON.stringify({ ...demo.demoProfile, id: 'another-account' }));
    expect(demo.loadDemoProfile()).toEqual(demo.demoProfile);
  });

  it('ignores malformed events without discarding valid history', async () => {
    const event = { id: 'click-1', linkId: 'website', timestamp: '2026-09-12T12:00:00.000Z' };
    values.set(
      EVENTS_KEY,
      JSON.stringify([null, {}, { ...event, timestamp: 'not-a-date' }, event]),
    );
    const demo = await import('../lib/demo');
    expect(demo.loadDemoEvents()).toEqual([event]);
  });

  it('does not count draft, disabled, nonexistent, or foreign-profile links', async () => {
    const demo = await import('../lib/demo');
    const saved = structuredClone(demo.demoProfile);
    saved.links[0].enabled = false;
    demo.saveDemoProfile(saved);
    demo.recordDemoClick(saved.id, saved.links[0].id);
    demo.recordDemoClick(saved.id, 'missing');
    demo.recordDemoClick('different-profile', saved.links[1].id);
    saved.published = false;
    demo.saveDemoProfile(saved);
    demo.recordDemoClick(saved.id, saved.links[1].id);
    expect(demo.loadDemoEvents()).toEqual([]);
  });

  it('keeps a saved edit in memory when writes fail but stale disk data remains readable', async () => {
    const demo = await import('../lib/demo');
    values.set(PROFILE_KEY, JSON.stringify(demo.demoProfile));
    storage.setItem.mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    demo.saveDemoProfile({ ...demo.demoProfile, name: 'Unsynced change' });
    expect(demo.loadDemoProfile().name).toBe('Unsynced change');
    expect(demo.getDemoStorageWarning()).toBeTruthy();
  });

  it('preserves multiple new events in memory after storage writes fail', async () => {
    const demo = await import('../lib/demo');
    values.set(EVENTS_KEY, '[]');
    storage.setItem.mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    demo.recordDemoClick(demo.demoProfile.id, 'website');
    demo.recordDemoClick(demo.demoProfile.id, 'instagram');
    expect(demo.loadDemoEvents().map((event) => event.linkId)).toEqual(['website', 'instagram']);
    expect(demo.getDemoStorageWarning()).toBeTruthy();
  });

  it('does not claim full persistence when only analytics storage recovers', async () => {
    const demo = await import('../lib/demo');
    storage.setItem.mockImplementation((key: string, value: string) => {
      if (key === PROFILE_KEY) throw new Error('QuotaExceededError');
      values.set(key, value);
    });
    demo.saveDemoProfile({ ...demo.demoProfile, name: 'Still only in this tab' });
    demo.recordDemoClick(demo.demoProfile.id, 'website');
    expect(demo.getDemoStorageWarning()).toBeTruthy();
    expect(demo.loadDemoProfile().name).toBe('Still only in this tab');
  });

  it('continues editing and recording when browser storage access is denied', async () => {
    storage.getItem.mockImplementation(() => {
      throw new Error('SecurityError');
    });
    storage.setItem.mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const demo = await import('../lib/demo');
    demo.saveDemoProfile({ ...demo.demoProfile, name: 'Private browsing' });
    demo.recordDemoClick(demo.demoProfile.id, 'website');
    expect(demo.loadDemoProfile().name).toBe('Private browsing');
    expect(demo.loadDemoEvents()).toHaveLength(1);
    expect(demo.getDemoStorageWarning()).toBeTruthy();
  });
});
