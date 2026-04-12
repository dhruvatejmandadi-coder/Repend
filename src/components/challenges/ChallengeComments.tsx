import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface Comment {
  id: string;
  author_name: string | null;
  content: string;
  created_at: string;
  user_id: string | null;
}

interface ChallengeCommentsProps {
  challengeId: string;
}

export function ChallengeComments({ challengeId }: ChallengeCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [guestName, setGuestName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchComments = async () => {
    const { data, error } = await supabase
      .from("challenge_comments")
      .select("*")
      .eq("challenge_id", challengeId)
      .order("created_at", { ascending: false });

    if (!error && data) setComments(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchComments();
  }, [challengeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    if (!user && !guestName.trim()) {
      toast({ title: "Name required", description: "Please enter your name to comment." });
      return;
    }

    setSubmitting(true);

    let authorName = "User";
    const payload: any = {
      challenge_id: challengeId,
      content: newComment.trim(),
    };

    if (user) {
      // Fetch profile name to stay consistent with community posts
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .single();
      authorName = profile?.full_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "User";
      payload.user_id = user.id;
      payload.author_name = authorName;
    } else {
      payload.author_name = guestName.trim();
    }

    const { error } = await supabase.from("challenge_comments").insert(payload);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setNewComment("");
      toast({ title: "Comment added!" });
      fetchComments();
    }
    setSubmitting(false);
  };

  return (
    <div className="pt-4 border-t border-border space-y-4">
      <form onSubmit={handleSubmit} className="space-y-2">
        {!user && (
          <Input
            placeholder="Your name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            className="text-sm"
          />
        )}
        <div className="flex gap-2">
          <Input
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="text-sm"
          />
          <Button type="submit" size="icon" disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </form>

      <div className="space-y-3 max-h-60 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No comments yet. Be the first!</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {(comment.author_name || "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{comment.author_name || "Anonymous"}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{comment.content}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
