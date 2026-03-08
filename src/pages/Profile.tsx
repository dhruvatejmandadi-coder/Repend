import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { usePoints } from "@/hooks/usePoints";
import { supabase } from "@/integrations/supabase/client";
import { User, Mail, Trophy, Flame, Award, Save, Loader2 } from "lucide-react";
import CertificateCard from "@/components/courses/CertificateCard";

const PROFILE_KEY = "repend_profile";

function loadProfile() {
  try {
    const stored = localStorage.getItem(PROFILE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    /* ignore */
  }
  return null;
}

interface CertificateRow {
  certificate_id: string;
  issued_at: string;
  courses: { title: string } | null;
}

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { totalPoints, streak, achievements } = usePoints();

  const [loading, setLoading] = useState(false);
  const [certificates, setCertificates] = useState<CertificateRow[]>([]);
  const [certsLoading, setCertsLoading] = useState(true);

  const saved = loadProfile();

  const [fullName, setFullName] = useState(
    saved?.fullName || user?.user_metadata?.full_name || user?.user_metadata?.name || "",
  );

  const [bio, setBio] = useState(saved?.bio || "");

  useEffect(() => {
    if (!user) return;

    (async () => {
      const { data } = await supabase
        .from("certificates")
        .select("certificate_id, issued_at, courses(title)")
        .eq("user_id", user.id)
        .order("issued_at", { ascending: false });

      setCertificates((data as any) || []);
      setCertsLoading(false);
    })();
  }, [user]);

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const handleSave = () => {
    setLoading(true);

    localStorage.setItem(PROFILE_KEY, JSON.stringify({ fullName, bio }));

    setTimeout(() => {
      setLoading(false);
      toast({
        title: "Profile updated",
        description: "Your changes have been saved.",
      });
    }, 300);
  };

  const userName = fullName || user?.user_metadata?.full_name || "Learner";

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Your Profile</h1>
          <p className="text-muted-foreground mt-1">Manage your account settings</p>
        </div>

        {/* Points Summary */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold">{totalPoints}</p>
                <p className="text-xs text-muted-foreground">Points</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <Flame className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xl font-bold">{streak}</p>
                <p className="text-xs text-muted-foreground">Day Streak</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <span className="text-lg">🏅</span>
              </div>
              <div>
                <p className="text-xl font-bold">{achievements.length}</p>
                <p className="text-xs text-muted-foreground">Badges</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Certificates */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              Certificates
            </CardTitle>
          </CardHeader>

          <CardContent>
            {certsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : certificates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Complete a course to earn your first certificate!
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {certificates.map((cert) => (
                  <CertificateCard
                    key={cert.certificate_id}
                    userName={userName}
                    courseName={cert.courses?.title || "Course"}
                    certificateId={cert.certificate_id}
                    issuedAt={cert.issued_at}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Profile Info */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Profile Information
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="w-20 h-20">
                <AvatarImage src="" />
                <AvatarFallback className="bg-primary/10 text-primary text-xl">
                  {fullName ? getInitials(fullName) : "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{fullName || "Add your name"}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="email" value={user?.email || ""} disabled className="pl-9 bg-secondary/50" />
                </div>
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us a bit about yourself..."
                  rows={3}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground text-right">{bio.length}/500</p>
              </div>
            </div>

            <Button variant="hero" className="w-full" onClick={handleSave} disabled={loading}>
              <Save className="w-4 h-4" />
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>
      </div>
  );
}
