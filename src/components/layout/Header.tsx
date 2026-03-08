import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import rependLogo from "@/assets/repend-logo.png";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isLanding = location.pathname === "/";

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
    scrolled ?
    'bg-background/90 backdrop-blur-xl border-b border-border/50' :
    'bg-transparent'}`
    }>
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              if (isLanding) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              } else {
                navigate("/");
              }
            }}
            className="flex items-center"
          >
            <img
              src={rependLogo}
              alt="Repend"
              className="h-7 sm:h-8 w-auto object-contain" />
          </a>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            <Link
              to="/courses"
              className="text-muted-foreground hover:text-foreground transition-colors text-[13px] font-medium"
            >
              Try AI Course
            </Link>
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="text-[13px]">
              <Link to="/login">Log in</Link>
            </Button>
            <Button variant="hero" size="sm" asChild className="text-[13px]">
              <Link to="/signup">Get Started</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-foreground hover:bg-secondary/50 rounded-lg transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen &&
        <div className="md:hidden py-4 border-t border-border/50 animate-fade-in bg-background/95 backdrop-blur-xl">
            <nav className="flex flex-col gap-4">
              <Link
                to="/courses"
                className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Try AI Course
              </Link>
              <div className="flex gap-3 pt-4 border-t border-border/50">
                <Button variant="ghost" size="sm" asChild className="flex-1">
                  <Link to="/login">Log in</Link>
                </Button>
                <Button variant="hero" size="sm" asChild className="flex-1">
                  <Link to="/signup">Get Started</Link>
                </Button>
              </div>
            </nav>
          </div>
        }
      </div>
    </header>
  );
}
