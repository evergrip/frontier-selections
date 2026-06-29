import React from "react";
import { useCustomerPortal } from "@/components/CustomerPortalContext";
import { Button } from "@/components/ui/button";
import { X, Eye, User, AlertTriangle } from "lucide-react";

export default function CustomerPortalBanner() {
  const { customerPortalMode, customerPortalContext, exitCustomerPortal } = useCustomerPortal();

  if (!customerPortalMode || !customerPortalContext) {
    return null;
  }

  const { project, customer, reason } = customerPortalContext;
  const isPreview = customerPortalMode === 'preview';
  const isAct = customerPortalMode === 'act';

  return (
    <div className={`
      fixed top-0 left-0 right-0 z-50 px-4 py-2 shadow-md
      ${isPreview 
        ? "bg-blue-600 text-white" 
        : "bg-amber-600 text-white"
      }
    `}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {isPreview ? (
            <Eye className="h-5 w-5 flex-shrink-0" />
          ) : (
            <User className="h-5 w-5 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">
              {isPreview 
                ? customer 
                  ? `Previewing customer portal as ${customer.customer_name} - Read only. No changes will be saved.`
                  : `Previewing customer portal - Read only. No changes will be saved.`
                : `Acting as ${customer?.customer_name || 'customer'}. Changes will be recorded as staff acting on behalf of customer.`
              }
            </p>
            {isAct && reason && (
              <p className="text-xs text-blue-100 mt-0.5 truncate">
                Reason: {reason}
              </p>
            )}
            <p className="text-xs text-blue-100 mt-0.5">
              Project: {project?.name || 'N/A'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          {isAct && (
            <div className="hidden md:flex items-center gap-1 text-xs bg-white/20 px-2 py-1 rounded">
              <AlertTriangle className="h-3 w-3" />
              <span>All actions logged</span>
            </div>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={exitCustomerPortal}
            className="bg-white text-gray-900 hover:bg-gray-100"
          >
            <X className="h-4 w-4 mr-1.5" />
            {isPreview ? "Exit Preview" : "Exit Customer Mode"}
          </Button>
        </div>
      </div>
    </div>
  );
}