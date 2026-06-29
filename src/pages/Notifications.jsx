import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Notification.list("-created_date", 50).then(data => {
      setNotifications(data);
      setLoading(false);
    });
  }, []);

  async function markRead(id) {
    await base44.entities.Notification.update(id, { is_read: true });
    setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
  }

  async function markAllRead() {
    const unread = notifications.filter(n => !n.is_read);
    await Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { is_read: true })));
    setNotifications(notifications.map(n => ({ ...n, is_read: true })));
  }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        {notifications.some(n => !n.is_read) && (
          <Button variant="outline" size="sm" onClick={markAllRead} className="gap-2"><Check size={14} /> Mark all read</Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-20">
          <Bell size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 text-sm">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div key={n.id} className={`bg-white rounded-xl border p-4 flex items-start gap-3 ${n.is_read ? "border-gray-200" : "border-blue-200 bg-blue-50/30"}`}>
              <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${n.is_read ? "bg-gray-200" : "bg-blue-500"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{n.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
              </div>
              {!n.is_read && (
                <button onClick={() => markRead(n.id)} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">Mark read</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}