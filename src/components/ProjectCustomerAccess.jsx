import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { UserPlus, Eye, UserCog, Loader2, Mail, Send, Ban } from "lucide-react";
import CustomerInviteDialog from "@/components/CustomerInviteDialog";
import { startImpersonation } from "@/lib/impersonation";
import { hasPermission } from "@/lib/constants";

export default function ProjectCustomerAccess({ project, onUpdated }) {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [impersonationMode, setImpersonationMode] = useState(null); // 'view' or 'act'
  const [user, setUser] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(u => setUser(u)).catch(() => {});
    loadInvitations();
  }, [project.id]);

  const loadInvitations = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("customerInvitations", { action: "list" });
      const all = res.data?.invitations || [];
      setInvitations(all.filter(inv => (inv.project_ids || []).includes(project.id)));
    } catch (e) { /* */ }
    setLoading(false);
  };

  const canInvite = hasPermission(user, 'invite_customers');
  const canView = hasPermission(user, 'view_as_customer');
  const canAct = hasPermission(user, 'act_as_customer');

  const startImpersonationSession = async (invitation, mode, reason) => {
    try {
      const res = await base44.functions.invoke("impersonation", {
        action: "start",
        mode,
        customer_user_id: invitation.user_id || invitation.email,
        customer_name: invitation.customer_name || invitation.email,
        project_id: project.id,
        project_name: project.name,
        reason
      });
      const session = res.data;
      startImpersonation(session);
      navigate(`/portal/project/${project.id}`);
    } catch (e) {
      alert(e.response?.data?.error || e.message || "Failed to start");
    }
  };

  const handleResend = async (invitationId) => {
    try {
      await base44.functions.invoke("customerInvitations", { action: "resend", invitation_id: invitationId });
      loadInvitations();
    } catch (e) { alert(e.response?.data?.error || "Failed"); }
  };

  const handleCancel = async (invitationId) => {
    if (!confirm("Cancel this invitation? The customer will lose access.")) return;
    try {
      await base44.functions.invoke("customerInvitations", { action: "cancel", invitation_id: invitationId });
      loadInvitations();
      if (onUpdated) onUpdated();
    } catch (e) { alert(e.response?.data?.error || "Failed"); }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-semibold text-gray-900">Customer Access</h2>
          <p className="text-sm text-gray-500">Manage customer invitations and portal access for this project</p>
        </div>
        {canInvite && <Button size="sm" onClick={() => setShowInvite(true)}><UserPlus size={14} /> Invite Customer</Button>}
      </div>

      {invitations.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Mail size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-gray-400 text-sm">No customers invited yet</p>
          {canInvite && <Button variant="outline" className="mt-3" onClick={() => setShowInvite(true)}>Invite first customer</Button>}
        </div>
      ) : (
        <div className="space-y-3">
          {invitations.map(inv => (
            <div key={inv.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">{inv.customer_name || inv.email}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      inv.status === 'Active' ? 'bg-green-100 text-green-700' :
                      inv.status === 'Invitation sent' ? 'bg-amber-100 text-amber-700' :
                      inv.status === 'Deactivated' ? 'bg-red-100 text-red-700' :
                      inv.status === 'Cancelled' ? 'bg-gray-100 text-gray-500' :
                      'bg-gray-100 text-gray-600'
                    }`}>{inv.status}</span>
                  </div>
                  <p className="text-sm text-gray-500">{inv.email}{inv.phone ? ` · ${inv.phone}` : ''}</p>
                  {inv.last_login && <p className="text-xs text-gray-400 mt-1">Last login: {new Date(inv.last_login).toLocaleDateString()}</p>}
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  {canView && inv.status === 'Active' && (
                    <Button size="sm" variant="outline" onClick={() => setImpersonationMode({ invitation: inv, mode: 'view' })}>
                      <Eye size={12} /> View as Customer
                    </Button>
                  )}
                  {canAct && inv.status === 'Active' && (
                    <Button size="sm" variant="outline" onClick={() => setImpersonationMode({ invitation: inv, mode: 'act' })}>
                      <UserCog size={12} /> Act as Customer
                    </Button>
                  )}
                  {canInvite && (inv.status === 'Invitation sent' || (inv.status === 'Invitation sent' && inv.expiry_date && new Date(inv.expiry_date) < new Date())) && (
                    <Button size="sm" variant="ghost" onClick={() => handleResend(inv.id)}><Send size={12} /> Resend</Button>
                  )}
                  {canInvite && inv.status !== 'Cancelled' && inv.status !== 'Deactivated' && (
                    <Button size="sm" variant="ghost" onClick={() => handleCancel(inv.id)} className="text-orange-600"><Ban size={12} /> Cancel</Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showInvite && (
        <CustomerInviteDialog
          open={showInvite}
          onClose={() => setShowInvite(false)}
          preselectedProjectId={project.id}
          preselectedProjectName={project.name}
          onInvited={() => { setShowInvite(false); loadInvitations(); if (onUpdated) onUpdated(); }}
        />
      )}

      {impersonationMode && (
        <ImpersonationStartDialog
          invitation={impersonationMode.invitation}
          mode={impersonationMode.mode}
          projectName={project.name}
          onClose={() => setImpersonationMode(null)}
          onStart={startImpersonationSession}
        />
      )}
    </div>
  );
}

function ImpersonationStartDialog({ invitation, mode, projectName, onClose, onStart }) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const isView = mode === 'view';

  const handleStart = async () => {
    if (!isView && !reason.trim()) { alert("A reason is required to act as customer"); return; }
    setLoading(true);
    await onStart(invitation, mode, reason.trim());
    setLoading(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isView ? <Eye size={18} /> : <UserCog size={18} />}
            {isView ? 'View as Customer' : 'Act as Customer'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <p><span className="text-gray-500">Customer:</span> <span className="font-medium">{invitation.customer_name || invitation.email}</span></p>
            <p><span className="text-gray-500">Project:</span> <span className="font-medium">{projectName}</span></p>
          </div>
          {isView ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              You will see the customer portal in read-only mode. You cannot make any changes.
            </div>
          ) : (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                You will be able to make changes on behalf of this customer. All actions will be recorded as performed by you on behalf of the customer.
              </div>
              <div>
                <Label htmlFor="reason">Reason for acting as customer *</Label>
                <Textarea id="reason" value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="e.g. Customer called to request help submitting their selection over the phone" rows={3} />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleStart} disabled={loading} className={isView ? '' : 'bg-amber-600 hover:bg-amber-700'}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : isView ? <Eye size={14} /> : <UserCog size={14} />}
            {isView ? 'Start View Mode' : 'Start Act Mode'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}