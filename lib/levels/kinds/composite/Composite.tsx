"use client";

import { useState } from "react";
import { Stars } from "@/components/ui/Stars";
import type { Grade } from "@/lib/levels/grade";
import type { KindProps } from "@/lib/levels/kind-module";
import type { StepAttempt } from "@/lib/levels/schema";
import { gradeStep } from "./step-graders";
import { renderStep } from "./step-components";
import { stepAsAnyLevel } from "./steps";

/**
 * Walks a boss through its stages.
 *
 * Each step is turned into a real `Level` and rendered by that kind's own
 * component, so nothing here knows what a trendline or a swing high is. The only
 * composite-specific logic is deciding which stage is current.
 */
export function Composite({
  level,
  data,
  hintsUsed,
  grade,
  attempt,
  onCommit,
}: KindProps<"composite">) {
  const steps = level.config.steps;
  const [answers, setAnswers] = useState<(StepAttempt | null)[]>(() =>
    steps.map(() => null),
  );
  const [current, setCurrent] = useState(0);
  // Kept only so a finished stage stays visible rather than resetting to blank.
  const [stepGrades, setStepGrades] = useState<(Grade | null)[]>(() =>
    steps.map(() => null),
  );

  const committed = grade !== null;
  const shown = committed ? (attempt?.steps ?? answers) : answers;
  const step = steps[current];

  function commitStep(stepAttempt: StepAttempt) {
    if (committed) return;
    setAnswers((current_) => current_.map((a, i) => (i === current ? stepAttempt : a)));
  }

  if (!step) return null;

  const answeredHere = shown[current] ?? null;
  const allAnswered = shown.every((a) => a !== null);
  const stepLevel = stepAsAnyLevel(level, step);

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex flex-wrap gap-2 text-xs">
        {steps.map((s, i) => {
          const done = shown[i] !== null;
          const isCurrent = i === current && !committed;
          return (
            <li key={i}>
              <button
                type="button"
                disabled={committed}
                onClick={() => setCurrent(i)}
                aria-current={isCurrent ? "step" : undefined}
                className={[
                  "rounded border px-3 py-1.5 text-left",
                  isCurrent
                    ? "border-accent text-fg"
                    : done
                      ? "border-up/60 text-muted"
                      : "border-border text-muted",
                ].join(" ")}
              >
                {done ? "✓ " : `${i + 1}. `}
                {s.brief}
              </button>
            </li>
          );
        })}
      </ol>

      {/* Rendered through the kind's own component. Nothing in this file branches
          on what the step actually is. */}
      {renderStep(step.kind, {
        level: stepLevel,
        data,
        hintsUsed,
        // A step shows its own grade once answered, so the player gets feedback
        // per stage rather than only at the end.
        grade: stepGrades[current] ?? null,
        attempt: answeredHere,
        onCommit: (stepAttempt: StepAttempt) => {
          commitStep(stepAttempt);
          setStepGrades((gs) =>
            gs.map((g, i) =>
              i === current ? gradeStep(step.kind, stepAttempt, stepLevel, data) : g,
            ),
          );
        },
      })}

      {answeredHere && !committed ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {stepGrades[current] ? (
            <Stars earned={stepGrades[current]?.stars ?? 0} />
          ) : null}
          {current < steps.length - 1 ? (
            <button
              type="button"
              onClick={() => setCurrent((c) => c + 1)}
              className="rounded border border-border px-4 py-2 hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
            >
              Next stage →
            </button>
          ) : null}
        </div>
      ) : null}

      {committed || !allAnswered ? null : (
        <button
          type="button"
          onClick={() => onCommit({ kind: "composite", steps: answers, hintsUsed })}
          className="self-start rounded-md bg-accent px-5 py-2.5 font-medium text-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Finish the boss
        </button>
      )}
    </div>
  );
}
