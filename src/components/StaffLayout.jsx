import React, { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard, FolderKanban, ClipboardCheck, Package, Bell, RefreshCw, Truck, 
  FileText, GraduationCap, Shield, LogOut, Menu, X, ChevronDown, UserCircle,
  MoreHorizontal, PackageCheck, Palette, FileBox, LayoutTemplate, FlaskConical
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import ProjectSidebar from "@/components/ProjectSidebar";
import WalkthroughManager from "@/components/training/WalkthroughManager";
import ImpersonationBanner from "@/components/ImpersonationBanner";

const TOP_NAV_ITEMS = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard, navId: "dashboard" },
  { label: "Projects", path: "/projects", icon: FolderKanban, navId: "projects" },
  { label: "Selections", path: "/selections-tracker", icon: ClipboardCheck, navId: "selections-tracker" },
  { label: "Catalogue", path: "/catalogue", icon: Package, navId: "catalogue" },
  { label: "Approvals", path: "/change-requests", icon: RefreshCw, navId: "change-requests" },
  { label: "Procurement", path: "/procurement", icon: Truck, navId: "procurement" },
  { label: "Reports", path: "/reports", icon: FileText, navId: "reports" },
  { label: "Training", path: "/training", icon: GraduationCap, navId: "training" },
];

const MORE_NAV_ITEMS = [
  { label: "Supplier Orders", path: "/supplier-orders", icon: PackageCheck },
  { label: "Mood Board", path: "/staff-mood-board", icon: Palette },
  { label: "Final Packages", path: "/final-package", icon: FileBox },
  { label: "Templates", path: "/templates", icon: LayoutTemplate },
  { label: "Notifications", path: "/notifications", icon: Bell },
];

const ADMIN_ONLY_ITEMS = [
  { label: "Test Scenarios", path: "/test-scenarios", icon: FlaskConical },
];

export default function StaffLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showTopNavMobile, setShowTopNavMobile] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => setUser(u)).catch(() => {});
  }, []);

  const handleLogout = () => {
    base44.auth.logout("/login");
  };

  const showAdmin = user?.role === 'admin';

  const navItems = [...TOP_NAV_ITEMS];
  if (showAdmin) {
    navItems.push({ label: "Admin", path: "/admin", icon: Shield, navId: "admin" });
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 lg:hidden" 
          onClick={() => setMobileMenuOpen(false)} 
        />
      )}

      {/* Left Sidebar - Project-focused */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-gray-200
        transition-all duration-200
        ${sidebarCollapsed ? "w-16" : "w-72"}
        ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        {/* Logo */}
        <div className={`flex items-center h-16 border-b border-gray-100 ${sidebarCollapsed ? "justify-center px-2" : "px-4"}`}>
          {!sidebarCollapsed && (
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
          {sidebarCollapsed && (
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">F</span>
            </div>
          )}
        </div>

        {/* Project Sidebar Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <ProjectSidebar 
            collapsed={sidebarCollapsed}
            onProjectSelect={(project) => {
              setSelectedProject(project);
              if (project) {
                navigate(`/projects/${project.id}`);
              }
            }}
            selectedProject={selectedProject}
          />
        </div>

        {/* Collapse Toggle & Logout */}
        <div className="border-t border-gray-100 p-2">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex w-full items-center justify-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-50"
          >
            {sidebarCollapsed ? "→" : "← Collapse"}
          </button>
          <button
            onClick={handleLogout}
            className={`flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors ${sidebarCollapsed ? "justify-center" : ""}`}
          >
            <LogOut size={18} />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navigation Bar */}
        <header className="flex items-center h-16 px-4 border-b border-gray-200 bg-white">
          {/* Mobile menu button */}
          <button 
            onClick={() => setMobileMenuOpen(true)} 
            className="p-2 rounded-lg hover:bg-gray-100 lg:hidden"
          >
            <Menu size={20} />
          </button>

          {/* Top Nav Items - Desktop */}
          <nav className="hidden lg:flex items-center gap-1 flex-1">
            {navItems.map((item) => {
              const isActive = item.path === "/" 
                ? location.pathname === "/" 
                : location.pathname.startsWith(item.path);
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                    ${isActive 
                      ? "bg-gray-900 text-white" 
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"}
                  `}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                <MoreHorizontal size={18} />
                <span>More</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {MORE_NAV_ITEMS.map(item => {
                  const Icon = item.icon;
                  const isActive = location.pathname.startsWith(item.path);
                  return (
                    <DropdownMenuItem key={item.path} asChild>
                      <Link to={item.path} className={`flex items-center gap-2 cursor-pointer ${isActive ? "font-medium" : ""}`}>
                        <Icon size={16} /> {item.label}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
                {showAdmin && <DropdownMenuSeparator />}
                {showAdmin && ADMIN_ONLY_ITEMS.map(item => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem key={item.path} asChild>
                      <Link to={item.path} className="flex items-center gap-2 cursor-pointer">
                        <Icon size={16} /> {item.label}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          {/* Mobile top nav toggle */}
          <button 
            onClick={() => setShowTopNavMobile(!showTopNavMobile)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
          >
            <FileText size={20} />
          </button>

          {/* User menu */}
          <div className="flex items-center gap-3 ml-auto">
            {selectedProject && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-sm">
                <FolderKanban size={14} className="text-gray-500" />
                <span className="text-gray-700 font-medium truncate max-w-[200px]">
                  {selectedProject.name}
                </span>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="text-gray-400 hover:text-gray-600"
                  title="Clear project filter"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 cursor-pointer">
              <UserCircle size={20} className="text-gray-600" />
              <div className="hidden md:block text-sm">
                <p className="font-medium text-gray-700">{user?.full_name || "User"}</p>
                <p className="text-xs text-gray-500">{user?.role || "Staff"}</p>
              </div>
              <ChevronDown size={16} className="text-gray-400" />
            </div>
          </div>
        </header>

        {/* Mobile top nav dropdown */}
        {showTopNavMobile && (
          <div className="lg:hidden border-b border-gray-200 bg-white px-4 py-2">
            <nav className="flex flex-col gap-1">
              {[...navItems, ...MORE_NAV_ITEMS, ...(showAdmin ? ADMIN_ONLY_ITEMS : [])].map((item) => {
                const isActive = item.path === "/" 
                  ? location.pathname === "/" 
                  : location.pathname.startsWith(item.path);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setShowTopNavMobile(false)}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                      ${isActive 
                        ? "bg-gray-900 text-white" 
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"}
                    `}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        {/* Impersonation Banner */}
        <ImpersonationBanner />

        {/* Main Workspace */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <Outlet context={{ selectedProject, setSelectedProject }} />
        </main>
      </div>

      <WalkthroughManager />
    </div>
  );
}