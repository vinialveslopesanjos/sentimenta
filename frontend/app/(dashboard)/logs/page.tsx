"use client";

import PipelineLogViewer from "@/components/PipelineLogViewer";

export default function LogsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Logs de Pipeline</h1>
      <p className="text-sm text-text-secondary">
        Acompanhe o status das coletas e análises de sentimento.
      </p>
      <PipelineLogViewer />
    </div>
  );
}
