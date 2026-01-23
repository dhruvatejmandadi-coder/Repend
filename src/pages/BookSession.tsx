import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Clock, Star, CreditCard } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const mentorData: Record<string, {
  name: string;
  avatar: string;
  specialty: string;
  rating: number;
  price30: number;
  price60: number;
}> = {
  "1": {
    name: "Alex Rivera",
    avatar: "AR",
    specialty: "YouTube & Short Form",
    rating: 4.9,
    price30: 45,
    price60: 75,
  },
  "2": {
    name: "Sarah Chen",
    avatar: "SC",
    specialty: "Documentary & Narrative",
    rating: 5.0,
    price30: 60,
    price60: 100,
  },
  "3": {
    name: "Marcus Johnson",
    avatar: "MJ",
    specialty: "Motion Graphics",
    rating: 4.8,
    price30: 50,
    price60: 85,
  },
  "4": {
    name: "Emma Williams",
    avatar: "EW",
    specialty: "Color Grading",
    rating: 4.9,
    price30: 55,
    price60: 90,
  },
};

const timeSlots = [
  "9:00 AM", "10:00 AM", "11:00 AM", 
  "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM"
];

export default function BookSession() {
  const { mentorId } = useParams();
  const { toast } = useToast();
  const mentor = mentorData[mentorId || "1"];
  
  const [duration, setDuration] = useState<30 | 60>(30);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const price = duration === 30 ? mentor.price30 : mentor.price60;

  const handleBooking = () => {
    if (!selectedSlot) {
      toast({
        title: "Select a time slot",
        description: "Please choose an available time for your session.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Booking Confirmed! 🎉",
      description: `Your ${duration}-minute session with ${mentor.name} is booked for ${selectedSlot}.`,
    });
  };

  if (!mentor) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Mentor not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container px-4 sm:px-6 max-w-4xl">
          {/* Back Button */}
          <Link 
            to="/mentors" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Mentors
          </Link>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Booking Form */}
            <div className="lg:col-span-2 space-y-8">
              <div>
                <h1 className="font-display text-3xl font-bold mb-2">
                  Book a Session
                </h1>
                <p className="text-muted-foreground">
                  Schedule your 1-on-1 session with {mentor.name}
                </p>
              </div>

              {/* Session Duration */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Session Duration
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setDuration(30)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      duration === 30 
                        ? "border-primary bg-primary/10" 
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <p className="font-semibold">30 minutes</p>
                    <p className="text-2xl font-bold text-primary">${mentor.price30}</p>
                  </button>
                  <button
                    onClick={() => setDuration(60)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      duration === 60 
                        ? "border-primary bg-primary/10" 
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <p className="font-semibold">60 minutes</p>
                    <p className="text-2xl font-bold text-primary">${mentor.price60}</p>
                  </button>
                </div>
              </div>

              {/* Time Slots */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  Available Times (This Week)
                </h2>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => setSelectedSlot(slot)}
                      className={`p-3 rounded-lg text-sm font-medium transition-all ${
                        selectedSlot === slot
                          ? "gradient-primary text-primary-foreground"
                          : "bg-secondary hover:bg-secondary/80"
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-card border border-border rounded-2xl p-6 sticky top-24">
                <h2 className="font-display text-lg font-semibold mb-6">
                  Order Summary
                </h2>

                {/* Mentor Info */}
                <div className="flex items-center gap-3 pb-6 border-b border-border">
                  <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                    <span className="font-display font-bold text-primary-foreground">
                      {mentor.avatar}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold">{mentor.name}</p>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Star className="w-3 h-3 text-primary fill-primary" />
                      {mentor.rating}
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="py-6 border-b border-border space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Duration</span>
                    <span>{duration} minutes</span>
                  </div>
                  {selectedSlot && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Time</span>
                      <span>{selectedSlot}</span>
                    </div>
                  )}
                </div>

                {/* Total */}
                <div className="py-6 border-b border-border">
                  <div className="flex justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold text-xl">${price}</span>
                  </div>
                </div>

                {/* Book Button */}
                <Button 
                  variant="hero" 
                  size="lg" 
                  className="w-full mt-6"
                  onClick={handleBooking}
                >
                  <CreditCard className="w-4 h-4" />
                  Confirm Booking
                </Button>

                <p className="text-xs text-muted-foreground text-center mt-4">
                  You won't be charged until the session is confirmed
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
