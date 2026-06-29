import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'staff') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'create';

    if (action === 'clean') {
      const projects = await base44.asServiceRole.entities.Project.filter({});
      const trainingProjects = projects.filter(p => p.name && p.name.startsWith('TRAINING:'));
      let deleted = 0;
      for (const p of trainingProjects) {
        const areas = await base44.asServiceRole.entities.ProjectArea.filter({ project_id: p.id });
        const reqs = await base44.asServiceRole.entities.SelectionRequirement.filter({ project_id: p.id });
        const sels = await base44.asServiceRole.entities.CustomerSelection.filter({ project_id: p.id });
        const proc = await base44.asServiceRole.entities.ProcurementItem.filter({ project_id: p.id });
        const crs = await base44.asServiceRole.entities.ChangeRequest.filter({ project_id: p.id });
        const ledger = await base44.asServiceRole.entities.AllowanceLedger.filter({ project_id: p.id });
        for (const s of sels) await base44.asServiceRole.entities.CustomerSelection.delete(s.id).catch(() => {});
        for (const r of proc) await base44.asServiceRole.entities.ProcurementItem.delete(r.id).catch(() => {});
        for (const c of crs) await base44.asServiceRole.entities.ChangeRequest.delete(c.id).catch(() => {});
        for (const l of ledger) await base44.asServiceRole.entities.AllowanceLedger.delete(l.id).catch(() => {});
        for (const r of reqs) await base44.asServiceRole.entities.SelectionRequirement.delete(r.id).catch(() => {});
        for (const a of areas) await base44.asServiceRole.entities.ProjectArea.delete(a.id).catch(() => {});
        await base44.asServiceRole.entities.Project.delete(p.id).catch(() => {});
        deleted++;
      }
      return Response.json({ message: `Deleted ${deleted} training project(s)`, deleted });
    }

    // Create practice data
    const existing = await base44.asServiceRole.entities.Project.filter({});
    const existingTraining = existing.find(p => p.name && p.name.startsWith('TRAINING:') && (p.assigned_staff || []).includes(user.id));
    if (existingTraining) {
      return Response.json({ message: 'Practice project already exists', project_id: existingTraining.id });
    }

    const project = await base44.asServiceRole.entities.Project.create({
      name: `TRAINING: Practice Project - ${user.full_name || user.email}`,
      client_name: 'Practice Customer (Training)',
      address: '123 Training Street, Halifax, NS',
      project_type: 'Renovation',
      status: 'Active',
      total_allowance: 25000,
      pricing_visibility: 'show_item_prices',
      allowance_visibility: 'show_by_item',
      assigned_staff: [user.id],
      assigned_customers: [user.id],
      customer_notes: 'This is a TRAINING project for practice. All data here is sample data and does not affect real projects.',
      selections_due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    });

    const [kitchenArea, bathroomArea, globalArea] = await Promise.all([
      base44.asServiceRole.entities.ProjectArea.create({ project_id: project.id, name: 'Kitchen', area_type: 'Kitchen', display_order: 1, allowance: 12000, due_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10) }),
      base44.asServiceRole.entities.ProjectArea.create({ project_id: project.id, name: 'Main Bathroom', area_type: 'Main Bathroom', display_order: 2, allowance: 6000, due_date: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10) }),
      base44.asServiceRole.entities.ProjectArea.create({ project_id: project.id, name: 'Global', area_type: 'Global', display_order: 0, allowance: 7000 })
    ]);

    // Sample catalogue items
    const vanityItem = await base44.asServiceRole.entities.CatalogueItem.create({
      name: 'TRAINING: Shaker Vanity', category: 'Vanity', supplier: 'Frontier Cabinetry', brand: 'Frontier',
      base_price: 950, unit_of_measure: 'each', status: 'Active', lead_time: '4-6 weeks',
      description: 'Classic shaker-style vanity with soft-close drawers.',
      default_image: 'https://images.unsplash.com/photo-1fee3dfb83d4-4c2c-9c8e-9a9b1f1a1a1a?w=400',
      tags: ['training']
    });
    const tileItem = await base44.asServiceRole.entities.CatalogueItem.create({
      name: 'TRAINING: Subway Tile', category: 'Tile', supplier: 'Frontier Tile', brand: 'Frontier',
      base_price: 12, unit_of_measure: 'sq ft', status: 'Active',
      description: 'Classic white subway tile for walls and backsplashes.',
      tags: ['training']
    });

    // Option groups for vanity
    const sizeGroup = await base44.asServiceRole.entities.CatalogueOptionGroup.create({ catalogue_item_id: vanityItem.id, name: 'Size', display_order: 0, is_required: true });
    const colourGroup = await base44.asServiceRole.entities.CatalogueOptionGroup.create({ catalogue_item_id: vanityItem.id, name: 'Colour', display_order: 1, is_required: true });
    await base44.asServiceRole.entities.CatalogueOptionValue.bulkCreate([
      { option_group_id: sizeGroup.id, catalogue_item_id: vanityItem.id, name: '30 inch', price_modifier: 0, display_order: 0 },
      { option_group_id: sizeGroup.id, catalogue_item_id: vanityItem.id, name: '36 inch', price_modifier: 150, display_order: 1 },
      { option_group_id: sizeGroup.id, catalogue_item_id: vanityItem.id, name: '48 inch', price_modifier: 350, display_order: 2 },
      { option_group_id: colourGroup.id, catalogue_item_id: vanityItem.id, name: 'White', price_modifier: 0, display_order: 0 },
      { option_group_id: colourGroup.id, catalogue_item_id: vanityItem.id, name: 'Grey', price_modifier: 75, display_order: 1 },
      { option_group_id: colourGroup.id, catalogue_item_id: vanityItem.id, name: 'Espresso', price_modifier: 100, display_order: 2 }
    ]);

    // Selection requirements
    const vanityReq = await base44.asServiceRole.entities.SelectionRequirement.create({
      project_id: project.id, area_id: bathroomArea.id, name: 'Vanity', category: 'Vanity',
      is_required: true, allowance_amount: 1200, approval_required: true, status: 'Not Started'
    });
    const tileReq = await base44.asServiceRole.entities.SelectionRequirement.create({
      project_id: project.id, area_id: bathroomArea.id, name: 'Shower Wall Tile', category: 'Tile',
      is_required: true, allowance_amount: 800, approval_required: true, status: 'Not Started'
    });
    const flooringReq = await base44.asServiceRole.entities.SelectionRequirement.create({
      project_id: project.id, area_id: kitchenArea.id, name: 'Flooring', category: 'Flooring',
      is_required: true, allowance_amount: 3000, approval_required: true, status: 'Not Started'
    });

    // Sample pending selection
    const pendingSel = await base44.asServiceRole.entities.CustomerSelection.create({
      project_id: project.id, area_id: bathroomArea.id, requirement_id: vanityReq.id,
      catalogue_item_id: vanityItem.id,
      selected_options: [
        { group_id: sizeGroup.id, group_name: 'Size', option_id: '', option_name: '36 inch', price_modifier: 150 },
        { group_id: colourGroup.id, group_name: 'Colour', option_id: '', option_name: 'White', price_modifier: 0 }
      ],
      calculated_price: 1100, allowance_amount: 1200, over_allowance: 0, under_allowance: 100,
      status: 'Pending', submitted_date: new Date().toISOString(), version: 1, is_current: true
    });

    // Sample approved selection + procurement
    const approvedSel = await base44.asServiceRole.entities.CustomerSelection.create({
      project_id: project.id, area_id: bathroomArea.id, requirement_id: tileReq.id,
      catalogue_item_id: tileItem.id, selected_options: [],
      calculated_price: 750, allowance_amount: 800, over_allowance: 0, under_allowance: 50,
      status: 'Approved', submitted_date: new Date().toISOString(), reviewed_date: new Date().toISOString(),
      reviewed_by: 'Training Staff', version: 1, is_current: true
    });
    await base44.asServiceRole.entities.ProcurementItem.create({
      project_id: project.id, area_id: bathroomArea.id, requirement_id: tileReq.id, selection_id: approvedSel.id,
      catalogue_item_id: tileItem.id, item_name: 'TRAINING: Subway Tile', category: 'Tile',
      supplier: 'Frontier Tile', quantity: 62, unit_of_measure: 'sq ft', status: 'Ready to Order'
    });

    // Sample change request
    await base44.asServiceRole.entities.ChangeRequest.create({
      project_id: project.id, area_id: bathroomArea.id, selection_id: approvedSel.id, requirement_id: tileReq.id,
      original_item_name: 'TRAINING: Subway Tile', original_price: 750,
      requested_item_name: 'TRAINING: Marble Mosaic Tile', requested_price: 1200,
      reason: 'Customer would prefer a marble mosaic for the shower walls.',
      price_impact: 450, allowance_impact: -400, status: 'Requested'
    });

    // Allowance ledger
    await base44.asServiceRole.entities.AllowanceLedger.create({
      project_id: project.id, area_id: bathroomArea.id, requirement_id: tileReq.id,
      event_type: 'Original Allowance', amount: 800, running_balance: 800,
      description: 'Original allowance for shower wall tile', performed_by: 'Training'
    });

    return Response.json({
      message: 'Practice project created successfully',
      project_id: project.id,
      project_name: project.name
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});