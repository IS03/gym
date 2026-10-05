import type { MobileApiReadResult, MobileApiRequestResult } from '@/api/results';
import { normalizeDisplayName, type DisplayNameIntent, type DisplayNameReceipt, type ProfileIdentity } from '@/api/profile-identity';
import type { DisplayNameIntentRepository, StoredDisplayNameIntent } from './display-name-storage';

export type DisplayNameApi = {
  read: () => Promise<MobileApiReadResult<ProfileIdentity>>;
  write: (intent: DisplayNameIntent) => Promise<MobileApiRequestResult<DisplayNameReceipt>>;
};
export type DisplayNameEditor = { baseline: ProfileIdentity; draft: string };
export type DisplayNameState = {
  read: { status: 'loading' | 'ready' | 'unavailable'; identity: ProfileIdentity | null; stale: boolean };
  phase: 'loading' | 'idle' | 'pending' | 'uncertain' | 'confirmed' | 'conflict' | 'blocked';
  editor: DisplayNameEditor | null; intent: StoredDisplayNameIntent | null; message: string | null; notice: string | null;
};
const unavailable = { status: 'unavailable' as const, reason: 'network' as const, meta: { durationMs: 0, httpStatus: null, outcome: 'unavailable' as const } };

export class DisplayNameController {
  private state: DisplayNameState = { read: { status: 'loading', identity: null, stale: false }, phase: 'loading', editor: null, intent: null, message: null, notice: null };
  private busy = false; private disposed = false; private generation = 0; private listeners = new Set<() => void>();
  constructor(private api: DisplayNameApi, private repository: DisplayNameIntentRepository,
    private key: () => string = () => `display-name:${Date.now()}:${Math.random().toString(36).slice(2)}`) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<DisplayNameState>) { if (!this.disposed) { this.state = { ...this.state, ...patch }; this.listeners.forEach(f => f()); } }
  dispose() { this.disposed = true; this.generation++; this.listeners.clear(); }

  async initialize() {
    try {
      const stored = await this.repository.read();
      this.update(stored ? { phase: stored.receipt ? 'confirmed' : 'uncertain', intent: stored, editor: { baseline: stored.baseline, draft: stored.draft },
        message: stored.receipt ? 'El nombre está confirmado. Falta actualizar la lectura.' : 'Hay un cambio de nombre sin resultado confirmado. Comprobalo antes de hacer otro.' }
        : { phase: 'idle' });
    } catch { this.update({ phase: 'blocked', message: 'No pudimos leer el cambio de nombre guardado en el teléfono.' }); }
    await this.load();
  }

  /** Server truth. A newer load invalidates older responses; a failed read never fabricates "no name". */
  async load(): Promise<boolean> {
    const generation = ++this.generation;
    let result: MobileApiReadResult<ProfileIdentity>;
    try { result = await this.api.read(); } catch { result = unavailable; }
    if (this.disposed || generation !== this.generation) return false;
    if (result.status === 'ok') { this.update({ read: { status: 'ready', identity: result.data, stale: false } }); return true; }
    this.update({ read: this.state.read.identity ? { ...this.state.read, stale: true } : { status: 'unavailable', identity: null, stale: false } });
    return false;
  }

  open() {
    const identity = this.state.read.identity;
    if (this.busy || this.state.intent || this.state.phase !== 'idle' || this.state.read.status !== 'ready' || !identity || this.state.editor) return;
    this.update({ editor: { baseline: identity, draft: identity.displayName ?? '' }, message: null, notice: null });
  }
  change(draft: string) {
    const editor = this.state.editor;
    if (this.busy || this.state.intent || this.state.phase !== 'idle' || !editor) return;
    this.update({ editor: { ...editor, draft }, message: null });
  }
  dirty() { const e = this.state.editor; return !!e && normalizeDisplayName(e.draft) !== e.baseline.displayName; }
  close() {
    if (this.busy || this.state.intent) return;
    this.update({ editor: null, phase: this.state.phase === 'blocked' ? 'blocked' : 'idle', message: null });
  }

  async save() {
    const editor = this.state.editor;
    if (this.disposed || this.busy || this.state.intent || this.state.phase !== 'idle' || !editor) return;
    const displayName = normalizeDisplayName(editor.draft);
    if (displayName === editor.baseline.displayName) { this.update({ editor: null, message: null }); return; }
    const stored: StoredDisplayNameIntent = { version: 1, baseline: editor.baseline, draft: editor.draft,
      intent: { displayName, expectedVersion: editor.baseline.version, idempotencyKey: this.key() } };
    this.busy = true; this.update({ phase: 'pending', message: null, notice: null });
    try {
      // Durable BEFORE the request: a lost response is recovered with this same key.
      await this.repository.write(stored);
      this.update({ intent: stored });
      await this.send(stored);
    } catch { this.update({ phase: 'blocked', message: 'No pudimos conservar el cambio en el teléfono. No enviamos nada; revisá el almacenamiento.' }); }
    finally { this.busy = false; }
  }
  async recover() {
    if (this.busy || this.disposed) return;
    const stored = this.state.intent;
    if (!stored) { await this.initialize(); return; }
    this.busy = true; this.update({ phase: 'pending', message: null });
    try { if (stored.receipt) await this.confirmed(stored); else await this.send(stored); }
    catch { this.update({ phase: 'uncertain', message: 'Conservamos el cambio. No pudimos comprobar su resultado.' }); }
    finally { this.busy = false; }
  }
  private async send(stored: StoredDisplayNameIntent) {
    let result: MobileApiRequestResult<DisplayNameReceipt>;
    try { result = await this.api.write(stored.intent); }
    catch { this.update({ phase: 'uncertain', message: 'No sabemos si se guardó. Comprobar reenvía el mismo cambio, sin duplicarlo.' }); return; }
    if (result.status === 'ok') {
      const confirmed = { ...stored, receipt: result.data };
      this.update({ phase: 'confirmed', intent: confirmed });
      await this.repository.write(confirmed);
      await this.confirmed(confirmed);
      return;
    }
    if (result.status === 'conflict' || result.status === 'validation' || result.status === 'not_found') {
      // Definitive outcome: nothing was applied. Keep the draft; refresh server truth.
      await this.repository.clear(stored.intent.idempotencyKey);
      this.update({ intent: null, editor: { baseline: stored.baseline, draft: stored.draft },
        phase: result.status === 'validation' ? 'idle' : 'conflict', message: result.message });
      await this.load();
      return;
    }
    this.update({ phase: 'uncertain', message: 'El resultado es incierto. Conservamos el cambio para comprobarlo cuando quieras.' });
  }
  private async confirmed(stored: StoredDisplayNameIntent) {
    const fresh = await this.load();
    if (this.disposed) return;
    if (!fresh) { this.update({ phase: 'confirmed', message: 'Guardado confirmado. Falta actualizar la lectura; no vuelvas a enviarlo.' }); return; }
    await this.repository.clear(stored.intent.idempotencyKey);
    this.update({ phase: 'idle', intent: null, editor: null, message: null, notice: 'Nombre guardado.' });
  }
  /** After a conflict the draft stays; the user rebases it on server truth explicitly. */
  reviewTruth() {
    const editor = this.state.editor, identity = this.state.read.identity;
    if (this.busy || this.state.phase !== 'conflict' || !editor || !identity || this.state.read.stale) return;
    this.update({ phase: 'idle', editor: { baseline: identity, draft: editor.draft },
      message: 'Actualizamos tu nombre con el valor actual. Revisá tu borrador antes de guardar de nuevo.' });
  }
  dismissNotice() { this.update({ notice: null }); }
}
