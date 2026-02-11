import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, MessageCircle } from "lucide-react";
import { useState } from "react";
import { CreatePostModal } from "@/components/community/CreatePostModal";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Post {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  author: string;
  created_at: string;
}

export default function Community() {
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleCreatePost = () => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please log in to create a post.",
      });
      navigate("/login");
      return;
    }
    setCreatePostOpen(true);
  };

  const handlePostCreated = (post: { title: string; content: string; image_url: string | null }) => {
    const newPost: Post = {
      id: Date.now().toString(),
      title: post.title,
      content: post.content,
      image_url: post.image_url,
      author: user?.user_metadata?.full_name || user?.email || "You",
      created_at: "Just now",
    };
    setPosts((prev) => [newPost, ...prev]);
  };

  return (
    <DashboardLayout>
      <div className="p-6 pb-24 relative min-h-full">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold">Community</h1>
          <p className="text-muted-foreground mt-1">
            Ask questions, share problems, and help others learn
          </p>
        </div>

        {posts.length === 0 ? (
          /* Empty State */
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <MessageCircle className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-display text-lg font-semibold mb-2">
                No posts yet
              </h3>
              <p className="text-muted-foreground text-sm max-w-sm mb-6">
                Be the first to start a conversation! Share a question or problem 
                you're working through.
              </p>
              <Button variant="outline" onClick={handleCreatePost}>
                <Plus className="w-4 h-4 mr-2" />
                Create First Post
              </Button>
            </CardContent>
          </Card>
        ) : (
          /* Posts Feed */
          <ScrollArea className="h-[calc(100vh-14rem)]">
            <div className="space-y-4 pr-4">
              {posts.map((post) => (
                <Card key={post.id}>
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {post.author.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{post.author}</p>
                        <p className="text-xs text-muted-foreground">{post.created_at}</p>
                      </div>
                    </div>
                    <h3 className="font-display font-semibold text-lg">{post.title}</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{post.content}</p>
                    {post.image_url && (
                      <img
                        src={post.image_url}
                        alt="Post image"
                        className="rounded-lg max-h-80 w-full object-cover border border-border"
                      />
                    )}
                  </CardContent>
                </Card>
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
    </DashboardLayout>
  );
}
