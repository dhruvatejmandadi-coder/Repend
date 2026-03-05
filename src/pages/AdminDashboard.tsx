import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, UserPlus, Users, BookOpen, TrendingUp, Loader2 } from "lucide-react";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading, inviteAdmin } = useAdmin();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [stats, setStats] = useState({ users: 0, courses: 0, labResults: 0 });
  const [invites, setInvites] = useState<any[]>([]);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate("/courses");
    }
  }, [isAdmin, adminLoading, navigate]);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchStats = async () => {
      const [coursesRes, labsRes, invitesRes] = await Promise.all([
        supabase.from("courses").select("id", { count: "exact", head: true }),
        supabase.from("lab_results").select("id", { count: "exact", head: true }),
        supabase.from("admin_invites").select("*").order("created_at", { ascending: false }),
      ]);
      setStats({
        users: 0, // can't query auth.users from client
        courses: coursesRes.count || 0,
        labResults: labsRes.count || 0,
      });
      setInvites(invitesRes.data || []);
    };
    fetchStats();
  }, [isAdmin]);

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    try {
      const result = await inviteAdmin(inviteEmail);
      toast({
        title: result.immediate ? "Admin role granted!" : "Invite sent!",
        description: result.immediate
          ? `${inviteEmail} is now an admin.`
          : `${inviteEmail} will become admin when they sign up.`,
      });
      setInviteEmail("");
      // Refresh invites
      const { data } = await supabase.from("admin_invites").select("*").order("created_at", { ascending: false });
      setInvites(data || []);
    } catch (err: any) {
      toast({ title: "Invite failed", description: err.message, variant: "destructive" });
    }
    setInviting(false);
  };

  if (adminLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) return null;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Shield className="w-7 h-7 text-primary" />
          <h1 className="font-display text-2xl font-bold">Admin Dashboard</h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard icon={BookOpen} label="Total Courses" value={stats.courses} />
          <StatCard icon={TrendingUp} label="Lab Completions" value={stats.labResults} />
          <StatCard icon={Users} label="Admin Invites" value={invites.length} />
        </div>

        {/* Invite Admin */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <UserPlus className="w-5 h-5" /> Invite New Admin
          </h2>
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="admin@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={inviting}
              />
            </div>
            <Button onClick={handleInvite} disabled={inviting || !inviteEmail}>
              {inviting ? "Sending..." : "Send Invite"}
            </Button>
          </div>
        </div>

        {/* Invites list */}
        {invites.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <h2 className="font-semibold text-lg">Invite History</h2>
            <div className="divide-y divide-border">
              {invites.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between py-3">
                  <span className="text-sm">{inv.email}</span>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      inv.accepted
                        ? "bg-green-500/10 text-green-600"
                        : "bg-yellow-500/10 text-yellow-600"
                    }`}
                  >
                    {inv.accepted ? "Accepted" : "Pending"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
      <Icon className="w-8 h-8 text-primary/70" />
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
