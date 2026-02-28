import { useState } from "react";
import { usePostComments } from "@/hooks/usePostComments";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trash2, Send, Reply } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { PostComment } from "@/hooks/usePostComments";
import { cn } from "@/lib/utils";

interface PostCommentsSectionProps {
  postId: string;
}

function CommentItem({
  comment,
  allComments,
  user,
  onDelete,
  onReply,
  replyingTo,
  depth = 0,
}: {
  comment: PostComment;
  allComments: PostComment[];
  user: any;
  onDelete: (id: string) => void;
  onReply: (id: string | null) => void;
  replyingTo: string | null;
  depth?: number;
}) {
  const replies = allComments.filter((c) => c.parent_id === comment.id);
  const timeAgo = (() => {
    try {
      return formatDistanceToNow(new Date(comment.created_at), { addSuffix: true });
    } catch {
      return "";
    }
  })();

  return (
    <div className={cn("space-y-2", depth > 0 && "ml-6 border-l border-border pl-3")}>
      <div className="flex gap-2 group">
        <Avatar className="w-6 h-6 mt-0.5 shrink-0">
          <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">
            {(comment.author_name || "?").charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium">{comment.author_name || "Anonymous"}</span>
            <span className="text-[10px] text-muted-foreground">{timeAgo}</span>
            {user && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100"
                onClick={() => onReply(replyingTo === comment.id ? null : comment.id)}
              >
                <Reply className="w-3 h-3 mr-0.5" />
                Reply
              </Button>
            )}
            {user?.id === comment.user_id && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(comment.id)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{comment.content}</p>
        </div>
      </div>

      {replies.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          allComments={allComments}
          user={user}
          onDelete={onDelete}
          onReply={onReply}
          replyingTo={replyingTo}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export function PostCommentsSection({ postId }: PostCommentsSectionProps) {
  const { comments, loading, addComment, deleteComment } = usePostComments(postId);
  const { user } = useAuth();
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const replyTarget = replyingTo ? comments.find((c) => c.id === replyingTo) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    await addComment(newComment, replyingTo);
    setNewComment("");
    setReplyingTo(null);
    setSubmitting(false);
  };

  const topLevelComments = comments.filter((c) => !c.parent_id);

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
      {topLevelComments.map((c) => (
        <CommentItem
          key={c.id}
          comment={c}
          allComments={comments}
          user={user}
          onDelete={deleteComment}
          onReply={setReplyingTo}
          replyingTo={replyingTo}
        />
      ))}

      {user ? (
        <div className="space-y-1">
          {replyTarget && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Reply className="w-3 h-3" />
              Replying to {replyTarget.author_name || "Anonymous"}
              <Button variant="ghost" size="sm" className="h-4 px-1 text-[10px]" onClick={() => setReplyingTo(null)}>
                ✕
              </Button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              placeholder={replyTarget ? `Reply to ${replyTarget.author_name || "Anonymous"}...` : "Write a comment..."}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="text-sm h-9"
              maxLength={500}
            />
            <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={submitting || !newComment.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-1">Log in to comment</p>
      )}
    </div>
  );
}
