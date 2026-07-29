import { beforeEach, describe, expect, it } from "vitest";
import { useGameStore } from "./game";
import { initialPersisted } from "./schema";

describe("useGameStore", () => {
  beforeEach(() => {
    useGameStore.setState({ ...initialPersisted });
  });

  it("records stars, best score and attempts", () => {
    useGameStore.getState().recordAttempt("1-1", 0.62, 2);
    const entry = useGameStore.getState().progress["1-1"];

    expect(entry?.stars).toBe(2);
    expect(entry?.bestScore).toBeCloseTo(0.62);
    expect(entry?.attempts).toBe(1);
  });

  it("keeps the best result when a replay scores worse", () => {
    const { recordAttempt } = useGameStore.getState();
    recordAttempt("1-1", 0.91, 3);
    recordAttempt("1-1", 0.2, 1);

    const entry = useGameStore.getState().progress["1-1"];
    expect(entry?.stars).toBe(3);
    expect(entry?.bestScore).toBeCloseTo(0.91);
    expect(entry?.attempts).toBe(2);
  });

  it("pays xp only for the improvement", () => {
    const { recordAttempt } = useGameStore.getState();
    recordAttempt("1-1", 0.5, 1);
    const afterFirst = useGameStore.getState().profile.xp;

    recordAttempt("1-1", 0.95, 3);
    const afterUpgrade = useGameStore.getState().profile.xp;

    // Replaying a solved level must not farm xp, so a third attempt at the same
    // grade is worth nothing.
    recordAttempt("1-1", 0.95, 3);
    expect(useGameStore.getState().profile.xp).toBe(afterUpgrade);
    expect(afterUpgrade).toBeGreaterThan(afterFirst);
  });

  it("stores predictions for later levels to read back", () => {
    useGameStore.getState().recordPrediction("1-B", { correct: 2, of: 5 });
    expect(useGameStore.getState().predictions["1-B"]).toEqual({
      correct: 2,
      of: 5,
    });
  });

  it("merges settings without dropping the others", () => {
    useGameStore.getState().updateSettings({ yAxisMode: "atr" });
    const { settings } = useGameStore.getState().profile;

    expect(settings.yAxisMode).toBe("atr");
    expect(settings.reducedMotion).toBe("system");
  });
});
