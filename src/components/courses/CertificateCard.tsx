import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Share2, Award } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRef } from "react";

interface CertificateCardProps {
  userName: string;
  courseName: string;
  certificateId: string;
  issuedAt: string;
}

export default function CertificateCard({
  userName,
  courseName,
  certificateId,
  issuedAt,
}: CertificateCardProps) {
  const { toast } = useToast();
  const certRef = useRef<HTMLDivElement>(null);

  const formattedDate = new Date(issuedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const handleDownload = async () => {
    if (!certRef.current) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 600;
      const ctx = canvas.getContext("2d")!;

      // Background
      ctx.fillStyle = "#1a2332";
      ctx.fillRect(0, 0, 800, 600);

      // Border
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 4;
      ctx.strokeRect(20, 20, 760, 560);
      ctx.strokeStyle = "#3b82f680";
      ctx.lineWidth = 1;
      ctx.strokeRect(30, 30, 740, 540);

      // Header
      ctx.fillStyle = "#3b82f6";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("REPEND AI", 400, 80);

      ctx.fillStyle = "#e2e8f0";
      ctx.font = "bold 32px sans-serif";
      ctx.fillText("Certificate of Completion", 400, 130);

      // User name
      ctx.fillStyle = "#94a3b8";
      ctx.font = "16px sans-serif";
      ctx.fillText("This certifies that", 400, 200);

      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 28px sans-serif";
      ctx.fillText(userName, 400, 245);

      // Course
      ctx.fillStyle = "#94a3b8";
      ctx.font = "16px sans-serif";
      ctx.fillText("has successfully completed the course", 400, 300);

      ctx.fillStyle = "#3b82f6";
      ctx.font = "bold 22px sans-serif";
      const truncated = courseName.length > 50 ? courseName.slice(0, 47) + "..." : courseName;
      ctx.fillText(truncated, 400, 340);

      // Date & ID
      ctx.fillStyle = "#64748b";
      ctx.font = "14px sans-serif";
      ctx.fillText(`Issued: ${formattedDate}`, 400, 440);
      ctx.fillText(`Certificate ID: ${certificateId}`, 400, 470);

      // Download
      const link = document.createElement("a");
      link.download = `repend-certificate-${certificateId}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      toast({ title: "Certificate downloaded!" });
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  const handleShare = async () => {
    const text = `I just earned a certificate from Repend AI for completing "${courseName}"! 🎓 Certificate ID: ${certificateId}`;
    if (navigator.share) {
      await navigator.share({ title: "Repend AI Certificate", text });
    } else {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied to clipboard!" });
    }
  };

  return (
    <Card className="bg-card border-border overflow-hidden" ref={certRef}>
      <CardContent className="p-6">
        <div className="text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Award className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Certificate</p>
            <h3 className="font-display font-bold text-lg mt-1 line-clamp-2">{courseName}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{formattedDate}</p>
          <p className="text-xs font-mono text-muted-foreground">{certificateId}</p>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={handleDownload}>
            <Download className="w-3.5 h-3.5" /> Download
          </Button>
          <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={handleShare}>
            <Share2 className="w-3.5 h-3.5" /> Share
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
