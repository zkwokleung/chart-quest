import type { Level } from "../../schema";

/**
 * **The level the milestone's gate names**, and the one that is only possible because there are
 * no accounts. The journal is genuinely the player's own.
 *
 * ## What it shows, and why that is enough to grade
 *
 * The panel above the question is the real record — read from the store by the component, which
 * a component may do. What makes the level *gradeable* without a grader touching the store is
 * that **the honest reading is the same for every possible player**:
 *
 * A player reaching this level has planned **eight** trades: two crypto, four shares, one
 * currency and — once 9.4 is behind them — one gold. Plus ten from 7.B whose entry, stop and
 * target were authored, where the only decision was size. So the largest per-asset-class cell
 * any player can reach is **four trades**, and a player who skipped levels has fewer, never
 * more. No cell can support an expectancy. That is author-known, so `perfectAttempt` works and
 * the winnability guard is untouched.
 *
 * The chapter's claims test *computes* that guarantee from the journal-coverage numbers rather
 * than asserting a constant, so a future chapter adding a trade level fails a guarantee rather
 * than leaving a stale figure behind.
 *
 * ## The distinction the level is really about
 *
 * Ten of the seventeen entries are not the player's plans. Averaging them into "your average
 * loss" would describe *the author's* stops — the exact error this chapter exists to cure — so
 * the panel separates them and the second misconception catches a player who did not notice.
 *
 * That is also why the fx cell has exactly one trade in it, and the futures cell one planned
 * trade beside ten authored ones. A player looking for "which market am I worst at" finds a
 * single euro trade and, if they take it at face value, concludes they cannot trade currencies.
 *
 * The journal-coverage test is what keeps this paragraph true: it pins the per-class counts, and
 * it caught this very sentence claiming an empty futures cell after 9.4 put a gold trade in it.
 *
 * ## Why not a `dashboard` kind
 *
 * `CURRICULUM.md` and `PLAN.md` both list one. A `LevelKind` that cannot be graded cannot
 * satisfy the winnability guard, which makes it a page rather than a level — so the tables live
 * in a component and the level is a `classify` with a real question. The two curriculum tables
 * are corrected in the docs step rather than the kind being built.
 */
export const level: Level<"classify"> = {
  id: "9-6",
  chapter: 9,
  title: "Your own record",
  kind: "classify",
  brief:
    "Every trade you have placed in this game is above, split the way a trading journal splits things. Nobody else has seen it — there are no accounts here, so this is genuinely yours. Read it the way you would read somebody else's, and tell me what it supports.",
  data: [],
  config: {
    prompt:
      "Looking at your own record: what does it actually let you conclude?",
    artefact: "journal-analytics",
    options: [
      {
        id: "too-small-to-split",
        label:
          "Very little yet — every market and setup has too few trades behind it to mean anything.",
        note: "Correct, and it is the same answer for everybody who reaches this level. At most four planned trades in any one market; two in most. Chapter 4 spent a chapter on why that is not a sample, and this is the same argument turned on your own numbers.",
      },
      {
        id: "best-market",
        label:
          "Which market I trade best — the per-market expectancies are right there.",
        note: "They are, and they rest on between one and four trades each. An expectancy from two trades is two numbers averaged, which is arithmetic rather than evidence.",
      },
      {
        id: "setup-preference",
        label: "Which kind of setup suits me, since the by-setup rows separate cleanly.",
        note: "The rows separate because there are three of them and eight trades. Any three-way split of eight things separates.",
      },
      {
        id: "nothing-at-all",
        label:
          "Nothing at all — a journal this size is not worth keeping until there is more in it.",
        note: "Too far the other way. The record already shows two real things: whether your stops held, and whether you wrote down why. Neither needs a large sample, because neither is an average.",
      },
    ],
  },
  target: { correct: ["too-small-to-split"] },
  tolerance: {},
  stars: [0.5, 0.9, 1],
  misconceptions: [
    {
      id: "journal-read-a-cell",
      test: (attempt) =>
        attempt.selected.includes("best-market") ||
        attempt.selected.includes("setup-preference"),
      message:
        "Look at the n column beside whichever figure you just read. Your biggest market has four trades in it and most have one or two. That is not a market you are good or bad at — it is one or two things that happened, and the panel says 'too few to say' beside each of them for exactly this reason. 9.2's coin-flippers are the same arithmetic: any split of eight things looks like a pattern.",
    },
    {
      id: "journal-counted-the-authored-trades",
      test: () => false,
      message:
        "If you included the ten gold trades from Chapter 7, look again at what you chose in them: the size, and nothing else. Their entries, stops and targets were written for you, so their average loss is a fact about the author rather than about you. That is why the panel separates them and puts your own eight first — of which exactly one is gold, the trade you just planned in 9.4.",
    },
    {
      id: "journal-what-it-does-support",
      test: () => false,
      message:
        "Two things in there do not need a large sample, because neither is an average. Whether your stops held — a loss past 1R means price gapped through it, not that you were wrong. And whether you wrote down a reason. Chapter 10 asks you to build a strategy from your best context; the honest answer today is that you do not have enough record to know what that is, and knowing that is the point of this level.",
    },
  ],
  hints: [
    "Read the n column before reading any of the figures beside it.",
    "Which of these conclusions would you accept from somebody else's journal of eight trades?",
  ],
};
