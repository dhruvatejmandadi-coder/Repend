import { useState } from "react";
import { usePostComments } from "@/hooks/usePostComments";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trash2, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface PostCommentsSectionProps {
  postId: string;
}

export function PostCommentsSection({ postId }: PostCommentsSectionProps) {
  const { comments, loading, addComment, deleteComment } = usePostComments(postId);
  const { user } = useAuth();
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    await addComment(newComment);
    setNewComment("");
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="space-y-2 pt-2 border-t border-border">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-3/4" />
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-3 border-t border-border">
      {/* Comments list */}
      {comments.map((c) => (
        <div key={c.id} className="flex gap-2 group">
          <Avatar className="w-6 h-6 mt-0.5">
            <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">
              {(c.author_name || "?").charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">{c.author_name || "Anonymous"}</span>
              <span className="text-[10px] text-muted-foreground">
                {(() => {
                  try {
                    return formatDistanceToNow(new Date(c.created_at), { addSuffix: true });
                  } catch {
                    return "";
                  }
                })()}
              </span>
              {user?.id === c.user_id && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteComment(c.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{c.content}</p>
          </div>
        </div>
      ))}

      {/* Add comment */}
      {user ? (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            placeholder="Write a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="text-sm h-9"
            maxLength={500}
          />
          <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={submitting || !newComment.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-1">Log in to comment</p>
      )}
    </div>
  );
}
