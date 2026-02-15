import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import rependLogo from "@/assets/repend-logo.png";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
    scrolled ?
    'bg-background/95 backdrop-blur-md border-b border-border shadow-sm' :
    'bg-transparent'}`
    }>
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center pl-2 sm:pl-4">
            <img
              src={rependLogo}
              alt="Repend"
              className="h-8 sm:h-9 w-auto object-contain" />

          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            





            <button
              onClick={scrollToTop}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">

              AI Tutor
            </button>
            <button
              onClick={scrollToTop}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">

              Community
            </button>
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
            className="md:hidden p-2 text-foreground hover:bg-secondary rounded-lg transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>

            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen &&
        <div className="md:hidden py-4 border-t border-border animate-fade-in bg-background/95 backdrop-blur-md">
            <nav className="flex flex-col gap-4">
              <button
              onClick={scrollToTop}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium py-2 text-left">

                Challenges
              </button>
              <button
              onClick={scrollToTop}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium py-2 text-left">

                AI Tutor
              </button>
              <button
              onClick={scrollToTop}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium py-2 text-left">

                Community
              </button>
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
        }
      </div>
    </header>);

}