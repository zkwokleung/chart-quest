import { notFound } from "next/navigation";
import { ChartDemo } from "@/components/chart/ChartDemo";

export const metadata = { title: "Chart harness" };

/**
 * The authoring harness: any committed series, with the bar index under the pointer.
 *
 * Kept, because reading indices off a chart is how every level's `from`/`to` gets chosen and doing it
 * by hand would be miserable. **Not shipped**, because it is an internal tool and a public site has no
 * reason to offer a raw data browser — nothing links to it, so until M11 the only people who reached it
 * in production were the ones guessing URLs.
 *
 * Gated at render rather than deleted: the tool stays one `npm run dev` away, and there is nothing to
 * remember to re-add.
 */
export default function ChartHarnessPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-8">
      <ChartDemo />
    </main>
  );
}
