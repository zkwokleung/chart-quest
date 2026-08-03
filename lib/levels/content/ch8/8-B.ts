import type { Level } from "../../schema";

/**
 * Boss: AAPL-1d 3412-4410, 2018-07-24 to 2022-07-12. A market the player has never seen.
 *
 * ## Why Apple, of all six
 *
 * Not because 96% of it is undisplayed, though that is true. **Because Apple is where this
 * chapter's own lesson fails.** It is fourth of six on trend persistence and first of six on
 * what the breakout rule pays — +0.522R a trade against Bitcoin's +0.300R. A player who leaves
 * 8.2 and 8.3 believing "the persistent market is the one to trade" has drawn exactly the
 * inference 8.3's reveal was built to break, and this is where it costs them.
 *
 * Reserving it has a structural cost the chapter pays deliberately: `guards.test.ts` compares a
 * boss's *displayed slices* against every other level's, and it is series-id granular rather
 * than window granular, so no Chapter 8 level may name `AAPL-1d` at any window. 8.1 shows five
 * markets rather than six for this reason, and every table that covers Apple — the probe
 * readout, the correlation matrix, the edge grid — reaches it through `data: []` rather than
 * through a pane. The chapter's claims test asserts the reserve from level 8.1 onward, because
 * the generic guard is inert until a boss exists.
 *
 * ## Why the character read has to be absolute
 *
 * Every other market in the spine is taught in this chapter, so the boss cannot show a
 * comparison — there is nothing left to compare against. The player has to read this market's
 * volatility off one chart and place it against the table they built themselves. That is a
 * harder question than the teaching levels asked and it is the right one: nobody hands you five
 * reference charts before your first trade in an unfamiliar market.
 *
 * Measured: median 14-bar ATR is **2.32%** of price over Apple's full history and 2.38% inside
 * this window, so the window is representative rather than a calm or wild stretch. On the
 * chapter's scale that puts it between the index at 1.11% and the small-cap at 3.69% — the
 * middle of the six, which is the least guessable answer available.
 *
 * ## The trade, and its score surface
 *
 * `AUTHORING.md` requires simulating the surface before locking a window, and boss 3.B was
 * authored twice for skipping it. Bar 3880 (2020-06-03), entry 81.28, ATR 1.547, with a swing
 * low at **78.27** — 1.946x ATR below entry. Total risk from entry, 2R target, 60 bars:
 *
 *   0.20x  −1.00R      1.90x  +2.00R (inside the low)      3.00x  +2.09R
 *   0.35x  −1.00R      2.00x  +2.00R (clears it)           3.50x  +2.00R
 *   0.50x  −1.00R      2.50x  +2.00R                       4.00x  +2.00R
 *                                                          5.00x  +2.07R
 *
 * **Every width that clears the structure reaches the target, out to five ATR, and every stop
 * crammed inside a half-ATR loses a full R.** No coin flip anywhere in the band — which is why
 * this setup rather than bar 3656, whose surface has a −1.00R hole at 3.0x sitting between two
 * winners. That is a lottery with a correction screen, and 7.4's docstring already names it.
 *
 * ## Weights
 *
 * Reading the character is worth least (0.25) and trading it worth most (0.45), because the
 * chapter's claim is that character *informs a decision* rather than being trivia. A player who
 * reads the market correctly, picks the right edge and then places a stop inside the structure
 * has not transferred anything.
 */
export const level: Level<"composite"> = {
  id: "8-B",
  chapter: 8,
  title: "An unfamiliar market",
  kind: "composite",
  brief:
    "This is a market you have not seen in this game, and its name is not going to help you. You have spent a chapter building a table of what each kind of market does. Read this one off the chart, pick the rule that survives being moved into it, and then trade it — three questions, and the third is worth the most.",
  data: [{ series: "AAPL-1d", from: 3412, to: 4410, label: "An unfamiliar market · daily" }],
  yAxis: "pct",
  config: {
    steps: [
      {
        kind: "classify",
        weight: 0.25,
        brief:
          "First, the only question that matters before any rule: how much does this market move on an ordinary day, as a share of its own price? You have measured six markets. Place this one among them.",
        config: {
          prompt:
            "About how much does a typical day here span, as a percentage of price?",
          options: [
            {
              id: "mid",
              label: "Around two and a half percent — between an index and a small-cap.",
              note: "Correct. The median 14-bar ATR is 2.32% of price over this market's whole history and 2.38% inside this window, so what you are looking at is typical for it.",
            },
            {
              id: "index-like",
              label: "Around one percent — index-like.",
              note: "That is the S&P at 1.11% and gold at 1.15%. This market moves more than twice that on an ordinary day, which changes every stop you would place in it.",
            },
            {
              id: "crypto-like",
              label: "Four to five percent — crypto-like.",
              note: "That is Bitcoin at 4.60%. This market is volatile for an equity and nowhere near that; treating it as crypto would size every position at half what it should be.",
            },
            {
              id: "fx-like",
              label: "Under one percent — like a major currency pair.",
              note: "That is the euro at 0.82%, the quietest market in the spine. Nothing on this chart looks like that.",
            },
          ],
        },
        target: { correct: ["mid"] },
        tolerance: {},
        misconceptions: [
          {
            id: "boss8-read-it-as-an-index",
            test: (attempt) => attempt.selected.includes("index-like"),
            message:
              "Twice too quiet. A one-percent day is the S&P or gold; this market spans 2.32% on a median day. The consequence is not academic — a stop sized for a one-percent market sits inside this one's ordinary noise, which is the mistake 7.4 was built around.",
          },
          {
            id: "boss8-read-it-as-crypto",
            test: (attempt) =>
              attempt.selected.includes("crypto-like") ||
              attempt.selected.includes("fx-like"),
            message:
              "Both of those are the extremes of the spine — Bitcoin at 4.60% and the euro at 0.82% — and this market is in the middle at 2.32%. The middle is the hardest answer to guess and the easiest to measure, which is the whole argument for measuring.",
          },
        ],
      },
      {
        kind: "classify",
        weight: 0.3,
        brief:
          "Now the rule. You ranked four of them by how well they travel into markets you had not measured. This is one of those markets.",
        config: {
          prompt: "Which of the four rules do you take into an unfamiliar market?",
          options: [
            {
              id: "breakout",
              label:
                "The breakout — the only one of the four that was profitable in every market measured.",
              note: "Correct, and correct twice over: it is the most portable of the four at six markets out of six, and it happens to be the best of the four here too, at +0.522R a trade against the gap rule's +0.297R.",
            },
            {
              id: "gap-fill",
              label: "The gap rule — this is an equity, and equities gap.",
              note: "They do, and it makes +0.297R here, which is real. But it was positive in only three of the five markets that have gaps at all and cannot be traded in the sixth — you would be choosing the least portable rule for the one market where portability is the question being asked.",
            },
            {
              id: "pullback",
              label: "The pullback to the moving average — a trending stock should respect one.",
              note: "It makes +0.265R here, the weakest of the four, and was positive in only four of six markets. It needs a market that trends smoothly enough for an average to mean something, which is a demand on the market rather than a rule you can carry.",
            },
            {
              id: "three-down",
              label: "Three down days in an uptrend — buy the dip.",
              note: "A reasonable second choice: +0.381R here and positive in five of six markets. The breakout is better on both counts.",
            },
          ],
        },
        target: { correct: ["breakout"] },
        tolerance: {},
        misconceptions: [
          {
            id: "boss8-reasoned-from-the-asset-class",
            test: (attempt) => attempt.selected.includes("gap-fill"),
            message:
              "Equities do gap, and that is reasoning from a label rather than from a measurement. The gap rule was positive in three of the five markets that can express it at all, and undefined in the sixth — the least portable of the four. This chapter's argument is that you check what a rule does across markets before carrying it into a new one, not that you match rules to asset classes by name.",
          },
          {
            id: "boss8-chose-the-weakest-here",
            test: (attempt) => attempt.selected.includes("pullback"),
            message:
              "The pullback is the weakest of the four in this market — +0.265R a trade — and the second least portable across the six. 'A trending stock should respect its average' is a story about how markets ought to behave; the table you built is a record of how they did.",
          },
        ],
      },
      {
        kind: "replay-trade",
        weight: 0.45,
        brief:
          "The breakout has triggered. Place the stop and the target, say why, and let it run — the market moves 2.3% on an ordinary day, and the low it broke out from is on the chart.",
        // Narrowed so the stage cannot see its own outcome. The series is unchanged.
        data: [
          { series: "AAPL-1d", from: 3820, to: 3920, label: "An unfamiliar market · daily" },
        ],
        config: {
          prompt: "Place your stop and target, say why, and let it run.",
          side: "long",
          // a breakout of the 20-bar high.
          setup: "continuation",
          primeBars: 61,
          maxBars: 60,
          minRR: 2,
          atrPeriod: 14,
        },
        target: {
          structure: { shape: "level", price: 78.27 },
          triggerBar: 3880,
        },
        // **Total risk from entry, in ATR.** The swing low sits 1.946x below entry, so 2.0 is the
        // first width that clears it; every width from there to 5.0 reaches the 2R target, and
        // 4.0 is a defensible ceiling well inside the verified band. Stops inside half an ATR
        // lose a full R. Simulated before the window was locked, per AUTHORING.md.
        tolerance: { minAtr: 2.0, maxAtr: 4.0, barSlop: 2 },
        misconceptions: [
          {
            id: "boss8-stop-sized-for-a-quieter-market",
            test: (attempt, lvl, data) => {
              const series = data[0];
              const entry = series?.c[lvl.target.triggerBar];
              if (entry === undefined) return false;
              // Under one ATR of room on a market whose ordinary day is 2.3% of price.
              return entry - attempt.stop < 1.547;
            },
            message:
              "Less than one ordinary day of room, in a market that moves 2.3% on an ordinary day. Every stop inside half an ATR here lost a full R — not because the trade was wrong but because the stop was inside the noise. This is the first stage of this boss becoming money: you read the volatility, and then you have to use it.",
          },
          {
            id: "boss8-stop-inside-the-structure",
            test: (attempt, lvl) => {
              const structure = lvl.target.structure;
              if (structure.shape !== "level") return false;
              return attempt.stop > structure.price;
            },
            message:
              "Your stop sits above the low this breakout came from, so a routine retest of it takes you out. That low is 1.95 ATR below entry, so clearing it means risking about two ordinary days — which sounds like a lot until you notice that every width from there out to five ATR reached the target here, and every width inside half an ATR lost.",
          },
          {
            id: "boss8-no-reason-given",
            test: (attempt) => attempt.reason.trim().length < 15,
            message:
              "Write down why this stop. Chapter 9 reads these back and asks whether your stated reasons predicted your results, and 'it looked about right' is not a reason a later chapter can test. On the last trade of the last chapter before it, that matters more than usual.",
          },
        ],
      },
    ],
  },
  target: {},
  tolerance: {},
  stars: [0.5, 0.75, 0.9],
  misconceptions: [
    {
      id: "boss8-incomplete",
      test: (attempt) => attempt.steps.some((step) => step === null),
      message:
        "Some stages are unanswered. All three are weighed, so a skipped stage counts as zero rather than being set aside — and the trade is worth nearly half of it.",
    },
    {
      id: "boss8-the-market-was-apple",
      test: () => true,
      message:
        "The market was Apple, and knowing that would not have helped you. It is fourth of six on trend persistence and first of six on what the breakout rule pays — so every intuition about which market 'should' trend, including the one this chapter risked teaching you in 8.2, points the wrong way here. What did help was the table: 2.3% on an ordinary day, so a stop needs about two of them; the breakout survives being moved and the gap rule does not. That is asset character doing work rather than being trivia, and it is the last thing you learn before Chapter 9 starts reading your own trades back to you.",
    },
  ],
  hints: [],
};
