import { LayoutDashboard, Package, Package2, ShoppingCart, Warehouse, Users, Settings, HelpCircle, FileText } from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Inventory", url: "/inventory", icon: Package },
  { title: "Products", url: "/products", icon: Package },
  { title: "Orders", url: "/orders", icon: ShoppingCart },
  { title: "Timeline", url: "/timeline", icon: LayoutDashboard },
  { title: "Warehouses", url: "/warehouses", icon: Warehouse },
  { title: "Suppliers", url: "/suppliers", icon: Users },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "How It Works", url: "/how-it-works", icon: HelpCircle },
];

export function AppSidebar() {
  const { open } = useSidebar();

  return (
    <Sidebar className={`${open ? "w-60" : "w-14"} border-r border-border/50 glass backdrop-blur-xl`}>
      <SidebarContent className="relative">
        <div className="p-4 border-b border-border/50">
          <h2 className={`font-bold text-xl gradient-text transition-opacity ${!open && "opacity-0"}`}>
            Capyera
          </h2>
        </div>
        
        <SidebarGroup className="pt-4">
          <SidebarGroupLabel className={`${!open ? "sr-only" : ""} text-muted-foreground text-xs uppercase tracking-wider px-4 mb-2`}>
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1 px-2">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                          isActive
                            ? "bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/20"
                            : "hover:bg-accent/50 hover:translate-x-1"
                        }`
                      }
                    >
                      <item.icon className={`h-5 w-5 transition-transform group-hover:scale-110 ${!open && 'mx-auto'}`} />
                      {open && <span className="font-medium">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
