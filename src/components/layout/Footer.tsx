import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-secondary/30 border-t border-border py-12">
      <div className="container px-4 sm:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-xl text-foreground">
              MentorAI
            </span>
          </Link>

          {/* Links */}
          <nav className="flex items-center gap-8">
            <Link 
              to="/mentors" 
              className="text-muted-foreground hover:text-foreground transition-colors text-sm"
            >
              Find Mentors
            </Link>
            <Link 
              to="/ai-tutor" 
              className="text-muted-foreground hover:text-foreground transition-colors text-sm"
            >
              AI Tutor
            </Link>
            <Link 
              to="/waitlist" 
              className="text-muted-foreground hover:text-foreground transition-colors text-sm"
            >
              Waitlist
            </Link>
          </nav>

          {/* Copyright */}
          <p className="text-sm text-muted-foreground">
            © 2026 MentorAI. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
