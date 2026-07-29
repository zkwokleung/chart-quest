type StarsProps = {
  earned: number;
  total?: number;
  label?: string;
};

/**
 * Stars are decorative; the accessible name carries the count. Rendering three
 * separate glyphs would make a screen reader announce "star star star".
 */
export function Stars({ earned, total = 3, label }: StarsProps) {
  const filled = Math.max(0, Math.min(total, earned));
  return (
    <span
      className="font-mono text-sm tracking-tight text-accent"
      aria-label={label ?? `${filled} of ${total} stars`}
    >
      <span aria-hidden="true">
        {"★".repeat(filled)}
        <span className="text-border">{"☆".repeat(total - filled)}</span>
      </span>
    </span>
  );
}
