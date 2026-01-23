import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, Menu, X } from "lucide-react";
import { useState } from "react";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-xl text-foreground">
              MentorAI
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            <Link 
              to="/mentors" 
              className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
            >
              Find Mentors
            </Link>
            <Link 
              to="/ai-tutor" 
              className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
            >
              AI Tutor
            </Link>
            <Link 
              to="/how-it-works" 
              className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
            >
              How it Works
            </Link>
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Log in</Link>
            </Button>
            <Button variant="hero" size="sm" asChild>
              <Link to="/signup">Get Started</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border animate-fade-in">
            <nav className="flex flex-col gap-4">
              <Link 
                to="/mentors" 
                className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Find Mentors
              </Link>
              <Link 
                to="/ai-tutor" 
                className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                AI Tutor
              </Link>
              <Link 
                to="/how-it-works" 
                className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                How it Works
              </Link>
              <div className="flex gap-3 pt-4 border-t border-border">
                <Button variant="ghost" size="sm" asChild className="flex-1">
                  <Link to="/login">Log in</Link>
                </Button>
                <Button variant="hero" size="sm" asChild className="flex-1">
                  <Link to="/signup">Get Started</Link>
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
