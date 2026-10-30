import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6" aria-busy="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-9 w-80" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </main>
  );
}
