import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, User, Info, Zap } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAITutor } from "@/hooks/useAITutor";
import ReactMarkdown from "react-markdown";

const MAX_FREE_MESSAGES = 10;

const suggestedQuestions = [
  "Explain recursion in programming",
  "How do I solve quadratic equations?",
  "Tips for improving my writing",
  "What makes a good portfolio?",
];

export default function AITutor() {
  const { messages, isLoading, sendMessage } = useAITutor();
  const [input, setInput] = useState("");
  const [messageCount, setMessageCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const remainingMessages = MAX_FREE_MESSAGES - messageCount;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    if (remainingMessages <= 0) {
      return;
    }

    const messageToSend = input.trim();
    setInput("");
    setMessageCount((prev) => prev + 1);
    await sendMessage(messageToSend);
  };

  const handleSuggestion = (question: string) => {
    setInput(question);
  };

  return (
    <DashboardLayout>
      <div className="p-6 flex flex-col h-[calc(100vh-3.5rem)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center">
              <Bot className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold">AI Tutor</h1>
              <p className="text-sm text-muted-foreground">Your 24/7 learning companion</p>
            </div>
          </div>
          
          {/* Credits Display */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
            remainingMessages <= 3 ? "bg-destructive/10 text-destructive" : "bg-secondary"
          }`}>
            <Zap className="w-4 h-4" />
            <span className="text-sm font-medium">{remainingMessages} messages left</span>
          </div>
        </div>

        {/* Info Banner */}
        <div className="flex items-start gap-3 p-4 bg-secondary/50 rounded-xl border border-border mb-4">
          <Info className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            <span className="text-accent font-medium">AI helps you learn.</span>{" "}
            <span className="text-primary font-medium">Mentors help you improve.</span>{" "}
            Use me to understand concepts, then book a mentor for personalized feedback on your work.
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
                  {message.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none text-foreground prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-code:text-accent prose-code:bg-background/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-background/50 prose-pre:border prose-pre:border-border prose-ul:text-foreground prose-ol:text-foreground prose-li:text-foreground">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}
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

          {/* Limit Reached Banner */}
          {remainingMessages <= 0 && (
            <div className="p-4 bg-destructive/10 border-t border-destructive/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-destructive">Free messages used up</p>
                  <p className="text-sm text-muted-foreground">Sign up to continue learning</p>
                </div>
                <Button variant="hero" size="sm" asChild>
                  <Link to="/signup">Get More</Link>
                </Button>
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
                placeholder={remainingMessages > 0 ? "Ask anything..." : "Sign up to continue..."}
                className="flex-1"
                disabled={isLoading || remainingMessages <= 0}
              />
              <Button 
                variant="hero" 
                size="icon"
                onClick={handleSend}
                disabled={!input.trim() || isLoading || remainingMessages <= 0}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
