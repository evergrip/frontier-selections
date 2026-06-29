import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { feature_id, change_notes } = body;
    if (!feature_id) return Response.json({ error: 'feature_id required' }, { status: 400 });

    const now = new Date().toISOString();
    const feature = await base44.asServiceRole.entities.FeatureRegistry.get(feature_id).catch(() => null);
    if (!feature) return Response.json({ error: 'Feature not found' }, { status: 404 });

    // Update the feature's change tracking
    await base44.asServiceRole.entities.FeatureRegistry.update(feature_id, {
      last_changed_date: now,
      change_notes: change_notes || feature.change_notes || 'Feature updated'
    });

    let flaggedTutorials = 0;
    let flaggedArticles = 0;

    // Flag linked tutorials for review
    if (feature.related_tutorial_ids && feature.related_tutorial_ids.length > 0) {
      for (const tid of feature.related_tutorial_ids) {
        await base44.asServiceRole.entities.Tutorial.update(tid, {
          review_status: 'Needs Review',
          status: 'Needs Review',
          review_reason: `Linked feature "${feature.name}" was updated: ${change_notes || 'feature change'}`,
          last_feature_change_date: now
        });
        flaggedTutorials++;
      }
    }

    // Flag linked help articles for review
    if (feature.related_article_ids && feature.related_article_ids.length > 0) {
      for (const aid of feature.related_article_ids) {
        await base44.asServiceRole.entities.HelpArticle.update(aid, {
          review_status: 'Needs Review',
          status: 'Needs Review',
          review_reason: `Linked feature "${feature.name}" was updated: ${change_notes || 'feature change'}`,
          last_feature_change_date: now
        });
        flaggedArticles++;
      }
    }

    return Response.json({
      message: 'Feature change processed',
      feature: feature.name,
      flaggedTutorials,
      flaggedArticles
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});