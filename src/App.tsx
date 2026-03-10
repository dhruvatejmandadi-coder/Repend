import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Index from "./pages/Index";
import Courses from "./pages/Courses";
import CourseView from "./pages/CourseView";
import Community from "./pages/Community";
import Challenges from "./pages/Challenges";
import ChallengeView from "./pages/ChallengeView";
import CreateChallenge from "./pages/CreateChallenge";
import ProgressPage from "./pages/ProgressPage";

import Profile from "./pages/Profile";
import Pricing from "./pages/Pricing";
import Waitlist from "./pages/Waitlist";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/AdminDashboard";
import CourseCreator from "./pages/CourseCreator";
import PublicCourses from "./pages/PublicCourses";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <OnboardingFlow />
        <BrowserRouter>
          <Routes>
            {/* Pages without sidebar */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/waitlist" element={<Waitlist />} />

            {/* Dashboard pages — persistent sidebar */}
            <Route element={<DashboardLayout />}>
              <Route path="/courses" element={<Courses />} />
              <Route path="/courses/create" element={<CourseCreator />} />
              <Route path="/courses/explore" element={<PublicCourses />} />
              <Route path="/courses/:id" element={<CourseView />} />
              <Route path="/community" element={<Community />} />
              <Route path="/challenges" element={<Challenges />} />
              <Route path="/challenges/create" element={<CreateChallenge />} />
              <Route path="/challenges/:id" element={<ChallengeView />} />
              <Route path="/progress" element={<ProgressPage />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/admin" element={<AdminDashboard />} />
            </Route>

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
