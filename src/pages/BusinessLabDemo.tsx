import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, TrendingUp, Users, DollarSign, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function BusinessLabDemo() {
  const navigate = useNavigate();
  const [budget, setBudget] = useState(50);
  const [price, setPrice] = useState(10);

  const customers = budget * 2;
  const revenue = customers * price;
  const profit = revenue - budget;

  return (
    <div className="min-h-screen bg-background p-6 md:p-10 max-w-3xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2 text-muted-foreground">
        <ArrowLeft className="w-4 h-4" /> Back
      </Button>

      <div>
        <h1 className="text-2xl font-bold text-foreground">🏪 Run a Business</h1>
        <p className="text-muted-foreground mt-1 flex items-center gap-2">
          <Target className="w-4 h-4" /> <span className="font-medium">Goal:</span> Maximize profit by balancing ad spend and pricing.
        </p>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Ad Budget</span>
              <span className="font-mono font-semibold text-foreground">${budget}</span>
            </div>
            <Slider min={0} max={100} step={1} value={[budget]} onValueChange={([v]) => setBudget(v)} />
            <p className="text-xs text-muted-foreground">How much you spend on advertising to attract customers.</p>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Product Price</span>
              <span className="font-mono font-semibold text-foreground">${price}</span>
            </div>
            <Slider min={1} max={50} step={1} value={[price]} onValueChange={([v]) => setPrice(v)} />
            <p className="text-xs text-muted-foreground">The price each customer pays for your product.</p>
          </div>
        </CardContent>
      </Card>

      {/* Outputs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center space-y-1">
            <Users className="w-5 h-5 mx-auto text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Customers</p>
            <p className="text-2xl font-bold font-mono text-foreground">{customers}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 text-center space-y-1">
            <DollarSign className="w-5 h-5 mx-auto text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Revenue</p>
            <p className="text-2xl font-bold font-mono text-foreground">${revenue}</p>
          </CardContent>
        </Card>

        <Card className={profit >= 0 ? "border-green-500/50 bg-green-500/5" : "border-destructive/50 bg-destructive/5"}>
          <CardContent className="pt-6 text-center space-y-1">
            <TrendingUp className="w-5 h-5 mx-auto" style={{ color: profit >= 0 ? "hsl(142, 71%, 45%)" : undefined }} />
            <p className="text-xs text-muted-foreground">Profit</p>
            <p className={`text-2xl font-bold font-mono ${profit >= 0 ? "text-green-500" : "text-destructive"}`}>
              ${profit}
            </p>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        💡 Tip: Higher budget attracts more customers, but cuts into profit. Find the sweet spot!
      </p>
    </div>
  );
}
