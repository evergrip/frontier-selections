import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, Check, AlertTriangle } from "lucide-react";

export default function CustomerNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke("customerPortal", { action: "list_my_notifications" });
        if (res.data?.error) throw new Error(res.data.error);
        setNotifications(res.data?.notifications || []);
      } catch (err) {
        setLoadError(err.message || "Failed to load notifications");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function markRead(id) {
    try {
      await base44.functions.invoke("customerPortal", { action: "mark_notification_read", notification_id: id });
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      alert("Failed to mark notification: " + (err.message || "Unknown error"));
    }
  }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;
  if (loadError) return (
    <div className="p-8 text-center">
      <AlertTriangle size={32} className="mx-auto text-red-400 mb-2" />
      <p className="text-red-600 text-sm font-medium">Failed to load notifications</p>
      <p className="text-gray-400 text-xs mt-1">{loadError}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
      {notifications.length === 0 ? (
        <div className="text-center py-20">
          <Bell size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 text-sm">No notifications</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div key={n.id} className={`bg-white rounded-xl border p-4 flex items-start gap-3 ${n.is_read ? "border-gray-200" : "border-blue-200 bg-blue-50/30"}`}>
              <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${n.is_read ? "bg-gray-200" : "bg-blue-500"}`} />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{n.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
              </div>
              {!n.is_read && <button onClick={() => markRead(n.id)} className="text-xs text-gray-400 hover:text-gray-600">Mark read</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}