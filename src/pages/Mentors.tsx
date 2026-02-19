import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Users, 
  Bell, 
  ArrowRight, 
  Code, 
  GraduationCap, 
  Briefcase, 
  Palette, 
  Video, 
  PenTool,
  Search,
  SlidersHorizontal,
  Star,
  Clock,
  DollarSign
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const categories = [
  { icon: Code, name: "Coding", description: "Web dev, mobile apps, data science" },
  { icon: GraduationCap, name: "School", description: "Math, science, languages, test prep" },
  { icon: Briefcase, name: "Professional", description: "Career, leadership, interviews" },
  { icon: Palette, name: "Creative", description: "Design, art, music production" },
  { icon: Video, name: "Video", description: "Editing, filming, content creation" },
  { icon: PenTool, name: "Writing", description: "Copywriting, storytelling, blogging" },
];

export default function Mentors() {
  const [email, setEmail] = useState("");
  const [notified, setNotified] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("");
  const { toast } = useToast();

  const handleNotify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email to get notified.",
        variant: "destructive",
      });
      return;
    }
    setNotified(true);
    toast({
      title: "You're on the list! 🎉",
      description: "We'll notify you when mentors are available.",
    });
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 border border-border mb-6">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">Coming Soon</span>
          </div>
          
          <h1 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            Find Your <span className="gradient-text">Perfect Mentor</span>
          </h1>
          <p className="text-muted-foreground mb-6">
            We're building a marketplace of expert mentors across every skill imaginable. 
            Get notified when we launch.
          </p>

          {/* Notify Form */}
          {!notified ? (
            <form onSubmit={handleNotify} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
              />
              <Button variant="hero" type="submit">
                <Bell className="w-4 h-4" />
                Notify Me
              </Button>
            </form>
          ) : (
            <div className="flex items-center justify-center gap-2 text-primary">
              <Bell className="w-5 h-5" />
              <span className="font-medium">We'll email you when mentors are ready!</span>
            </div>
          )}
        </div>

        {/* Enhanced Search Section */}
        <Card className="max-w-4xl mx-auto mb-8 bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Search & Filter (Preview)</span>
            </div>
            
            <div className="grid sm:grid-cols-4 gap-3">
              {/* Search Input */}
              <div className="sm:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search mentors by name or skill..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Category Filter */}
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.name} value={cat.name.toLowerCase()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Sort By */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rating">
                    <div className="flex items-center gap-2">
                      <Star className="w-3 h-3" />
                      Top Rated
                    </div>
                  </SelectItem>
                  <SelectItem value="price-low">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-3 h-3" />
                      Price: Low to High
                    </div>
                  </SelectItem>
                  <SelectItem value="price-high">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-3 h-3" />
                      Price: High to Low
                    </div>
                  </SelectItem>
                  <SelectItem value="availability">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      Availability
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <p className="text-xs text-muted-foreground mt-3 text-center">
              Search functionality will be enabled when mentors are available
            </p>
          </CardContent>
        </Card>

        {/* Categories Preview */}
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-sm text-muted-foreground mb-6">
            Mentors coming for these categories:
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <div
                key={cat.name}
                className="bg-card border border-border rounded-xl p-6 transition-all duration-300 hover:border-primary/30"
              >
                <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-4">
                  <cat.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-display font-semibold mb-1">{cat.name}</h3>
                <p className="text-sm text-muted-foreground">{cat.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="max-w-2xl mx-auto text-center mt-12">
          <p className="text-muted-foreground mb-4">
            Want to start learning right now?
          </p>
          <Button variant="accent" size="lg" asChild>
            <Link to="/courses">
              Start Learning Free
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
