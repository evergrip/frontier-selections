import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { User, Mail, Calendar, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { hasPermission } from "@/lib/constants";
import { useCustomerPortal } from "@/components/CustomerPortalContext";

export default function ViewCustomerPortalDialog({ project, open, onOpenChange }) {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showModeSelect, setShowModeSelect] = useState(false);
  const [actReason, setActReason] = useState("");
  const [user, setUser] = useState(null);
  
  const { enterPreviewMode, enterActMode, enteringMode } = useCustomerPortal();

  useEffect(() => {
    if (open && project) {
      loadCustomers();
      base44.auth.me().then(u => setUser(u)).catch(() => {});
    }
  }, [open, project]);

  async function loadCustomers() {
    setLoading(true);
    try {
      const invRes = await base44.functions.invoke("customerInvitations", { 
        action: "list",
        project_id: project.id
      });
      const invitations = invRes.data?.invitations || [];
      const activeCustomers = invitations.filter(inv => 
        inv.status === 'Active' || inv.status === 'Account created'
      );
      setCustomers(activeCustomers);
      if (activeCustomers.length === 1) {
        setSelectedCustomer(activeCustomers[0]);
      }
    } catch (error) {
      console.error("Failed to load customers:", error);
    }
    setLoading(false);
  }

  const handlePreview = () => {
    if (enteringMode) return;
    enterPreviewMode(project, selectedCustomer);
    onOpenChange(false);
  };

  const handleActSubmit = () => {
    if (enteringMode || !actReason.trim()) return;
    enterActMode(project, selectedCustomer, actReason.trim());
    onOpenChange(false);
  };

  const canAct = hasPermission(user, "act_as_customer");
  const canPreview = hasPermission(user, "preview_customer_view") || hasPermission(user, "view_as_customer");

  return (
    <>
      {/* Customer Selection Dialog */}
      <Dialog open={open && !showModeSelect} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>View Customer Portal</DialogTitle>
            <DialogDescription>
              Select a customer to preview their portal view or act on their behalf.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              </div>
            ) : customers.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                <p className="text-gray-700 font-medium mb-2">No customer has been invited yet</p>
                <p className="text-sm text-gray-500 mb-4">Invite a customer first to preview the real customer portal.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {customers.map(customer => (
                  <div
                    key={customer.id}
                    onClick={() => setSelectedCustomer(customer)}
                    className={`
                      p-4 rounded-lg border-2 cursor-pointer transition-all
                      ${selectedCustomer?.id === customer.id
                        ? "border-gray-900 bg-gray-50"
                        : "border-gray-200 hover:border-gray-300"
                      }
                    `}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <h4 className="font-semibold text-gray-900">{customer.customer_name}</h4>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 text-gray-400" />
                            {customer.email}
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                            Status: {customer.status}
                          </div>
                          {customer.last_login && (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3.5 w-3.5 text-gray-400" />
                              Last login: {new Date(customer.last_login).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                      {selectedCustomer?.id === customer.id && (
                        <div className="text-gray-900 font-medium">Selected</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => setShowModeSelect(true)}
              disabled={!selectedCustomer || !canPreview || customers.length === 0}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mode Selection Dialog */}
      <Dialog open={showModeSelect} onOpenChange={(open) => {
        if (!open) {
          setShowModeSelect(false);
          setSelectedCustomer(null);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Choose Portal Mode</DialogTitle>
            <DialogDescription>
              {selectedCustomer ? `How would you like to access ${selectedCustomer.customer_name}'s portal?` : "Preview the customer portal in read-only mode."}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Preview Mode */}
            <button
              type="button"
              onClick={handlePreview}
              disabled={enteringMode}
              className="w-full text-left p-4 rounded-lg border-2 border-gray-200 hover:border-gray-900 cursor-pointer transition-all disabled:opacity-50"
            >
              <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Preview Customer Portal
              </h4>
              <p className="text-sm text-gray-600">
                Read-only view. See exactly what the customer sees without making any changes.
              </p>
              <div className="mt-3 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                ✓ View selections, rooms, and pricing (if visible to customer)<br/>
                ✓ View customer comments and mood board<br/>
                ✗ Cannot submit or edit selections<br/>
                ✗ Cannot add comments or upload files
              </div>
              {enteringMode && <span className="text-xs text-gray-500 mt-2 block">Loading...</span>}
            </button>

            {/* Act Mode */}
            {canAct && (
              <div className="p-4 rounded-lg border-2 border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Act as Customer
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  Perform customer actions on their behalf. Requires a reason.
                </p>
                <Label htmlFor="act-reason" className="text-xs font-medium">
                  Reason for acting <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="act-reason"
                  value={actReason}
                  onChange={(e) => setActReason(e.target.value)}
                  placeholder="e.g., Customer requested help by phone, Customer selected options in person..."
                  className="mt-1 text-sm"
                  rows={3}
                />
                <div className="mt-3 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                  ✓ Submit and revise selections<br/>
                  ✓ Upload mood board items<br/>
                  ✓ Add customer comments<br/>
                  ✗ Cannot approve/reject selections<br/>
                  ✗ Cannot see internal notes or hidden pricing<br/>
                  ✓ All actions logged with your name as actor
                </div>
                <Button 
                  className="w-full mt-3" 
                  onClick={handleActSubmit}
                  disabled={!actReason.trim() || enteringMode}
                >
                  {enteringMode ? "Entering..." : "Start Acting as Customer"}
                </Button>
              </div>
            )}

            {!canAct && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                You don't have permission to act as a customer. Only preview mode is available.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModeSelect(false)}>
              Back
            </Button>
            <Button 
              variant="secondary"
              onClick={handlePreview}
              disabled={enteringMode}
            >
              {enteringMode ? "Loading..." : "Preview Only"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}