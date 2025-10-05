import { LayoutDashboard, Package, Package2, ShoppingCart, Warehouse, Users, Settings, HelpCircle, FileText } from "lucide-react";
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
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar className={`${open ? "w-60" : "w-14"} border-r bg-white shadow-sm`}>
      <SidebarContent>
        <div className="p-4 border-b bg-white">
          <h2 className={`font-bold text-lg text-primary transition-opacity ${!open && "opacity-0"}`}>
            Capyera
          </h2>
        </div>
        
        <SidebarGroup>
          <SidebarGroupLabel className={`${!open ? "sr-only" : ""} text-muted-foreground text-xs font-medium px-4 py-2`}>
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="px-2 space-y-1">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    isActive={isActive(item.url)}
                    onClick={() => navigate(item.url)}
                    className="flex items-center gap-3 px-3 py-2.5"
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {open && <span className="text-sm">{item.title}</span>}
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
