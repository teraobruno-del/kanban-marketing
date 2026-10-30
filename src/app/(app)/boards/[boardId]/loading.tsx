import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col" aria-busy="true" aria-label="Carregando quadro">
      <div className="space-y-3 border-b bg-background p-4">
        <Skeleton className="h-6 w-56" />
        <div className="flex gap-2">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-6 w-24 rounded-full" />)}</div>
      </div>
      <div className="flex gap-3 overflow-hidden p-4">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="w-64 shrink-0 space-y-2 rounded-xl border bg-muted/60 p-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
