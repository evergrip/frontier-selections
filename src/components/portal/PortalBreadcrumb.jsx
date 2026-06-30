import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

export default function PortalBreadcrumb({ items = [] }) {
  return (
    <nav className="flex items-center gap-1 text-xs text-gray-500 overflow-x-auto whitespace-nowrap pb-1 -mb-2">
      <Link to="/portal" className="flex items-center gap-1 hover:text-gray-900 shrink-0">
        <Home size={12} />
        <span className="hidden sm:inline">My Projects</span>
      </Link>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          <ChevronRight size={12} className="shrink-0 text-gray-300" />
          {item.to && i < items.length - 1 ? (
            <Link to={item.to} className="hover:text-gray-900 shrink-0 truncate max-w-[140px]">
              {item.label}
            </Link>
          ) : (
            <span className="text-gray-900 font-medium shrink-0 truncate max-w-[140px]">
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}