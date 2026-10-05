import { describe, expect, it, jest } from '@jest/globals';
import type { DisplayNameIntent, ProfileIdentity } from '@/api/profile-identity';
import { DisplayNameController, type DisplayNameApi } from './display-name-controller';
import { DisplayNameIntentRepository } from './display-name-storage';

const v1 = 'a'.repeat(64), v2 = 'b'.repeat(64), v3 = 'c'.repeat(64);
const meta = { durationMs: 0, httpStatus: 200, outcome: 'ok' as const };
const ok = <T,>(data: T) => ({ status: 'ok' as const, data, meta });
const unavailable = { status: 'unavailable' as const, reason: 'network' as const, meta: { ...meta, outcome: 'unavailable' as const, httpStatus: null } };
const tick = () => new Promise(r => setTimeout(r, 0));

function memoryStorage() {
  const memory = new Map<string, string>();
  return { memory, port: {
    getItem: jest.fn(async (k: string) => memory.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => { memory.set(k, v); }),
    removeItem: jest.fn(async (k: string) => { memory.delete(k); }),
  } };
}
function setup(user = 'owner', storage = memoryStorage()) {
  let truth: ProfileIdentity = { displayName: 'Nacho', version: v1 };
  const api: DisplayNameApi = {
    read: jest.fn(async () => ok(truth)),
    write: jest.fn(async (i: DisplayNameIntent) => { truth = { displayName: i.displayName, version: v2 }; return ok({ status: 'confirmed' as const, ...truth }); }),
  };
  const repository = new DisplayNameIntentRepository(storage.port, user);
  let n = 0;
  const controller = new DisplayNameController(api, repository, () => `display-name:${++n}`);
  return { api, storage, repository, controller, setTruth: (t: ProfileIdentity) => { truth = t; } };
}

describe('Display name controller', () => {
  it('reads server truth and saves a trimmed name with CAS + persisted intent, then rereads', async () => {
    const x = setup();
    await x.controller.initialize();
    expect(x.controller.getSnapshot().read).toEqual({ status: 'ready', identity: { displayName: 'Nacho', version: v1 }, stale: false });
    x.controller.open(); x.controller.change('  Ignacio  ');
    jest.mocked(x.api.write).mockImplementationOnce(async i => {
      expect(await x.repository.read()).toMatchObject({ intent: i });
      expect(x.controller.getSnapshot().phase).toBe('pending');
      x.setTruth({ displayName: 'Ignacio', version: v2 });
      return ok({ status: 'confirmed' as const, displayName: 'Ignacio', version: v2 });
    });
    await x.controller.save();
    expect(x.api.write).toHaveBeenCalledWith({ displayName: 'Ignacio', expectedVersion: v1, idempotencyKey: 'display-name:1' });
    expect(x.controller.getSnapshot()).toMatchObject({ phase: 'idle', editor: null, intent: null, notice: 'Nombre guardado.',
      read: { identity: { displayName: 'Ignacio', version: v2 } } });
    expect(await x.repository.read()).toBeNull();
  });

  it('a blank name means "no name" (null), like Web; an unchanged name sends nothing', async () => {
    const x = setup();
    await x.controller.initialize();
    x.controller.open(); x.controller.change(' Nacho ');
    expect(x.controller.dirty()).toBe(false);
    await x.controller.save();
    expect(x.api.write).not.toHaveBeenCalled();
    x.controller.open(); x.controller.change('   ');
    await x.controller.save();
    expect(jest.mocked(x.api.write).mock.calls[0][0].displayName).toBeNull();
  });

  it('stale version: conflict without overwrite, draft kept, review rebases on the current value', async () => {
    const x = setup();
    await x.controller.initialize();
    x.controller.open(); x.controller.change('Mobile');
    x.setTruth({ displayName: 'Web', version: v3 });
    jest.mocked(x.api.write).mockResolvedValueOnce({ status: 'conflict', code: 'PROFILE_CHANGED', message: 'Tu nombre cambió.', meta: { ...meta, outcome: 'conflict' } } as never);
    await x.controller.save();
    expect(x.controller.getSnapshot()).toMatchObject({ phase: 'conflict', intent: null, message: 'Tu nombre cambió.',
      editor: { draft: 'Mobile', baseline: { version: v1 } }, read: { identity: { displayName: 'Web', version: v3 } } });
    expect(await x.repository.read()).toBeNull();
    x.controller.reviewTruth();
    expect(x.controller.getSnapshot()).toMatchObject({ phase: 'idle', editor: { draft: 'Mobile', baseline: { displayName: 'Web', version: v3 } } });
    await x.controller.save();
    expect(jest.mocked(x.api.write).mock.calls[1][0]).toMatchObject({ displayName: 'Mobile', expectedVersion: v3 });
  });

  it('network uncertainty survives restart; explicit recovery replays the same key exactly once', async () => {
    const x = setup();
    await x.controller.initialize();
    x.controller.open(); x.controller.change('Ignacio');
    jest.mocked(x.api.write).mockResolvedValueOnce(unavailable as never);
    await x.controller.save();
    expect(x.controller.getSnapshot().phase).toBe('uncertain');
    const stored = await x.repository.read();
    const second = new DisplayNameController(x.api, x.repository);
    await second.initialize();
    expect(second.getSnapshot()).toMatchObject({ phase: 'uncertain', editor: { draft: 'Ignacio' } });
    expect(x.api.write).toHaveBeenCalledTimes(1);
    second.open(); second.change('Otro'); await second.save();
    expect(x.api.write).toHaveBeenCalledTimes(1);
    await second.recover();
    expect(jest.mocked(x.api.write).mock.calls[1][0]).toEqual(stored!.intent);
    expect(second.getSnapshot()).toMatchObject({ phase: 'idle', intent: null });
  });

  it('a thrown request is uncertain, never success; a confirmed receipt only rereads on recovery', async () => {
    const x = setup();
    await x.controller.initialize();
    x.controller.open(); x.controller.change('Ignacio');
    jest.mocked(x.api.write).mockRejectedValueOnce(new Error('offline'));
    await x.controller.save();
    expect(x.controller.getSnapshot().phase).toBe('uncertain');
    jest.mocked(x.api.read).mockResolvedValueOnce(unavailable as never);
    await x.controller.recover();
    expect(x.controller.getSnapshot().phase).toBe('confirmed');
    expect((await x.repository.read())?.receipt).toBeDefined();
    await x.controller.recover();
    expect(x.api.write).toHaveBeenCalledTimes(2);
    expect(x.controller.getSnapshot().phase).toBe('idle');
  });

  it('storage failure blocks before sending anything', async () => {
    const storage = memoryStorage();
    const x = setup('owner', storage);
    await x.controller.initialize();
    storage.port.setItem.mockRejectedValueOnce(new Error('disk full'));
    x.controller.open(); x.controller.change('Ignacio');
    await x.controller.save();
    expect(x.controller.getSnapshot().phase).toBe('blocked');
    expect(x.api.write).not.toHaveBeenCalled();
  });

  it('a failed read is unavailable, never a fabricated "no name"', async () => {
    const x = setup();
    jest.mocked(x.api.read).mockResolvedValueOnce(unavailable as never);
    await x.controller.initialize();
    expect(x.controller.getSnapshot().read).toEqual({ status: 'unavailable', identity: null, stale: false });
    x.controller.open();
    expect(x.controller.getSnapshot().editor).toBeNull();
    await x.controller.load();
    jest.mocked(x.api.read).mockResolvedValueOnce(unavailable as never);
    await x.controller.load();
    expect(x.controller.getSnapshot().read).toMatchObject({ status: 'ready', stale: true, identity: { displayName: 'Nacho' } });
  });

  it('intents are namespaced per user', async () => {
    const storage = memoryStorage();
    const owner = setup('owner', storage);
    await owner.controller.initialize();
    owner.controller.open(); owner.controller.change('Ignacio');
    jest.mocked(owner.api.write).mockResolvedValueOnce(unavailable as never);
    await owner.controller.save();
    const other = setup('second-user', storage);
    await other.controller.initialize();
    await tick();
    expect(other.controller.getSnapshot()).toMatchObject({ phase: 'idle', intent: null });
    expect([...storage.memory.keys()]).toEqual(['ownlevel.profile.display-name.v1.owner']);
  });
});
