import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, User, Sparkles, Info } from "lucide-react";
import { useState, useRef, useEffect } from "react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const suggestedQuestions = [
  "What's the best software for video editing?",
  "How do I improve my pacing in edits?",
  "Explain color grading basics",
  "Tips for smooth transitions",
];

export default function AITutor() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hey! I'm your AI tutor. I can help you learn video editing concepts, prepare for mentor sessions, or answer any questions. What would you like to learn about?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Simulate AI response (will be replaced with real AI later)
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: getSimulatedResponse(userMessage.content),
      };
      setMessages((prev) => [...prev, aiResponse]);
      setIsLoading(false);
    }, 1000);
  };

  const getSimulatedResponse = (question: string): string => {
    const q = question.toLowerCase();
    
    if (q.includes("software") || q.includes("best")) {
      return "For beginners, I'd recommend starting with DaVinci Resolve (free and powerful) or Adobe Premiere Pro (industry standard). Both have great communities and tutorials. Would you like me to explain the pros and cons of each?";
    }
    if (q.includes("pacing") || q.includes("rhythm")) {
      return "Great question! Pacing is all about matching your edits to the energy of your content. Key tips:\n\n1. **Cut on action** - Make cuts during movement\n2. **Match audio beats** - Sync cuts to music or dialogue\n3. **Vary shot length** - Mix quick cuts with longer holds\n\nWant me to elaborate on any of these?";
    }
    if (q.includes("color") || q.includes("grading")) {
      return "Color grading transforms the look of your footage. The basics:\n\n1. **Primary correction** - Fix exposure, white balance\n2. **Secondary correction** - Adjust specific colors/areas\n3. **Creative grading** - Add your artistic style\n\nStart with getting your footage 'neutral' before adding creative looks. Should I explain any step in more detail?";
    }
    if (q.includes("transition")) {
      return "Smooth transitions are about motivation. Ask yourself: 'Why am I cutting here?'\n\nBest practices:\n• Use match cuts (similar shapes/movement)\n• J-cuts and L-cuts for natural flow\n• Save wipes/effects for intentional style moments\n\nThe best transition is often a simple cut at the right moment!";
    }
    
    return "That's a great question about video editing! I'd love to help you understand this better. Could you tell me more about what specific aspect you're curious about? Or if you'd like, you can book a session with one of our mentors for personalized guidance on this topic.";
  };

  const handleSuggestion = (question: string) => {
    setInput(question);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 pt-16 flex flex-col">
        <div className="container px-4 sm:px-6 flex-1 flex flex-col max-w-4xl py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center">
                <Bot className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <h1 className="font-display text-xl font-bold">AI Tutor</h1>
                <p className="text-sm text-muted-foreground">Your 24/7 learning companion</p>
              </div>
            </div>
          </div>

          {/* Info Banner */}
          <div className="flex items-start gap-3 p-4 bg-secondary/50 rounded-xl border border-border mb-6">
            <Info className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              <span className="text-accent font-medium">AI helps you learn.</span>{" "}
              <span className="text-primary font-medium">Mentors help you improve.</span>{" "}
              Use me to understand concepts and prepare, then book a mentor for personalized feedback on your work.
            </p>
          </div>

          {/* Chat Area */}
          <div className="flex-1 bg-card border border-border rounded-2xl flex flex-col overflow-hidden">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === "user" ? "justify-end" : ""
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-accent-foreground" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      message.role === "user"
                        ? "gradient-primary text-primary-foreground"
                        : "bg-secondary"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                  {message.role === "user" && (
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-foreground" />
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-accent-foreground" />
                  </div>
                  <div className="bg-secondary rounded-2xl px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Suggestions */}
            {messages.length === 1 && (
              <div className="px-4 pb-4">
                <p className="text-xs text-muted-foreground mb-2">Try asking:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedQuestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSuggestion(q)}
                      className="text-xs px-3 py-1.5 bg-secondary hover:bg-secondary/80 rounded-full transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-4 border-t border-border">
              <div className="flex gap-3">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Ask anything about video editing..."
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button 
                  variant="hero" 
                  size="icon"
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
