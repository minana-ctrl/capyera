import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Button } from "./ui/button";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-background via-background to-background/95">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          <header className="h-16 border-b border-border/50 flex items-center justify-between px-6 glass-strong backdrop-blur-xl sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-accent/50" />
              <h1 className="text-xl font-bold gradient-text">Capyera Inventory</h1>
            </div>
            <Button variant="glass" size="sm" onClick={handleSignOut} className="group">
              <LogOut className="h-4 w-4 mr-2 group-hover:rotate-12 transition-transform" />
              Sign Out
            </Button>
          </header>
          <div className="flex-1 p-6 overflow-auto">
            <div className="max-w-[1600px] mx-auto">
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
