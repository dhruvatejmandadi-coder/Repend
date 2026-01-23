import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Clock, Video } from "lucide-react";
import { Link } from "react-router-dom";

const mentors = [
  {
    id: "1",
    name: "Alex Rivera",
    avatar: "AR",
    skill: "Video Editing",
    specialty: "YouTube & Short Form",
    bio: "8 years of experience editing for top YouTubers. Specialized in fast-paced, engaging content that keeps viewers hooked.",
    price30: 45,
    price60: 75,
    rating: 4.9,
    sessions: 124,
  },
  {
    id: "2",
    name: "Sarah Chen",
    avatar: "SC",
    skill: "Video Editing",
    specialty: "Documentary & Narrative",
    bio: "Award-winning documentary editor. I help creators tell compelling stories through thoughtful pacing and emotional beats.",
    price30: 60,
    price60: 100,
    rating: 5.0,
    sessions: 89,
  },
  {
    id: "3",
    name: "Marcus Johnson",
    avatar: "MJ",
    skill: "Video Editing",
    specialty: "Motion Graphics",
    bio: "Motion designer turned editor. I teach the intersection of animation and editing to create dynamic, professional content.",
    price30: 50,
    price60: 85,
    rating: 4.8,
    sessions: 156,
  },
  {
    id: "4",
    name: "Emma Williams",
    avatar: "EW",
    skill: "Video Editing",
    specialty: "Color Grading",
    bio: "Colorist with experience on Netflix productions. I'll teach you how to give your videos that cinematic look.",
    price30: 55,
    price60: 90,
    rating: 4.9,
    sessions: 72,
  },
];

export default function Mentors() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container px-4 sm:px-6">
          {/* Header */}
          <div className="max-w-2xl mb-12">
            <h1 className="font-display text-4xl sm:text-5xl font-bold mb-4">
              Find Your <span className="gradient-text">Mentor</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Connect with expert video editors who'll give you personalized feedback 
              and help you level up your skills.
            </p>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-3 mb-8">
            <span className="text-sm text-muted-foreground">Skill:</span>
            <Badge variant="default" className="gradient-primary text-primary-foreground">
              <Video className="w-3 h-3 mr-1" />
              Video Editing
            </Badge>
          </div>

          {/* Mentor Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {mentors.map((mentor) => (
              <div
                key={mentor.id}
                className="bg-card border border-border rounded-2xl p-6 transition-all duration-300 hover:border-primary/50 hover:shadow-lg group"
              >
                <div className="flex gap-4">
                  {/* Avatar */}
                  <div className="w-16 h-16 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
                    <span className="font-display font-bold text-lg text-primary-foreground">
                      {mentor.avatar}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-display text-lg font-semibold truncate">
                        {mentor.name}
                      </h3>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Star className="w-4 h-4 text-primary fill-primary" />
                        <span className="text-sm font-medium">{mentor.rating}</span>
                      </div>
                    </div>
                    
                    <p className="text-sm text-primary mb-2">{mentor.specialty}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                      {mentor.bio}
                    </p>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {mentor.sessions} sessions
                      </span>
                    </div>

                    {/* Pricing & CTA */}
                    <div className="flex items-center justify-between">
                      <div className="text-sm">
                        <span className="text-muted-foreground">From </span>
                        <span className="font-semibold text-foreground">${mentor.price30}</span>
                        <span className="text-muted-foreground"> / 30 min</span>
                      </div>
                      <Button variant="hero" size="sm" asChild>
                        <Link to={`/book/${mentor.id}`}>Book Session</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
