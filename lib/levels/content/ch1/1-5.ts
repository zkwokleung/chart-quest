import type { Level } from "../../schema";

/**
 * BTCUSDT-1d from the start of the series to early 2021.
 *
 * On a linear axis the 2017 run from roughly 4,300 to 19,700 is compressed into
 * the bottom sliver of the chart by the 2021 move to 40,000+, because equal
 * pixel distances represent equal dollar amounts. On a log axis they represent
 * equal percentage moves, and the 2017 rally reappears.
 *
 * The level unlocks the scale toggle, so the player investigates rather than being
 * told.
 */
export const level: Level<"classify"> = {
  id: "1-5",
  chapter: 1,
  title: "Log or linear",
  kind: "classify",
  brief:
    "Bitcoin's 2017 rally was one of the largest in its history. On the chart below it is almost invisible. Switch the scale and it returns.",
  data: [{ series: "BTCUSDT-1d", from: 0, to: 1250, label: "BTCUSDT · daily" }],
  config: {
    prompt:
      "Toggle the scale above the chart. Why does the 2017 rally almost disappear on the linear one?",
    options: [
      {
        id: "equal-dollars",
        label:
          "A linear axis gives equal space to equal dollar amounts, so a move from 4,000 to 19,000 is dwarfed by one from 20,000 to 40,000.",
        note: "A log axis gives equal space to equal percentage moves instead.",
      },
      {
        id: "less-data",
        label: "There is less data in 2017, so the chart draws it smaller.",
      },
      {
        id: "smaller-percent",
        label: "The 2017 rally was a smaller percentage move than the 2021 one.",
        note: "It was larger in percentage terms — which is precisely why the linear axis misleads.",
      },
      {
        id: "volume",
        label: "Volume was lower in 2017, and the axis is scaled by volume.",
      },
    ],
  },
  target: { correct: ["equal-dollars"] },
  tolerance: {},
  stars: [0.5, 0.9, 1],
  misconceptions: [
    {
      id: "percent-confusion",
      test: (attempt) => attempt.selected.includes("smaller-percent"),
      message:
        "The opposite: 2017 was the larger percentage move. It looks smaller because a linear axis measures dollars, and the same percentage is worth fewer dollars at a lower price.",
    },
    {
      id: "blamed-the-data",
      test: (attempt) =>
        attempt.selected.includes("less-data") || attempt.selected.includes("volume"),
      message:
        "Both charts plot exactly the same bars. Only the vertical axis changed — what differs is whether equal space means equal dollars or equal percentages.",
    },
  ],
  hints: [
    "Use the scale toggle above the chart and watch the 2017 section, not the 2021 one.",
    "On the linear axis, measure how much vertical space $1,000 occupies at the bottom of the chart versus the top.",
  ],
  unlocks: ["log-scale"],
};
