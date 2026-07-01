import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2, Search, UserCheck } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function CustomerInviteDialog({ open, onClose, preselectedProjectId, preselectedProjectName, onInvited }) {
  const [mode, setMode] = useState("new"); // "new" | "existing"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [projects, setProjects] = useState([]);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Existing user state
  const [existingUsers, setExistingUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    if (open) {
      loadProjects();
      loadExistingUsers();
      setName(""); setEmail(""); setPhone(""); setError("");
      setSearchQuery(""); setSelectedUser(null);
      setSelectedProjects(preselectedProjectId ? [preselectedProjectId] : []);
    }
  }, [open]);

  const loadProjects = async () => {
    try { const list = await base44.entities.Project.list(); setProjects(list); } catch (e) {}
  };

  const loadExistingUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await base44.functions.invoke("customerInvitations", { action: "listExistingUsers" });
      setExistingUsers(res.data?.users || []);
    } catch (e) { /* */ }
    setUsersLoading(false);
  };

  const toggleProject = (pid) => {
    setSelectedProjects(prev => prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]);
  };

  const filteredUsers = existingUsers.filter(u => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (u.full_name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
  });

  const handleSubmit = async () => {
    if (loading) return;
    if (selectedProjects.length === 0) { setError("Select at least one project"); return; }

    if (mode === "new") {
      if (!email) { setError("Email is required"); return; }
    } else {
      if (!selectedUser) { setError("Select a customer to grant access"); return; }
    }

    setLoading(true); setError("");
    try {
      const projectNames = projects.filter(p => selectedProjects.includes(p.id)).map(p => p.name);

      if (mode === "existing") {
        const res = await base44.functions.invoke("customerInvitations", {
          action: "linkExistingUser",
          user_id: selectedUser.id,
          project_ids: selectedProjects,
          project_names: projectNames,
          phone
        });
        if (res.data?.error) throw new Error(res.data.error);
        toast({ title: "Access granted", description: `${selectedUser.full_name || selectedUser.email} now has access to the selected project(s).` });
        if (onInvited) onInvited(res.data);
      } else {
        const res = await base44.functions.invoke("customerInvitations", {
          action: "create", email, customer_name: name, phone,
          project_ids: selectedProjects, project_names: projectNames
        });
        const data = res.data;
        if (data?.error) throw new Error(data.error);
        if (onInvited) onInvited(data);
        if (data.email_sent) {
          toast({ title: "Invitation sent", description: `An invite has been sent to ${email}.` });
        } else {
          toast({ title: "Invitation created", description: `Email could not be sent: ${data.email_error || 'Unknown error'}. Invite link: ${data.invite_link}`, variant: "destructive" });
        }
      }
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || e.message || "Failed to grant access");
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus size={18} /> Give Customer Access</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Mode toggle */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => { setMode("new"); setSelectedUser(null); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === "new" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >Invite New</button>
            <button
              onClick={() => setMode("existing")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === "existing" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >Select Existing</button>
          </div>

          {mode === "new" ? (
            <>
              <div><Label htmlFor="cust-name">Customer Name</Label><Input id="cust-name" value={name} onChange={e => setName(e.target.value)} placeholder="John Smith" /></div>
              <div><Label htmlFor="cust-email">Email *</Label><Input id="cust-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@example.com" /></div>
              <div><Label htmlFor="cust-phone">Phone</Label><Input id="cust-phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(902) 555-1234" /></div>
            </>
          ) : (
            <>
              <div>
                <Label>Select a Registered Customer *</Label>
                {usersLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin text-gray-400" /></div>
                ) : existingUsers.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-400">No registered customers found</p>
                  </div>
                ) : (
                  <>
                    <div className="relative mb-2">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by name or email..." className="pl-9" />
                    </div>
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-50">
                      {filteredUsers.length === 0 && <p className="text-sm text-gray-400 p-3 text-center">No matches found</p>}
                      {filteredUsers.map(u => (
                        <button
                          key={u.id}
                          onClick={() => setSelectedUser(u)}
                          className={`w-full flex items-center gap-3 p-2.5 text-left transition-colors ${selectedUser?.id === u.id ? "bg-blue-50" : "hover:bg-gray-50"}`}
                        >
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 shrink-0">
                            {(u.full_name || u.email || "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{u.full_name || "Unnamed"}</p>
                            <p className="text-xs text-gray-500 truncate">{u.email}</p>
                          </div>
                          {selectedUser?.id === u.id && <UserCheck size={16} className="text-blue-600 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {selectedUser && (
                <div><Label htmlFor="cust-phone">Phone (optional)</Label><Input id="cust-phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(902) 555-1234" /></div>
              )}
            </>
          )}

          <div>
            <Label>Assign to Projects *</Label>
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
              {projects.length === 0 && <p className="text-sm text-gray-400 p-2">No projects found</p>}
              {projects.map(p => (
                <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={selectedProjects.includes(p.id)} onChange={() => toggleProject(p.id)} className="rounded" />
                  <span className="text-sm">{p.name}</span>
                  {preselectedProjectId === p.id && <span className="text-xs text-blue-600">(current)</span>}
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : mode === "new" ? <UserPlus size={14} /> : <UserCheck size={14} />}
            {loading ? "Processing..." : mode === "new" ? "Send Invitation" : "Grant Access"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}