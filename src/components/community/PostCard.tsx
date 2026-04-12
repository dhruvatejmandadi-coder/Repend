import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Heart, MessageCircle, MoreHorizontal, Trash2, Flag, Share2 } from "lucide-react";
import { CommunityPost } from "@/hooks/useCommunityPosts";
import { PostCommentsSection } from "./PostCommentsSection";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface PostCardProps {
  post: CommunityPost;
  onLike: (postId: string) => void;
  onDelete: (postId: string) => void;
  onReport?: (postId: string) => void;
  onProfileClick?: (userId: string) => void;
}

export function PostCard({ post, onLike, onDelete, onReport, onProfileClick }: PostCardProps) {
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

  const handleProfileClick = () => {
    if (post.user_id && onProfileClick) {
      onProfileClick(post.user_id);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + "/community");
    } catch { /* ignore */ }
  };

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-5 space-y-3">
        {/* Author row */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            onClick={handleProfileClick}
          >
            <Avatar className="w-9 h-9">
              <AvatarImage src={post.author_avatar_url || ""} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {(post.author_name || "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="text-left">
              <p className="text-sm font-semibold leading-tight">{post.author_name || "Anonymous"}</p>
              <p className="text-[11px] text-muted-foreground">{timeAgo}</p>
            </div>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={handleShare}>
                <Share2 className="w-4 h-4 mr-2" />
                Share Post
              </DropdownMenuItem>
              {user && !isOwner && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onReport?.(post.id)}
                  >
                    <Flag className="w-4 h-4 mr-2" />
                    Report Post
                  </DropdownMenuItem>
                </>
              )}
              {isOwner && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDelete(post.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Post
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Content */}
        <div>
          <h3 className="font-display font-semibold text-base leading-snug">{post.title}</h3>
          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-4">{post.content}</p>
        </div>

        {post.image_url && (
          <img
            src={post.image_url}
            alt="Post attachment"
            className="rounded-xl max-h-80 w-full object-cover border border-border"
            loading="lazy"
          />
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 pt-1 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className={cn("gap-1.5 text-muted-foreground hover:text-red-500", post.user_has_liked && "text-red-500")}
            onClick={() => onLike(post.id)}
          >
            <Heart className={cn("w-4 h-4", post.user_has_liked && "fill-current")} />
            <span className="text-xs font-medium">{post.likes_count}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => setShowComments(!showComments)}
          >
            <MessageCircle className="w-4 h-4" />
            <span className="text-xs font-medium">{post.comments_count}</span>
          </Button>
        </div>

        {/* Comments section */}
        {showComments && <PostCommentsSection postId={post.id} />}
      </CardContent>
    </Card>
  );
}
