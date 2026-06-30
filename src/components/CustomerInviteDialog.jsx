import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2 } from "lucide-react";

export default function CustomerInviteDialog({ open, onClose, preselectedProjectId, preselectedProjectName, onInvited }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [projects, setProjects] = useState([]);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      loadProjects();
      setName(""); setEmail(""); setPhone(""); setError("");
      setSelectedProjects(preselectedProjectId ? [preselectedProjectId] : []);
    }
  }, [open]);

  const loadProjects = async () => {
    try { const list = await base44.entities.Project.list(); setProjects(list); } catch (e) {}
  };

  const toggleProject = (pid) => {
    setSelectedProjects(prev => prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]);
  };

  const handleSubmit = async () => {
    if (loading) return;
    if (!email || selectedProjects.length === 0) {
      setError("Email and at least one project are required");
      return;
    }
    setLoading(true); setError("");
    try {
      const projectNames = projects.filter(p => selectedProjects.includes(p.id)).map(p => p.name);
      const res = await base44.functions.invoke("customerInvitations", {
        action: "create", email, customer_name: name, phone,
        project_ids: selectedProjects, project_names: projectNames
      });
      const data = res.data;
      if (onInvited) onInvited(data);
      if (data.email_sent) {
        alert(`Invitation sent to ${email}!\n\nInvite link: ${data.invite_link}`);
      } else {
        alert(`Invitation created but email failed: ${data.email_error || 'Unknown error'}\n\nInvite link: ${data.invite_link}`);
      }
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || e.message || "Failed to send invitation");
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><UserPlus size={18} /> Invite Customer</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div><Label htmlFor="cust-name">Customer Name</Label><Input id="cust-name" value={name} onChange={e => setName(e.target.value)} placeholder="John Smith" /></div>
          <div><Label htmlFor="cust-email">Email *</Label><Input id="cust-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@example.com" /></div>
          <div><Label htmlFor="cust-phone">Phone</Label><Input id="cust-phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(902) 555-1234" /></div>
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
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
            {loading ? "Sending..." : "Send Invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}