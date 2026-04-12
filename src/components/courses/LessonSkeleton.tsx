import { Skeleton } from "@/components/ui/skeleton";

export default function LessonSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
        {/* Progress bar skeleton */}
        <div className="h-1.5 bg-secondary overflow-hidden">
          <div className="h-full w-1/3 bg-gradient-to-r from-muted via-muted-foreground/10 to-muted animate-[shimmer_1.5s_ease-in-out_infinite] rounded-full" />
        </div>
        <div className="p-6 sm:p-8 space-y-6">
          {/* Badge row */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          {/* Title */}
          <Skeleton className="h-8 w-3/4" />
          {/* Body lines */}
          <div className="space-y-3 min-h-[200px]">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/6" />
            <div className="py-2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          {/* Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Skeleton className="h-8 w-24" />
            <div className="flex gap-1.5">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="w-2 h-2 rounded-full" />
              ))}
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}
