import type { MobileApiReadResult, MobileApiRequestResult } from '@/api/results';
import { sameQuickSelection, type QuickOptions, type QuickOption, type QuickPreview, type QuickResponse, type QuickIntent, type QuickSelection } from '@/api/nutrition-quick';
import type { MobileNutritionDayResponse } from '@/api/nutrition-day';
import { QuickIntentRepository, type StoredQuickIntent } from './quick-storage';
import { quickDraft, selectionFromDraft, type QuickDraft } from './quick-model';
export type QuickApi = { options: () => Promise<MobileApiReadResult<QuickOptions>>; preview: (s: QuickSelection) => Promise<MobileApiRequestResult<QuickPreview>>;
  confirm: (i: QuickIntent) => Promise<MobileApiRequestResult<QuickResponse>>; read: (date: string) => Promise<MobileApiReadResult<MobileNutritionDayResponse>> };
export type QuickState = { phase: 'loading' | 'idle' | 'pending' | 'uncertain' | 'confirmed' | 'conflict' | 'blocked';
  open: boolean; date: string | null; options: QuickOptions | null; optionsLoading: boolean; optionsError: boolean;
  draft: QuickDraft | null; previousDraft: QuickDraft | null; preview: QuickPreview | null; previewLoading: boolean;
  intent: StoredQuickIntent | null; truth: QuickOption | null; message: string | null; errors: Record<string, string> };
export class QuickController {
  private state: QuickState = { phase: 'loading', open: false, date: null, options: null, optionsLoading: false, optionsError: false,
    draft: null, previousDraft: null, preview: null, previewLoading: false, intent: null, truth: null, message: null, errors: {} };
  private listeners = new Set<() => void>(); private disposed = false; private busy = false; private previewGeneration = 0; private optionsGeneration = 0;
  constructor(private api: QuickApi, private repository: QuickIntentRepository, private invalidate: () => void,
    private newKey: () => string = () => `quick:${Date.now()}:${Math.random().toString(36).slice(2)}`) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<QuickState>) { if (!this.disposed) { this.state = { ...this.state, ...patch }; this.listeners.forEach(f => f()); } }
  dispose() { this.disposed = true; this.previewGeneration++; this.optionsGeneration++; this.listeners.clear(); }
  async initialize() {
    try { const stored = await this.repository.read();
      this.update(stored ? { phase: stored.receipt ? 'confirmed' : 'uncertain', intent: stored, draft: stored.draft, date: stored.intent.date,
        message: stored.receipt ? 'El intento está confirmado. Falta actualizar los datos.' : 'Hay un intento rápido sin resultado confirmado. Comprobalo antes de guardar otra comida.' } : { phase: 'idle' });
    } catch { this.update({ phase: 'blocked', message: 'No pudimos leer el intento local. Comprobá el almacenamiento.' }); }
  }
  open(date: string) {
    if (this.state.phase !== 'idle' || this.state.intent || this.busy) return;
    this.previewGeneration++;
    this.update({ open: true, date, draft: null, previousDraft: null, preview: null, previewLoading: false, message: null, errors: {}, truth: null });
    void this.loadOptions();
  }
  close() {
    if (this.busy) return;
    this.previewGeneration++;
    this.update({ open: false, previewLoading: false,
      ...(this.state.phase === 'conflict' && !this.state.intent ? { phase: 'idle', draft: null, previousDraft: null, preview: null, truth: null, message: null } : {}) });
  }
  dirty() { const d = this.state.draft; return !!d && d.option.items.some(i => d.quantities[i.id] !== String(i.quantity).replace('.', ',')); }
  showRecovery() { if (this.state.intent && !this.busy) this.update({ open: true, date: this.state.intent.intent.date, draft: this.state.intent.draft }); }
  async loadOptions() {
    if (this.disposed) return;
    const generation = ++this.optionsGeneration; this.update({ optionsLoading: true, optionsError: false });
    try { const result = await this.api.options();
      if (this.disposed || generation !== this.optionsGeneration) return;
      if (result.status !== 'ok') { this.update({ optionsLoading: false, optionsError: true }); return; }
      this.update({ options: result.data, optionsLoading: false, optionsError: false });
      if (this.state.phase === 'conflict' && this.state.draft) {
        const src = this.state.draft.option.source, section = src.kind === 'saved' ? result.data.saved : result.data.suggested;
        this.update({ truth: section.status === 'ok' ? section.items.find(o => o.source.id === src.id) ?? null : null });
      }
    } catch { if (generation === this.optionsGeneration) this.update({ optionsLoading: false, optionsError: true }); }
  }
  choose(option: QuickOption) {
    if (this.state.phase !== 'idle' || this.state.intent || this.busy || !this.state.date) return;
    this.previewGeneration++; this.update({ draft: quickDraft(this.state.date, option), previousDraft: null, preview: null, message: null, errors: {}, truth: null });
    void this.requestPreview();
  }
  back() {
    if (this.state.intent || this.busy || this.state.phase === 'blocked') return;
    this.previewGeneration++; this.update({ phase: 'idle', draft: null, previousDraft: null, preview: null, previewLoading: false, truth: null, errors: {}, message: null });
  }
  change(itemId: string, value: string) {
    const d = this.state.draft;
    if (!d || !d.option.items.some(i => i.id === itemId) || this.state.intent || this.state.phase !== 'idle' || this.busy) return;
    this.previewGeneration++; this.update({ draft: { ...d, quantities: { ...d.quantities, [itemId]: value } }, preview: null, previewLoading: false, errors: {}, message: null });
  }
  async requestPreview() {
    if (this.disposed || this.state.phase !== 'idle' || !this.state.draft || this.busy || this.state.intent) return;
    const { selection, errors } = selectionFromDraft(this.state.draft);
    if (!selection) { this.update({ errors, preview: null }); return; }
    const generation = ++this.previewGeneration; this.update({ previewLoading: true, preview: null, errors: {}, message: null });
    try { const result = await this.api.preview(selection);
      if (this.disposed || generation !== this.previewGeneration || !this.state.open) return;
      if (result.status === 'ok' && sameQuickSelection(selection, result.data.selection)) this.update({ preview: result.data, previewLoading: false });
      else if (result.status === 'conflict') {
        this.update({ phase: 'conflict', previewLoading: false, message: result.message, truth: null }); await this.loadOptions();
      } else this.update({ previewLoading: false, message: result.status === 'validation' ? result.message : 'No pudimos calcular la vista previa. Tu selección sigue intacta.' });
    } catch { if (generation === this.previewGeneration) this.update({ previewLoading: false, message: 'No pudimos calcular la vista previa.' }); }
  }
  reviewTruth() {
    const { truth, draft } = this.state;
    if (!truth || !draft || this.state.phase !== 'conflict' || this.busy) return;
    // Deliberate review only. Web may replace ingredient IDs; preserve the old
    // draft as visible reference, never silently assign an old quantity to a new item.
    const next = quickDraft(draft.date, truth);
    for (const item of truth.items) if (draft.quantities[item.id] !== undefined) next.quantities[item.id] = draft.quantities[item.id];
    this.update({ phase: 'idle', draft: next, previousDraft: draft, truth: null, preview: null, message: 'Revisá esta versión y calculá una nueva vista previa antes de confirmar.' });
  }
  async save(operation: QuickIntent['operation'] = 'register') {
    const { draft, preview } = this.state;
    if (this.disposed || this.busy || this.state.phase !== 'idle' || this.state.intent || !draft || !preview) return;
    const selection = selectionFromDraft(draft).selection;
    if (!selection || !sameQuickSelection(preview.selection, selection) || operation === 'saveSuggestion' && selection.source.kind !== 'suggestion') return;
    const stored: StoredQuickIntent = { version: 1, intent: { ...selection, operation, idempotencyKey: this.newKey() }, draft };
    this.busy = true; this.previewGeneration++; this.update({ phase: 'pending', message: null });
    try { await this.repository.write(stored); this.update({ intent: stored }); await this.send(stored); }
    catch { this.update({ phase: 'blocked', message: 'No pudimos conservar el intento local. Comprobá el almacenamiento antes de continuar.' }); }
    finally { this.busy = false; }
  }
  async recover() {
    if (this.disposed || this.busy) return;
    if (!this.state.intent) { await this.initialize(); return; }
    this.busy = true; const stored = this.state.intent; this.update({ phase: 'pending', message: null });
    try { if (stored.receipt) await this.confirmed(stored); else await this.send(stored); }
    catch { this.update({ phase: 'uncertain', message: 'El intento sigue guardado. No pudimos comprobar su resultado.' }); }
    finally { this.busy = false; }
  }
  private async send(stored: StoredQuickIntent) {
    if (this.disposed) return;
    let result: MobileApiRequestResult<QuickResponse>;
    try { result = await this.api.confirm(stored.intent); }
    catch { this.update({ phase: 'uncertain', message: 'No sabemos si se guardó. Comprobar usa exactamente el mismo intento.' }); return; }
    if (result.status === 'ok' && !('error' in result.data)) {
      const confirmed = { ...stored, receipt: result.data }; this.update({ intent: confirmed, phase: 'confirmed' });
      await this.repository.write(confirmed); await this.confirmed(confirmed); return;
    }
    if (['conflict','validation','not_found'].includes(result.status)) {
      await this.repository.clear(stored.intent.idempotencyKey);
      const message = 'message' in result ? result.message : 'Revisá la opción.';
      this.update({ intent: null, phase: result.status === 'validation' ? 'idle' : 'conflict', preview: null, message, truth: null });
      if (result.status === 'conflict') await this.loadOptions(); return;
    }
    this.update({ phase: 'uncertain', message: 'El resultado es incierto. Conservamos el intento; recuperalo explícitamente.' });
  }
  private async confirmed(stored: StoredQuickIntent) {
    const receipt = stored.receipt!; this.invalidate();
    if (receipt.operation === 'register') {
      const result = await this.api.read(receipt.date);
      if (this.disposed) return;
      if (result.status !== 'ok' || result.data.date !== receipt.date || result.data.nutrition.status !== 'ok') {
        this.update({ phase: 'confirmed', message: 'La comida está confirmada. Falta actualizar el día; no vuelvas a registrarla.' }); return;
      }
    } else {
      await this.loadOptions();
      if (this.disposed) return;
      if (this.state.optionsError || this.state.options?.saved.status !== 'ok') {
        this.update({ phase: 'confirmed', message: 'La habitual está confirmada. Falta actualizar la lista.' }); return;
      }
    }
    await this.repository.clear(stored.intent.idempotencyKey);
    this.update({ phase: 'idle', intent: null, open: false, draft: null, preview: null, previousDraft: null, truth: null,
      message: receipt.operation === 'register' ? 'Comida registrada.' : 'Guardada como habitual. No agregamos otra comida al día.' });
  }
}
