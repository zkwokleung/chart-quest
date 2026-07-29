import type { Series, SeriesId } from "@/lib/chart/types";
import type { LevelId, YAxisMode } from "@/lib/store/schema";

/**
 * The interaction primitives levels are built from.
 *
 * ~73 levels must not become ~73 components, so every level is *data* naming one
 * of these kinds. The union grows one milestone at a time; a new kind needs a
 * level the existing ones genuinely cannot express. See docs/ARCHITECTURE.md.
 */
export type LevelKind = "classify" | "mark-bars" | "predict-next";

export type ToolId =
  | "crosshair"
  | "timeframe"
  | "log-scale"
  | "y-axis-mode"
  | "measure";

/**
 * A window into a committed series, addressed by bar index rather than date.
 * `to` is exclusive. See docs/DATA.md on why indices are the addressing scheme.
 */
export type LevelSlice = {
  series: SeriesId;
  from: number;
  to: number;
  /** Short label when a level shows several charts at once (MTF, multi-asset). */
  label?: string;
  /**
   * Bars visible before the reveal, counted from `from`. `predict-next` only:
   * everything at or after this index is hidden until the player commits.
   */
  reveal?: number;
};

/**
 * The parts of a single candle, for the `candle-anatomy` mode.
 *
 * `open` and `close` are the two edges of the body; the wicks are the lines above
 * and below it.
 */
export type CandlePart = "upper-wick" | "lower-wick" | "body" | "open" | "close";

/**
 * A thing the player marked.
 *
 * `mark-bars` grades both bar clicks and candle-part clicks through the same
 * set-overlap logic, but bar marks are numeric (they need `barSlop` arithmetic)
 * and part marks are an enum. Encoding both as tagged strings keeps one kind
 * instead of two nearly-identical ones; `mark.ts` owns the encoding so nothing
 * downstream parses these by hand.
 */
export type Mark = `bar:${number}` | `part:${CandlePart}`;

/** What the player submitted. Discriminated by kind. */
export type Attempt = {
  classify: { kind: "classify"; selected: string[]; hintsUsed: number };
  "mark-bars": { kind: "mark-bars"; marks: Mark[]; hintsUsed: number };
  "predict-next": {
    kind: "predict-next";
    /** One entry per round, in order. `null` means not yet answered. */
    calls: (Direction | null)[];
    hintsUsed: number;
  };
};

export type Direction = "up" | "down";

export type ClassifyOption = {
  id: string;
  label: string;
  /** Shown after committing, whether or not this option was chosen. */
  note?: string;
};

export type KindConfig = {
  classify: {
    prompt: string;
    options: ClassifyOption[];
    multiple?: boolean;
    /** Bars to animate in after committing, revealing what happened next. */
    revealBars?: number;
  };
  "mark-bars": {
    prompt: string;
    /**
     * `bars` clicks candles in a series. `candle-anatomy` magnifies a single
     * candle and asks for one of its parts — same click-and-grade machinery,
     * different render.
     */
    mode: "bars" | "candle-anatomy";
    /** candle-anatomy only: which bar of the slice to magnify. */
    focusBar?: number;
    /** How many marks the player is expected to make; shown in the UI. */
    expected?: number;
  };
  "predict-next": {
    prompt: string;
    /** One slice per round. Each carries its own `reveal`. */
    rounds: LevelSlice[];
    /** Bars revealed after each call. */
    horizon: number;
  };
};

export type KindTarget = {
  classify: { correct: string[] };
  "mark-bars": { marks: Mark[] };
  /**
   * `predict-next` has no authored target — the answer is whatever the data did.
   * The grader derives it, which is also why the kind cannot be brute-forced by
   * reading the level file.
   */
  "predict-next": Record<string, never>;
};

export type KindTolerance = {
  classify: Record<string, never>;
  "mark-bars": {
    /** A mark this many bars either side of a target still counts. */
    barSlop: number;
  };
  "predict-next": Record<string, never>;
};

/**
 * A named wrong answer, with a test that recognises it.
 *
 * This is where the teaching lives. A grader returning `0.62` tells the player
 * nothing; one returning *"you anchored to bodies, not wicks"* tells them the
 * thing. Every level authors at least two, enforced by test.
 *
 * `test` must be pure — the authoring guards depend on it being deterministic.
 */
export type Misconception<K extends LevelKind = LevelKind> = DiagnosisEntry & {
  test: (attempt: Attempt[K], level: Level<K>, data: Series<string>[]) => boolean;
};

/**
 * The displayable half of a misconception.
 *
 * The `test` is authoring-time and kind-specific; the UI only ever needs what to
 * say. Splitting them keeps `Grade` free of a kind-generic function type, which
 * would otherwise make a grade impossible to hold without knowing its kind.
 */
export type DiagnosisEntry = {
  id: string;
  message: string;
  /** Emphasised in the diagnosis when several match. */
  overlay?: OverlaySpec;
};

/** How to draw the correction against the player's own attempt. */
export type OverlaySpec =
  | { kind: "none" }
  | { kind: "marks"; missed: Mark[]; wrong: Mark[]; hit: Mark[] }
  | { kind: "options"; correct: string[]; chosen: string[] }
  | { kind: "calls"; actual: Direction[]; called: (Direction | null)[] };

export type StarThresholds = [number, number, number];

export type Level<K extends LevelKind = LevelKind> = {
  id: LevelId;
  chapter: number;
  title: string;
  kind: K;
  /** One or two sentences, max. Any figure quoted here must be measured. */
  brief: string;
  data: LevelSlice[];
  config: KindConfig[K];
  target: KindTarget[K];
  tolerance: KindTolerance[K];
  /** Score needed for 1, 2 and 3 stars. Ascending, all within (0, 1]. */
  stars: StarThresholds;
  /** At least two. See `Misconception`. */
  misconceptions: Misconception<K>[];
  /** Progressive: redirect attention first, narrow the search second. */
  hints: string[];
  unlocks?: ToolId[];
  yAxis?: YAxisMode;
};

/** Any level, usable where the kind is not known statically. */
export type AnyLevel =
  | Level<"classify">
  | Level<"mark-bars">
  | Level<"predict-next">;

export function isKind<K extends LevelKind>(
  level: AnyLevel,
  kind: K,
): level is Extract<AnyLevel, { kind: K }> {
  return level.kind === kind;
}
