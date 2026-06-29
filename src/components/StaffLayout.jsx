import React, { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard, FolderKanban, BookOpen, Package, Bell, RefreshCw, Truck, ClipboardList, Palette, FileText,
  ChevronLeft, ChevronRight, LogOut, Menu, X, Settings, FlaskConical, GraduationCap, Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import WalkthroughManager from "@/components/training/WalkthroughManager";

const NAV_ITEMS = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard, navId: "dashboard" },
  { label: "Projects", path: "/projects", icon: FolderKanban, navId: "projects" },
  { label: "Catalogue", path: "/catalogue", icon: Package, navId: "catalogue" },
  { label: "Templates", path: "/templates", icon: BookOpen, navId: "templates" },
  { label: "Notifications", path: "/notifications", icon: Bell, navId: "notifications" },
  { label: "Change Requests", path: "/change-requests", icon: RefreshCw, navId: "change-requests" },
  { label: "Procurement", path: "/procurement", icon: Truck, navId: "procurement" },
  { label: "Supplier Orders", path: "/supplier-orders", icon: ClipboardList, navId: "supplier-orders" },
  { label: "Mood Board", path: "/mood-board", icon: Palette, navId: "mood-board" },
  { label: "Reports", path: "/reports", icon: FileText, navId: "reports" },
  { label: "Final Package", path: "/final-package", icon: Package, navId: "final-package" },
  { label: "Test Scenarios", path: "/test-scenarios", icon: FlaskConical, navId: "test-scenarios" },
  { label: "Help & Training", path: "/training", icon: GraduationCap, navId: "training" },
  ];

export default function StaffLayout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => setUser(u)).catch(() => {});
  }, []);

  const handleLogout = () => {
    base44.auth.logout("/login");
  };

  const navItems = [...NAV_ITEMS];
  if (user?.role === 'admin') {
    navItems.push({ label: "Admin Panel", path: "/admin", icon: Shield, navId: "admin" });
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-gray-200
        transition-all duration-200
        ${collapsed ? "w-16" : "w-60"}
        ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        <div className={`flex items-center h-16 border-b border-gray-100 ${collapsed ? "justify-center px-2" : "px-5"}`}>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">F</span>
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-900 leading-tight">Frontier</p>
                <p className="text-[10px] text-gray-400 leading-tight">Selections</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">F</span>
            </div>
          )}
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                data-nav={item.navId}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${isActive ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"}
                  ${collapsed ? "justify-center" : ""}
                `}
              >
                <Icon size={18} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-100 p-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex w-full items-center justify-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-50"
          >
            {collapsed ? <ChevronRight size={14} /> : <><ChevronLeft size={14} /> <span>Collapse</span></>}
          </button>
          <button
            onClick={handleLogout}
            className={`flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors ${collapsed ? "justify-center" : ""}`}
          >
            <LogOut size={18} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center h-14 px-4 border-b border-gray-200 bg-white lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-lg hover:bg-gray-100">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2 ml-3">
            <div className="w-6 h-6 bg-gray-900 rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">F</span>
            </div>
            <span className="font-semibold text-sm">Frontier Selections</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <WalkthroughManager />
    </div>
  );
}