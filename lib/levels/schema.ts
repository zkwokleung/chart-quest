import type { Drawing, Side } from "@/lib/chart/geometry";
import type { IndicatorSpec } from "@/lib/chart/indicator-data";
import type { Series, SeriesId } from "@/lib/chart/types";
import type { TradeSide } from "@/lib/trade/simulate";
import type { LevelId, YAxisMode } from "@/lib/store/schema";

/**
 * The interaction primitives levels are built from.
 *
 * ~73 levels must not become ~73 components, so every level is *data* naming one
 * of these kinds. The union grows one milestone at a time; a new kind needs a
 * level the existing ones genuinely cannot express. See docs/ARCHITECTURE.md.
 */
export type LevelKind =
  | "classify"
  | "mark-bars"
  | "predict-next"
  | "annotate"
  | "replay-trade"
  | "tune-param"
  | "composite";

/** Every kind a composite step may use. Nesting is excluded by construction. */
export type StepKind = Exclude<LevelKind, "composite">;

export type ToolId =
  "crosshair" | "timeframe" | "log-scale" | "y-axis-mode" | "measure";

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
};

/**
 * The parts of a single candle, for the `candle-anatomy` mode.
 *
 * `open` and `close` are the two edges of the body; the wicks are the lines above
 * and below it.
 */
export type CandlePart =
  "upper-wick" | "lower-wick" | "body" | "open" | "close";

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
  annotate: { kind: "annotate"; drawing: Drawing | null; hintsUsed: number };
  "replay-trade": {
    kind: "replay-trade";
    /** The bar the player committed on. Entry fills at its close. */
    entryBar: number;
    stop: number;
    target: number | null;
    /**
     * Why they took it, in their own words.
     *
     * Required by the config rather than optional decoration: Chapter 9.6 analyses
     * the player's stated reasons against their own results, and it can only do
     * that if the very first trade carried one.
     */
    reason: string;
    hintsUsed: number;
  };
  "tune-param": {
    kind: "tune-param";
    /** Where the slider was left. */
    value: number;
    /**
     * Every value the slider rested on, in order.
     *
     * Kept because some of these levels have no right answer — 5.1 is about the
     * lag trade-off, not about a correct period — and for those the thing worth
     * scoring is whether the player actually looked.
     */
    visited: number[];
    hintsUsed: number;
  };
  composite: {
    kind: "composite";
    /** One entry per step, in order. `null` until that step is committed. */
    steps: (StepAttempt | null)[];
    hintsUsed: number;
  };
};

/** A step's attempt, with its own kind still discriminable. */
export type StepAttempt = Attempt[StepKind];

/**
 * One stage of a boss: a Level without its identity.
 *
 * Shaped this way so `stepAsLevel` can synthesise a real `Level` and hand it to
 * the existing kind component and grader — a boss reuses the whole engine rather
 * than adding a parallel path.
 */
export type CompositeStep<K extends StepKind = StepKind> = {
  kind: K;
  /** Relative contribution to the final score. Weights sum to 1. */
  weight: number;
  brief: string;
  config: KindConfig[K];
  target: KindTarget[K];
  tolerance: KindTolerance[K];
  /** At least two, same as any level. Guard-enforced per step. */
  misconceptions: Misconception<K>[];
  /** Defaults to the composite's own data. */
  data?: LevelSlice[];
};

export type AnyStep =
  | CompositeStep<"classify">
  | CompositeStep<"mark-bars">
  | CompositeStep<"predict-next">
  | CompositeStep<"annotate">
  // Boss 4.B scans an unseen chart and then trades it, and 5.B and 6.B do the
  // same with indicators and two timeframes. Including it here is what makes
  // those levels authoring rather than building.
  | CompositeStep<"replay-trade">
  | CompositeStep<"tune-param">;

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
  annotate: {
    prompt: string;
    shape: Drawing["shape"];
    /** Which extreme the drawing should track. */
    side: Side;
    /** Touches needed for full marks on that component of the score. */
    requiredTouches: number;
    /**
     * Expected sign of the slope. A support line sloping the wrong way is not the
     * thing asked for, so this is a gate rather than a scored component.
     */
    expectSlope?: "up" | "down" | "flat";
  };
  composite: {
    /** Walked in order; each is graded on commit before the next appears. */
    steps: AnyStep[];
  };
  "predict-next": {
    prompt: string;
    /**
     * Bars revealed past the end of a slice once the call is committed. Each
     * entry in `level.data` is one round, so the rounds are not listed twice —
     * which also means the authoring guards' bar-range checks cover them.
     */
    horizon: number;
  };
  "tune-param": {
    prompt: string;
    /** What the slider controls, for the label and the live readout. */
    label: string;
    min: number;
    max: number;
    step: number;
    initial: number;
    /** The indicator drawn at a given slider value. */
    indicator: (value: number) => IndicatorSpec;
    /**
     * How the level is scored.
     *
     * `target` means there is a measured right answer and the slider should find
     * it. `exploration` means there is not — 5.1 teaches that a shorter average
     * lags less and whips more, a trade-off with no winning period — and the score
     * is whether the player moved across enough of the range to have seen it.
     *
     * This is the same call `predict-next` makes in scoring participation rather
     * than accuracy, and for the same reason: a level with no right answer must not
     * pretend to have one, because the player will believe it.
     */
    scoring: "target" | "exploration";
    /** Share of the range that must be covered, for `exploration`. Default 0.6. */
    exploreFraction?: number;
  };
  "replay-trade": {
    prompt: string;
    side: TradeSide;
    /** Bars shown before the player may act. The rest arrive through the replay. */
    primeBars: number;
    /** Bars the replay will advance before forcing an exit at the close. */
    maxBars: number;
    /**
     * Reward:risk needed for full marks on that component of the plan score.
     *
     * A gate on quality of thinking, not on outcome: a 1:1 trade needs to be right
     * more than half the time to break even, which is the arithmetic Chapter 7
     * makes explicit and Chapter 3 introduces.
     */
    minRR: number;
    /** ATR period for judging whether a stop has room. */
    atrPeriod?: number;
  };
};

export type KindTarget = {
  classify: { correct: string[] };
  "mark-bars": { marks: Mark[] };
  /**
   * Shown as the correction and used by `perfectAttempt`, never to score. A
   * trendline is not unique — BTC-1d alone holds 182 lines with three or more
   * touches and no body cuts — so grading against one author's line would mark
   * most correct answers wrong.
   */
  annotate: { reference: Drawing };
  /**
   * The structure the stop is meant to respect, and the bar the setup triggers on.
   *
   * There is no "correct" stop price: many are defensible, so the plan is scored on
   * whether it sits beyond this structure with sensible room, not on matching a
   * number. Same reasoning as the trendline reference in `annotate`.
   */
  "replay-trade": { structure: Drawing; triggerBar: number };
  /** The measured answer. Ignored entirely when scoring is `exploration`. */
  "tune-param": { value: number };
  /** A composite's answers live on its steps. */
  composite: Record<string, never>;
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
  annotate: {
    /** Price tolerance as a fraction of the window's high-low span. Scale-free. */
    priceFracOfRange: number;
    barSlop: number;
  };
  composite: Record<string, never>;
  "predict-next": Record<string, never>;
  "tune-param": {
    /** Distance from the target that still earns full marks. */
    slop: number;
  };
  "replay-trade": {
    /**
     * How much room a stop needs beyond the structure, and how much is too much,
     * both in ATR multiples.
     *
     * In ATR rather than price because the same numbers then work on Bitcoin at
     * 25,000 and the euro at 1.09. A stop with less than `minAtr` of room is
     * sitting where everyone else's is; more than `maxAtr` is not a stop, it is a
     * hope.
     */
    minAtr: number;
    maxAtr: number;
    /** Bars either side of the trigger that still count as entering on time. */
    barSlop: number;
  };
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
  test: (
    attempt: Attempt[K],
    level: Level<K>,
    data: Series<string>[],
  ) => boolean;
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
  | { kind: "calls"; actual: Direction[]; called: (Direction | null)[] }
  | {
      kind: "drawing";
      drawn: Drawing | null;
      reference: Drawing;
      touched: number[];
      cuts: number[];
    }
  | {
      kind: "param";
      chosen: number;
      /** Absent when the level has no right answer. */
      target: number | null;
      explored: number;
    }
  | {
      kind: "trade";
      structure: Drawing;
      entryPrice: number;
      stop: number;
      target: number | null;
      exitBar: number;
      exitPrice: number;
      /** Risk-multiples achieved. Journalled from here, so the record and the
          score card cannot disagree about what happened. */
      r: number;
      /** How the trade ended, in the words the score card uses. */
      outcome: string;
    };

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
  | Level<"predict-next">
  | Level<"annotate">
  | Level<"replay-trade">
  | Level<"tune-param">
  | Level<"composite">;

export function isKind<K extends LevelKind>(
  level: AnyLevel,
  kind: K,
): level is Extract<AnyLevel, { kind: K }> {
  return level.kind === kind;
}
