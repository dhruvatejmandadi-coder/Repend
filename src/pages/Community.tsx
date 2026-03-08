import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, MessageCircle, Loader2, Search } from "lucide-react";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { CreatePostModal } from "@/components/community/CreatePostModal";
import { PostCard } from "@/components/community/PostCard";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { usePoints } from "@/hooks/usePoints";
import { useCommunityPosts } from "@/hooks/useCommunityPosts";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Community() {
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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

  return (
    <>
      <div className="p-6 pb-24 relative min-h-full">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold">Community</h1>
          <p className="text-muted-foreground mt-1">
            Ask questions, share problems, and help others learn
          </p>
        </div>

        {/* Search bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search posts by title, content, or author..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredPosts.length === 0 ? (
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
        ) : (
          <ScrollArea className="h-[calc(100vh-18rem)]">
            <div className="space-y-4 pr-4">
              {filteredPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onLike={handleLike}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </ScrollArea>
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
    </>
  );
}
