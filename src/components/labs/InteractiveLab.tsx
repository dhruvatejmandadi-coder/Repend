import { FlaskConical } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import SimulationLab from "./SimulationLab";
import DecisionLab from "./DecisionLab";
import ClassificationLab from "./ClassificationLab";
import ReactMarkdown from "react-markdown";

type Props = {
  labType?: string | null;
  labData?: any;
  labTitle?: string | null;
  labDescription?: string | null;
};

export default function InteractiveLab({ labType, labData, labTitle, labDescription }: Props) {
  // If we have structured lab data, render the interactive version
  if (labType && labData) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <FlaskConical className="w-5 h-5 text-primary" />
          <h3 className="font-display font-bold text-lg">{labData.title || labTitle}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{labData.description}</p>

        {labType === "simulation" && <SimulationLab data={labData} />}
        {labType === "decision" && <DecisionLab data={labData} />}
        {labType === "classification" && <ClassificationLab data={labData} />}
      </div>
    );
  }

  // Fallback to markdown lab description
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <FlaskConical className="w-5 h-5 text-primary" />
          <h3 className="font-display font-bold text-lg">{labTitle}</h3>
        </div>
        <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
          <ReactMarkdown>{labDescription || ""}</ReactMarkdown>
        </div>
      </CardContent>
    </Card>
  );
}
