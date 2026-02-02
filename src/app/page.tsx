import { StatsHeader } from "@/components/StatsHeader";
import { DashboardPanels } from "@/components/DashboardPanels";
import { KanbanV2 } from "@/components/KanbanV2";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-4">
        <StatsHeader />
        <DashboardPanels />
        <KanbanV2 />
      </div>
    </main>
  );
}
