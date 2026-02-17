import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap, Award, Download, Share2, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

interface CourseCompletionScreenProps {
  courseName: string;
  totalModules: number;
  pointsAwarded: number;
  onDismiss: () => void;
  onViewCertificate: () => void;
}

export default function CourseCompletionScreen({
  courseName,
  totalModules,
  pointsAwarded,
  onDismiss,
  onViewCertificate,
}: CourseCompletionScreenProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div
        className={`transition-all duration-700 ${
          show ? "opacity-100 scale-100" : "opacity-0 scale-90"
        }`}
      >
        <Card className="w-full max-w-lg mx-4 border-primary/30 bg-card shadow-lg">
          <CardContent className="p-8 text-center space-y-6">
            {/* Icon */}
            <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center animate-bounce">
              <GraduationCap className="w-10 h-10 text-primary" />
            </div>

            {/* Title */}
            <div>
              <h1 className="font-display text-3xl font-bold text-foreground">
                🎉 Course Completed!
              </h1>
              <p className="text-muted-foreground mt-2">
                You've completed all {totalModules} modules in
              </p>
              <p className="text-lg font-semibold text-primary mt-1">{courseName}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-secondary/50 border border-border">
                <p className="text-2xl font-bold text-primary">+{pointsAwarded}</p>
                <p className="text-xs text-muted-foreground">Points Earned</p>
              </div>
              <div className="p-4 rounded-xl bg-secondary/50 border border-border">
                <Award className="w-6 h-6 text-amber-500 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Badge Unlocked</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <Button variant="hero" className="w-full gap-2" onClick={onViewCertificate}>
                <Download className="w-4 h-4" />
                View Certificate
              </Button>
              <Button variant="outline" className="w-full gap-2" onClick={onDismiss}>
                <ArrowRight className="w-4 h-4" />
                Continue Learning
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
