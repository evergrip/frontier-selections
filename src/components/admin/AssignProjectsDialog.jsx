import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, FolderKanban } from "lucide-react";

export default function AssignProjectsDialog({ customer, projects, onClose, onSaved }) {
  const [selected, setSelected] = useState(new Set());
  const [original, setOriginal] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const assigned = new Set(
      projects
        .filter(p => (p.assigned_customers || []).includes(customer.id) || (p.assigned_customers || []).includes(customer.email))
        .map(p => p.id)
    );
    setSelected(assigned);
    setOriginal(assigned);
  }, [customer, projects]);

  const toggle = (pid) => {
    const next = new Set(selected);
    if (next.has(pid)) next.delete(pid);
    else next.add(pid);
    setSelected(next);
  };

  const added = [...selected].filter(id => !original.has(id));
  const removed = [...original].filter(id => !selected.has(id));
  const hasChanges = added.length > 0 || removed.length > 0;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // Add newly assigned projects
      if (added.length > 0) {
        const addedProjects = projects.filter(p => added.includes(p.id));
        await base44.functions.invoke("customerInvitations", {
          action: "linkExistingUser",
          user_id: customer.id,
          project_ids: added,
          project_names: addedProjects.map(p => p.name)
        });
      }
      // Remove unassigned projects
      for (const pid of removed) {
        const project = projects.find(p => p.id === pid);
        if (!project) continue;
        const current = project.assigned_customers || [];
        const updated = current.filter(c => c !== customer.id && c !== customer.email);
        await base44.entities.Project.update(pid, { assigned_customers: updated });
      }
      onSaved();
    } catch (e) {
      setError(e.response?.data?.error || e.message || "Failed to update");
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderKanban size={18} />
            Assign Projects — {customer.full_name || customer.email}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2 max-h-80 overflow-y-auto">
          {projects.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No projects available</p>
          ) : projects.map(p => (
            <label key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer">
              <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                {p.client_name && <p className="text-xs text-gray-400 truncate">{p.client_name}</p>}
              </div>
            </label>
          ))}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={!hasChanges || saving}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save Changes{hasChanges ? ` (${added.length} add, ${removed.length} remove)` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}