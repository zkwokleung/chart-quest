import type { Level } from "../../schema";

/**
 * Where to build, and the reason the answer cannot come from the journal.
 *
 * ## The specified level, and why it changed shape rather than kind
 *
 * `CURRICULUM.md` asks for "pick market + timeframe — constrained to your journal's best-performing
 * context". M9 established the invariant that makes that ungradeable as written: **no level's graded
 * answer may depend on the store.** `journal` is empty on a fresh save, after `resetProgress`, and in
 * private mode where storage degrades to memory, so a level whose right answer is "whatever your
 * record liked" is unwinnable for those players and cannot satisfy the winnability guard.
 *
 * The split 9.6 used applies here unchanged: **the journal marks the options and the data decides the
 * answer.** `JournalHints` shows how many trades the player has taken on each candidate and what they
 * returned, which is genuinely useful and genuinely theirs. What is *graded* is a judgement about
 * sample sizes that is true for every possible player, because M9 pinned the numbers: a full
 * playthrough leaves eight planned trades, and the largest per-market cell any player can reach is
 * four.
 *
 * So the correct answer is not "the market I did best on". It is that **eight trades cannot choose a
 * market**, and the honest basis for choosing is how much history there is to test on — which is a
 * fact about the data rather than about the player.
 *
 * ## Why the daily series
 *
 * Measured rather than asserted, and the claims test recomputes it: `SPY-1d` holds 4,612 bars and
 * `SPY-15m` holds 1,041. A rule tested on the intraday series has a quarter of the history and, once
 * the holdback is removed, produces single-digit trade counts — which Chapter 10.6 is about to show
 * the player is not a sample. The chapter's own boss requires three markets, and only the daily
 * series exist for all six.
 */
export const level: Level<"classify"> = {
  id: "10-1",
  chapter: 10,
  title: "Where to build it",
  kind: "classify",
  brief:
    "You are about to build a strategy, and the first decision is where. Above is your own record on each market, which is the evidence most people would use. Read it the way Chapter 9 taught you to read a number, then choose the basis for the decision rather than the market.",
  data: [],
  config: {
    prompt: "What should decide which market and timeframe you build on?",
    artefact: "journal-analytics",
    options: [
      {
        id: "history-available",
        label:
          "How much history there is to test on — the daily series, because a rule needs enough bars to say anything after the holdback comes out.",
        note: "Correct, and it is the only one of these four that rests on something big enough to decide with. SPY's daily series holds 4,612 bars against the fifteen-minute series' 1,041, and 10.6 is about to show you what a small sample does to a conclusion.",
      },
      {
        id: "best-market",
        label:
          "The market I have done best on so far — my record is right there, and it is mine.",
        note: "It is yours, and there are at most four trades in any market of it. 9.6 was this exact argument: an expectancy over four trades is arithmetic rather than evidence, and choosing a market on it is 9.2's coin-flipper picking a career.",
      },
      {
        id: "most-familiar",
        label: "Whichever market I understand best, since I will read it more accurately.",
        note: "Reasonable, and it is not measurable. Chapter 8's whole finding was that markets differ in ways you can measure — persistence, volatility, which edges survive — so 'I understand it' is available as a tiebreak and not as the basis.",
      },
      {
        id: "most-volatile",
        label: "The most volatile market, because bigger moves mean more to capture.",
        note: "Bigger moves mean bigger stops, and Chapter 7 showed that size adjusts until one R costs the same either way. Volatility changes the position, not the edge — which is why every rule in this chapter is stated in ATR.",
      },
    ],
  },
  target: { correct: ["history-available"] },
  tolerance: {},
  stars: [0.5, 0.9, 1],
  misconceptions: [
    {
      id: "ch10-market-from-eight-trades",
      test: (attempt) => attempt.selected.includes("best-market"),
      message:
        "Look at the n column beside whichever market you just picked. A full playthrough of this game leaves eight trades you planned yourself, and at most four in any one market — so the market you 'do best on' is one or two things that happened. You cleared 9.6 by saying so about your own record; this is the same record, being asked to make a bigger decision than it can.",
    },
    {
      id: "ch10-volatility-is-not-edge",
      test: (attempt) => attempt.selected.includes("most-volatile"),
      message:
        "Chapter 7 answered this: risk a fixed fraction, and a wide stop simply buys fewer units. One R costs the same on Bitcoin as on the euro, which is why the whole chapter is denominated in it. Volatility decides your position size and Chapter 8 measured how much — 2.3% a day on Apple against 1.1% on the index — but it does not decide whether a rule has an edge.",
    },
    {
      id: "ch10-why-history-matters",
      test: () => false,
      message:
        "The reason this is the first level rather than a footnote: whatever you build, 70% of the data is for tuning and the rest is held back, and Chapter 10.6 runs your rule on that remainder. Start on 1,041 intraday bars and the holdback gives you single-digit trades — a number you already know cannot rule anything in. Start on 4,612 daily bars and you get enough to be refuted by, which is the most a backtest can offer.",
    },
  ],
  hints: [
    "Read the n column beside every figure in the panel before you choose.",
    "Which of these four could you check against the data rather than argue about?",
  ],
};
