import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Beaker, ClipboardList, ChevronDown, ChevronUp } from "lucide-react";
import type { CreatorModule } from "@/pages/CourseCreator";
import LabEditor from "./LabEditor";
import QuizEditor from "./QuizEditor";
import { useState } from "react";

interface Props {
  module: CreatorModule;
  onChange: (updates: Partial<CreatorModule>) => void;
}

export default function ModuleEditor({ module, onChange }: Props) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    lesson: true,
    lab: true,
    quiz: true,
  });

  const toggle = (section: string) =>
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));

  return (
    <div className="space-y-3 pt-4">
      <div className="space-y-2">
        <Label>Module Title</Label>
        <Input
          placeholder="e.g. Understanding Supply & Demand"
          value={module.title}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </div>

      {/* Lesson Section */}
      <SectionHeader
        icon={<FileText className="w-3.5 h-3.5" />}
        label="Lesson"
        badge={module.lesson_content ? "Added" : undefined}
        open={openSections.lesson}
        onToggle={() => toggle("lesson")}
      />
      {openSections.lesson && (
        <div className="space-y-3 pl-2 border-l-2 border-primary/20 ml-2">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Use <code className="bg-secondary px-1 rounded">---</code> to separate slides. Use <code className="bg-secondary px-1 rounded">## Heading</code> for slide titles.
            </p>
            <Textarea
              placeholder={`## What is Supply?\n\n- Supply is the quantity of a good...\n\n---\n\n## What is Demand?\n\n- Demand represents...`}
              value={module.lesson_content}
              onChange={(e) => onChange({ lesson_content: e.target.value })}
              rows={8}
              className="font-mono text-sm"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs">YouTube URL (optional)</Label>
              <Input
                placeholder="https://youtube.com/watch?v=..."
                value={module.youtube_url || ""}
                onChange={(e) => onChange({ youtube_url: e.target.value || null })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Video Title</Label>
              <Input
                placeholder="Video title..."
                value={module.youtube_title || ""}
                onChange={(e) => onChange({ youtube_title: e.target.value || null })}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Lab Section */}
      <SectionHeader
        icon={<Beaker className="w-3.5 h-3.5" />}
        label="Lab"
        badge={module.lab_type || undefined}
        open={openSections.lab}
        onToggle={() => toggle("lab")}
      />
      {openSections.lab && (
        <div className="pl-2 border-l-2 border-green-500/20 ml-2">
          <LabEditor module={module} onChange={onChange} />
        </div>
      )}

      {/* Quiz Section */}
      <SectionHeader
        icon={<ClipboardList className="w-3.5 h-3.5" />}
        label="Quiz"
        badge={module.quiz.length > 0 ? `${module.quiz.length} Q` : undefined}
        open={openSections.quiz}
        onToggle={() => toggle("quiz")}
      />
      {openSections.quiz && (
        <div className="pl-2 border-l-2 border-orange-500/20 ml-2">
          <QuizEditor
            questions={module.quiz}
            onChange={(quiz) => onChange({ quiz })}
          />
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  icon,
  label,
  badge,
  open,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 w-full text-left py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors"
    >
      {icon}
      <span className="text-sm font-medium flex-1">{label}</span>
      {badge && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {badge}
        </Badge>
      )}
      {open ? (
        <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
      ) : (
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
      )}
    </button>
  );
}
