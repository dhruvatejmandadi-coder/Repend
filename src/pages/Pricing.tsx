import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Sparkles, Loader2, Crown, Zap } from "lucide-react";
import { useSubscription, PLAN_CONFIG, type Plan } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

const features = [
  { name: "AI Course Generation", starter: "2/month", pro: "10/month", elite: "15/month" },
  { name: "Modules per Course", starter: "Up to 5", pro: "Up to 10", elite: "Unlimited" },
  { name: "File Upload Courses", starter: false, pro: "3/month", elite: "Unlimited" },
  { name: "Interactive Labs", starter: "Basic only", pro: "All types", elite: "All + priority" },
  { name: "Community Access", starter: true, pro: true, elite: "Enhanced" },
  { name: "Daily Challenges", starter: "View only", pro: "Full access", elite: "Full + exclusive" },
  { name: "Quizzes", starter: "Limited retries", pro: "Unlimited", elite: "Unlimited + analytics" },
  { name: "Certificates", starter: false, pro: true, elite: true },
  { name: "Progress Analytics", starter: "Basic", pro: "Detailed", elite: "Advanced behavioral" },
];

const tiers: {
  plan: Plan;
  name: string;
  price: string;
  description: string;
  icon: typeof Zap;
  highlight?: boolean;
  cta: string;
}[] = [
  {
    plan: "starter",
    name: "Starter",
    price: "Free",
    description: "Get started with AI-powered learning",
    icon: Zap,
    cta: "Current Plan",
  },
  {
    plan: "pro",
    name: "Pro",
    price: "$7.99",
    description: "Unlock the full learning experience",
    icon: Sparkles,
    highlight: true,
    cta: "Upgrade to Pro",
  },
  {
    plan: "elite",
    name: "Elite",
    price: "$11.99",
    description: "Maximum power for serious learners",
    icon: Crown,
    cta: "Go Elite",
  },
];

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="w-4 h-4 text-green-400" />;
  if (value === false) return <X className="w-4 h-4 text-muted-foreground/40" />;
  return <span className="text-sm">{value}</span>;
}

export default function Pricing() {
  const { plan: currentPlan, loading, startCheckout, openPortal, subscribed, refresh } = useSubscription();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast({ title: "Subscription activated!", description: "Welcome to your new plan. Refreshing..." });
      refresh();
    } else if (searchParams.get("canceled") === "true") {
      toast({ title: "Checkout canceled", description: "No changes were made." });
    }
  }, [searchParams]);

  const handleAction = async (tierPlan: Plan) => {
    if (!user) {
      navigate("/signup");
      return;
    }

    if (tierPlan === "starter") return;

    if (currentPlan === tierPlan && subscribed) {
      await openPortal();
      return;
    }

    const config = PLAN_CONFIG[tierPlan as "pro" | "elite"];
    await startCheckout(config.price_id);
  };

  const getButtonLabel = (tierPlan: Plan) => {
    if (!user) return "Sign Up Free";
    if (tierPlan === "starter" && currentPlan === "starter") return "Current Plan";
    if (tierPlan === currentPlan && subscribed) return "Manage Plan";
    if (tierPlan === "starter") return "Current Plan";
    const tierRank = { starter: 0, pro: 1, elite: 2 };
    if (tierRank[tierPlan] <= tierRank[currentPlan]) return "Current Plan";
    return tiers.find((t) => t.plan === tierPlan)?.cta ?? "Upgrade";
  };

  const isDisabled = (tierPlan: Plan) => {
    if (!user) return false;
    if (tierPlan === "starter") return true;
    const tierRank = { starter: 0, pro: 1, elite: 2 };
    return tierRank[tierPlan] < tierRank[currentPlan];
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl font-bold mb-2">Choose Your Plan</h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Start free, upgrade when you're ready. All plans include community access.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Tier Cards */}
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              {tiers.map((tier) => {
                const isCurrent = tier.plan === currentPlan;
                return (
                  <Card
                    key={tier.plan}
                    className={`relative transition-all ${
                      tier.highlight
                        ? "border-primary shadow-[0_0_30px_hsl(214_80%_56%/0.15)] scale-[1.02]"
                        : "border-border"
                    } ${isCurrent ? "ring-2 ring-primary/50" : ""}`}
                  >
                    {tier.highlight && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-primary text-primary-foreground px-3 py-1 text-xs">
                          Most Popular
                        </Badge>
                      </div>
                    )}
                    {isCurrent && (
                      <div className="absolute -top-3 right-4">
                        <Badge variant="outline" className="border-primary text-primary px-2 py-0.5 text-xs">
                          Your Plan
                        </Badge>
                      </div>
                    )}

                    <CardHeader className="text-center pb-2 pt-6">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                        <tier.icon className="w-6 h-6 text-primary" />
                      </div>
                      <CardTitle className="text-xl">{tier.name}</CardTitle>
                      <div className="mt-2">
                        <span className="text-3xl font-bold">{tier.price}</span>
                        {tier.price !== "Free" && (
                          <span className="text-muted-foreground text-sm">/mo</span>
                        )}
                      </div>
                      <p className="text-muted-foreground text-sm mt-1">{tier.description}</p>
                    </CardHeader>

                    <CardContent className="pt-4">
                      <ul className="space-y-3 mb-6">
                        {features.map((f) => {
                          const val = f[tier.plan as keyof typeof f];
                          return (
                            <li key={f.name} className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{f.name}</span>
                              <FeatureValue value={val as boolean | string} />
                            </li>
                          );
                        })}
                      </ul>

                      <Button
                        variant={tier.highlight ? "hero" : "outline"}
                        className="w-full"
                        disabled={isDisabled(tier.plan)}
                        onClick={() => handleAction(tier.plan)}
                      >
                        {getButtonLabel(tier.plan)}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* FAQ */}
            <div className="max-w-2xl mx-auto">
              <h2 className="font-display text-xl font-semibold text-center mb-6">
                Frequently Asked Questions
              </h2>
              <div className="space-y-4">
                {[
                  {
                    q: "Can I switch plans anytime?",
                    a: "Yes! Upgrade or downgrade at any time. Changes take effect immediately.",
                  },
                  {
                    q: "What happens when I reach my course limit?",
                    a: "You'll see a prompt to upgrade. Your existing courses remain accessible.",
                  },
                  {
                    q: "Is community access really free?",
                    a: "Yes — all users can read and post in the community. Pro and Elite get additional perks.",
                  },
                  {
                    q: "How do I cancel?",
                    a: "Click 'Manage Plan' to access the customer portal where you can cancel anytime.",
                  },
                ].map(({ q, a }) => (
                  <div key={q} className="bg-card rounded-lg p-4 border border-border">
                    <h3 className="font-medium text-sm mb-1">{q}</h3>
                    <p className="text-muted-foreground text-sm">{a}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
