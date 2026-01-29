import { StatsHeader } from "@/components/StatsHeader";
import { KanbanV2 } from "@/components/KanbanV2";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <StatsHeader />
        <KanbanV2 />
      </div>
    </main>
  );
}
