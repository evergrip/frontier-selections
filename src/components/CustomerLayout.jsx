import React, { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Home, FolderKanban, Image, Bell, LogOut, Menu, X } from "lucide-react";
import CustomerPortalBanner from "@/components/CustomerPortalBanner";
import ProjectSwitcher from "@/components/portal/ProjectSwitcher";
import { useCustomerPortal } from "@/components/CustomerPortalContext";

const NAV_ITEMS = [
  { label: "My Projects", path: "/portal", icon: Home },
  { label: "Mood Board", path: "/portal/mood-board", icon: Image },
  { label: "Notifications", path: "/portal/notifications", icon: Bell },
];

export default function CustomerLayout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isPreviewMode, isActMode } = useCustomerPortal();

  // In preview mode, block interactions
  const isReadOnly = isPreviewMode;

  return (
    <div className="min-h-screen bg-gray-50">
      <CustomerPortalBanner />
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100">
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">F</span>
              </div>
              <span className="font-semibold text-gray-900">Frontier Selections</span>
            </div>
            <ProjectSwitcher />
          </div>
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const isActive = item.path === "/portal" 
                ? location.pathname === "/portal" 
                : location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                    ${isActive ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:text-gray-900"}`}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <button onClick={() => base44.auth.logout("/login")} className="text-gray-400 hover:text-gray-600 p-2">
            <LogOut size={18} />
          </button>
        </div>
        {mobileOpen && (
          <div className="lg:hidden border-t border-gray-100 bg-white px-4 py-2 space-y-1">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}