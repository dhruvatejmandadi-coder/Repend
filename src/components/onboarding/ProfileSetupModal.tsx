import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface ProfileSetupModalProps {
  open: boolean;
  onComplete: () => void;
}

const PROFILE_KEY = "repend_profile";

export function ProfileSetupModal({ open, onComplete }: ProfileSetupModalProps) {
  const { user } = useAuth();

  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || user?.user_metadata?.name || "");

  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);

    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({
        fullName,
        bio,
      }),
    );

    setTimeout(() => {
      setSaving(false);
      onComplete();
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-[480px] max-h-[90vh] overflow-hidden flex flex-col [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center flex-shrink-0">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <User className="w-7 h-7 text-primary" />
          </div>
          <DialogTitle className="text-xl font-display">Set Up Your Profile</DialogTitle>
          <DialogDescription>Tell us a bit about yourself to get started.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 flex-1 overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="setup-email">Email</Label>
            <Input id="setup-email" value={user?.email || ""} disabled className="bg-secondary/50" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="setup-name">Full Name</Label>
            <Input
              id="setup-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="setup-bio">Bio</Label>
            <Textarea
              id="setup-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us a bit about yourself..."
              rows={2}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">{bio.length}/500</p>
          </div>
        </div>

        <div className="flex-shrink-0 pt-4 border-t border-border">
          <Button variant="hero" className="w-full" onClick={handleSave} disabled={saving || !fullName.trim()}>
            {saving ? "Saving..." : "Done"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
