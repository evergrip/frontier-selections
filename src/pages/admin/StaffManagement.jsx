import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STAFF_ROLES, ROLE_PERMISSIONS, PERMISSIONS } from "@/lib/constants";
import { UserPlus, Loader2, Shield, ShieldOff, CheckCircle, XCircle } from "lucide-react";

export default function StaffManagement() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("userManagement", { action: "listStaff" });
      setStaff(res.data?.users || []);
    } catch (e) { /* */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{staff.length} staff user(s)</p>
        <Button onClick={() => setShowInvite(true)} size="sm"><UserPlus size={14} /> Invite Staff</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400" /></div>
      ) : staff.length === 0 ? (
        <p className="text-center text-gray-400 py-10">No staff users found</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Staff Role</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Last Login</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {staff.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.full_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.staff_role || '—'}</td>
                  <td className="px-4 py-3">
                    {u.active === false
                      ? <span className="flex items-center gap-1 text-red-600 text-xs"><XCircle size={12} /> Inactive</span>
                      : <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle size={12} /> Active</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{u.last_login ? new Date(u.last_login).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setEditingUser(u)}>Edit</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showInvite && <InviteStaffDialog onClose={() => setShowInvite(false)} onDone={() => { setShowInvite(false); load(); }} />}
      {editingUser && <EditStaffDialog user={editingUser} onClose={() => setEditingUser(null)} onDone={() => { setEditingUser(null); load(); }} />}
    </div>
  );
}

function InviteStaffDialog({ onClose, onDone }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("staff");
  const [staffRole, setStaffRole] = useState("Project Coordinator");
  const [permissions, setPermissions] = useState(ROLE_PERMISSIONS["Project Coordinator"] || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleStaffRoleChange = (val) => {
    setStaffRole(val);
    setPermissions(ROLE_PERMISSIONS[val] || []);
  };

  const handleSubmit = async () => {
    if (loading) return;
    if (!email) { setError("Email is required"); return; }
    setLoading(true); setError("");
    try {
      await base44.functions.invoke("userManagement", {
        action: "inviteStaff", email, role, staff_role: staffRole, permissions, name, phone
      });
      onDone();
    } catch (e) {
      setError(e.response?.data?.error || e.message || "Failed to invite");
    }
    setLoading(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Invite Staff User</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>Email *</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
          <div>
            <Label>App Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Staff Role</Label>
            <Select value={staffRole} onValueChange={handleStaffRoleChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAFF_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Permissions ({permissions.length} selected)</Label>
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
              {PERMISSIONS.map(p => (
                <label key={p} className="flex items-center gap-2 px-2 py-0.5 rounded hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={permissions.includes(p)} onChange={() => {
                    setPermissions(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
                  }} className="rounded" />
                  <span className="text-xs font-mono">{p}</span>
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Send Invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditStaffDialog({ user, onClose, onDone }) {
  const [staffRole, setStaffRole] = useState(user.staff_role || "Project Coordinator");
  const [permissions, setPermissions] = useState(user.permissions || ROLE_PERMISSIONS[staffRole] || []);
  const [active, setActive] = useState(user.active !== false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (loading) return;
    setLoading(true); setError("");
    try {
      await base44.functions.invoke("userManagement", {
        action: "updateStaff", user_id: user.id, staff_role: staffRole, permissions, active
      });
      onDone();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
    setLoading(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit Staff: {user.full_name || user.email}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Staff Role</Label>
            <Select value={staffRole} onValueChange={(v) => { setStaffRole(v); setPermissions(ROLE_PERMISSIONS[v] || []); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAFF_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Permissions ({permissions.length} selected)</Label>
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
              {PERMISSIONS.map(p => (
                <label key={p} className="flex items-center gap-2 px-2 py-0.5 rounded hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={permissions.includes(p)} onChange={() => {
                    setPermissions(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
                  }} className="rounded" />
                  <span className="text-xs font-mono">{p}</span>
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="rounded" />
            <span className="text-sm">Account Active</span>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : null} Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}