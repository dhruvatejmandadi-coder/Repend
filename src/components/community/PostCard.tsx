import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Heart, MessageCircle, Trash2 } from "lucide-react";
import { CommunityPost } from "@/hooks/useCommunityPosts";
import { PostCommentsSection } from "./PostCommentsSection";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface PostCardProps {
  post: CommunityPost;
  onLike: (postId: string) => void;
  onDelete: (postId: string) => void;
}

export function PostCard({ post, onLike, onDelete }: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const { user } = useAuth();
  const isOwner = user?.id === post.user_id;

  const timeAgo = (() => {
    try {
      return formatDistanceToNow(new Date(post.created_at), { addSuffix: true });
    } catch {
      return "just now";
    }
  })();

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        {/* Author row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {(post.author_name || "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{post.author_name || "Anonymous"}</p>
              <p className="text-xs text-muted-foreground">{timeAgo}</p>
            </div>
          </div>
          {isOwner && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(post.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Content */}
        <h3 className="font-display font-semibold text-lg">{post.title}</h3>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{post.content}</p>
        {post.image_url && (
          <img
            src={post.image_url}
            alt="Post attachment"
            className="rounded-lg max-h-80 w-full object-cover border border-border"
            loading="lazy"
          />
        )}

        {/* Actions */}
        <div className="flex items-center gap-4 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn("gap-1.5 text-muted-foreground", post.user_has_liked && "text-red-500")}
            onClick={() => onLike(post.id)}
          >
            <Heart className={cn("w-4 h-4", post.user_has_liked && "fill-current")} />
            <span className="text-xs">{post.likes_count}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => setShowComments(!showComments)}
          >
            <MessageCircle className="w-4 h-4" />
            <span className="text-xs">{post.comments_count}</span>
          </Button>
        </div>

        {/* Comments section */}
        {showComments && <PostCommentsSection postId={post.id} />}
      </CardContent>
    </Card>
  );
}
