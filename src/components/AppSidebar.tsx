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
    <Sidebar className={`${open ? "w-60" : "w-14"} border-r bg-white`}>
      <SidebarContent>
        <div className="p-4 border-b">
          <h2 className={`font-bold text-lg text-primary transition-opacity ${!open && "opacity-0"}`}>
            Capyera
          </h2>
        </div>
        
        <SidebarGroup>
          <SidebarGroupLabel className={!open ? "sr-only" : ""}>
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        `flex items-center gap-3 ${
                          isActive
                            ? "bg-primary text-primary-foreground font-medium"
                            : "hover:bg-accent"
                        }`
                      }
                    >
                      <item.icon className="h-5 w-5" />
                      {open && <span>{item.title}</span>}
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
