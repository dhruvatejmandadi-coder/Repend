import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Link } from "react-router-dom";
import rependLogo from "@/assets/repend-logo.png";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          {/* Top header */}
          <header className="h-14 border-b border-border flex items-center px-4 gap-4 bg-card/95 backdrop-blur-md">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <Link to="/" className="flex items-center pl-1">
              <img 
                src={rependLogo} 
                alt="Repend" 
                className="h-7 w-auto object-contain"
              />
            </Link>
          </header>
          
          {/* Main content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
