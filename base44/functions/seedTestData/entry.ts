import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'seed';

    if (action === 'seed') {
      const existing = await base44.asServiceRole.entities.Project.filter({ name: "Smith Main Floor Renovation" });
      if (existing.length > 0) {
        const project = existing[0];
        const areas = await base44.asServiceRole.entities.ProjectArea.filter({ project_id: project.id });
        const reqs = await base44.asServiceRole.entities.SelectionRequirement.filter({ project_id: project.id, name: "Vanity" });
        const items = await base44.asServiceRole.entities.CatalogueItem.filter({ name: "Shaker Vanity" });
        const vanityItem = items[0];
        const vanityReq = reqs[0];
        const groups = vanityItem ? await base44.asServiceRole.entities.CatalogueOptionGroup.filter({ catalogue_item_id: vanityItem.id }) : [];
        const values = vanityItem ? await base44.asServiceRole.entities.CatalogueOptionValue.filter({ catalogue_item_id: vanityItem.id }) : [];
        return Response.json({
          message: "Test data already exists",
          project_id: project.id,
          areas: areas.reduce((m, a) => { m[a.area_type] = a.id; return m; }, {}),
          vanity_item_id: vanityItem?.id,
          vanity_requirement_id: vanityReq?.id,
          option_groups: groups.reduce((m, g) => { m[g.name] = g.id; return m; }, {}),
          option_values: values.reduce((m, v) => { m[v.name] = v.id; return m; }, {})
        });
      }

      const project = await base44.asServiceRole.entities.Project.create({
        name: "Smith Main Floor Renovation",
        client_name: "John Smith",
        address: "123 Maple Street, Halifax, NS",
        project_type: "Renovation",
        status: "Active",
        total_allowance: 25000,
        pricing_visibility: "show_item_prices",
        allowance_visibility: "show_by_item",
        assigned_staff: [user.id],
        assigned_customers: [user.id],
        customer_notes: "Welcome to your selection portal! Browse and choose your finishes for your main floor renovation.",
        selections_due_date: "2026-08-15"
      });

      const [globalArea, kitchenArea, bathroomArea, livingRoomArea] = await Promise.all([
        base44.asServiceRole.entities.ProjectArea.create({ project_id: project.id, name: "Global", area_type: "Global", display_order: 0 }),
        base44.asServiceRole.entities.ProjectArea.create({ project_id: project.id, name: "Kitchen", area_type: "Kitchen", display_order: 1, allowance: 12000, due_date: "2026-07-30" }),
        base44.asServiceRole.entities.ProjectArea.create({ project_id: project.id, name: "Main Bathroom", area_type: "Main Bathroom", display_order: 2, allowance: 6000, due_date: "2026-07-20" }),
        base44.asServiceRole.entities.ProjectArea.create({ project_id: project.id, name: "Living Room", area_type: "Living Room", display_order: 3 })
      ]);

      const vanityItem = await base44.asServiceRole.entities.CatalogueItem.create({
        name: "Shaker Vanity", category: "Vanity", supplier: "Frontier Cabinetry", brand: "Frontier",
        base_price: 950, unit_of_measure: "each", status: "Active", lead_time: "4-6 weeks",
        description: "Classic shaker-style vanity with soft-close drawers and adjustable shelving.",
        default_image: "https://images.unsplash.com/photo-1620626011761-996317b8d101?w=800"
      });

      const [sizeGroup, colourGroup, drawerGroup, countertopGroup] = await Promise.all([
        base44.asServiceRole.entities.CatalogueOptionGroup.create({ catalogue_item_id: vanityItem.id, name: "Size", display_order: 0, is_required: true }),
        base44.asServiceRole.entities.CatalogueOptionGroup.create({ catalogue_item_id: vanityItem.id, name: "Colour", display_order: 1, is_required: true }),
        base44.asServiceRole.entities.CatalogueOptionGroup.create({ catalogue_item_id: vanityItem.id, name: "Drawer Bank", display_order: 2, is_required: true }),
        base44.asServiceRole.entities.CatalogueOptionGroup.create({ catalogue_item_id: vanityItem.id, name: "Countertop", display_order: 3, is_required: true })
      ]);

      const [size36, size42, size48, colourBlue, colourGreen, colourBlack, colourWhite, drawerLeft, drawerRight, drawerNone, counterLaminate, counterQuartzWhite, counterQuartzGrey] = await Promise.all([
        base44.asServiceRole.entities.CatalogueOptionValue.create({ option_group_id: sizeGroup.id, catalogue_item_id: vanityItem.id, name: "36 inch", display_order: 0 }),
        base44.asServiceRole.entities.CatalogueOptionValue.create({ option_group_id: sizeGroup.id, catalogue_item_id: vanityItem.id, name: "42 inch", display_order: 1 }),
        base44.asServiceRole.entities.CatalogueOptionValue.create({ option_group_id: sizeGroup.id, catalogue_item_id: vanityItem.id, name: "48 inch", display_order: 2 }),
        base44.asServiceRole.entities.CatalogueOptionValue.create({ option_group_id: colourGroup.id, catalogue_item_id: vanityItem.id, name: "Blue", display_order: 0 }),
        base44.asServiceRole.entities.CatalogueOptionValue.create({ option_group_id: colourGroup.id, catalogue_item_id: vanityItem.id, name: "Green", display_order: 1 }),
        base44.asServiceRole.entities.CatalogueOptionValue.create({ option_group_id: colourGroup.id, catalogue_item_id: vanityItem.id, name: "Black", display_order: 2 }),
        base44.asServiceRole.entities.CatalogueOptionValue.create({ option_group_id: colourGroup.id, catalogue_item_id: vanityItem.id, name: "White", display_order: 3 }),
        base44.asServiceRole.entities.CatalogueOptionValue.create({ option_group_id: drawerGroup.id, catalogue_item_id: vanityItem.id, name: "Left", display_order: 0 }),
        base44.asServiceRole.entities.CatalogueOptionValue.create({ option_group_id: drawerGroup.id, catalogue_item_id: vanityItem.id, name: "Right", display_order: 1 }),
        base44.asServiceRole.entities.CatalogueOptionValue.create({ option_group_id: drawerGroup.id, catalogue_item_id: vanityItem.id, name: "None", display_order: 2 }),
        base44.asServiceRole.entities.CatalogueOptionValue.create({ option_group_id: countertopGroup.id, catalogue_item_id: vanityItem.id, name: "Laminate", display_order: 0 }),
        base44.asServiceRole.entities.CatalogueOptionValue.create({ option_group_id: countertopGroup.id, catalogue_item_id: vanityItem.id, name: "Quartz white", display_order: 1, price_modifier: 300 }),
        base44.asServiceRole.entities.CatalogueOptionValue.create({ option_group_id: countertopGroup.id, catalogue_item_id: vanityItem.id, name: "Quartz grey", display_order: 2, price_modifier: 325 })
      ]);

      // Rules: hide options based on size selection
      const rules = [
        // 36 inch: hide black (allows blue, green, white)
        { cond: size36.id, target: colourBlack.id, group: colourGroup.id },
        // 42 inch: hide blue (allows black, green, white)
        { cond: size42.id, target: colourBlue.id, group: colourGroup.id },
        // 48 inch: hide blue, green (allows black, white)
        { cond: size48.id, target: colourBlue.id, group: colourGroup.id },
        { cond: size48.id, target: colourGreen.id, group: colourGroup.id },
        // 36 inch: hide drawer none (allows left, right)
        { cond: size36.id, target: drawerNone.id, group: drawerGroup.id },
        // 42 inch: hide drawer right, none (allows left only)
        { cond: size42.id, target: drawerRight.id, group: drawerGroup.id },
        { cond: size42.id, target: drawerNone.id, group: drawerGroup.id },
        // 48 inch: hide drawer left, right (allows none only)
        { cond: size48.id, target: drawerLeft.id, group: drawerGroup.id },
        { cond: size48.id, target: drawerRight.id, group: drawerGroup.id }
      ];
      await Promise.all(rules.map(r => base44.asServiceRole.entities.CatalogueOptionRule.create({
        catalogue_item_id: vanityItem.id, rule_type: "availability",
        condition_group_id: sizeGroup.id, condition_option_value_id: r.cond,
        target_group_id: r.group, target_option_value_id: r.target,
        action: "hide", is_active: true
      })));

      // Selection requirements
      const vanityReq = await base44.asServiceRole.entities.SelectionRequirement.create({
        project_id: project.id, area_id: bathroomArea.id, name: "Vanity", category: "Vanity",
        is_required: true, allowance_amount: 1200, due_date: "2026-07-15", approval_required: true,
        customer_instructions: "Choose your vanity size, colour, drawer configuration, and countertop."
      });

      const bathReqs = [
        { name: "Floor Tile", category: "Tile", allowance: 800, due: "2026-07-20" },
        { name: "Shower Wall Tile", category: "Tile", allowance: 1000, due: "2026-07-20" },
        { name: "Toilet", category: "Toilet", allowance: 400, due: null },
        { name: "Faucet", category: "Faucet", allowance: 300, due: null },
        { name: "Mirror", category: "Mirror", allowance: 200, due: null },
        { name: "Lighting", category: "Lighting", allowance: 350, due: null },
        { name: "Paint Colour", category: "Paint", allowance: 150, due: null }
      ];
      const kitchenReqs = [
        { name: "Cabinet Style", category: "Cabinet", allowance: 5000, due: "2026-07-30" },
        { name: "Countertop", category: "Countertop", allowance: 3000, due: "2026-07-30" },
        { name: "Backsplash", category: "Tile", allowance: 800, due: null },
        { name: "Sink", category: "Sink", allowance: 500, due: null },
        { name: "Faucet", category: "Faucet", allowance: 400, due: null }
      ];
      const globalReqs = [
        { name: "Interior Doors", category: "Door", allowance: 2000, due: null },
        { name: "Flooring", category: "Flooring", allowance: 3000, due: null },
        { name: "Wall Paint Colour", category: "Paint", allowance: 1000, due: null }
      ];
      const livingReqs = [
        { name: "Flooring", category: "Flooring", allowance: 2000, due: null },
        { name: "Lighting", category: "Lighting", allowance: 500, due: null }
      ];

      const allReqs = [...bathReqs, ...kitchenReqs, ...globalReqs, ...livingReqs].map(r => ({
        project_id: project.id,
        area_id: bathReqs.includes(r) ? bathroomArea.id : kitchenReqs.includes(r) ? kitchenArea.id : globalReqs.includes(r) ? globalArea.id : livingRoomArea.id,
        name: r.name, category: r.category, is_required: true, allowance_amount: r.allowance,
        due_date: r.due, approval_required: true
      }));
      await base44.asServiceRole.entities.SelectionRequirement.bulkCreate(allReqs);

      // Allowance ledger
      await base44.asServiceRole.entities.AllowanceLedger.bulkCreate([
        { project_id: project.id, event_type: "Original Allowance", amount: 25000, running_balance: 25000, description: "Original project allowance", performed_by: "staff" },
        { project_id: project.id, area_id: kitchenArea.id, event_type: "Original Allowance", amount: 12000, running_balance: 12000, description: "Kitchen area allowance", performed_by: "staff" },
        { project_id: project.id, area_id: bathroomArea.id, event_type: "Original Allowance", amount: 6000, running_balance: 6000, description: "Main Bathroom area allowance", performed_by: "staff" },
        { project_id: project.id, area_id: bathroomArea.id, requirement_id: vanityReq.id, event_type: "Original Allowance", amount: 1200, running_balance: 1200, description: "Vanity selection allowance", performed_by: "staff" }
      ]);

      // Mood board items
      await base44.asServiceRole.entities.MoodBoardItem.bulkCreate([
        { project_id: project.id, area_id: bathroomArea.id, image_url: "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800", notes: "Modern blue vanity inspiration", tags: ["Bathroom", "Vanity", "Modern", "Blue"], selection_category: "Vanity", priority: "High" },
        { project_id: project.id, area_id: bathroomArea.id, image_url: "https://images.unsplash.com/photo-1604709237255-2a44c81c0d9c?w=800", notes: "White subway tile shower", tags: ["Bathroom", "Tile", "Clean"], selection_category: "Tile" }
      ]);

      return Response.json({
        message: "Test data seeded successfully",
        project_id: project.id,
        areas: { Global: globalArea.id, Kitchen: kitchenArea.id, "Main Bathroom": bathroomArea.id, "Living Room": livingRoomArea.id },
        vanity_item_id: vanityItem.id,
        vanity_requirement_id: vanityReq.id,
        option_groups: { Size: sizeGroup.id, Colour: colourGroup.id, "Drawer Bank": drawerGroup.id, Countertop: countertopGroup.id },
        option_values: {
          "36 inch": size36.id, "42 inch": size42.id, "48 inch": size48.id,
          Blue: colourBlue.id, Green: colourGreen.id, Black: colourBlack.id, White: colourWhite.id,
          Left: drawerLeft.id, Right: drawerRight.id, None: drawerNone.id,
          Laminate: counterLaminate.id, "Quartz white": counterQuartzWhite.id, "Quartz grey": counterQuartzGrey.id
        }
      });
    }

    if (action === 'clean') {
      const projects = await base44.asServiceRole.entities.Project.filter({ name: "Smith Main Floor Renovation" });
      if (projects.length === 0) return Response.json({ message: "No test data found" });
      const projectId = projects[0].id;

      const [areas, reqs, items, ledger, moodboard, crs, procs, sels] = await Promise.all([
        base44.asServiceRole.entities.ProjectArea.filter({ project_id: projectId }),
        base44.asServiceRole.entities.SelectionRequirement.filter({ project_id: projectId }),
        base44.asServiceRole.entities.CatalogueItem.filter({ name: "Shaker Vanity" }),
        base44.asServiceRole.entities.AllowanceLedger.filter({ project_id: projectId }),
        base44.asServiceRole.entities.MoodBoardItem.filter({ project_id: projectId }),
        base44.asServiceRole.entities.ChangeRequest.filter({ project_id: projectId }),
        base44.asServiceRole.entities.ProcurementItem.filter({ project_id: projectId }),
        base44.asServiceRole.entities.CustomerSelection.filter({ project_id: projectId })
      ]);

      for (const s of sels) await base44.asServiceRole.entities.CustomerSelection.delete(s.id);
      for (const c of crs) await base44.asServiceRole.entities.ChangeRequest.delete(c.id);
      for (const p of procs) await base44.asServiceRole.entities.ProcurementItem.delete(p.id);
      for (const r of reqs) await base44.asServiceRole.entities.SelectionRequirement.delete(r.id);
      for (const item of items) {
        const [groups, values, rules] = await Promise.all([
          base44.asServiceRole.entities.CatalogueOptionGroup.filter({ catalogue_item_id: item.id }),
          base44.asServiceRole.entities.CatalogueOptionValue.filter({ catalogue_item_id: item.id }),
          base44.asServiceRole.entities.CatalogueOptionRule.filter({ catalogue_item_id: item.id })
        ]);
        for (const v of values) await base44.asServiceRole.entities.CatalogueOptionValue.delete(v.id);
        for (const g of groups) await base44.asServiceRole.entities.CatalogueOptionGroup.delete(g.id);
        for (const r of rules) await base44.asServiceRole.entities.CatalogueOptionRule.delete(r.id);
        await base44.asServiceRole.entities.CatalogueItem.delete(item.id);
      }
      for (const e of ledger) await base44.asServiceRole.entities.AllowanceLedger.delete(e.id);
      for (const m of moodboard) await base44.asServiceRole.entities.MoodBoardItem.delete(m.id);
      for (const a of areas) await base44.asServiceRole.entities.ProjectArea.delete(a.id);
      await base44.asServiceRole.entities.Project.delete(projectId);
      return Response.json({ message: "Test data cleaned" });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});