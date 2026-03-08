import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface CommunityPost {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  author_name: string | null;
  author_avatar_url: string | null;
  user_id: string | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  user_has_liked: boolean;
}

export function useCommunityPosts() {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchPosts = useCallback(async () => {
    const { data: rawPosts, error } = await supabase
      .from("community_posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !rawPosts) {
      console.error("Failed to fetch posts:", error);
      setLoading(false);
      return;
    }

    const postIds = rawPosts.map((p) => p.id);

    // Fetch likes counts
    const { data: likesData } = await supabase
      .from("post_likes")
      .select("post_id")
      .in("post_id", postIds);

    // Fetch comments counts
    const { data: commentsData } = await supabase
      .from("post_comments")
      .select("post_id")
      .in("post_id", postIds);

    // Fetch user's likes
    let userLikes: string[] = [];
    if (user) {
      const { data: userLikesData } = await supabase
        .from("post_likes")
        .select("post_id")
        .eq("user_id", user.id)
        .in("post_id", postIds);
      userLikes = (userLikesData || []).map((l) => l.post_id);
    }

    // Fetch author avatars
    const authorUserIds = [...new Set(rawPosts.map((p) => p.user_id).filter(Boolean))] as string[];
    let avatarMap: Record<string, string> = {};
    if (authorUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, avatar_url")
        .in("user_id", authorUserIds);
      if (profiles) {
        for (const p of profiles) {
          if (p.avatar_url) avatarMap[p.user_id] = p.avatar_url;
        }
      }
    }

    const likesMap: Record<string, number> = {};
    const commentsMap: Record<string, number> = {};
    (likesData || []).forEach((l) => {
      likesMap[l.post_id] = (likesMap[l.post_id] || 0) + 1;
    });
    (commentsData || []).forEach((c) => {
      commentsMap[c.post_id] = (commentsMap[c.post_id] || 0) + 1;
    });

    const enriched: CommunityPost[] = rawPosts.map((p) => ({
      id: p.id,
      title: p.title,
      content: p.content,
      image_url: p.image_url,
      author_name: p.author_name,
      author_avatar_url: p.user_id ? avatarMap[p.user_id] || null : null,
      user_id: p.user_id,
      created_at: p.created_at,
      likes_count: likesMap[p.id] || 0,
      comments_count: commentsMap[p.id] || 0,
      user_has_liked: userLikes.includes(p.id),
    }));

    setPosts(enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel("community-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_posts" }, () => {
        fetchPosts();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, () => {
        fetchPosts();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments" }, () => {
        fetchPosts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPosts]);

  const createPost = useCallback(
    async (post: { title: string; content: string; image_url: string | null }) => {
      if (!user) return null;

      // Get name from profile (matches what's set on the Profile page)
      let authorName = user.user_metadata?.full_name || user.email || "Anonymous";
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .single();
      if (profile?.full_name) authorName = profile.full_name;

      const { data, error } = await supabase
        .from("community_posts")
        .insert({
          title: post.title,
          content: post.content,
          image_url: post.image_url,
          user_id: user.id,
          author_name: authorName,
        })
        .select()
        .single();

      if (error) {
        console.error("Failed to create post:", error);
        return null;
      }
      return data;
    },
    [user]
  );

  const toggleLike = useCallback(
    async (postId: string) => {
      if (!user) return;
      const post = posts.find((p) => p.id === postId);
      if (!post) return;

      if (post.user_has_liked) {
        await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
      } else {
        await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id });
      }
      // Realtime will handle the refresh
    },
    [user, posts]
  );

  const deletePost = useCallback(
    async (postId: string) => {
      if (!user) return;
      await supabase.from("community_posts").delete().eq("id", postId).eq("user_id", user.id);
    },
    [user]
  );

  return { posts, loading, createPost, toggleLike, deletePost, refetch: fetchPosts };
}
