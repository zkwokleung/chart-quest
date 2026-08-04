import type { Block, BlockKind } from "@/lib/backtest/blocks";
import type { Objective } from "@/lib/backtest/guards";
import type { Drawing, Side } from "@/lib/chart/geometry";
import type { IndicatorSpec } from "@/lib/chart/indicator-data";
import type { Series, SeriesId } from "@/lib/chart/types";
import type { SignalId } from "@/lib/ta/correlation";
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
  | "sort-rank"
  | "spot-the-flaw"
  | "sizing-calc"
  | "trade-sequence"
  | "probe"
  | "build-rules"
  | "composite";

/**
 * Every kind a composite step may use.
 *
 * Nesting is excluded by construction, and `probe` by judgement: it reads the whole data
 * spine rather than the level's own slices, so a probe stage would quietly widen what a boss
 * is testing — which is the thing the "composite steps stay on the boss's series" guard exists
 * to prevent. Excluding it also keeps the composite chunk from importing the probe component,
 * since `step-components.ts` is eager.
 *
 * `build-rules` is excluded for the same two reasons and a third. It runs over a *set* of series
 * chosen by its own config — 10.7's whole point is three markets at once — so a stage of it would
 * widen a boss's scope past anything the guard can see. And it is the heaviest component in the
 * project, so putting it in the eager step map would give every boss the composer. Chapter 10's
 * boss is a page rather than a composite for exactly this reason.
 */
export type StepKind = Exclude<LevelKind, "composite" | "probe" | "build-rules">;

/**
 * What kind of setup a trade was, for the journal to group by.
 *
 * **Authored on the level, never derived.** Three cheaper derivations were considered and all
 * three are wrong:
 *
 * - From `tags`, which holds `[side, seriesId, "N-star"]`. A side and a series id is not a
 *   setup; deriving one from them is inventing it.
 * - From `target.structure.shape`. That is the shape of the *structure*, not the setup — 3.B's
 *   pullback and 7.4's structural stop both rest on a `level`, so it would silently mislabel
 *   half the record. It is the option that looks right.
 * - By keyword-matching the player's stated `reason`. Unfalsifiable prose, in a project whose
 *   selling point is that every number is recomputable. `reason` is displayed verbatim and is
 *   never a grouping key.
 *
 * **Three ids rather than one per level.** Eight planned trades over six ids would be one per
 * 1.3 trades and every by-setup cell would be n=1, which is a breakdown that cannot say
 * anything. Three gets at least one cell to n>=3; per-level detail lives in the by-series
 * breakdown instead.
 */
export type SetupId = "continuation" | "reversal" | "level";

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
  "sort-rank": {
    kind: "sort-rank";
    /** Item ids in the order the player left them, best-first. */
    order: string[];
    hintsUsed: number;
  };
  "spot-the-flaw": {
    kind: "spot-the-flaw";
    /** Claim ids the player marked as faulty. */
    flagged: string[];
    hintsUsed: number;
  };
  "sizing-calc": {
    kind: "sizing-calc";
    /** One entry per position asked about, in order. `null` means left blank. */
    values: (number | null)[];
    hintsUsed: number;
  };
  probe: {
    kind: "probe";
    /** Where the control was left. */
    value: number;
    /**
     * Every resting position, in order.
     *
     * The same reason `tune-param` keeps them: 8.2's answer is worthless unless the player
     * swept to find it, because a lucky landing on the crossing horizon teaches nothing
     * about horizons.
     */
    visited: number[];
    hintsUsed: number;
  };
  "trade-sequence": {
    kind: "trade-sequence";
    /** Fraction of the account risked on each trade, in order. */
    risks: number[];
    hintsUsed: number;
  };
  /**
   * **The strategy the player composed *is* the attempt.**
   *
   * The decision Chapter 10 turns on. `CONVENTIONS.md` holds that no level's graded answer may
   * depend on the store — `strategies` is empty on a fresh save, after `resetProgress`, and in
   * private mode — so a level cannot grade "the strategy you saved earlier". Carrying it on the
   * attempt instead means the grader receives everything it needs as an argument, runs the engine
   * over `level.data`, and stays as pure as every other grader in the project.
   *
   * `predict-next` is the precedent for the other half: it authors no target because the answer is
   * whatever the data did. Here the *answer* is derived the same way, and `target.reference` exists
   * only so `perfectAttempt` can prove the objective is reachable.
   */
  "build-rules": {
    kind: "build-rules";
    entry: Block[];
    exit: ExitRule;
    risk: RiskRule;
    /** How many variants the player ran before committing. Their own count, warned on past ten. */
    variants: number;
    hintsUsed: number;
  };
  composite: {
    kind: "composite";
    /** One entry per step, in order. `null` until that step is committed. */
    steps: (StepAttempt | null)[];
    hintsUsed: number;
  };
};

/**
 * How a composed strategy gets out, and how much it risks.
 *
 * Separate from `StopRule` and `TargetRule` in `lib/backtest/engine.ts` on purpose: those are what
 * the engine consumes, and these are what a player chose. The two are one field apart today and the
 * indirection has already earned itself once — `riskPct` has no meaning to the engine, which works
 * entirely in R, and belongs to the sizing question 10.4 asks.
 */
export type ExitRule = {
  /** Stop distance in ATR. ATR-relative so a rule is portable across the spine by construction. */
  stopAtr: number;
  /** Target as a multiple of the risk taken, or null to run to the stop or the clock. */
  targetR: number | null;
  timeStopBars: number;
};

export type RiskRule = {
  /** Share of the account risked per trade, as a fraction. Chapter 7's number. */
  perTradePct: number;
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
  | CompositeStep<"spot-the-flaw">
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
    /**
     * A measured table to show once the answer is committed.
     *
     * Named rather than carried, like `sort-rank.reveal` and for the same reason: the numbers
     * live in `public/data/asset-character.json`, and retyping them into a level file is how
     * a level comes to disagree with the measurement it rests on.
     */
    reveal?: "asset-correlation";
    /**
     * An artefact shown *before* the answer is committed, because it is the evidence.
     *
     * Distinct from `reveal`, which is a correction. 9.2's distribution and 9.6's journal
     * report are what the question is *about* — hiding them until commit would leave nothing to
     * reason from.
     *
     * Both read state the grader cannot: the player's stored 1.B score, and their own trade
     * record. A kind *component* may read the store; only graders must stay pure. What keeps
     * these levels gradeable is that their answers are author-known anyway — see the level files.
     */
    artefact?: "coin-flip-distribution" | "journal-analytics";
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
  "build-rules": {
    prompt: string;
    /**
     * Which blocks the palette offers.
     *
     * `"unlocked"` means everything the player's own progress has earned — the palette as their
     * progress made concrete, which is issue #28's phrase for it. A level may narrow it to a list
     * instead, which is how 10.3 can teach composing with two blocks before handing over five.
     *
     * Resolved by `resolvePalette` in a *component*, which may read the store. The grader never
     * consults it: a strategy is scored on what it does, not on whether the player was allowed the
     * blocks they used, or a saved strategy would stop grading when a save was cleared.
     */
    palette: "unlocked" | BlockKind[];
    /**
     * What the run has to achieve. Stated per asset, never over the pooled total.
     *
     * 10.7's reason for existing and 8.5's flawed claim inverted: a rule making +50R on one market
     * and losing on three others is "profitable pooled", and that is the sentence 8.5 asks the
     * player to mark as not following.
     */
    objective: Objective;
    /** Bars the player may not tune on, held back until the run is committed. */
    holdback?: { series: SeriesId; from: number; to: number }[];
    /** Fix parts of the strategy the level is not asking about, so one question is asked at a time. */
    fixed?: Partial<{ exit: ExitRule; risk: RiskRule; side: TradeSide }>;
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
  probe: {
    prompt: string;
    /**
     * The measurement the control drives, named rather than passed as a function.
     *
     * A function in a level file would put the computation somewhere no test can recompute
     * it and would ship the estimator to the client. The numbers come from
     * `public/data/asset-character.json`, exactly as `sort-rank` and `spot-the-flaw` name
     * their reveals rather than carrying them.
     */
    /**
     * Which measurement the control drives.
     *
     * `variance-ratio` is 8.2's trend persistence; `edge-sweep` is 9.5's parameter sweep and
     * `drawdown` is 9.3's. All three read a committed artefact, so a new one means a new
     * readout component and nothing else — `Probe.tsx` switches on this and the switch is typed
     * so a `measure` without a readout is a compile error.
     */
    measure: "variance-ratio" | "edge-sweep" | "drawdown";
    /** What the control moves. Labels it, and heads the readout column. */
    label: string;
    /**
     * The control's range, which **must** reproduce the artefact's own grid.
     *
     * The readout reads a committed table, so a value between two grid points would have to
     * be interpolated — and an interpolated variance ratio is a number nobody measured. The
     * chapter's claims test asserts these land exactly on the artefact's horizons.
     */
    min: number;
    max: number;
    step: number;
    initial: number;
    /**
     * The markets the readout covers, in the order shown.
     *
     * Named here rather than in `level.data` because none of them is *displayed*: a probe
     * renders a table of measurements, not a chart of bars. Same call `sizing-calc` makes
     * with `data: []`, and it has the same consequence — these series stay outside the
     * cross-asset boss guard, which is what lets the chapter measure all six while its boss
     * runs on one of them.
     */
    assets: SeriesId[];
    /** The row the graded question is about. Marked in the readout. */
    focus: SeriesId;
    /**
     * Whether the readout holds part of itself back until the answer is committed.
     *
     * 8.2 shows its whole table always, because its lesson is in the sweep. 9.5's later-window
     * column and 9.3's answer must not be visible while the player is deciding — that is the
     * entire pedagogy of both, and showing it early would turn a test of judgement into a
     * reading exercise.
     */
    revealOnCommit?: boolean;
    /** `target` when the reading has a measured answer, `exploration` when it does not. */
    scoring: "target" | "exploration";
    /** Share of the range that must be covered before full marks. Default 0.6. */
    exploreFraction?: number;
  };
  "trade-sequence": {
    prompt: string;
    /** What kind of setup these trades are, for the journal. */
    setup: SetupId;
    /** Starting account, in the series' quote currency. */
    equity: number;
    /**
     * The trades, already identified, in the order they occurred.
     *
     * Pre-identified on purpose. Four bosses already test finding a setup and placing a stop;
     * what no level has tested is deciding *how much* to risk, ten times, while the account
     * moves underneath you — and that is the whole of Chapter 7.
     */
    trades: { bar: number; stop: number; targetR: number; label?: string }[];
    /** The risk levels the player may pick from, as decimals. */
    riskChoices: number[];
    /** Bars each trade may run before it is closed at the market. */
    maxBars: number;
  };
  "sizing-calc": {
    prompt: string;
    /** The account, in the quote currency of every instrument listed. */
    equity: number;
    /** Fraction of the account to risk, as a decimal. 0.01 is one percent. */
    riskPct: number;
    /**
     * The positions to size, one row each.
     *
     * 7.2 lists one and 7.3 lists four — and four is the point of 7.3, since splitting it
     * into four levels would lose the comparison it exists to make.
     */
    positions: {
      instrument: SeriesId;
      entry: number;
      stop: number;
      label?: string;
      /**
       * How much of it is held.
       *
       * Required when `answer` is `riskCurrency` and meaningless otherwise: pricing the risk
       * of a position needs a position, and 7.1 hands the player one rather than asking them
       * to derive it. Without this the answer would be `equity * riskPct` restated, which is
       * a question with itself for an answer.
       */
      units?: number;
    }[];
    /**
     * What the player is asked for.
     *
     * `units` is a position size, `riskCurrency` the money at risk — both derived from
     * `positions`. `expectancy` is 9.1's: the mean R of an authored trade list, derived from
     * `outcomes`.
     *
     * **Why this kind rather than a new one.** `sizing-calc`'s identity is *type a number,
     * derived from config rather than authored, graded on relative tolerance* — and an
     * expectancy is exactly that. The rejection that produced `probe` in M8 was structural:
     * `tune-param.config` literally *is* `(value) => IndicatorSpec`, which no amount of
     * widening makes into a table of markets. Nothing here is being bent out of shape.
     */
    answer: "units" | "riskCurrency" | "expectancy";
    /**
     * A trade list to compute an expectancy from. Required by `expectancy` and forbidden
     * otherwise; `positions` is the reverse. A guard enforces both.
     */
    outcomes?: { r: number; label?: string }[];
  };
  "spot-the-flaw": {
    prompt: string;
    /**
     * The artefact under review: the claims someone made, in the order shown.
     *
     * `signal` names a measurable reading in `lib/ta/correlation.ts` where the claim has
     * one. That is what lets 6.5 be graded against data rather than against taste — the
     * content-claims test recomputes which claims duplicate another and checks the
     * authored answer still matches.
     *
     * `note` is shown **after committing**, whether or not the claim was marked, the same as
     * `ClassifyOption.note`. It is a verdict on the claim, so showing it earlier prints the
     * answer beside the question.
     */
    claims: { id: string; label: string; note?: string; signal?: SignalId }[];
    /** A measured table to show once the answer is committed. */
    reveal?: "signal-correlation" | "rule-by-year";
  };
  "sort-rank": {
    prompt: string;
    /**
     * The rows to be ordered, in the order they are first shown.
     *
     * `slice` indexes `level.data` where a row has a chart of its own. 4.5 ranks patterns
     * by their definitions and needs none; 6.4 ranks four setups and is unanswerable
     * without them.
     */
    items: { id: string; label: string; note?: string; slice?: number }[];
    /** What the top of the list means, so "first" is never ambiguous. */
    topLabel: string;
    bottomLabel: string;
    /**
     * A measured table to show once the ranking is committed.
     *
     * Named rather than carried as data because the numbers live in a committed
     * artefact fetched at runtime — `public/data/base-rates.json` is 5 patterns x 5
     * assets x 4 statistics, which is a table rather than something to retype into a
     * level file where it could drift from the measurement.
     */
    reveal?: "pattern-base-rates" | "breakout-by-market" | "edge-by-market";
  };
  "replay-trade": {
    prompt: string;
    side: TradeSide;
    /** What kind of setup this is, for the journal. Required so it cannot be forgotten. */
    setup: SetupId;
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
    /**
     * How much of the score the outcome carries. Defaults to 0.3.
     *
     * Zero for 9.4, where the player already knows the trade worked. Once the outcome is known
     * the only thing left to judge is the plan, and letting a known result carry any weight
     * would be scoring hindsight.
     *
     * Every existing replay level and step leaves this unset and scores identically — asserted
     * in `replay-trade/grade.test.ts` rather than assumed.
     */
    outcomeWeight?: number;
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
  /**
   * No authored target either: each trade's outcome comes from `simulate` over the committed
   * series, so the sequence cannot drift from what the data did. What the player is scored on
   * is their sizing, and that is judged against `tolerance` rather than against an answer.
   */
  /** The measured control value. Ignored entirely when scoring is `exploration`. */
  probe: { value: number };
  /**
   * A strategy the author verified clears the objective — and nothing the player is scored against.
   *
   * The score is the *run*: the engine takes the player's own blocks over `level.data` and the
   * objective says whether the result cleared it. So this is not an answer to match, in the same
   * way `annotate`'s trendline is not. It exists so `perfectAttempt` has something to return, which
   * is what lets the winnability guard prove three stars is reachable — the guard that has caught
   * an unwinnable level in four of the last five milestones.
   *
   * **Authoring one means running it.** A reference that does not clear its own objective fails the
   * guard rather than a player, which is exactly what happened to 4.B's replay in M7c.
   */
  "build-rules": { reference: { entry: Block[]; exit: ExitRule; risk: RiskRule } };
  "trade-sequence": Record<string, never>;
  /**
   * No authored target: the answer is whatever the sizing formula gives for the instrument,
   * so the grader derives it from `config` and the `InstrumentSpec`. Authoring the numbers
   * as well would create two sources for one fact and a way for them to disagree — which is
   * the same reasoning `predict-next` uses.
   */
  "sizing-calc": Record<string, never>;
  /**
   * The claims that add nothing, because another claim already says them.
   *
   * Measured, not asserted: a claim counts as flawed when it correlates above
   * `REDUNDANT_ABOVE` with some other claim in the same set.
   */
  "spot-the-flaw": { flawed: string[] };
  /**
   * The measured ordering, best-first.
   *
   * Must be derivable from data rather than from taste, and the quantity ranked has
   * to actually separate — 4.5 ranks by sample size for exactly that reason, since
   * the win rates it also shows are 2.5 points apart and rank to nothing.
   */
  "sort-rank": { order: string[] };
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
  /** How far off the measured crossing still counts, in the control's own units. */
  probe: { slop: number };
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
  /**
   * Nothing to tolerate: a claim is either duplicated by another or it is not, and the
   * partial credit that matters comes from `f1` over the set the player marked.
   */
  "spot-the-flaw": Record<string, never>;
  /**
   * Nothing to tolerate either, and for a sharper reason than `spot-the-flaw`'s.
   *
   * The objective *is* the tolerance — `minExpectancy`, `minTrades`, `minAssetsPassing` — and it
   * lives in the config because the player is told it. A hidden slop on top would mean a strategy
   * that missed the stated bar could still pass, which is the one thing a level about honest
   * backtesting cannot do.
   */
  "build-rules": Record<string, never>;
  "trade-sequence": {
    /** The largest per-trade risk still counted as defensible. */
    maxRiskPct: number;
    /** Ending below this fraction of the starting account counts as ruin. */
    ruinBelow: number;
  };
  "sizing-calc": {
    /**
     * Accepted error as a *fraction* of the correct answer.
     *
     * Relative rather than absolute, and it has to be: the right answer is 0.0043 BTC on one
     * row and 340 shares on the next, and no flat tolerance serves both.
     */
    relative: number;
  };
  "sort-rank": {
    /**
     * Adjacent transpositions that still earn full marks.
     *
     * Some neighbours in a measured ordering are not distinguishable by reasoning —
     * 4.5's three candlestick patterns differ in frequency by well under 2× and no
     * player could order them from first principles. Forgiving a swap or two keeps
     * the level about the part that *is* inferable, which is the gap between the
     * common candles and the rare chart patterns.
     */
    swaps: number;
  };
  "replay-trade": {
    /**
     * **Total risk from entry to stop, in ATR multiples** — not distance beyond the structure.
     *
     * The grader computes `|entry − stop| / atr` and checks it falls in `[minAtr, maxAtr]`.
     * This doc said "beyond the structure" from M5 until M7c, and two levels were authored
     * against the wrong reading: 4.B ended up rejecting its own reference answer, which only
     * escaped the winnability guard because composite averaging carried it to 0.904 against a
     * 0.9 threshold. `guards.test.ts` now checks every replay-trade's reference satisfies all
     * four plan components directly, so the next mis-reading fails loudly.
     *
     * Being beyond the structure is scored separately, by `beyondStructure`. In ATR rather
     * than price so the same numbers work on Bitcoin at 25,000 and the euro at 1.09.
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
      kind: "sequence";
      /**
       * Per trade: what it returned, the account after it, and the prices it ran at.
       *
       * The prices are here so the trades can be journalled. 7.B's ten were dropped until M9
       * partly because this carried only `{r, risk, equity}`, so there was nothing to record.
       * Declared inline rather than imported from the kind, which would make the schema depend
       * on a grader; `trade-sequence/grade.ts` exports the matching `SequenceStep`.
       */
      steps: {
        r: number;
        risk: number;
        equity: number;
        bar: number;
        entry: number;
        stop: number;
        target: number;
        exit: number;
        outcome: string;
        label?: string;
      }[];
      startingEquity: number;
      /** True once the account fell through the ruin line. */
      ruined: boolean;
      /** Trades where the player raised their risk after a loss. */
      escalations: number[];
    }
  | {
      kind: "sizing";
      submitted: (number | null)[];
      /** What the formula gives, per position. */
      correct: number[];
      /** Money at risk per position, once rounded to a tradeable size. */
      risked: number[];
    }
  | {
      kind: "claims";
      flagged: string[];
      /** The claims that really do duplicate another. */
      flawed: string[];
      /** Marked and flawed. */
      hit: string[];
    }
  | {
      kind: "ranking";
      submitted: string[];
      /** The measured ordering, best-first. */
      correct: string[];
      /** Ids the player placed at the right index, for a per-row mark. */
      inPlace: string[];
      /** Adjacent transpositions between the two orderings. */
      swaps: number;
    }
  | {
      /**
       * One overlay per composite step, in order.
       *
       * Exists so a boss's replay stages can be journalled. `gradeComposite` used to discard
       * every step grade after reading its score, and return `{ kind: "none" }` — which is why
       * four bosses' trades never reached the journal. Collecting them here keeps the invariant
       * that a journal entry is read off the grade rather than recomputed.
       */
      kind: "steps";
      /** `{ kind: "none" }` for a stage not attempted. */
      steps: OverlaySpec[];
    }
  | {
      /**
       * A strategy's run, per asset, with the verdict and the reason.
       *
       * Carries no chart geometry because there is nothing to draw *onto* the attempt — the
       * correction for a strategy is its result, not a line in a different place. The equity curve
       * and the trade table are built from this by the component.
       */
      kind: "run";
      verdict: "passed" | "refuted" | "inconclusive";
      reason: string;
      perAsset: {
        asset: string;
        trades: number;
        expectancy: number | null;
        totalR: number;
        maxDrawdownR: number;
        underpowered: boolean;
        /**
         * What entering on *every* bar would have paid on this market, with the same exit.
         *
         * Null when the level did not ask for the comparison. Never omitted when it did: on this
         * spine a random entry makes +0.265R a trade on the index, so a figure shown without it is a
         * figure that flatters.
         */
        baselineR: number | null;
      }[];
      /** Assets that cleared the objective, and the classes they span. */
      passing: string[];
      classesPassing: string[];
      /** Cumulative R of every trade, pooled in the order the assets were given. */
      equityR: number[];
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
  | Level<"sort-rank">
  | Level<"spot-the-flaw">
  | Level<"sizing-calc">
  | Level<"trade-sequence">
  | Level<"probe">
  | Level<"build-rules">
  | Level<"composite">;

export function isKind<K extends LevelKind>(
  level: AnyLevel,
  kind: K,
): level is Extract<AnyLevel, { kind: K }> {
  return level.kind === kind;
}
