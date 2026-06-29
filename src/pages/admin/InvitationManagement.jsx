import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, Send, Ban, PowerOff, Power, Trash2, UserPlus } from "lucide-react";
import CustomerInviteDialog from "@/components/CustomerInviteDialog";
import { INVITATION_STATUSES, STATUS_COLORS } from "@/lib/constants";

export default function InvitationManagement() {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("customerInvitations", { action: "list" });
      setInvitations(res.data?.invitations || []);
    } catch (e) { /* */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAction = async (action, invitationId, extra = {}) => {
    try {
      const res = await base44.functions.invoke("customerInvitations", { action, invitation_id: invitationId, ...extra });
      const data = res.data;
      if (data.email_sent) {
        alert(`Invitation ${action}ed successfully!\n\nInvite link: ${data.invite_link}`);
      } else if (data.invite_link) {
        alert(`Invitation ${action}ed but email failed: ${data.email_error || 'Unknown error'}\n\nInvite link: ${data.invite_link}`);
      } else {
        alert(`Invitation ${action}ed successfully`);
      }
      load();
    } catch (e) {
      alert(e.response?.data?.error || "Failed");
    }
  };

  const isExpired = (inv) => inv.status === 'Invitation sent' && inv.expiry_date && new Date(inv.expiry_date) < new Date();

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{invitations.length} invitation(s)</p>
        <Button onClick={() => setShowInvite(true)} size="sm"><UserPlus size={14} /> Invite Customer</Button>
      </div>

      {invitations.length === 0 ? (
        <p className="text-center text-gray-400 py-10">No invitations yet. Click "Invite Customer" to send one.</p>
      ) : (
        <div className="space-y-3">
          {invitations.map(inv => {
            const expired = isExpired(inv);
            const displayStatus = expired ? 'Expired' : inv.status;
            return (
              <div key={inv.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{inv.customer_name || inv.email}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[displayStatus] || 'bg-gray-100 text-gray-600'}`}>
                        {displayStatus}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{inv.email}{inv.phone ? ` · ${inv.phone}` : ''}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(inv.project_names || []).map((pn, i) => (
                        <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{pn}</span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Invited {inv.invited_date ? new Date(inv.invited_date).toLocaleDateString() : '—'}
                      {inv.expiry_date ? ` · Expires ${new Date(inv.expiry_date).toLocaleDateString()}` : ''}
                      {inv.last_login ? ` · Last login ${new Date(inv.last_login).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    {(inv.status === 'Invitation sent' || expired) && (
                      <Button size="sm" variant="ghost" onClick={() => handleAction('resend', inv.id)}><Send size={12} /> Resend</Button>
                    )}
                    {inv.status !== 'Cancelled' && inv.status !== 'Deactivated' && (
                      <Button size="sm" variant="ghost" onClick={() => handleAction('cancel', inv.id)} className="text-orange-600"><Ban size={12} /> Cancel</Button>
                    )}
                    {inv.status !== 'Deactivated' && inv.status !== 'Cancelled' && (
                      <Button size="sm" variant="ghost" onClick={() => handleAction('deactivate', inv.id)} className="text-red-600"><PowerOff size={12} /> Deactivate</Button>
                    )}
                    {inv.status === 'Deactivated' && (
                      <Button size="sm" variant="ghost" onClick={() => handleAction('reactivate', inv.id)} className="text-green-600"><Power size={12} /> Reactivate</Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showInvite && <CustomerInviteDialog open={showInvite} onClose={() => setShowInvite(false)} onInvited={load} />}
    </div>
  );
}