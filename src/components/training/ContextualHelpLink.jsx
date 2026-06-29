import React, { useState, useEffect } from "react";
import { HelpCircle, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { base44 } from "@/api/base44Client";

export default function ContextualHelpLink({ category, relatedModule, label }) {
  const [article, setArticle] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    base44.entities.HelpArticle.filter({
      status: "Published",
      ...(relatedModule ? { related_module: relatedModule } : {}),
      ...(category ? { category } : {})
    }, "-view_count", 1).then(async (results) => {
      if (results.length > 0) {
        setArticle(results[0]);
        await base44.entities.HelpArticle.update(results[0].id, {
          view_count: (results[0].view_count || 0) + 1
        }).catch(() => {});
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
      >
        <HelpCircle size={12} />
        {label || "Help"}
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{article?.title || "Help Article"}</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="w-6 h-6 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
                </div>
              ) : article ? (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{article.body}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No help article found for this topic.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}