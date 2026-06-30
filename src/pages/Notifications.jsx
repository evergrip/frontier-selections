import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, Check, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

function getNotificationLink(n) {
  if (n.link) return n.link;
  if (n.type === "selection_submitted" || n.type === "sign_off_request" || n.type === "new_comment") {
    return n.project_id ? `/projects/${n.project_id}` : "/";
  }
  if (n.type === "change_request") {
    return n.project_id ? `/change-requests` : "/";
  }
  if (n.type === "substitution") {
    return n.project_id ? `/projects/${n.project_id}` : "/";
  }
  if (n.project_id) return `/projects/${n.project_id}`;
  return "/";
}

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [markingId, setMarkingId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const user = await base44.auth.me();
        const data = await base44.entities.Notification.filter({ user_id: user.id }, "-created_date", 50);
        setNotifications(data);
      } catch (err) {
        setLoadError(err.message || "Failed to load notifications");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function markRead(id) {
    if (markingId) return;
    setMarkingId(id);
    try {
      await base44.entities.Notification.update(id, { is_read: true });
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      alert("Failed to mark notification: " + (err.message || "Unknown error"));
    } finally {
      setMarkingId(null);
    }
  }

  async function markAllRead() {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      const unread = notifications.filter(n => !n.is_read);
      await Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { is_read: true })));
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      alert("Failed to mark all: " + (err.message || "Unknown error"));
    } finally {
      setMarkingAll(false);
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
    <div className="p-6 lg:p-8 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        {notifications.some(n => !n.is_read) && (
          <Button variant="outline" size="sm" onClick={markAllRead} disabled={markingAll} className="gap-2">
            {markingAll ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {markingAll ? "Marking..." : "Mark all read"}
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <Bell size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm font-medium">No notifications</p>
          <p className="text-gray-400 text-xs mt-1">You'll see updates here when selections are submitted, change requests are made, or comments are posted.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const link = getNotificationLink(n);
            return (
              <div key={n.id} className={`bg-white rounded-xl border p-4 flex items-start gap-3 ${n.is_read ? "border-gray-200" : "border-blue-200 bg-blue-50/30"}`}>
                <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${n.is_read ? "bg-gray-200" : "bg-blue-500"}`} />
                <Link to={link} className="flex-1 min-w-0" onClick={() => !n.is_read && markRead(n.id)}>
                  <p className="text-sm font-medium text-gray-900 hover:text-blue-600">{n.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                  {n.created_date && <p className="text-[10px] text-gray-400 mt-1">{new Date(n.created_date).toLocaleString()}</p>}
                </Link>
                {!n.is_read && (
                  <button
                    onClick={() => markRead(n.id)}
                    disabled={markingId === n.id}
                    className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 shrink-0 disabled:opacity-50"
                  >
                    {markingId === n.id ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                    Mark read
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}