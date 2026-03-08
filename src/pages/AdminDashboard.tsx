import { useState, useEffect } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Shield, UserPlus, Users, BookOpen, TrendingUp, Loader2,
  ClipboardList, DollarSign, Trophy, Plus, Pencil, Trash2, Eye,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type AdminUser = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  full_name: string;
  role: string;
};

type Survey = {
  id: string;
  email: string;
  user_id: string | null;
  created_at: string;
  goals: string[] | null;
  challenges: string[] | null;
  subject_area: string | null;
  skill_level: string | null;
  time_commitment: string | null;
};

type Sale = {
  id: string;
  email: string;
  user_id: string;
  plan: string;
  status: string;
  created_at: string;
  current_period_end: string | null;
  stripe_subscription_id: string | null;
};

type Challenge = {
  id: string;
  title: string;
  description: string;
  youtube_url: string | null;
  is_daily: boolean;
  expires_at: string | null;
  created_at: string;
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading, inviteAdmin } = useAdmin();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("users");
  const [loading, setLoading] = useState(false);

  // Data
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);

  // Invite
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  // Challenge form
  const [challengeDialog, setChallengeDialog] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
  const [challengeForm, setChallengeForm] = useState({
    title: "", description: "", youtube_url: "", is_daily: false, expires_at: "",
  });

  // Survey detail
  const [surveyDetail, setSurveyDetail] = useState<Survey | null>(null);

  useEffect(() => {
    if (!adminLoading && !isAdmin) navigate("/courses");
  }, [isAdmin, adminLoading, navigate]);

  const callAdmin = async (action: string, data?: any) => {
    const { data: result, error } = await supabase.functions.invoke("admin-data", {
      body: { action, data },
    });
    if (error) throw error;
    return result;
  };

  const fetchData = async (tab: string) => {
    setLoading(true);
    try {
      switch (tab) {
        case "users": {
          const res = await callAdmin("get_users");
          setUsers(res.users || []);
          break;
        }
        case "surveys": {
          const res = await callAdmin("get_surveys");
          setSurveys(res.surveys || []);
          break;
        }
        case "sales": {
          const res = await callAdmin("get_sales");
          setSales(res.sales || []);
          break;
        }
        case "challenges": {
          const res = await callAdmin("get_challenges");
          setChallenges(res.challenges || []);
          break;
        }
      }
    } catch (err: any) {
      toast({ title: "Error loading data", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  };

  // Load all data on mount so stats are accurate
  useEffect(() => {
    if (!isAdmin) return;
    const loadAll = async () => {
      setLoading(true);
      try {
        const [usersRes, surveysRes, salesRes, challengesRes] = await Promise.all([
          callAdmin("get_users"),
          callAdmin("get_surveys"),
          callAdmin("get_sales"),
          callAdmin("get_challenges"),
        ]);
        setUsers(usersRes.users || []);
        setSurveys(surveysRes.surveys || []);
        setSales(salesRes.sales || []);
        setChallenges(challengesRes.challenges || []);
      } catch (err: any) {
        toast({ title: "Error loading data", description: err.message, variant: "destructive" });
      }
      setLoading(false);
    };
    loadAll();
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
      fetchData("users");
    } catch (err: any) {
      toast({ title: "Invite failed", description: err.message, variant: "destructive" });
    }
    setInviting(false);
  };

  const openCreateChallenge = () => {
    setEditingChallenge(null);
    setChallengeForm({ title: "", description: "", youtube_url: "", is_daily: false, expires_at: "" });
    setChallengeDialog(true);
  };

  const openEditChallenge = (c: Challenge) => {
    setEditingChallenge(c);
    setChallengeForm({
      title: c.title,
      description: c.description,
      youtube_url: c.youtube_url || "",
      is_daily: c.is_daily,
      expires_at: c.expires_at ? c.expires_at.slice(0, 16) : "",
    });
    setChallengeDialog(true);
  };

  const handleSaveChallenge = async () => {
    try {
      const payload: any = {
        title: challengeForm.title,
        description: challengeForm.description,
        youtube_url: challengeForm.youtube_url || null,
        is_daily: challengeForm.is_daily,
        expires_at: challengeForm.expires_at || null,
      };

      if (editingChallenge) {
        await callAdmin("update_challenge", { id: editingChallenge.id, ...payload });
        toast({ title: "Challenge updated" });
      } else {
        await callAdmin("create_challenge", payload);
        toast({ title: "Challenge created" });
      }
      setChallengeDialog(false);
      fetchData("challenges");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteChallenge = async (id: string) => {
    if (!confirm("Delete this challenge?")) return;
    try {
      await callAdmin("delete_challenge", { id });
      toast({ title: "Challenge deleted" });
      fetchData("challenges");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
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
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-7 h-7 text-primary" />
            <h1 className="font-display text-2xl font-bold">Admin Dashboard</h1>
          </div>
          {/* Invite admin */}
          <div className="flex gap-2 items-end">
            <Input
              placeholder="admin@email.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-56"
            />
            <Button size="sm" onClick={handleInvite} disabled={inviting || !inviteEmail}>
              <UserPlus className="w-4 h-4 mr-1" />
              {inviting ? "..." : "Invite Admin"}
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Users" value={users.length} />
          <StatCard icon={ClipboardList} label="Surveys" value={surveys.length} />
          <StatCard icon={DollarSign} label="Subscriptions" value={sales.length} />
          <StatCard icon={Trophy} label="Challenges" value={challenges.length} />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-lg grid-cols-4">
            <TabsTrigger value="users" className="gap-1"><Users className="w-3.5 h-3.5" />Users</TabsTrigger>
            <TabsTrigger value="surveys" className="gap-1"><ClipboardList className="w-3.5 h-3.5" />Surveys</TabsTrigger>
            <TabsTrigger value="sales" className="gap-1"><DollarSign className="w-3.5 h-3.5" />Sales</TabsTrigger>
            <TabsTrigger value="challenges" className="gap-1"><Trophy className="w-3.5 h-3.5" />Challenges</TabsTrigger>
          </TabsList>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* USERS TAB */}
              <TabsContent value="users">
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead>Last Sign In</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                          <TableCell>
                            <Badge variant={u.role === "admin" ? "default" : "secondary"} className="text-xs">
                              {u.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(u.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : "Never"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {users.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No users found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* SURVEYS TAB */}
              <TabsContent value="surveys">
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Skill Level</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {surveys.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="text-sm">{s.email}</TableCell>
                          <TableCell className="text-sm">{s.subject_area || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{s.skill_level || "—"}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{s.time_commitment || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(s.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => setSurveyDetail(s)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {surveys.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No surveys found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Survey detail dialog */}
                <Dialog open={!!surveyDetail} onOpenChange={(o) => !o && setSurveyDetail(null)}>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Survey Details — {surveyDetail?.email}</DialogTitle>
                    </DialogHeader>
                    {surveyDetail && (
                      <div className="space-y-3 text-sm">
                        <Detail label="Goals" value={surveyDetail.goals?.join(", ")} />
                        <Detail label="Challenges" value={surveyDetail.challenges?.join(", ")} />
                        <Detail label="Subject Area" value={surveyDetail.subject_area} />
                        <Detail label="Skill Level" value={surveyDetail.skill_level} />
                        <Detail label="Time Commitment" value={surveyDetail.time_commitment} />
                        <Detail label="Submitted" value={new Date(surveyDetail.created_at).toLocaleString()} />
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </TabsContent>

              {/* SALES TAB */}
              <TabsContent value="sales">
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Period End</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="text-sm">{s.email}</TableCell>
                          <TableCell>
                            <Badge variant={s.plan === "elite" ? "default" : s.plan === "pro" ? "secondary" : "outline"} className="text-xs capitalize">
                              {s.plan}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={s.status === "active" ? "default" : "destructive"} className="text-xs">
                              {s.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(s.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {sales.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No subscriptions found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* CHALLENGES TAB */}
              <TabsContent value="challenges">
                <div className="flex justify-end mb-4">
                  <Button onClick={openCreateChallenge}>
                    <Plus className="w-4 h-4 mr-1" /> New Challenge
                  </Button>
                </div>
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Video</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {challenges.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.title}</TableCell>
                          <TableCell>
                            <Badge variant={c.is_daily ? "default" : "outline"} className="text-xs">
                              {c.is_daily ? "Daily" : "Regular"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {c.youtube_url ? "Yes" : "No"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(c.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => openEditChallenge(c)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteChallenge(c.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {challenges.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No challenges yet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Challenge Create/Edit Dialog */}
                <Dialog open={challengeDialog} onOpenChange={setChallengeDialog}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingChallenge ? "Edit Challenge" : "Create Challenge"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Title</Label>
                        <Input
                          value={challengeForm.title}
                          onChange={(e) => setChallengeForm(f => ({ ...f, title: e.target.value }))}
                          placeholder="Challenge title"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          value={challengeForm.description}
                          onChange={(e) => setChallengeForm(f => ({ ...f, description: e.target.value }))}
                          placeholder="Describe the challenge..."
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>YouTube URL (optional)</Label>
                        <Input
                          value={challengeForm.youtube_url}
                          onChange={(e) => setChallengeForm(f => ({ ...f, youtube_url: e.target.value }))}
                          placeholder="https://youtube.com/embed/..."
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={challengeForm.is_daily}
                          onCheckedChange={(v) => setChallengeForm(f => ({ ...f, is_daily: v }))}
                        />
                        <Label>Daily Challenge</Label>
                      </div>
                      {challengeForm.is_daily && (
                        <div className="space-y-2">
                          <Label>Expires At</Label>
                          <Input
                            type="datetime-local"
                            value={challengeForm.expires_at}
                            onChange={(e) => setChallengeForm(f => ({ ...f, expires_at: e.target.value }))}
                          />
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setChallengeDialog(false)}>Cancel</Button>
                      <Button onClick={handleSaveChallenge} disabled={!challengeForm.title || !challengeForm.description}>
                        {editingChallenge ? "Update" : "Create"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
      <Icon className="w-7 h-7 text-primary/70" />
      <div>
        <p className="text-xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="font-medium text-foreground">{label}:</span>{" "}
      <span className="text-muted-foreground">{value || "—"}</span>
    </div>
  );
}
