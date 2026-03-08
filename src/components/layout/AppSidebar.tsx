import { 
  LogOut,
  User,
  TrendingUp,
  Trophy,
  BookOpen,
  LogIn,
  MessageSquare,
  Sparkles,
  Shield,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import rependLogo from "@/assets/repend-logo.png";

const guestItems = [
  { title: "Try AI Course", url: "/courses", icon: BookOpen },
];

const authedMainItems = [
  { title: "Courses", url: "/courses", icon: BookOpen },
  { title: "Challenges", url: "/challenges", icon: Trophy },
  { title: "Community", url: "/community", icon: MessageSquare },
];

const authedLearnItems = [
  { title: "Progress", url: "/progress", icon: TrendingUp },
  { title: "Profile", url: "/profile", icon: User },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();

  // Use cached/previous state while loading to prevent flicker
  const effectiveUser = authLoading ? null : user;
  // During auth loading, assume user is logged in if we're on a dashboard route
  // to prevent sidebar flash
  const isDashboardRoute = ["/courses", "/challenges", "/community", "/progress", "/profile", "/admin", "/pricing"].some(
    (p) => location.pathname.startsWith(p)
  );
  const showAuthedUI = user || (authLoading && isDashboardRoute);

  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const mainItems = user ? authedMainItems : guestItems;

  return (
    <Sidebar collapsible="icon" className="border-r border-border/60">
      {/* Logo in sidebar header */}
      <SidebarHeader className="px-4 py-5 border-b border-border/40">
        <NavLink to={user ? "/courses" : "/"} className="flex items-center gap-2">
          <img src={rependLogo} alt="Repend" className="h-7 w-auto object-contain" />
        </NavLink>
      </SidebarHeader>

      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupLabel className={cn("text-[11px] uppercase tracking-widest text-muted-foreground/60 font-medium", collapsed && "sr-only")}>
            {user ? "Navigation" : "Explore"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink
                      to={item.url}
                      className={cn(
                        "flex items-center gap-3 rounded-lg transition-all duration-150",
                        isActive(item.url) 
                          ? "text-primary font-medium" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                      <span className="text-[13px]">{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {user && isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className={cn("text-[11px] uppercase tracking-widest text-muted-foreground/60 font-medium", collapsed && "sr-only")}>
              Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive("/admin")}
                    tooltip="Admin"
                  >
                    <NavLink
                      to="/admin"
                      className={cn(
                        "flex items-center gap-3 rounded-lg transition-all duration-150",
                        isActive("/admin") 
                          ? "text-primary font-medium" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Shield className="w-[18px] h-[18px] flex-shrink-0" />
                      <span className="text-[13px]">Admin</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {user && (
          <SidebarGroup>
            <SidebarGroupLabel className={cn("text-[11px] uppercase tracking-widest text-muted-foreground/60 font-medium", collapsed && "sr-only")}>
              Personal
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {authedLearnItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                    >
                      <NavLink
                        to={item.url}
                        className={cn(
                          "flex items-center gap-3 rounded-lg transition-all duration-150",
                          isActive(item.url) 
                            ? "text-primary font-medium" 
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                        <span className="text-[13px]">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-border/40">
        <SidebarMenu>
          {user && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip="Upgrade"
                className="flex items-center gap-3 text-primary hover:text-primary/80 cursor-pointer font-medium"
              >
                <NavLink to="/pricing">
                  <Sparkles className="w-[18px] h-[18px] flex-shrink-0" />
                  <span className="text-[13px]">Upgrade</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            {user ? (
              <SidebarMenuButton
                tooltip="Sign Out"
                onClick={handleSignOut}
                className="flex items-center gap-3 text-muted-foreground hover:text-destructive cursor-pointer"
              >
                <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
                <span className="text-[13px]">Sign Out</span>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                asChild
                tooltip="Sign In"
                className="flex items-center gap-3 text-muted-foreground hover:text-primary cursor-pointer"
              >
                <NavLink to="/login">
                  <LogIn className="w-[18px] h-[18px] flex-shrink-0" />
                  <span className="text-[13px]">Sign In</span>
                </NavLink>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
