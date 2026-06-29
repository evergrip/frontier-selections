import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Paperclip, AlertTriangle, Eye, Lock } from "lucide-react";

export default function CommentThread({ projectId, targetType, targetId, staff, title = "Comments", readOnly = false }) {
  const [comments, setComments] = useState([]);
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [isInternal, setIsInternal] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [authorName, setAuthorName] = useState("");
  const [confirmVisible, setConfirmVisible] = useState(false);

  useEffect(() => { if (targetId) load(); }, [targetId]);

  async function load() {
    const cs = await base44.entities.Comment.filter({ project_id: projectId, target_type: targetType, target_id: targetId });
    setComments(cs.sort((a, b) => (a.created_date || "").localeCompare(b.created_date || "")));
    try { const u = await base44.auth.me(); setAuthorName(u.full_name || u.email || (staff ? "Staff" : "Customer")); } catch {}
  }

  async function handleUpload(e) {
    if (readOnly) return;
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setAttachments([...attachments, file_url]); setUploading(false);
  }

  async function notifyStaff(message) {
    try {
      await base44.functions.invoke("sendNotifications", {
        target_all_staff: true, project_id: projectId, type: "new_comment",
        title: "New customer comment", message, link: "", skip_email: true
      });
    } catch {}
  }

  async function notifyCustomers(message) {
    try {
      const project = await base44.entities.Project.get(projectId);
      const custs = project.assigned_customers || [];
      if (custs.length === 0) return;
      await base44.entities.Notification.bulkCreate(custs.map(id => ({
        user_id: id, project_id: projectId, type: "new_comment",
        title: "New message from staff", message, is_read: false
      })));
    } catch {}
  }

  async function doPost() {
    if (readOnly || !content.trim()) return;
    const c = await base44.entities.Comment.create({
      project_id: projectId, target_type: targetType, target_id: targetId,
      content, is_internal: staff ? isInternal : false,
      author_name: authorName, author_role: staff ? "staff" : "customer",
      attachments
    });
    setComments([...comments, c]);
    const msg = `${authorName}: ${content.slice(0, 120)}`;
    if (!staff) { await notifyStaff(msg); }
    else if (!isInternal) { await notifyCustomers(msg); }
    setContent(""); setAttachments([]); setConfirmVisible(false);
  }

  function handlePost() {
    if (readOnly) return;
    if (staff && !isInternal) { setConfirmVisible(true); return; }
    doPost();
  }

  const visible = staff ? comments : comments.filter(c => !c.is_internal);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      {title && <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>}
      <div className="space-y-3">
        {visible.length === 0 && <p className="text-sm text-gray-400">No comments yet</p>}
        {visible.map(c => (
          <div key={c.id} className={`rounded-lg p-3 ${c.is_internal ? "bg-yellow-50 border border-yellow-200" : "bg-blue-50 border border-blue-200"}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-gray-900 text-xs">{c.author_name || (c.is_internal ? "Staff" : "Customer")}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 font-medium ${c.is_internal ? "bg-yellow-200 text-yellow-800" : "bg-blue-200 text-blue-800"}`}>
                {c.is_internal ? <><Lock size={10} /> Internal note</> : <><Eye size={10} /> Customer-visible</>}
              </span>
            </div>
            <p className="text-sm text-gray-700">{c.content}</p>
            {c.created_date && <p className="text-[10px] text-gray-400 mt-1">{new Date(c.created_date).toLocaleString()}</p>}
            {(c.attachments || []).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {c.attachments.map((url, i) => <a key={i} href={url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Paperclip size={10} /> {url.split("/").pop() || "file"}</a>)}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="space-y-2 pt-2 border-t border-gray-50">
        <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder={readOnly ? "Preview mode - comments disabled" : "Write a comment..."} rows={2} disabled={readOnly} />
        {staff && !readOnly && (
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input type="radio" checked={isInternal} onChange={() => setIsInternal(true)} /> <Lock size={10} /> Internal note
            </label>
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input type="radio" checked={!isInternal} onChange={() => setIsInternal(false)} /> <Eye size={10} /> Customer-visible
            </label>
          </div>
        )}
        {!readOnly && (
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs text-gray-500 cursor-pointer flex items-center gap-1">
              <Upload size={12} /> {uploading ? "Uploading..." : "Attach file"}
              <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
            {attachments.map((url, i) => <span key={i} className="text-xs text-gray-500 flex items-center gap-1"><Paperclip size={10} /> {url.split("/").pop()}</span>)}
          </div>
        )}
        {confirmVisible && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-800 space-y-2">
            <div className="flex items-center gap-1"><AlertTriangle size={12} /> This comment will be visible to the customer. Post it?</div>
            <div className="flex gap-2">
              <Button size="sm" onClick={doPost}>Yes, post</Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmVisible(false)}>Cancel</Button>
            </div>
          </div>
        )}
        {!confirmVisible && (
          readOnly ? (
            <p className="text-xs text-gray-400">Preview mode - comments disabled.</p>
          ) : (
            <Button size="sm" onClick={handlePost} disabled={!content.trim()}>Post Comment</Button>
          )
        )}
      </div>
    </div>
  );
}