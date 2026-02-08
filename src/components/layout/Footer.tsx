import { Link } from "react-router-dom";
import { Sparkles, Twitter, Linkedin, Youtube, Instagram } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-foreground text-background py-16">
      <div className="container px-4 sm:px-6">
        <div className="grid md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="font-display font-bold text-xl text-white">
                MentorAI
              </span>
            </Link>
            <p className="text-white/60 text-sm leading-relaxed">
              Learn faster with AI. Improve faster with real mentors.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold text-white mb-4">Product</h4>
            <nav className="flex flex-col gap-3">
              <Link to="/mentors" className="text-white/60 hover:text-white transition-colors text-sm">
                Find Mentors
              </Link>
              <Link to="/ai-tutor" className="text-white/60 hover:text-white transition-colors text-sm">
                AI Tutor
              </Link>
              <Link to="/community" className="text-white/60 hover:text-white transition-colors text-sm">
                Community
              </Link>
            </nav>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-white mb-4">Company</h4>
            <nav className="flex flex-col gap-3">
              <Link to="/waitlist" className="text-white/60 hover:text-white transition-colors text-sm">
                Join Waitlist
              </Link>
              <Link to="/login" className="text-white/60 hover:text-white transition-colors text-sm">
                Sign In
              </Link>
            </nav>
          </div>

          {/* Social */}
          <div>
            <h4 className="font-semibold text-white mb-4">Connect</h4>
            <div className="flex items-center gap-3">
              <a href="#" className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                <Twitter className="w-5 h-5 text-white" />
              </a>
              <a href="#" className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                <Linkedin className="w-5 h-5 text-white" />
              </a>
              <a href="#" className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                <Youtube className="w-5 h-5 text-white" />
              </a>
              <a href="#" className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                <Instagram className="w-5 h-5 text-white" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-white/40">
            © 2026 MentorAI. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-white/40 hover:text-white/60 transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="text-sm text-white/40 hover:text-white/60 transition-colors">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
