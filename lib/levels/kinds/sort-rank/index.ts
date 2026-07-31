import type { KindModule } from "../../kind-module";
import { gradeSortRank, perfectSortRank } from "./grade";
import { SortRank } from "./SortRank";

export const sortRankKind: KindModule<"sort-rank"> = {
  kind: "sort-rank",
  Component: SortRank,
  grade: gradeSortRank,
  perfectAttempt: perfectSortRank,
};
