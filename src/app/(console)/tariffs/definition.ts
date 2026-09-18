/**
 * A tariff version's definition: the shape, and the editor's draft of it.
 *
 * These types are written here rather than in `@/lib/api/types` because the
 * definition is only ever handled by these screens. The API validates a
 * definition on the way in and explains anything it refuses, so what happens
 * here is only enough checking to keep an obvious typo from becoming a round
 * trip — the API stays the authority.
 *
 * Amounts and rates are in the currency's **minor units**. A rate is a string
 * with up to four further decimal places, because a per-minute price is
 * routinely a fraction of a paisa; `sessionFeeMinor` is a whole-number JSON
 * integer, which is the one exception and is the API's own choice.
 */

export const ROUNDING_MODES = ['half_up', 'half_even'] as const;
export type RoundingMode = (typeof ROUNDING_MODES)[number];

export interface TimeOfDayBand {
  /** `HH:MM` in the site's time zone. */
  start: string;
  /** `HH:MM`, exclusive, or `24:00`. Earlier than `start` crosses midnight. */
  end: string;
  /** ISO weekdays, 1 Monday to 7 Sunday. Absent means every day. */
  daysOfWeek?: number[];
  pricePerKwhMinor: string;
}

export interface TariffDefinition {
  sessionFeeMinor?: number;
  energy?: {
    pricePerKwhMinor: string;
    timeOfDay?: TimeOfDayBand[];
  };
  chargingTime?: { pricePerMinuteMinor: string };
  idle?: { pricePerMinuteMinor: string; graceMinutes: number };
  occupancy?: { pricePerMinuteMinor: string; graceMinutes: number };
}

/** Minor units with at most four decimals, never negative. */
const RATE = /^(0|[1-9]\d{0,11})(\.\d{1,4})?$/;
const WHOLE = /^(0|[1-9]\d{0,11})$/;
const WALL_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const WALL_TIME_OR_MIDNIGHT = /^(([01]\d|2[0-3]):([0-5]\d)|24:00)$/;

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** `18:00–22:00 Mon, Tue` — how a band reads on a screen. */
export function describeBand(band: TimeOfDayBand): string {
  const days = band.daysOfWeek?.length
    ? [...band.daysOfWeek]
        .sort((a, b) => a - b)
        .map((day) => DAY_NAMES[day - 1] ?? day)
        .join(', ')
    : 'every day';
  return `${band.start}–${band.end} ${days}`;
}

// ---------------------------------------------------------------------------
// The draft the form edits
// ---------------------------------------------------------------------------

export interface BandDraft {
  start: string;
  end: string;
  /** Empty means every day, which is how the API reads an absent list. */
  days: number[];
  price: string;
}

export interface DefinitionDraft {
  sessionFee: { on: boolean; amount: string };
  energy: { on: boolean; price: string; bands: BandDraft[] };
  chargingTime: { on: boolean; price: string };
  idle: { on: boolean; price: string; grace: string };
  occupancy: { on: boolean; price: string; grace: string };
}

export const EMPTY_DRAFT: DefinitionDraft = {
  sessionFee: { on: false, amount: '' },
  energy: { on: true, price: '', bands: [] },
  chargingTime: { on: false, price: '' },
  idle: { on: false, price: '', grace: '15' },
  occupancy: { on: false, price: '', grace: '0' },
};

export const EMPTY_BAND: BandDraft = {
  start: '',
  end: '',
  days: [],
  price: '',
};

type Built = { definition: TariffDefinition } | { error: string };

function grace(value: string, part: string): number | string {
  if (!/^\d{1,4}$/.test(value)) return `${part}: grace minutes must be a whole number`;
  const minutes = Number(value);
  if (minutes > 24 * 60) return `${part}: grace minutes cannot exceed 1440`;
  return minutes;
}

/** The draft as the API wants it, or the first thing wrong with it. */
export function buildDefinition(draft: DefinitionDraft): Built {
  const definition: TariffDefinition = {};

  if (draft.sessionFee.on) {
    if (!WHOLE.test(draft.sessionFee.amount)) {
      return { error: 'Session fee must be a whole number of minor units' };
    }
    definition.sessionFeeMinor = Number(draft.sessionFee.amount);
  }

  if (draft.energy.on) {
    if (!RATE.test(draft.energy.price)) {
      return { error: 'Energy price must be minor units, at most 4 decimals' };
    }
    const bands: TimeOfDayBand[] = [];
    for (const [index, band] of draft.energy.bands.entries()) {
      const where = `Band ${index + 1}`;
      if (!WALL_TIME.test(band.start)) {
        return { error: `${where}: start must be HH:MM` };
      }
      if (!WALL_TIME_OR_MIDNIGHT.test(band.end)) {
        return { error: `${where}: end must be HH:MM, or 24:00` };
      }
      if (band.start === band.end) {
        return {
          error: `${where}: a band cannot start and end at the same time`,
        };
      }
      if (!RATE.test(band.price)) {
        return { error: `${where}: price must be minor units, at most 4 decimals` };
      }
      bands.push({
        start: band.start,
        end: band.end,
        ...(band.days.length > 0
          ? { daysOfWeek: [...band.days].sort((a, b) => a - b) }
          : {}),
        pricePerKwhMinor: band.price,
      });
    }
    definition.energy = {
      pricePerKwhMinor: draft.energy.price,
      ...(bands.length > 0 ? { timeOfDay: bands } : {}),
    };
  }

  if (draft.chargingTime.on) {
    if (!RATE.test(draft.chargingTime.price)) {
      return { error: 'Charging time price must be minor units, at most 4 decimals' };
    }
    definition.chargingTime = { pricePerMinuteMinor: draft.chargingTime.price };
  }

  if (draft.idle.on) {
    if (!RATE.test(draft.idle.price)) {
      return { error: 'Idle price must be minor units, at most 4 decimals' };
    }
    const minutes = grace(draft.idle.grace, 'Idle');
    if (typeof minutes === 'string') return { error: minutes };
    definition.idle = {
      pricePerMinuteMinor: draft.idle.price,
      graceMinutes: minutes,
    };
  }

  if (draft.occupancy.on) {
    if (!RATE.test(draft.occupancy.price)) {
      return { error: 'Occupancy price must be minor units, at most 4 decimals' };
    }
    const minutes = grace(draft.occupancy.grace, 'Occupancy');
    if (typeof minutes === 'string') return { error: minutes };
    definition.occupancy = {
      pricePerMinuteMinor: draft.occupancy.price,
      graceMinutes: minutes,
    };
  }

  if (Object.keys(definition).length === 0) {
    return { error: 'A tariff needs at least one part' };
  }
  return { definition };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A stored definition as a draft, or `null` when the form cannot hold it —
 * a definition written by a newer build, say. The raw JSON view then has it.
 */
export function draftFromDefinition(value: unknown): DefinitionDraft | null {
  if (!isObject(value)) return null;
  const known = [
    'sessionFeeMinor',
    'energy',
    'chargingTime',
    'idle',
    'occupancy',
  ];
  if (Object.keys(value).some((key) => !known.includes(key))) return null;

  const draft: DefinitionDraft = {
    ...EMPTY_DRAFT,
    energy: { on: false, price: '', bands: [] },
  };

  if (value.sessionFeeMinor !== undefined) {
    if (typeof value.sessionFeeMinor !== 'number') return null;
    draft.sessionFee = { on: true, amount: String(value.sessionFeeMinor) };
  }

  if (value.energy !== undefined) {
    const energy = value.energy;
    if (!isObject(energy) || typeof energy.pricePerKwhMinor !== 'string') {
      return null;
    }
    const bands: BandDraft[] = [];
    if (energy.timeOfDay !== undefined) {
      if (!Array.isArray(energy.timeOfDay)) return null;
      for (const raw of energy.timeOfDay) {
        if (
          !isObject(raw) ||
          typeof raw.start !== 'string' ||
          typeof raw.end !== 'string' ||
          typeof raw.pricePerKwhMinor !== 'string'
        ) {
          return null;
        }
        const days = raw.daysOfWeek;
        if (days !== undefined && !Array.isArray(days)) return null;
        bands.push({
          start: raw.start,
          end: raw.end,
          days: (days ?? []).filter(
            (day): day is number => typeof day === 'number',
          ),
          price: raw.pricePerKwhMinor,
        });
      }
    }
    draft.energy = { on: true, price: energy.pricePerKwhMinor, bands };
  }

  if (value.chargingTime !== undefined) {
    const part = value.chargingTime;
    if (!isObject(part) || typeof part.pricePerMinuteMinor !== 'string') {
      return null;
    }
    draft.chargingTime = { on: true, price: part.pricePerMinuteMinor };
  }

  for (const key of ['idle', 'occupancy'] as const) {
    const part = value[key];
    if (part === undefined) continue;
    if (
      !isObject(part) ||
      typeof part.pricePerMinuteMinor !== 'string' ||
      typeof part.graceMinutes !== 'number'
    ) {
      return null;
    }
    draft[key] = {
      on: true,
      price: part.pricePerMinuteMinor,
      grace: String(part.graceMinutes),
    };
  }

  return draft;
}

// ---------------------------------------------------------------------------
// The editor, which is a form and a raw JSON view of the same thing
// ---------------------------------------------------------------------------

export interface EditorState {
  mode: 'form' | 'json';
  draft: DefinitionDraft;
  json: string;
}

export const NEW_EDITOR: EditorState = {
  mode: 'form',
  draft: EMPTY_DRAFT,
  json: '{}',
};

/** An editor holding an existing definition, for a version copied forward. */
export function editorFrom(definition: unknown): EditorState {
  const draft = draftFromDefinition(definition);
  return {
    mode: draft ? 'form' : 'json',
    draft: draft ?? EMPTY_DRAFT,
    json: JSON.stringify(definition, null, 2),
  };
}

/** What the editor would send, or why it cannot yet. */
export function definitionOf(state: EditorState): Built {
  if (state.mode === 'form') return buildDefinition(state.draft);
  let parsed: unknown;
  try {
    parsed = JSON.parse(state.json);
  } catch {
    return { error: 'That is not valid JSON' };
  }
  if (!isObject(parsed)) return { error: 'A definition is a JSON object' };
  return { definition: parsed as TariffDefinition };
}

/**
 * Moving between the two views.
 *
 * Going to JSON always works — the form's draft can always be written out,
 * even half-finished, as far as it is valid. Coming back only works when the
 * JSON is something the form can hold, and says so when it is not.
 */
export function toJsonMode(state: EditorState): EditorState {
  const built = buildDefinition(state.draft);
  return {
    ...state,
    mode: 'json',
    json: 'definition' in built ? JSON.stringify(built.definition, null, 2) : state.json,
  };
}

export function toFormMode(state: EditorState): EditorState | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(state.json);
  } catch {
    return { error: 'Fix the JSON before going back to the form' };
  }
  const draft = draftFromDefinition(parsed);
  if (!draft) {
    return {
      error: 'The form cannot hold this definition. Keep editing it as JSON.',
    };
  }
  return { ...state, mode: 'form', draft };
}
