import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, MessageCircle } from "lucide-react";
import { useState } from "react";
import { CreatePostModal } from "@/components/community/CreatePostModal";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

export default function Community() {
  const [createPostOpen, setCreatePostOpen] = useState(false);
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

        {/* Empty State */}
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

      <CreatePostModal open={createPostOpen} onOpenChange={setCreatePostOpen} />
    </DashboardLayout>
  );
}
