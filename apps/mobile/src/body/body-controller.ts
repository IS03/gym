import type { MobileApiReadResult, MobileApiRequestResult } from '@/api/results';
import type {
  BodyMeasurement, BodyMeasurementIntent, BodyMeasurementReceipt, BodyOverview, BodyPage, BodyWeightEntry, BodyWeightIntent, BodyWeightReceipt,
} from '@/api/body';
import { parseInputNutritionDate, shiftNutritionDate } from '@/nutrition/day-format';
import {
  formatKg, measurementDraft, mergeByKey, validateMeasurementDraft, validateWeightDraft, weightAt, weightDraft,
} from './body-model';
import type { BodyEditor, BodyIntentRepository, MeasurementEditor, StoredBodyIntent, WeightEditor } from './body-storage';

type Page<T> = BodyPage<T> & { today: string };
export type BodyApi = {
  overview: () => Promise<MobileApiReadResult<BodyOverview>>;
  weights: (before: string) => Promise<MobileApiReadResult<Page<BodyWeightEntry>>>;
  measurements: (before: string) => Promise<MobileApiReadResult<Page<BodyMeasurement>>>;
  weight: (intent: BodyWeightIntent) => Promise<MobileApiRequestResult<BodyWeightReceipt>>;
  measurement: (intent: BodyMeasurementIntent) => Promise<MobileApiRequestResult<BodyMeasurementReceipt>>;
};
export type BodyRead = {
  status: 'loading' | 'ready' | 'unavailable'; overview: BodyOverview | null; refreshing: boolean; stale: boolean;
  weights: BodyWeightEntry[]; weightsCursor: string | null; measurements: BodyMeasurement[]; measurementsCursor: string | null;
  loadingMore: 'weights' | 'measurements' | null; moreError: boolean;
};
export type BodyState = {
  read: BodyRead;
  phase: 'loading' | 'idle' | 'pending' | 'uncertain' | 'confirmed' | 'conflict' | 'blocked';
  editor: BodyEditor | null; intent: StoredBodyIntent | null; message: string | null; errors: Record<string, string>; notice: string | null;
};
const emptyRead: BodyRead = { status: 'loading', overview: null, refreshing: false, stale: false, weights: [], weightsCursor: null,
  measurements: [], measurementsCursor: null, loadingMore: null, moreError: false };
const sameDraft = (a: object, b: object) => JSON.stringify(a) === JSON.stringify(b);

export class BodyController {
  private state: BodyState = { read: emptyRead, phase: 'loading', editor: null, intent: null, message: null, errors: {}, notice: null };
  private busy = false; private disposed = false; private generation = 0; private listeners = new Set<() => void>();
  constructor(private api: BodyApi, private repository: BodyIntentRepository,
    private key: () => string = () => `body:${Date.now()}:${Math.random().toString(36).slice(2)}`) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<BodyState>) { if (!this.disposed) { this.state = { ...this.state, ...patch }; this.listeners.forEach(f => f()); } }
  private updateRead(patch: Partial<BodyRead>) { this.update({ read: { ...this.state.read, ...patch } }); }
  dispose() { this.disposed = true; this.generation++; this.listeners.clear(); }

  async initialize() {
    try {
      const stored = await this.repository.read();
      this.update(stored ? { phase: stored.receipt ? 'confirmed' : 'uncertain', intent: stored, editor: stored.editor,
        message: stored.receipt ? 'El cambio está confirmado. Falta actualizar la lectura.' : 'Hay un cambio sin resultado confirmado. Comprobalo antes de guardar otro.' }
        : { phase: 'idle' });
    } catch { this.update({ phase: 'blocked', message: 'No pudimos leer el cambio guardado en el teléfono. Revisá el almacenamiento antes de continuar.' }); }
    await this.load();
  }

  /** Server truth read. A newer load or write invalidates older responses. */
  async load(): Promise<boolean> {
    const generation = ++this.generation;
    this.updateRead(this.state.read.overview ? { refreshing: true } : { status: 'loading' });
    let result: MobileApiReadResult<BodyOverview>;
    try { result = await this.api.overview(); } catch { result = { status: 'unavailable', reason: 'network', meta: { durationMs: 0, httpStatus: null, outcome: 'unavailable' } }; }
    if (this.disposed || generation !== this.generation) return false;
    if (result.status === 'ok') {
      const o = result.data;
      this.update({ read: { status: 'ready', overview: o, refreshing: false, stale: false, weights: o.weights.items, weightsCursor: o.weights.nextBefore,
        measurements: o.measurements.items, measurementsCursor: o.measurements.nextBefore, loadingMore: null, moreError: false } });
      return true;
    }
    // Keep the last confirmed read visible but marked stale; never fabricate empty.
    this.updateRead(this.state.read.overview ? { refreshing: false, stale: true } : { status: 'unavailable', refreshing: false });
    return false;
  }
  async loadMore(section: 'weights' | 'measurements') {
    const read = this.state.read, cursor = section === 'weights' ? read.weightsCursor : read.measurementsCursor;
    if (read.status !== 'ready' || read.loadingMore || !cursor) return;
    const generation = this.generation;
    this.updateRead({ loadingMore: section, moreError: false });
    try {
      if (section === 'weights') {
        const r = await this.api.weights(cursor);
        if (this.disposed || generation !== this.generation) return;
        if (r.status === 'ok') this.updateRead({ weights: mergeByKey(this.state.read.weights, r.data.items, e => e.date), weightsCursor: r.data.nextBefore, loadingMore: null });
        else this.updateRead({ loadingMore: null, moreError: true });
      } else {
        const r = await this.api.measurements(cursor);
        if (this.disposed || generation !== this.generation) return;
        if (r.status === 'ok') this.updateRead({ measurements: mergeByKey(this.state.read.measurements, r.data.items, m => m.id), measurementsCursor: r.data.nextBefore, loadingMore: null });
        else this.updateRead({ loadingMore: null, moreError: true });
      }
    } catch { if (generation === this.generation) this.updateRead({ loadingMore: null, moreError: true }); }
  }

  private canEdit() { return !this.busy && !this.state.intent && this.state.phase === 'idle' && this.state.read.status === 'ready' && !!this.state.read.overview; }
  openWeight(entry?: BodyWeightEntry) {
    const today = this.state.read.overview?.today;
    if (!this.canEdit() || this.state.editor || !today) return;
    this.update({ editor: entry ? { kind: 'weight', mode: 'edit', baseline: entry.weightKg, draft: weightDraft(entry.date, entry.weightKg) }
      : { kind: 'weight', mode: 'create', baseline: null, draft: weightDraft(today, null) }, errors: {}, message: null, notice: null });
  }
  openMeasurement(measurement?: BodyMeasurement) {
    const today = this.state.read.overview?.today;
    if (!this.canEdit() || this.state.editor || !today) return;
    this.update({ editor: { kind: 'measurement', mode: measurement ? 'edit' : 'create', baseline: measurement ?? null, draft: measurementDraft(measurement ?? null, today) },
      errors: {}, message: null, notice: null });
  }
  change(key: string, value: string) {
    const editor = this.state.editor;
    if (this.busy || this.state.intent || this.state.phase !== 'idle' || !editor || !(key in editor.draft)) return;
    if (editor.kind === 'weight' && editor.mode === 'edit' && key === 'date') return; // a weight's date is its identity
    this.update({ editor: { ...editor, draft: { ...editor.draft, [key]: value } } as BodyEditor, errors: {}, message: null });
  }
  dirty(): boolean {
    const editor = this.state.editor, today = this.state.read.overview?.today;
    if (!editor || !today) return false;
    if (editor.kind === 'weight') return editor.mode === 'create' ? editor.draft.weight.trim() !== '' || editor.draft.date !== weightDraft(today, null).date
      : !sameDraft(editor.draft, weightDraft(parseDateFromDraft(editor) ?? today, editor.baseline));
    return !sameDraft(editor.draft, measurementDraft(editor.baseline, today));
  }
  close() {
    if (this.busy || this.state.intent) return;
    this.update({ editor: null, phase: this.state.phase === 'blocked' ? 'blocked' : 'idle', errors: {}, message: null });
  }

  async saveWeight() {
    const editor = this.state.editor, read = this.state.read, today = read.overview?.today;
    if (!this.canEdit() || editor?.kind !== 'weight' || !today) return;
    const parsed = validateWeightDraft(editor.draft, today);
    if ('errors' in parsed) { this.update({ errors: parsed.errors }); return; }
    let expected = editor.baseline;
    if (editor.mode === 'create') {
      // CAS needs the value this date really has. Inside the loaded range it is
      // known; older dates are looked up explicitly before anything is sent.
      const known = weightAt(read.weights, read.weightsCursor !== null, parsed.date);
      let existing: number | null;
      if (known.known) existing = known.weightKg;
      else {
        const next = shiftNutritionDate(parsed.date, 1) ?? parsed.date;
        this.busy = true;
        try {
          const page = await this.api.weights(next);
          if (page.status !== 'ok') { this.update({ message: 'No pudimos comprobar el peso de esa fecha. Revisá la conexión e intentá de nuevo.' }); return; }
          existing = page.data.items[0]?.date === parsed.date ? page.data.items[0].weightKg : null;
        } catch { this.update({ message: 'No pudimos comprobar el peso de esa fecha. Revisá la conexión e intentá de nuevo.' }); return; }
        finally { this.busy = false; }
        if (this.disposed) return;
      }
      if (existing !== editor.baseline) {
        // Replacing an existing weight is explicit: the user saw it before sending.
        this.update({ editor: { ...editor, baseline: existing }, message: existing === null ? null
          : `Ese día ya tiene ${formatKg(existing)}. Guardá de nuevo para reemplazarlo.` });
        if (existing !== null) return;
      }
      expected = existing;
    }
    await this.submit({ version: 1, kind: 'weight', editor: { ...editor, baseline: expected },
      intent: { operation: 'set', date: parsed.date, expectedWeightKg: expected, weightKg: parsed.weightKg, idempotencyKey: this.key() } });
  }
  async deleteWeight() {
    const editor = this.state.editor;
    if (!this.canEdit() || editor?.kind !== 'weight' || editor.mode !== 'edit') return;
    const date = parseDateFromDraft(editor);
    if (!date) return;
    await this.submit({ version: 1, kind: 'weight', editor,
      intent: { operation: 'delete', date, expectedWeightKg: editor.baseline, weightKg: null, idempotencyKey: this.key() } });
  }
  async saveMeasurement() {
    const editor = this.state.editor, read = this.state.read, today = read.overview?.today;
    if (!this.canEdit() || editor?.kind !== 'measurement' || !today) return;
    const baseline = editor.baseline;
    const parsed = validateMeasurementDraft(editor.draft, today, !!baseline && (baseline.armCm !== null || baseline.thighCm !== null));
    if ('errors' in parsed) { this.update({ errors: parsed.errors }); return; }
    if (read.measurements.some(m => m.measuredOn === parsed.fields.measuredOn && m.id !== baseline?.id)) {
      this.update({ errors: { date: 'Ya existe una medición para esa fecha. Editala o elegí otra fecha.' } }); return;
    }
    await this.submit({ version: 1, kind: 'measurement', editor, intent: baseline
      ? { operation: 'update', measurementId: baseline.id, expectedUpdatedAt: baseline.updatedAt, fields: parsed.fields, idempotencyKey: this.key() }
      : { operation: 'create', measurementId: null, expectedUpdatedAt: null, fields: parsed.fields, idempotencyKey: this.key() } });
  }
  async deleteMeasurement() {
    const editor = this.state.editor;
    if (!this.canEdit() || editor?.kind !== 'measurement' || !editor.baseline) return;
    await this.submit({ version: 1, kind: 'measurement', editor,
      intent: { operation: 'delete', measurementId: editor.baseline.id, expectedUpdatedAt: editor.baseline.updatedAt, fields: null, idempotencyKey: this.key() } });
  }

  private async submit(stored: StoredBodyIntent) {
    if (this.disposed || this.busy) return;
    this.busy = true; this.update({ phase: 'pending', message: null, errors: {} });
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
  private async send(stored: StoredBodyIntent) {
    let result: MobileApiRequestResult<BodyWeightReceipt> | MobileApiRequestResult<BodyMeasurementReceipt>;
    try { result = stored.kind === 'weight' ? await this.api.weight(stored.intent) : await this.api.measurement(stored.intent); }
    catch { this.update({ phase: 'uncertain', message: 'No sabemos si se guardó. Comprobar reenvía el mismo cambio, sin duplicarlo.' }); return; }
    if (result.status === 'ok') {
      const confirmed = { ...stored, receipt: result.data } as StoredBodyIntent;
      this.update({ phase: 'confirmed', intent: confirmed });
      await this.repository.write(confirmed);
      await this.confirmed(confirmed);
      return;
    }
    if (result.status === 'conflict' || result.status === 'validation' || result.status === 'not_found') {
      // Definitive outcome: nothing was applied. Keep the draft; refresh server truth.
      await this.repository.clear(stored.intent.idempotencyKey);
      this.update({ intent: null, phase: result.status === 'validation' ? 'idle' : 'conflict', message: result.message });
      await this.load();
      return;
    }
    this.update({ phase: 'uncertain', message: 'El resultado es incierto. Conservamos el cambio para comprobarlo cuando quieras.' });
  }
  private async confirmed(stored: StoredBodyIntent) {
    const fresh = await this.load();
    if (this.disposed) return;
    if (!fresh) { this.update({ phase: 'confirmed', message: 'Guardado confirmado. Falta actualizar la lectura; no vuelvas a enviarlo.' }); return; }
    await this.repository.clear(stored.intent.idempotencyKey);
    this.update({ phase: 'idle', intent: null, editor: null, errors: {}, message: null, notice: successNotice(stored) });
  }
  /** After a conflict the draft stays; the user rebases it on server truth explicitly. */
  reviewTruth() {
    const editor = this.state.editor, read = this.state.read;
    if (this.busy || this.state.phase !== 'conflict' || read.status !== 'ready' || !editor) return;
    if (editor.kind === 'weight') {
      const date = parseDateFromDraft(editor);
      const known = date ? weightAt(read.weights, read.weightsCursor !== null, date) : { known: false as const };
      const next: WeightEditor = known.known ? { ...editor, baseline: known.weightKg, mode: known.weightKg === null ? 'create' : editor.mode } : editor;
      this.update({ phase: 'idle', editor: next, message: known.known
        ? `Valor actual en el servidor: ${formatKg(known.weightKg)}. Revisá tu borrador antes de guardar de nuevo.`
        : 'Revisá tu borrador antes de guardar de nuevo.' });
      return;
    }
    const current = editor.baseline ? read.measurements.find(m => m.id === editor.baseline!.id) : undefined;
    const next: MeasurementEditor = editor.baseline && !current ? { ...editor, mode: 'create', baseline: null } : current ? { ...editor, baseline: current } : editor;
    this.update({ phase: 'idle', editor: next, message: editor.baseline && !current
      ? 'Esa medición ya no existe. Si guardás, se registra como nueva.' : 'Revisá tu borrador frente a los valores actuales antes de guardar de nuevo.' });
  }
  dismissNotice() { this.update({ notice: null }); }
}

function parseDateFromDraft(editor: WeightEditor): string | undefined {
  return parseInputNutritionDate(editor.draft.date.trim());
}
function successNotice(stored: StoredBodyIntent): string {
  if (stored.kind === 'weight') {
    const r = stored.receipt!;
    const current = r.currentWeightChanged ? (r.current ? ` Tu peso actual ahora es ${formatKg(r.current.weightKg)}.` : ' Ya no hay peso registrado.') : '';
    return `${r.operation === 'set' ? 'Peso guardado.' : 'Peso eliminado.'}${current}`;
  }
  const op = stored.intent.operation;
  if (op === 'delete') return 'Medición eliminada.';
  return op === 'update' && stored.editor.baseline?.qualityStatus === 'suspect' ? 'Medición corregida y verificada.' : 'Medición guardada.';
}
