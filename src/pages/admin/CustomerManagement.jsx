import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, Eye } from "lucide-react";

export default function CustomerManagement() {
  const [customers, setCustomers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [custRes, projList] = await Promise.all([
        base44.functions.invoke("userManagement", { action: "listCustomers" }),
        base44.entities.Project.list()
      ]);
      setCustomers(custRes.data?.users || []);
      setProjects(projList);
    } catch (e) { /* */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const getAssignedProjects = (customer) => {
    return projects.filter(p => (p.assigned_customers || []).includes(customer.email) || (p.assigned_customers || []).includes(customer.id));
  };

  const toggleActive = async (customer) => {
    try {
      await base44.functions.invoke("userManagement", {
        action: customer.active === false ? "reactivateUser" : "deactivateUser",
        user_id: customer.id
      });
      load();
    } catch (e) {
      alert(e.response?.data?.error || "Failed to update");
    }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">{customers.length} customer user(s)</p>
      {customers.length === 0 ? (
        <p className="text-center text-gray-400 py-10">No customer users found. Invite customers from a project page or the Invitations tab.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-left px-4 py-3">Assigned Projects</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Last Login</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map(c => {
                const assigned = getAssignedProjects(c);
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.full_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.email}</td>
                    <td className="px-4 py-3 text-gray-500">{c.phone || '—'}</td>
                    <td className="px-4 py-3">
                      {assigned.length === 0 ? <span className="text-gray-400 text-xs">None</span> :
                        <div className="space-y-0.5">
                          {assigned.map(p => <div key={p.id} className="text-xs text-gray-600">{p.name}</div>)}
                        </div>}
                    </td>
                    <td className="px-4 py-3">
                      {c.active === false
                        ? <span className="flex items-center gap-1 text-red-600 text-xs"><XCircle size={12} /> Inactive</span>
                        : <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle size={12} /> Active</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{c.last_login ? new Date(c.last_login).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(c)}>
                        {c.active === false ? 'Reactivate' : 'Deactivate'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}