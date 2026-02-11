import { useState, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tutor`;
const STORAGE_KEY = "repend_ai_tutor_messages";

const welcomeMessage: Message = {
  id: "welcome",
  role: "assistant",
  content: "Hey! I'm your AI tutor. I can help you learn about coding, school subjects, creative skills, professional development, and much more. What would you like to explore today?",
};

function loadMessages(): Message[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Message[];
      if (parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return [welcomeMessage];
}

function saveMessages(messages: Message[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch { /* ignore */ }
}

export function useAITutor() {
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Save messages whenever they change
  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  const clearMessages = useCallback(() => {
    setMessages([welcomeMessage]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const sendMessage = useCallback(async (input: string) => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    let assistantContent = "";
    
    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.id !== "welcome") {
          return prev.map((m, i) => 
            i === prev.length - 1 ? { ...m, content: assistantContent } : m
          );
        }
        return [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: assistantContent }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages.filter(m => m.id !== "welcome"), userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${resp.status}`);
      }

      if (!resp.body) {
        throw new Error("No response body");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) updateAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw || raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) updateAssistant(content);
          } catch { /* ignore */ }
        }
      }
    } catch (error) {
      console.error("AI tutor error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to get response",
      });
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, toast]);

  return { messages, isLoading, sendMessage, clearMessages };
}
