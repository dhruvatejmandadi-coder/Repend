import { Skeleton } from "@/components/ui/skeleton";

export default function CourseViewSkeleton() {
  return (
    <div className="flex h-[calc(100vh-3rem)] animate-fade-in">
      {/* Sidebar skeleton */}
      <aside className="w-72 border-r border-border/50 bg-card/30 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-border/40 space-y-3">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-5 w-48" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-1 flex-1 rounded-full" />
            <Skeleton className="h-3 w-8" />
          </div>
        </div>
        <div className="flex-1 p-2 space-y-1">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-4 py-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="w-3.5 h-3.5 rounded-full" />
                <Skeleton className="h-4 flex-1" />
              </div>
              {i === 0 && (
                <div className="pl-6 space-y-1">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-3.5 w-14" />
                  <Skeleton className="h-3.5 w-16" />
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* Main content skeleton */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-64" />
          </div>
          {/* Slide skeleton */}
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
            <div className="h-1.5 bg-secondary overflow-hidden">
              <div className="h-full w-1/3 bg-gradient-to-r from-muted via-muted-foreground/10 to-muted animate-[shimmer_1.5s_ease-in-out_infinite]" />
            </div>
            <div className="p-6 sm:p-8 space-y-5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-8 w-3/4" />
              <div className="space-y-3 min-h-[200px]">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/6" />
                <div className="py-2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <Skeleton className="h-8 w-24" />
                <div className="flex gap-1.5">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="w-2 h-2 rounded-full" />)}
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
