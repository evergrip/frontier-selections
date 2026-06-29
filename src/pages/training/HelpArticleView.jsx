import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, Clock, Video, Image as ImageIcon } from "lucide-react";

export default function HelpArticleView() {
  const { articleId } = useParams();
  const [article, setArticle] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!articleId) return;
    base44.entities.HelpArticle.get(articleId).then(async art => {
      setArticle(art);
      // Increment view count
      base44.entities.HelpArticle.update(articleId, { view_count: (art.view_count || 0) + 1 }).catch(() => {});
      // Load related articles
      const relatedArts = await base44.entities.HelpArticle.filter({
        category: art.category, status: "Published"
      }, "-view_count", 5);
      setRelated(relatedArts.filter(a => a.id !== articleId).slice(0, 4));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [articleId]);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;
  if (!article) return <div className="p-6 text-center text-gray-500">Article not found</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to="/training" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
        <ArrowLeft size={16} /> Back to Help & Training
      </Link>

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{article.category}</span>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Clock size={12} /> Updated {article.last_updated ? new Date(article.last_updated).toLocaleDateString() : "Unknown"}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{article.title}</h1>

        {article.video_url && (
          <div className="mb-6">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <Video size={16} /> Video
            </div>
            <a href={article.video_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
              {article.video_url}
            </a>
          </div>
        )}

        <div className="prose prose-sm max-w-none">
          <ReactMarkdown>{article.body}</ReactMarkdown>
        </div>

        {article.screenshots && article.screenshots.length > 0 && (
          <div className="mt-6">
            <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1"><ImageIcon size={14} /> Screenshots</p>
            <div className="grid grid-cols-2 gap-3">
              {article.screenshots.map((url, idx) => (
                <img key={idx} src={url} alt={`Screenshot ${idx + 1}`} className="rounded-lg border border-gray-200" />
              ))}
            </div>
          </div>
        )}
      </div>

      {related.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Related Articles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {related.map(r => (
              <Link key={r.id} to={`/training/article/${r.id}`} className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-all">
                <p className="font-medium text-gray-900 text-sm">{r.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{r.category}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}