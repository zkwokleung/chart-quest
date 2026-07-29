import { ChartDemo } from "@/components/chart/ChartDemo";

export const metadata = { title: "Chart harness" };

export default function ChartHarnessPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-8">
      <ChartDemo />
    </main>
  );
}
