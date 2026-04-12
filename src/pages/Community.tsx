import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, MessageCircle, Loader2, Search, TrendingUp, Clock } from "lucide-react";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreatePostModal } from "@/components/community/CreatePostModal";
import { PostCard } from "@/components/community/PostCard";
import { UserProfileModal } from "@/components/community/UserProfileModal";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { usePoints } from "@/hooks/usePoints";
import { useCommunityPosts } from "@/hooks/useCommunityPosts";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Community() {
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { addCommunityPoints } = usePoints();
  const { posts, loading, createPost, toggleLike, deletePost } = useCommunityPosts();

  const filteredPosts = useMemo(() => {
    if (!searchQuery.trim()) return posts;
    const q = searchQuery.toLowerCase();
    return posts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        (p.author_name || "").toLowerCase().includes(q)
    );
  }, [posts, searchQuery]);

  const trendingPosts = useMemo(() => {
    return [...filteredPosts].sort((a, b) => b.likes_count + b.comments_count - (a.likes_count + a.comments_count));
  }, [filteredPosts]);

  const handleCreatePost = () => {
    if (!user) {
      toast({ title: "Login required", description: "Please log in to create a post." });
      navigate("/login");
      return;
    }
    setCreatePostOpen(true);
  };

  const handlePostCreated = async (post: { title: string; content: string; image_url: string | null }) => {
    const result = await createPost(post);
    if (result) {
      addCommunityPoints();
    }
  };

  const handleLike = (postId: string) => {
    if (!user) {
      toast({ title: "Login required", description: "Please log in to like posts." });
      navigate("/login");
      return;
    }
    toggleLike(postId);
  };

  const handleDelete = async (postId: string) => {
    await deletePost(postId);
    toast({ title: "Post deleted" });
  };

  const handleReport = async (postId: string) => {
    if (!user) {
      toast({ title: "Login required", description: "Please log in to report posts." });
      return;
    }
    const { error } = await supabase
      .from("post_reports")
      .insert({ post_id: postId, user_id: user.id, reason: "inappropriate" });

    if (error?.code === "23505") {
      toast({ title: "Already reported", description: "You've already reported this post." });
    } else if (error) {
      toast({ title: "Error", description: "Could not report post.", variant: "destructive" });
    } else {
      toast({ title: "Post reported", description: "Thank you for helping keep the community safe." });
    }
  };

  const handleProfileClick = (userId: string) => {
    setProfileUserId(userId);
    setProfileOpen(true);
  };

  const renderPosts = (postList: typeof filteredPosts) => {
    if (postList.length === 0) {
      return (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-display text-lg font-semibold mb-2">
              {searchQuery ? "No matching posts" : "No posts yet"}
            </h3>
            <p className="text-muted-foreground text-sm max-w-sm mb-6">
              {searchQuery
                ? "Try a different search term."
                : "Be the first to start a conversation! Share a question or problem you're working through."}
            </p>
            {!searchQuery && (
              <Button variant="outline" onClick={handleCreatePost}>
                <Plus className="w-4 h-4 mr-2" />
                Create First Post
              </Button>
            )}
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {postList.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onLike={handleLike}
            onDelete={handleDelete}
            onReport={handleReport}
            onProfileClick={handleProfileClick}
          />
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="p-6 pb-24 relative min-h-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold">Community</h1>
          <p className="text-muted-foreground mt-1">
            Ask questions, share problems, and help others learn
          </p>
        </div>

        {/* Search bar */}
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search posts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="recent">
            <TabsList className="mb-4 w-full">
              <TabsTrigger value="recent" className="flex-1 gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Recent
              </TabsTrigger>
              <TabsTrigger value="trending" className="flex-1 gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                Trending
              </TabsTrigger>
            </TabsList>

            <TabsContent value="recent">
              <ScrollArea className="h-[calc(100vh-20rem)]">
                <div className="pr-4">{renderPosts(filteredPosts)}</div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="trending">
              <ScrollArea className="h-[calc(100vh-20rem)]">
                <div className="pr-4">{renderPosts(trendingPosts)}</div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}

        {/* Floating Action Button */}
        <Button
          variant="hero"
          size="icon"
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg z-50"
          onClick={handleCreatePost}
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>

      <CreatePostModal
        open={createPostOpen}
        onOpenChange={setCreatePostOpen}
        onPostCreated={handlePostCreated}
      />

      <UserProfileModal
        open={profileOpen}
        onOpenChange={setProfileOpen}
        userId={profileUserId}
      />
    </>
  );
}
