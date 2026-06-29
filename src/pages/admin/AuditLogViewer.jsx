import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Eye, AlertTriangle } from "lucide-react";

export default function AuditLogViewer() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ actor: '', project_id: '', action_type: '', severity: '' });
  const [selectedLog, setSelectedLog] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const all = await base44.entities.AuditLog.list('-created_date', 200);
      let filtered = all;
      if (filters.actor) filtered = filtered.filter(l => (l.actor_name || '').toLowerCase().includes(filters.actor.toLowerCase()));
      if (filters.project_id) filtered = filtered.filter(l => l.project_id === filters.project_id);
      if (filters.action_type) filtered = filtered.filter(l => (l.action_type || l.action || '').includes(filters.action_type));
      if (filters.severity) filtered = filtered.filter(l => l.severity === filters.severity);
      setLogs(filtered);
    } catch (e) { /* */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const severityColor = (s) => ({
    low: 'bg-gray-100 text-gray-600',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-amber-100 text-amber-700',
    sensitive: 'bg-red-100 text-red-700'
  }[s] || 'bg-gray-100 text-gray-600');

  return (
    <div>
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Actor Name</Label>
            <Input value={filters.actor} onChange={e => setFilters({ ...filters, actor: e.target.value })} placeholder="Search..." />
          </div>
          <div>
            <Label className="text-xs">Action Type</Label>
            <Input value={filters.action_type} onChange={e => setFilters({ ...filters, action_type: e.target.value })} placeholder="e.g. selection" />
          </div>
          <div>
            <Label className="text-xs">Severity</Label>
            <Select value={filters.severity} onValueChange={v => setFilters({ ...filters, severity: v })}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>All</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="sensitive">Sensitive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={load} size="sm" className="w-full"><Search size={14} /> Apply Filters</Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400" /></div>
      ) : logs.length === 0 ? (
        <p className="text-center text-gray-400 py-10">No audit logs found</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Date/Time</th>
                <th className="text-left px-4 py-3">Actor</th>
                <th className="text-left px-4 py-3">Acting As</th>
                <th className="text-left px-4 py-3">Action</th>
                <th className="text-left px-4 py-3">Severity</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedLog(log)}>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{new Date(log.created_date).toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{log.actor_name || log.changed_by || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {log.acting_as_name ? <span className="text-amber-600 font-medium">{log.acting_as_name}</span> : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{log.action_type || log.action}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityColor(log.severity)}`}>
                      {log.severity || 'low'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right"><Eye size={14} className="text-gray-400" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedLog && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedLog(null)}>
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Audit Log Detail</h3>
              <Button size="sm" variant="ghost" onClick={() => setSelectedLog(null)}>Close</Button>
            </div>
            <div className="space-y-3 text-sm">
              <div><span className="text-gray-500">Date:</span> <span className="text-gray-900">{new Date(selectedLog.created_date).toLocaleString()}</span></div>
              <div><span className="text-gray-500">Action:</span> <span className="text-gray-900 font-mono">{selectedLog.action_type || selectedLog.action}</span></div>
              <div><span className="text-gray-500">Description:</span> <span className="text-gray-900">{selectedLog.description}</span></div>
              <div><span className="text-gray-500">Actor:</span> <span className="text-gray-900">{selectedLog.actor_name || selectedLog.changed_by}</span></div>
              {selectedLog.acting_as_name && (
                <div className="bg-amber-50 border border-amber-200 rounded p-2 flex items-center gap-2">
                  <AlertTriangle size={14} className="text-amber-600" />
                  <span className="text-amber-800">Acting as: {selectedLog.acting_as_name}</span>
                </div>
              )}
              {selectedLog.reason && <div><span className="text-gray-500">Reason:</span> <span className="text-gray-900">{selectedLog.reason}</span></div>}
              {selectedLog.project_id && <div><span className="text-gray-500">Project ID:</span> <span className="text-gray-900 font-mono text-xs">{selectedLog.project_id}</span></div>}
              {selectedLog.target_type && <div><span className="text-gray-500">Target:</span> <span className="text-gray-900">{selectedLog.target_type} ({selectedLog.target_id})</span></div>}
              {selectedLog.before_value && <div><span className="text-gray-500">Before:</span> <pre className="bg-gray-50 p-2 rounded text-xs mt-1 overflow-x-auto">{selectedLog.before_value}</pre></div>}
              {selectedLog.after_value && <div><span className="text-gray-500">After:</span> <pre className="bg-gray-50 p-2 rounded text-xs mt-1 overflow-x-auto">{selectedLog.after_value}</pre></div>}
              {selectedLog.old_value && <div><span className="text-gray-500">Old:</span> <span className="text-gray-900">{selectedLog.old_value}</span></div>}
              {selectedLog.new_value && <div><span className="text-gray-500">New:</span> <span className="text-gray-900">{selectedLog.new_value}</span></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}