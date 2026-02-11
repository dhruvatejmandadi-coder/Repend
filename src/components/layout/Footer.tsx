import { Link } from "react-router-dom";
import { Youtube, Instagram } from "lucide-react";
import rependLogo from "@/assets/repend-logo.png";

export function Footer() {
  return (
    <footer className="bg-secondary py-16 border-t border-border">
      <div className="container px-4 sm:px-6">
        <div className="grid md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center mb-4">
              <img 
                src={rependLogo} 
                alt="Repend" 
                className="h-8 w-auto object-contain"
              />
            </Link>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Take on challenges. Grow with the community.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Product</h4>
            <nav className="flex flex-col gap-3">
              <Link to="/challenges" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                Challenges
              </Link>
              <Link to="/ai-tutor" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                AI Tutor
              </Link>
              <Link to="/community" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                Community
              </Link>
            </nav>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Company</h4>
            <nav className="flex flex-col gap-3">
              <Link to="/waitlist" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                Join Waitlist
              </Link>
              <Link to="/login" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                Sign In
              </Link>
            </nav>
          </div>

          {/* Social */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Connect</h4>
            <div className="flex items-center gap-3">
              <a href="#" className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center hover:bg-primary/20 transition-colors">
                <Youtube className="w-5 h-5 text-foreground" />
              </a>
              <a href="#" className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center hover:bg-primary/20 transition-colors">
                <Instagram className="w-5 h-5 text-foreground" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © 2026 Repend. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
