import { 
  LogOut,
  User,
  TrendingUp,
  Trophy,
  BookOpen,
  LogIn,
  MessageSquare,
  FlaskConical
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
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const guestItems = [
  { title: "Try AI Course", url: "/courses", icon: BookOpen },
];

const authedMainItems = [
  { title: "Courses", url: "/courses", icon: BookOpen },
  { title: "Labs", url: "/labs", icon: FlaskConical },
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
  const { user, signOut } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const mainItems = user ? authedMainItems : guestItems;

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent className="pt-4">
        <SidebarGroup>
          <SidebarGroupLabel className={cn(collapsed && "sr-only")}>
            {user ? "Main" : "Explore"}
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
                        "flex items-center gap-3",
                        isActive(item.url) && "text-primary"
                      )}
                    >
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {user && (
          <SidebarGroup>
            <SidebarGroupLabel className={cn(collapsed && "sr-only")}>
              Learning
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
                          "flex items-center gap-3",
                          isActive(item.url) && "text-primary"
                        )}
                      >
                        <item.icon className="w-4 h-4 flex-shrink-0" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            {user ? (
              <SidebarMenuButton
                tooltip="Sign Out"
                onClick={handleSignOut}
                className="flex items-center gap-3 text-muted-foreground hover:text-destructive cursor-pointer"
              >
                <LogOut className="w-4 h-4 flex-shrink-0" />
                <span>Sign Out</span>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                asChild
                tooltip="Sign In"
                className="flex items-center gap-3 text-muted-foreground hover:text-primary cursor-pointer"
              >
                <NavLink to="/login">
                  <LogIn className="w-4 h-4 flex-shrink-0" />
                  <span>Sign In</span>
                </NavLink>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
