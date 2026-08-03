import type { Level } from "../../schema";

/**
 * Boss: three backtest reports, three markets, three different ways of being wrong.
 *
 * ## Why a composite of three rather than one `spot-the-flaw`
 *
 * A single `spot-the-flaw` renders `data[0]` and scores one flat `f1` across every claim, so a
 * player who dismantles the first report and ignores the third gets credit that hides the miss.
 * Three stages at a third each score them separately, which is what "three reports on three
 * assets" has to mean if it means anything.
 *
 * That cost one guard's strictness, and the reason it was strict is worth recording. The
 * "composite steps stay on the boss's series, in the same order" rule existed because
 * `Composite.tsx` paired step slices with loaded series **by index**, so a stage naming the
 * boss's second series was handed its first — silently, with a chart of the wrong market. The
 * pairing now looks the series up by id, and the guard checks what actually has to hold: a stage
 * may only name a series the boss itself loads.
 *
 * ## The three flaws, and where every figure comes from
 *
 * All of it is in `public/data/edge-sweep.json` and `public/data/base-rates.json`, and the
 * chapter's claims test recomputes every number below.
 *
 * **Report 1 — overfit — the index.** The rule and the sweep from 9.5. It picks the lookback that
 * made the most on the tuning window, quotes its 26.2R across 80 trades, and calls thirteen years
 * of tuning data a reason to trust it. On the five and a half years held back that lookback made
 * 4.3R and placed **25th of the 26 swept** — worse than twenty-four of the settings it beat. This
 * is the report a player *would have written* two levels ago, which is why it is first.
 *
 * **Report 2 — under-sampled — the small-cap.** Head and shoulders on LAKE-1d reads 66.7%, the
 * highest win rate in the whole of `base-rates.json`, from **eighteen** occurrences. Its own
 * interval runs [43.7, 83.7] and the pooled reading across five markets is 50.0% from sixty-six.
 * Chapter 4.5 showed the player this exact cell; the boss asks whether they remember what it was
 * for.
 *
 * **Report 3 — survivorship — the survivor.** `DATA.md` concedes no delisted series is
 * obtainable, so this report was always going to be the constructed one — and it does not need to
 * be. Its universe is "the large US equities our provider covers for the whole period", 230 trades
 * and +92.8R at a fixed twenty-one-bar lookback, every figure measured. The flaw is that a
 * universe defined by *having a complete record* is a universe chosen after the outcomes were
 * known, and the recomputable proof is this game's own data: all three equities in the spine start
 * on the same day in January 2005 and run to the last bar, not one truncated record among them.
 * That is a fact about what a data provider will sell you, not about markets, and it is the last
 * thing Chapter 9 says — the chapter turns its own lesson on the dataset the player has been
 * trusting for eight chapters.
 *
 * ## Which claims are flawed, and which true ones are worth including
 *
 * Each report has exactly two flawed claims and each carries at least one **sound and damning**
 * one, per `AUTHORING.md`: `r1-tuned` discloses the tuning, `r2-ci` gives the interval that
 * swallows the headline, `r3-complete` states the completeness that is the bias. `f1` makes
 * marking them cost something, which is the point — distrusting a report is not reading one.
 *
 * `stars` is [0.6, 0.8, 0.92] rather than the usual [0.5, 0.75, 0.9]. With two flawed claims out
 * of five or six, marking everything scores about 0.55 per stage, and a boss on reading reports
 * should not hand a star to a player who marked every sentence in all three.
 *
 * ## Series
 *
 * The boss guard compares a boss's displayed slices against its chapter's other levels, and the
 * only Chapter 9 level with any data is 9.4 on `GC-1d`. So gold is the one series unavailable
 * here, and reports 1 and 3 quote the sweep rather than charting it.
 *
 * `AAPL-1d` is deliberate rather than incidental. 9.3 measures Apple's drawdown, but through
 * `config.assets` with `data: []` — read, never displayed, which is the rule the probe kind
 * carries. Apple's price chart has not appeared in this chapter, and Apple is the right chart for
 * a survivorship report: the window is 2016-12 to 2017-11, +58% in a year, the single most
 * persuasive stretch of equity data in the spine and a company that happened not to fail.
 */
export const level: Level<"composite"> = {
  id: "9-B",
  chapter: 9,
  title: "Three reports",
  kind: "composite",
  brief:
    "Three strategy write-ups, one per market, each with a number at the top that would get it funded. Not one of them lies to you — every figure in all three is measured and correct. Each is still broken, in a different way, and you have met all three ways in this chapter. Take them one report at a time.",
  data: [
    { series: "SPY-1d", from: 3228, to: 3478, label: "Report 1 · the index" },
    { series: "LAKE-1d", from: 3300, to: 3550, label: "Report 2 · the small-cap" },
    { series: "AAPL-1d", from: 3000, to: 3250, label: "Report 3 · the survivor" },
  ],
  config: {
    steps: [
      {
        kind: "spot-the-flaw",
        weight: 1 / 3,
        brief:
          "Report one, on the index. A breakout rule with the lookback chosen to maximise what it made — which is exactly what you did two levels ago.",
        data: [{ series: "SPY-1d", from: 3228, to: 3478, label: "S&P 500 · the first year this report never saw" }],
        config: {
          prompt:
            "Every figure below is measured and correct. Mark the sentences that do not follow from it.",
          claims: [
            {
              id: "r1-sample",
              label:
                "Thirteen years of daily bars, 2005 to 2017, taking a trade only when flat: eighty trades.",
              note: "True, and the right thing to state first. Chapter 4's habit was to check the sample before anything else, and here it holds up.",
            },
            {
              id: "r1-tuned",
              label:
                "We swept the lookback across all twenty-six values from 5 to 55 bars and are reporting the one that made the most.",
              note: "True, and it is the most useful sentence in the report — 'we tried twenty-six and kept the best' is the disclosure that lets you discount everything after it. Marking it costs you.",
            },
            {
              id: "r1-total",
              label:
                "At that lookback — a nine-bar high — the rule made 26.2R, a third of an R a trade.",
              note: "True of the window the lookback was chosen on. That the figure and the choice come from the same thirteen years is the whole problem, and the report has already told you so.",
            },
            {
              id: "r1-robust",
              label:
                "Thirteen years is a long window, so the setting is robust rather than curve-fitted.",
              note: "Does not follow, and it is backwards. A longer window is more room to fit to, not less — 9.5 measured this exact rule, and the best in-sample lookback placed 25th of 26 on the years it was not chosen on.",
            },
            {
              id: "r1-forward",
              label:
                "We therefore expect the same rule at the same setting to perform comparably from here.",
              note: "Does not follow. On the five and a half years held back it made 4.3R across 45 trades — 25th of the 26 lookbacks swept, beaten by twenty-four of the settings it beat in-sample.",
            },
          ],
        },
        target: { flawed: ["r1-robust", "r1-forward"] },
        tolerance: {},
        misconceptions: [
          {
            id: "boss9-r1-missed-the-selection",
            test: (attempt) => !attempt.flagged.includes("r1-robust"),
            message:
              "The sentence to catch is that thirteen years of tuning data makes a setting robust. It does the opposite: a longer window is more room to fit to. 9.5 measured this exact rule — the best in-sample lookback placed 25th of 26 in the later window on the index and 21st of 26 on gold, so the parameter the report picked did worse than most of the ones it did not.",
          },
          {
            id: "boss9-r1-marked-the-disclosure",
            test: (attempt) =>
              attempt.flagged.includes("r1-sample") || attempt.flagged.includes("r1-tuned"),
            message:
              "Those are the honest sentences, and the second is the most valuable line in the report: 'we tried twenty-six and kept the best' is what tells you the 26.2R is a maximum rather than an average. A reviewer who marks the disclosure has learned to distrust a report rather than to read one, which is a different and much less useful skill.",
          },
        ],
      },
      {
        kind: "spot-the-flaw",
        weight: 1 / 3,
        brief:
          "Report two, on the small-cap. Nothing is tuned here. The striking figure at the top is real, and you have seen this exact cell before.",
        data: [{ series: "LAKE-1d", from: 3300, to: 3550, label: "The small-cap · 2018" }],
        config: {
          prompt:
            "Every figure below is measured and correct. Mark the sentences that do not follow from it.",
          claims: [
            {
              id: "r2-rate",
              label:
                "Head and shoulders resolved in the signalled direction 66.7% of the time on this market — the highest win rate anywhere in our table.",
              note: "Both halves are true. 66.7% is the strongest reading in all twenty-five cells of base-rates.json, and the next claim is why.",
            },
            {
              id: "r2-n",
              label: "Measured across eighteen occurrences.",
              note: "True, and it is the number that decides everything below it. Eighteen.",
            },
            {
              id: "r2-ci",
              label: "The interval around that 66.7% runs from 43.7% to 83.7%.",
              note: "True, and it is the sentence that dismantles two others: an interval reaching down to 43.7% cannot distinguish this pattern from a coin. Marking it costs you.",
            },
            {
              id: "r2-pooled",
              label:
                "Pooled across all five markets the same pattern reads 50.0%, from sixty-six occurrences.",
              note: "True. Sixty-six examples say 'a coin flip' and eighteen of them say 'exceptional', and the eighteen are a subset of the sixty-six.",
            },
            {
              id: "r2-best",
              label:
                "So this is the strongest pattern in the study and the one to put capital behind first.",
              note: "Does not follow. It is the most impressive figure in the table because it has the least behind it — twelve wins and six losses. One more loss takes it to 63%, two more to 60%.",
            },
            {
              id: "r2-market",
              label:
                "And the gap between 66.7% here and 50.0% overall is evidence that this market suits the pattern.",
              note: "Does not follow. The pooled interval is [38.3, 61.7] and this cell's is [43.7, 83.7]; they overlap across a third of their range. There is no gap to explain yet.",
            },
          ],
        },
        target: { flawed: ["r2-best", "r2-market"] },
        tolerance: {},
        misconceptions: [
          {
            id: "boss9-r2-took-the-rate",
            test: (attempt) => !attempt.flagged.includes("r2-best"),
            message:
              "Eighteen occurrences — twelve wins and six losses. 4.5 showed you this cell and said the most impressive number in the table was the one with the least behind it; this is that number, in a report that quotes its own sample size and then stops mentioning it. Two more losses and 66.7% becomes 60%, which nobody would fund.",
          },
          {
            id: "boss9-r2-marked-the-interval",
            test: (attempt) =>
              attempt.flagged.includes("r2-ci") || attempt.flagged.includes("r2-pooled"),
            message:
              "The interval and the pooled figure are true, and they are the two most valuable lines in the report — [43.7, 83.7] from eighteen, against 50.0% from sixty-six. They are what make the headline collapse. Marking a report's own honesty as a defect is how you end up unable to tell a careful study from a careless one.",
          },
        ],
      },
      {
        kind: "spot-the-flaw",
        weight: 1 / 3,
        brief:
          "Report three, on a market that did well. Nothing is tuned and nothing is under-sampled — this one avoided both of the previous mistakes. The problem is which names are in the study at all.",
        data: [{ series: "AAPL-1d", from: 3000, to: 3250, label: "Apple · the year everything worked" }],
        config: {
          prompt:
            "Every figure below is measured and correct. Mark the sentences that do not follow from it.",
          claims: [
            {
              id: "r3-fixed",
              label:
                "One rule throughout — a close above the twenty-one-bar high, a stop two ATR below, a two-R target — fixed before testing and never re-tuned.",
              note: "True, and genuinely good practice. This report did not make report one's mistake, which is what makes it the dangerous one.",
            },
            {
              id: "r3-total",
              label:
                "230 trades across the two large US equities in our data, 2005 to 2023: +92.8R, a little over four tenths of an R a trade.",
              note: "True, and a real sample. This report did not make report two's mistake either.",
            },
            {
              id: "r3-complete",
              label:
                "Both names have an unbroken daily record across the whole eighteen years, with no gaps to patch.",
              note: "True, and it is the flaw rather than a strength. It is also true of every equity in this game: three for three, unbroken from January 2005 to April 2023, not one truncated record among them. That is a fact about what a data provider will sell you, not about what happens to companies.",
            },
            {
              id: "r3-since",
              label:
                "So a trader who had run this rule on those two names from 2005 would have earned that +92.8R.",
              note: "Does not follow. In 2005 nobody could have known which names would still be quoted in 2023, and 'the ones with a complete record' is a list that could only be drawn up afterwards.",
            },
            {
              id: "r3-nobias",
              label:
                "And since the two names are simply the large US equities our provider covers for the whole period, rather than a basket we chose, there is no selection bias to correct for.",
              note: "Does not follow, and it is the most confident sentence in all three reports. Not choosing the basket yourself does not mean nobody chose it. It was chosen — by eighteen years of outcomes, before the study began.",
            },
          ],
        },
        target: { flawed: ["r3-since", "r3-nobias"] },
        tolerance: {},
        misconceptions: [
          {
            id: "boss9-r3-accepted-the-universe",
            test: (attempt) => !attempt.flagged.includes("r3-nobias"),
            message:
              "'Whatever our provider covers' sounds like the opposite of a hand-picked sample and is one. The picking was done by eighteen years of outcomes: a company that failed in 2011 has no record to cover, so it is not in the study, and the study cannot see that it is missing. Look at the completeness claim again — all three equities in this game are unbroken from 2005 to 2023, which is not what happens to a real universe of companies.",
          },
          {
            id: "boss9-r3-marked-the-good-practice",
            test: (attempt) =>
              attempt.flagged.includes("r3-fixed") || attempt.flagged.includes("r3-total"),
            message:
              "Those two are what this report got right, and they are exactly why it is the hardest of the three. One untuned setting chosen in advance, 230 trades, +92.8R — it avoided both mistakes the other reports made, and it is still wrong, for a reason neither of them could have shown you.",
          },
        ],
      },
    ],
  },
  target: {},
  tolerance: {},
  stars: [0.6, 0.8, 0.92],
  misconceptions: [
    {
      id: "boss9-incomplete",
      test: (attempt) => attempt.steps.some((step) => step === null),
      message:
        "Some reports are unreviewed. All three are weighed equally, so a skipped one counts as zero rather than being set aside — which is also the failure a single combined score would have hidden.",
    },
    {
      id: "boss9-three-ways-to-be-wrong",
      test: () => true,
      message:
        "Three reports, three flaws, and not one lie among them. The first tuned twenty-six settings and told you so, then asked you to trust the winner. The second quoted its own sample size and stopped mentioning it. The third did everything right except notice that a universe defined by having a complete record is a universe chosen after the fact — and that one is about this game as much as about the report, because all three equities you have traded here run unbroken from 2005 to 2023, and a real universe of companies does not do that. Checking the figures was never the job. Noticing what each one did not follow from was. Chapter 10 asks you to build a strategy of your own, and this is the standard you now have to hold it to.",
    },
  ],
  hints: [],
};
