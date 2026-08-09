import { NavLink, Outlet, useNavigate } from "react-router-dom";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, Users2, ScanLine, ClipboardList, CheckSquare,
  MapPin, QrCode, UserCog, ScrollText, Settings as SettingsIcon, LogOut, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const MENU = [
  { to: "/", label: "Dasbor", icon: LayoutDashboard, roles: ["admin", "supervisor", "read_only"] },
  { to: "/ai", label: "Asisten AI", icon: Sparkles, roles: ["admin", "supervisor"] },
  { to: "/scan", label: "Pemindaian", icon: ScanLine, roles: ["admin", "supervisor", "operator"] },
  { to: "/activities", label: "Aktivitas", icon: ClipboardList, roles: ["admin", "supervisor", "operator", "read_only"] },
  { to: "/approvals", label: "Persetujuan", icon: CheckSquare, roles: ["admin", "supervisor"] },
  { to: "/inmates", label: "Warga Binaan", icon: Users2, roles: ["admin", "supervisor", "read_only"] },
  { to: "/locations", label: "Lokasi", icon: MapPin, roles: ["admin", "supervisor", "read_only"] },
  { to: "/barcodes", label: "Unduh Barcode", icon: QrCode, roles: ["admin", "supervisor"] },
  { to: "/users", label: "Pengguna", icon: UserCog, roles: ["admin"] },
  { to: "/audit", label: "Log Audit", icon: ScrollText, roles: ["admin"] },
  { to: "/settings", label: "Pengaturan", icon: SettingsIcon, roles: ["admin"] },
];

const ROLE_LABEL = { admin: "Admin", supervisor: "Supervisor", operator: "Operator", read_only: "Lihat Saja" };

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data: settings } = useSWR("/settings", fetcher);

  const items = MENU.filter((m) => m.roles.includes(user.role));

  return (
    <div className="min-h-screen flex bg-background" data-testid="app-layout">
      <aside className="w-60 shrink-0 border-r border-border bg-card flex flex-col fixed inset-y-0 z-30 hidden md:flex">
        <div className="p-5 border-b border-border">
          <div className="font-heading font-black text-xl tracking-tight" data-testid="app-title">
            {settings?.app_title || "KAWAN PAS"}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mt-1">
            {settings?.institution_name || "Lembaga Pemasyarakatan"}
          </div>
        </div>
        <nav className="flex-1 py-3 overflow-y-auto" data-testid="sidebar-nav">
          {items.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              end={m.to === "/"}
              data-testid={`nav-${m.to === "/" ? "dashboard" : m.to.slice(1)}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 text-sm font-medium border-l-[3px] transition-colors duration-150 ${
                  isActive
                    ? "border-primary bg-accent text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                }`
              }
            >
              <m.icon className="h-4 w-4" strokeWidth={2} />
              {m.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-border">
          <div className="text-sm font-semibold truncate" data-testid="sidebar-user-name">{user.full_name}</div>
          <div className="text-xs text-muted-foreground">{ROLE_LABEL[user.role]}</div>
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3 rounded-none"
            onClick={logout}
            data-testid="logout-btn"
          >
            <LogOut className="h-3.5 w-3.5 mr-2" /> Keluar
          </Button>
        </div>
      </aside>

      <div className="flex-1 md:ml-60 flex flex-col min-h-screen">
        <header className="md:hidden sticky top-0 z-20 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="font-heading font-black text-lg">{settings?.app_title || "KAWAN PAS"}</div>
          <div className="flex gap-1 overflow-x-auto">
            {items.slice(0, 5).map((m) => (
              <Button key={m.to} variant="ghost" size="sm" className="rounded-none" onClick={() => navigate(m.to)} data-testid={`nav-mobile-${m.to.slice(1) || "dashboard"}`}>
                <m.icon className="h-4 w-4" />
              </Button>
            ))}
            <Button variant="ghost" size="sm" className="rounded-none" onClick={logout} data-testid="logout-mobile-btn">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
