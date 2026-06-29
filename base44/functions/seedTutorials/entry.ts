import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const existing = await base44.asServiceRole.entities.Tutorial.list();
    if (existing.length > 0) return Response.json({ message: 'Tutorials already seeded', count: existing.length });

    const now = new Date().toISOString();
    const ROLES = ['Admin / Operations Manager', 'Project Coordinator', 'Sales / Pre-Construction', 'Project Manager / Construction Team', 'Catalogue Manager'];

    // 1. Feature Registry
    const features = await base44.asServiceRole.entities.FeatureRegistry.bulkCreate([
      { name: 'Project Management', module: 'Projects', description: 'Creating and managing construction projects', related_pages: ['/projects', '/projects/:id'], related_entities: ['Project', 'ProjectArea'], related_roles: ROLES, status: 'Active', feature_version: '1.0', last_changed_date: now },
      { name: 'Room Templates', module: 'Templates', description: 'Reusable room/area selection templates', related_pages: ['/templates'], related_entities: ['RoomTemplate'], related_roles: ['Admin / Operations Manager', 'Project Coordinator'], status: 'Active', feature_version: '1.0', last_changed_date: now },
      { name: 'Catalogue Management', module: 'Catalogue', description: 'Creating and managing catalogue items', related_pages: ['/catalogue', '/catalogue/:id'], related_entities: ['CatalogueItem', 'CatalogueOptionGroup', 'CatalogueOptionValue', 'CatalogueOptionRule'], related_roles: ['Catalogue Manager', 'Admin / Operations Manager'], status: 'Active', feature_version: '1.0', last_changed_date: now },
      { name: 'Selection Requirements', module: 'Selections', description: 'Defining what customers need to select per area', related_pages: ['/projects/:id/area/:aid/requirement/:rid'], related_entities: ['SelectionRequirement', 'AttachmentRequirement', 'SelectionDependency'], related_roles: ['Project Coordinator', 'Admin / Operations Manager'], status: 'Active', feature_version: '1.0', last_changed_date: now },
      { name: 'Customer Portal', module: 'Portal', description: 'Customer-facing selection portal', related_pages: ['/portal', '/portal/project/:id'], related_entities: ['CustomerSelection', 'Project'], related_roles: ['Project Coordinator', 'Sales / Pre-Construction'], status: 'Active', feature_version: '1.0', last_changed_date: now },
      { name: 'Allowances', module: 'Finance', description: 'Allowance tracking and overage calculations', related_pages: ['/projects/:id'], related_entities: ['AllowanceLedger', 'SelectionRequirement'], related_roles: ['Project Coordinator', 'Admin / Operations Manager', 'Sales / Pre-Construction'], status: 'Active', feature_version: '1.0', last_changed_date: now },
      { name: 'Approval Workflow', module: 'Selections', description: 'Reviewing and approving customer selections', related_pages: ['/projects/:id/area/:aid/requirement/:rid'], related_entities: ['CustomerSelection', 'AuditLog'], related_roles: ['Project Coordinator', 'Admin / Operations Manager'], status: 'Active', feature_version: '1.0', last_changed_date: now },
      { name: 'Change Requests', module: 'Change Requests', description: 'Customer-initiated change requests after approval', related_pages: ['/change-requests', '/change-requests/:id'], related_entities: ['ChangeRequest'], related_roles: ['Project Coordinator', 'Project Manager / Construction Team'], status: 'Active', feature_version: '1.0', last_changed_date: now },
      { name: 'Procurement', module: 'Procurement', description: 'Ordering, receiving, and delivering items', related_pages: ['/procurement', '/procurement/:id', '/supplier-orders'], related_entities: ['ProcurementItem'], related_roles: ['Project Coordinator', 'Project Manager / Construction Team'], status: 'Active', feature_version: '1.0', last_changed_date: now },
      { name: 'Mood Board', module: 'Mood Board', description: 'Customer inspiration and mood board management', related_pages: ['/mood-board', '/portal/mood-board'], related_entities: ['MoodBoardItem'], related_roles: ['Sales / Pre-Construction', 'Project Coordinator'], status: 'Active', feature_version: '1.0', last_changed_date: now },
      { name: 'Reports', module: 'Reports', description: 'Project and selection reporting', related_pages: ['/reports'], related_entities: ['Project', 'CustomerSelection', 'ProcurementItem'], related_roles: ['Admin / Operations Manager', 'Project Manager / Construction Team'], status: 'Active', feature_version: '1.0', last_changed_date: now },
      { name: 'Final Selections Package', module: 'Final Package', description: 'Customer-facing and internal final packages', related_pages: ['/final-package', '/portal/project/:id/final-package'], related_entities: ['CustomerSelection', 'ProcurementItem'], related_roles: ['Project Coordinator', 'Project Manager / Construction Team'], status: 'Active', feature_version: '1.0', last_changed_date: now },
      { name: 'Security and Permissions', module: 'Security', description: 'Role-based access, pricing visibility, and data protection', related_pages: [], related_entities: ['User', 'Project'], related_roles: ['Admin / Operations Manager'], status: 'Active', feature_version: '1.0', last_changed_date: now }
    ]);

    const featureMap = {};
    features.forEach(f => featureMap[f.name] = f.id);

    // 2. Tutorials
    const tutorials = await base44.asServiceRole.entities.Tutorial.bulkCreate([
      {
        title: 'Frontier Selections Overview', description: 'Get a high-level tour of the entire platform and how selections flow from customer to construction.', category: 'Getting Started',
        applies_to_roles: ROLES, estimated_minutes: 5, target_page: '/',
        steps: [
          { title: 'Welcome', instruction: 'Frontier Selections manages the entire material selection lifecycle: from project setup through customer selections, approvals, procurement, and final packages.', target_element: '', completion_trigger: 'Read the overview' },
          { title: 'Staff Dashboard', instruction: 'The staff dashboard shows pending approvals, overdue items, and procurement status at a glance.', target_element: '[data-nav="dashboard"]', completion_trigger: 'Visit the dashboard' },
          { title: 'Projects', instruction: 'Projects contain areas (rooms), each with selection requirements that customers complete.', target_element: '[data-nav="projects"]', completion_trigger: 'Browse projects' },
          { title: 'Catalogue', instruction: 'The catalogue holds configurable items with option groups, values, and conditional rules.', target_element: '[data-nav="catalogue"]', completion_trigger: 'Browse the catalogue' },
          { title: 'Workflow', instruction: 'The core workflow: Create project → Add areas → Set requirements/allowances → Customer selects → Staff reviews → Approve → Procurement → Final package.', target_element: '', completion_trigger: 'Understand the workflow' }
        ],
        status: 'Published', review_status: 'Current', required: true, author: 'System', last_updated: now, app_version: '1.0', display_order: 1,
        feature_ids: [featureMap['Project Management'], featureMap['Customer Portal']]
      },
      {
        title: 'Create a Project', description: 'Learn how to create a new construction project and set its basic details.', category: 'Projects',
        applies_to_roles: ['Admin / Operations Manager', 'Project Coordinator', 'Sales / Pre-Construction'], estimated_minutes: 4, target_page: '/projects',
        steps: [
          { title: 'Open Projects', instruction: 'Navigate to the Projects page from the sidebar.', target_element: '[data-nav="projects"]', completion_trigger: 'Click Projects in the sidebar' },
          { title: 'New Project', instruction: 'Click the "New Project" button to open the project creation form.', target_element: 'button:has-text("New Project")', completion_trigger: 'Click New Project' },
          { title: 'Fill Details', instruction: 'Enter the project name, client name, address, project type, and key dates (start, target completion, selections due).', target_element: '', completion_trigger: 'Fill in the form fields' },
          { title: 'Set Pricing Visibility', instruction: 'Choose what pricing information customers will see: hidden, item prices, total allowance, or remaining only.', target_element: '', completion_trigger: 'Select pricing visibility' },
          { title: 'Save', instruction: 'Click Save to create the project. It will appear in the projects list with status "Draft".', target_element: 'button[type="submit"]', completion_trigger: 'Click Save' }
        ],
        status: 'Published', review_status: 'Current', required: true, author: 'System', last_updated: now, app_version: '1.0', display_order: 2,
        feature_ids: [featureMap['Project Management']]
      },
      {
        title: 'Add Rooms and Apply Templates', description: 'Add areas/rooms to a project and apply room templates to auto-generate selection requirements.', category: 'Rooms and Areas',
        applies_to_roles: ['Admin / Operations Manager', 'Project Coordinator'], estimated_minutes: 5, target_page: '/projects/:projectId',
        steps: [
          { title: 'Open Project', instruction: 'Open the project you want to add rooms to.', target_element: '', completion_trigger: 'Open a project' },
          { title: 'Add Area', instruction: 'In the Areas tab, click "Add Area" to create a new room or zone.', target_element: 'button:has-text("Add Area")', completion_trigger: 'Click Add Area' },
          { title: 'Choose Template', instruction: 'Select a room template (e.g., Main Bathroom, Kitchen) to auto-populate selection requirements, or choose "Custom" to add requirements manually.', target_element: '', completion_trigger: 'Select a template' },
          { title: 'Set Allowance', instruction: 'Optionally set an area-level allowance that applies across all requirements in that area.', target_element: '', completion_trigger: 'Set area allowance' },
          { title: 'Save', instruction: 'Save the area. It will appear in the project area list with its requirements.', target_element: 'button[type="submit"]', completion_trigger: 'Click Save' }
        ],
        status: 'Published', review_status: 'Current', required: true, author: 'System', last_updated: now, app_version: '1.0', display_order: 3,
        feature_ids: [featureMap['Project Management'], featureMap['Room Templates']]
      },
      {
        title: 'Invite a Customer', description: 'Invite a customer to a project so they can access the portal and make selections.', category: 'Customers',
        applies_to_roles: ['Admin / Operations Manager', 'Project Coordinator'], estimated_minutes: 3, target_page: '/projects/:projectId',
        steps: [
          { title: 'Open Project', instruction: 'Open the project you want to invite a customer to.', target_element: '', completion_trigger: 'Open a project' },
          { title: 'Project Details', instruction: 'Go to the Project Details tab and find the "Assigned Customers" section.', target_element: '', completion_trigger: 'Navigate to Project Details' },
          { title: 'Invite', instruction: 'Enter the customer\'s email and click Invite. The customer will receive an email with a link to register and access the portal.', target_element: '', completion_trigger: 'Click Invite' },
          { title: 'Confirm Assignment', instruction: 'The customer will appear in the assigned customers list. They can now log in and see this project in their portal.', target_element: '', completion_trigger: 'Verify customer is assigned' }
        ],
        status: 'Published', review_status: 'Current', required: true, author: 'System', last_updated: now, app_version: '1.0', display_order: 4,
        feature_ids: [featureMap['Customer Portal']]
      },
      {
        title: 'Set Allowances', description: 'Understand how allowances work at the project, area, and requirement level, and how overages are calculated.', category: 'Allowances',
        applies_to_roles: ['Admin / Operations Manager', 'Project Coordinator', 'Sales / Pre-Construction'], estimated_minutes: 5, target_page: '/projects/:projectId',
        steps: [
          { title: 'Allowance Hierarchy', instruction: 'Allowances can be set at three levels: Project (total), Area (per room), and Requirement (per selection). The most specific one applies.', target_element: '', completion_trigger: 'Understand the hierarchy' },
          { title: 'Project Allowance', instruction: 'Set a total project allowance in the Project Details tab. This is the overall budget for all selections.', target_element: '', completion_trigger: 'Set project allowance' },
          { title: 'Area Allowance', instruction: 'Set an area allowance when creating or editing an area. This allocates a portion of the budget to that room.', target_element: '', completion_trigger: 'Set area allowance' },
          { title: 'Requirement Allowance', instruction: 'Set a per-requirement allowance when editing a selection requirement. This is the budget for that specific item.', target_element: '', completion_trigger: 'Set requirement allowance' },
          { title: 'Overages', instruction: 'When a customer selects an item priced above the allowance, the overage is calculated automatically. Overages are visible to staff and optionally to customers based on pricing visibility settings.', target_element: '', completion_trigger: 'Understand overages' }
        ],
        status: 'Published', review_status: 'Current', required: true, author: 'System', last_updated: now, app_version: '1.0', display_order: 5,
        feature_ids: [featureMap['Allowances']]
      },
      {
        title: 'Review and Approve Customer Selections', description: 'Learn how to review customer submissions, adjust prices, and approve or reject selections.', category: 'Approvals',
        applies_to_roles: ['Admin / Operations Manager', 'Project Coordinator'], estimated_minutes: 6, target_page: '/projects/:projectId/area/:areaId/requirement/:requirementId',
        steps: [
          { title: 'Open Requirement', instruction: 'Navigate to a requirement that has a customer submission pending review.', target_element: '', completion_trigger: 'Open a pending requirement' },
          { title: 'Review Selection', instruction: 'Review the customer\'s selected item, chosen options, and calculated price. Check for any warnings or dependency issues.', target_element: '', completion_trigger: 'Review the selection details' },
          { title: 'Price Override', instruction: 'If needed, enter a staff price override to adjust the final price. This is useful for negotiated pricing or corrections.', target_element: '', completion_trigger: 'Optionally set a price override' },
          { title: 'Approve', instruction: 'Click Approve to accept the selection. This creates a procurement item and records an entry in the allowance ledger.', target_element: 'button:has-text("Approve")', completion_trigger: 'Click Approve' },
          { title: 'Request Revision', instruction: 'If changes are needed, click Request Revision and add comments explaining what the customer should change.', target_element: 'button:has-text("Revision")', completion_trigger: 'Optionally request a revision' }
        ],
        status: 'Published', review_status: 'Current', required: true, author: 'System', last_updated: now, app_version: '1.0', display_order: 6,
        feature_ids: [featureMap['Approval Workflow']]
      },
      {
        title: 'Handle Change Requests', description: 'Process customer change requests after a selection has been approved.', category: 'Change Requests',
        applies_to_roles: ['Admin / Operations Manager', 'Project Coordinator', 'Project Manager / Construction Team'], estimated_minutes: 5, target_page: '/change-requests',
        steps: [
          { title: 'View Change Requests', instruction: 'Navigate to the Change Requests page to see all requests across projects.', target_element: '[data-nav="change-requests"]', completion_trigger: 'Open Change Requests' },
          { title: 'Open Request', instruction: 'Click a change request to see the original item, the requested item, price impact, and customer reason.', target_element: '', completion_trigger: 'Open a change request' },
          { title: 'Review Impact', instruction: 'Check the price impact and allowance impact. If the requested item costs more, the customer may need to pay the difference.', target_element: '', completion_trigger: 'Review the impact' },
          { title: 'Approve or Reject', instruction: 'Approve the change to update the selection and procurement item, or reject with a staff response explaining why.', target_element: '', completion_trigger: 'Approve or reject the request' }
        ],
        status: 'Published', review_status: 'Current', required: true, author: 'System', last_updated: now, app_version: '1.0', display_order: 7,
        feature_ids: [featureMap['Change Requests']]
      },
      {
        title: 'Create a Catalogue Item', description: 'Add a new product to the catalogue with images, specs, and pricing.', category: 'Catalogue',
        applies_to_roles: ['Catalogue Manager', 'Admin / Operations Manager'], estimated_minutes: 4, target_page: '/catalogue',
        steps: [
          { title: 'Open Catalogue', instruction: 'Navigate to the Catalogue page from the sidebar.', target_element: '[data-nav="catalogue"]', completion_trigger: 'Click Catalogue' },
          { title: 'New Item', instruction: 'Click "New Item" to open the catalogue item editor.', target_element: 'button:has-text("New Item")', completion_trigger: 'Click New Item' },
          { title: 'Basic Details', instruction: 'Enter the item name, category, supplier, brand, SKU, base price, and unit of measure.', target_element: '', completion_trigger: 'Fill in basic details' },
          { title: 'Images', instruction: 'Upload a default image and optional gallery images. These are shown to customers in the selection portal.', target_element: '', completion_trigger: 'Upload images' },
          { title: 'Spec Sheet', instruction: 'Optionally upload a spec sheet PDF and add a supplier link for reference.', target_element: '', completion_trigger: 'Upload spec sheet' },
          { title: 'Save', instruction: 'Click Save to create the item. It will be visible in the catalogue with status "Active".', target_element: 'button[type="submit"]', completion_trigger: 'Click Save' }
        ],
        status: 'Published', review_status: 'Current', required: true, author: 'System', last_updated: now, app_version: '1.0', display_order: 8,
        feature_ids: [featureMap['Catalogue Management']]
      },
      {
        title: 'Build a Configurable Catalogue Item', description: 'Add option groups and values to make a catalogue item configurable (e.g., sizes, colours, finishes).', category: 'Product Configurator',
        applies_to_roles: ['Catalogue Manager', 'Admin / Operations Manager'], estimated_minutes: 7, target_page: '/catalogue/:itemId',
        steps: [
          { title: 'Open Item', instruction: 'Open a catalogue item in the editor.', target_element: '', completion_trigger: 'Open a catalogue item' },
          { title: 'Add Option Group', instruction: 'In the Option Groups section, click "Add Group" and name it (e.g., "Size", "Colour", "Finish").', target_element: 'button:has-text("Add Group")', completion_trigger: 'Click Add Group' },
          { title: 'Set Required', instruction: 'Mark whether the group is required (customer must choose) or optional.', target_element: '', completion_trigger: 'Set required flag' },
          { title: 'Add Option Values', instruction: 'For each group, add option values (e.g., "36 inch", "48 inch"). Each value can have a price modifier, image, and SKU.', target_element: '', completion_trigger: 'Add option values' },
          { title: 'Price Modifiers', instruction: 'Set price modifiers for options that cost more or less than the base price. The customer\'s total is calculated as base price + sum of selected modifiers.', target_element: '', completion_trigger: 'Set price modifiers' },
          { title: 'Save', instruction: 'Save the item. Customers will now see the configurable options when selecting this item.', target_element: 'button[type="submit"]', completion_trigger: 'Click Save' }
        ],
        status: 'Published', review_status: 'Current', required: true, author: 'System', last_updated: now, app_version: '1.0', display_order: 9,
        feature_ids: [featureMap['Catalogue Management']]
      },
      {
        title: 'Use Conditional Option Rules', description: 'Create rules that show, hide, or require approval for certain option combinations.', category: 'Product Configurator',
        applies_to_roles: ['Catalogue Manager', 'Admin / Operations Manager'], estimated_minutes: 6, target_page: '/catalogue/:itemId',
        steps: [
          { title: 'Open Rules', instruction: 'In the catalogue item editor, find the Option Rules section.', target_element: '', completion_trigger: 'Navigate to Option Rules' },
          { title: 'Create Rule', instruction: 'Click "Add Rule" to create a new conditional rule.', target_element: 'button:has-text("Add Rule")', completion_trigger: 'Click Add Rule' },
          { title: 'Set Condition', instruction: 'Choose a condition group and option value that triggers the rule (e.g., "When Size = 36 inch").', target_element: '', completion_trigger: 'Set the condition' },
          { title: 'Set Action', instruction: 'Choose the action: show/hide a target option, set a price, add a warning, or require approval.', target_element: '', completion_trigger: 'Set the action' },
          { title: 'Save', instruction: 'Save the rule. It will be applied in real-time when customers configure the item.', target_element: 'button[type="submit"]', completion_trigger: 'Click Save' }
        ],
        status: 'Published', review_status: 'Current', required: false, author: 'System', last_updated: now, app_version: '1.0', display_order: 10,
        feature_ids: [featureMap['Catalogue Management']]
      },
      {
        title: 'Track Procurement', description: 'Monitor the ordering, receiving, and delivery lifecycle of approved selections.', category: 'Procurement',
        applies_to_roles: ['Project Coordinator', 'Project Manager / Construction Team'], estimated_minutes: 5, target_page: '/procurement',
        steps: [
          { title: 'Open Procurement', instruction: 'Navigate to the Procurement page from the sidebar.', target_element: '[data-nav="procurement"]', completion_trigger: 'Click Procurement' },
          { title: 'View Items', instruction: 'The list shows all procurement items with their current status: Not Ready to Order, Ready to Order, Ordered, Received, Delivered, Installed.', target_element: '', completion_trigger: 'Browse procurement items' },
          { title: 'Update Status', instruction: 'Click an item to update its status. Enter the purchase order number, order date, and expected delivery date when ordering.', target_element: '', completion_trigger: 'Open a procurement item' },
          { title: 'Track Delivery', instruction: 'Update the actual received date and delivered-to-site date as items arrive. Mark items as Installed once they\'re placed.', target_element: '', completion_trigger: 'Update delivery status' },
          { title: 'Supplier Orders', instruction: 'Use the Supplier Orders page to group items by supplier for bulk ordering.', target_element: '[data-nav="supplier-orders"]', completion_trigger: 'Visit Supplier Orders' }
        ],
        status: 'Published', review_status: 'Current', required: true, author: 'System', last_updated: now, app_version: '1.0', display_order: 11,
        feature_ids: [featureMap['Procurement']]
      },
      {
        title: 'Generate Final Selections Packages', description: 'Create customer-facing and internal final packages summarizing all approved selections.', category: 'Final Selections Packages',
        applies_to_roles: ['Project Coordinator', 'Project Manager / Construction Team'], estimated_minutes: 4, target_page: '/final-package',
        steps: [
          { title: 'Open Final Package', instruction: 'Navigate to the Final Package page from the sidebar.', target_element: '[data-nav="final-package"]', completion_trigger: 'Click Final Package' },
          { title: 'Select Project', instruction: 'Choose a project to generate the package for.', target_element: '', completion_trigger: 'Select a project' },
          { title: 'Customer View', instruction: 'The customer-facing view shows approved selections with images and customer-visible notes. Internal data (costs, staff notes) is hidden.', target_element: '', completion_trigger: 'Review customer view' },
          { title: 'Internal View', instruction: 'The internal view includes procurement status, staff notes, and allowance details for the construction team.', target_element: '', completion_trigger: 'Review internal view' },
          { title: 'Share', instruction: 'Use the Share button to send the package link to the customer or construction team.', target_element: '', completion_trigger: 'Share the package' }
        ],
        status: 'Published', review_status: 'Current', required: true, author: 'System', last_updated: now, app_version: '1.0', display_order: 12,
        feature_ids: [featureMap['Final Selections Package']]
      },
      {
        title: 'Use the Mood Board', description: 'Help customers collect inspiration and link mood board items to selection requirements.', category: 'Mood Board',
        applies_to_roles: ['Sales / Pre-Construction', 'Project Coordinator'], estimated_minutes: 4, target_page: '/mood-board',
        steps: [
          { title: 'Open Mood Board', instruction: 'Navigate to the Mood Board page from the sidebar.', target_element: '[data-nav="mood-board"]', completion_trigger: 'Click Mood Board' },
          { title: 'Add Inspiration', instruction: 'Click "Add Inspiration" to upload an image, add a link, tag it by room/style, and add notes.', target_element: 'button:has-text("Add Inspiration")', completion_trigger: 'Click Add Inspiration' },
          { title: 'Filter', instruction: 'Filter mood board items by room, tag, or favourite status to organize inspiration.', target_element: '', completion_trigger: 'Use filters' },
          { title: 'Link to Requirement', instruction: 'Link a mood board item to a selection requirement to give staff context on the customer\'s style preferences.', target_element: '', completion_trigger: 'Link an item to a requirement' }
        ],
        status: 'Published', review_status: 'Current', required: false, author: 'System', last_updated: now, app_version: '1.0', display_order: 13,
        feature_ids: [featureMap['Mood Board']]
      },
      {
        title: 'Reports Overview', description: 'Understand the available reports and how to use them for different audiences.', category: 'Reports',
        applies_to_roles: ['Admin / Operations Manager', 'Project Manager / Construction Team'], estimated_minutes: 4, target_page: '/reports',
        steps: [
          { title: 'Open Reports', instruction: 'Navigate to the Reports page from the sidebar.', target_element: '[data-nav="reports"]', completion_trigger: 'Click Reports' },
          { title: 'Project Summary', instruction: 'The project summary report shows selection progress, allowance usage, and overage totals per project.', target_element: '', completion_trigger: 'Review project summary' },
          { title: 'Procurement Report', instruction: 'The procurement report shows order status, delivery dates, and items needing attention — useful for the construction team.', target_element: '', completion_trigger: 'Review procurement report' },
          { title: 'Trade-Friendly Report', instruction: 'A simplified report for trades, showing only what they need: item names, quantities, and delivery locations.', target_element: '', completion_trigger: 'Review trade report' }
        ],
        status: 'Published', review_status: 'Current', required: false, author: 'System', last_updated: now, app_version: '1.0', display_order: 14,
        feature_ids: [featureMap['Reports']]
      },
      {
        title: 'Security and Visibility Basics', description: 'Understand role-based access, pricing visibility, and what customers can and cannot see.', category: 'Security and Permissions',
        applies_to_roles: ['Admin / Operations Manager'], estimated_minutes: 5, target_page: '/',
        steps: [
          { title: 'Roles', instruction: 'Frontier Selections has staff roles (admin, staff) and customer roles. Staff see the staff dashboard; customers see the portal. Only admins can manage users and settings.', target_element: '', completion_trigger: 'Understand roles' },
          { title: 'Pricing Visibility', instruction: 'Each project has a pricing visibility setting that controls what customers see: hidden, item prices, total allowance, area allowance, or remaining/overage only.', target_element: '', completion_trigger: 'Understand pricing visibility' },
          { title: 'Internal vs Customer Notes', instruction: 'Internal notes are visible only to staff. Customer-visible comments appear in the portal. Always double-check which type you\'re writing.', target_element: '', completion_trigger: 'Understand note visibility' },
          { title: 'Project Access', instruction: 'Customers can only see projects they\'re assigned to. The portal verifies access on every page — customers can\'t access other projects by changing URLs.', target_element: '', completion_trigger: 'Understand project access' }
        ],
        status: 'Published', review_status: 'Current', required: true, author: 'System', last_updated: now, app_version: '1.0', display_order: 15,
        feature_ids: [featureMap['Security and Permissions']]
      }
    ]);

    // 3. Help Articles
    const articles = await base44.asServiceRole.entities.HelpArticle.bulkCreate([
      {
        title: 'What Customers Can See', category: 'Security and Permissions', applies_to_roles: ROLES, related_module: 'Customer Portal',
        body: '## What Customers Can See\n\nCustomers see a simplified portal that shows only their assigned projects. Within each project, they can:\n\n- View areas and selection requirements assigned to them\n- Browse available catalogue items\n- Configure and submit selections\n- View mood board items\n- See notifications and deadlines\n\n**What customers cannot see:**\n\n- Other customers\' projects\n- Internal notes and staff comments\n- Cost/markup information (unless pricing visibility is enabled)\n- Procurement details (status, PO numbers, supplier info)\n- Audit logs\n- Other users\' data\n\nPricing visibility is controlled per-project. Options include:\n- **Hidden** — No pricing shown\n- **Show item prices** — Customer sees each item\'s price\n- **Show total allowance** — Customer sees the overall budget\n- **Show remaining only** — Customer sees how much budget is left\n- **Show overage only** — Customer sees only overages they\'re responsible for',
        status: 'Published', review_status: 'Current', author: 'System', last_updated: now, app_version: '1.0', is_customer_facing: false, display_order: 1,
        feature_ids: [featureMap['Security and Permissions'], featureMap['Customer Portal']]
      },
      {
        title: 'Internal Notes vs Customer-Visible Comments', category: 'Security and Permissions', applies_to_roles: ROLES, related_module: 'Comments',
        body: '## Internal Notes vs Customer Comments\n\nFrontier Selections has two types of communication:\n\n### Internal Notes\n- Visible **only to staff**\n- Used for: cost discussions, supplier notes, markup decisions, internal coordination\n- Found on: requirement detail pages, change requests, procurement items\n- Labelled "Internal" in the UI\n\n### Customer-Visible Comments\n- Visible to **both staff and customers** in the portal\n- Used for: asking customers questions, providing guidance, explaining options\n- Found in the Comment Thread component on each record\n- Labelled "Customer" or "Public" in the UI\n\n### Tips\n- When posting a comment, always check the visibility toggle before submitting\n- Internal notes are never shown to customers, even in the final package\n- The Project Timeline shows all comments, but internal ones are filtered out for customers',
        status: 'Published', review_status: 'Current', author: 'System', last_updated: now, app_version: '1.0', is_customer_facing: false, display_order: 2,
        feature_ids: [featureMap['Security and Permissions']]
      },
      {
        title: 'How Allowances Work', category: 'Allowances', applies_to_roles: ROLES, related_module: 'Finance',
        body: '## How Allowances Work\n\nAn **allowance** is the budget allocated for a selection. Allowances can be set at three levels:\n\n1. **Project level** — Total budget for all selections\n2. **Area level** — Budget for a specific room/zone\n3. **Requirement level** — Budget for a specific item (e.g., vanity)\n\n### Overage Calculation\n\nWhen a customer selects an item, the system calculates:\n- **Calculated price** = Base item price + Sum of selected option modifiers\n- **Overage** = Calculated price − Allowance (if positive)\n- **Under allowance** = Allowance − Calculated price (if positive)\n\n### Allowance Ledger\n\nEvery allowance event is recorded in the Allowance Ledger:\n- Original Allowance (set by staff)\n- Selection Submitted (customer submits)\n- Selection Approved (staff approves, finalizes price)\n- Staff Override (staff adjusts price)\n- Manual Adjustment (admin corrects)\n\n### Pricing Visibility\n\nWhat the customer sees is controlled by the project\'s pricing visibility setting. Even if allowances are tracked internally, customers may only see "remaining budget" or "overage amount" depending on settings.',
        status: 'Published', review_status: 'Current', author: 'System', last_updated: now, app_version: '1.0', is_customer_facing: false, display_order: 3,
        feature_ids: [featureMap['Allowances']]
      },
      {
        title: 'How Approvals Work', category: 'Approvals', applies_to_roles: ROLES, related_module: 'Selections',
        body: '## How Approvals Work\n\nWhen a customer submits a selection, it enters the **Pending** status. Staff then review and take one of three actions:\n\n### Approve\n- The selection status becomes **Approved**\n- The requirement status becomes **Approved**\n- A procurement item is automatically created (status: Not Ready to Order)\n- An allowance ledger entry is recorded\n- The customer sees "Approved" in their portal\n\n### Request Revision\n- The selection status becomes **Revision Requested**\n- The customer is notified and can revise their selection\n- Staff comments explain what needs to change\n- The customer resubmits, creating a new version\n\n### Reject\n- The selection status becomes **Rejected**\n- The customer must start over with a new selection\n- Used when the selection is fundamentally wrong\n\n### Staff Price Override\n\nStaff can override the calculated price during review. This is useful for:\n- Negotiated pricing\n- Correcting catalogue errors\n- Applying discounts\n\nThe override becomes the final price used for allowance and overage calculations.\n\n### Sign-Off and Locking\n\nAfter approval, staff can request customer sign-off (formal confirmation) and lock the selection to prevent further changes.',
        status: 'Published', review_status: 'Current', author: 'System', last_updated: now, app_version: '1.0', is_customer_facing: false, display_order: 4,
        feature_ids: [featureMap['Approval Workflow']]
      },
      {
        title: 'How Change Requests Work', category: 'Change Requests', applies_to_roles: ROLES, related_module: 'Change Requests',
        body: '## How Change Requests Work\n\nAfter a selection is approved, customers can request a change (if the requirement allows it). This creates a **Change Request**.\n\n### Change Request Lifecycle\n\n1. **Requested** — Customer submits a change request with a new item/options and a reason\n2. **Under Review** — Staff reviews the request\n3. **Approved** — Staff approves; the selection is updated and procurement is adjusted\n4. **Rejected** — Staff rejects with a response\n5. **Cancelled** — Customer cancels the request\n\n### Price Impact\n\nThe system calculates the price difference between the original and requested items:\n- **Price impact** = New price − Original price\n- **Allowance impact** = How the change affects the allowance balance\n\nIf the new item costs more, the customer may be responsible for the difference (depending on project terms).\n\n### Procurement Impact\n\nWhen a change request is approved:\n- The existing procurement item is updated to point to the new selection\n- No duplicate procurement items are created\n- The allowance ledger is updated\n\n### Locked Items\n\nIf a selection is locked, change requests cannot be submitted. Staff must unlock the selection first.',
        status: 'Published', review_status: 'Current', author: 'System', last_updated: now, app_version: '1.0', is_customer_facing: false, display_order: 5,
        feature_ids: [featureMap['Change Requests']]
      },
      {
        title: 'How to Avoid Duplicate Catalogue Items', category: 'Catalogue', applies_to_roles: ['Catalogue Manager', 'Admin / Operations Manager'], related_module: 'Catalogue',
        body: '## How to Avoid Duplicate Catalogue Items\n\nDuplicate catalogue items cause confusion and pricing errors. Follow these practices:\n\n### Before Creating a New Item\n\n1. **Search first** — Use the catalogue search to check if the item already exists. Search by name, SKU, and brand.\n2. **Check inactive items** — Filter by status "Inactive" and "Discontinued" — the item may already exist but be hidden.\n3. **Check by SKU** — The SKU is the most reliable identifier. If a SKU exists, don\'t create a new item.\n\n### Naming Conventions\n\n- Use consistent naming: `[Brand] [Model] [Key Spec]` (e.g., "Kohler Wellworth Toilet 1.28 GPF")\n- Include the size/colour in the name only if it\'s a separate SKU\n- For items with variants (sizes, colours), create ONE item with option groups — don\'t create separate items per variant\n\n### When to Update vs Create New\n\n- **Update** if: the item exists but needs new images, price update, or option changes\n- **Create new** if: it\'s a genuinely different product with a different SKU\n- **Mark as Discontinued** if: the item is no longer available, but don\'t delete it (existing selections reference it)\n\n### Substitution Recommendations\n\nIf an item is discontinued, create a Substitution Recommendation linking the old item to a recommended replacement. This helps staff guide customers to alternatives.',
        status: 'Published', review_status: 'Current', author: 'System', last_updated: now, app_version: '1.0', is_customer_facing: false, display_order: 6,
        feature_ids: [featureMap['Catalogue Management']]
      },
      {
        title: 'How to Use Option Groups and Rules', category: 'Product Configurator', applies_to_roles: ['Catalogue Manager', 'Admin / Operations Manager'], related_module: 'Catalogue',
        body: '## How to Use Option Groups and Rules\n\nOption groups make catalogue items configurable. Rules add conditional logic.\n\n### Option Groups\n\nAn **option group** is a set of choices (e.g., "Size", "Colour", "Finish").\n\n- **Required groups** — Customer must select a value\n- **Optional groups** — Customer can skip\n- Each group has a display order (lower appears first)\n\n### Option Values\n\nEach value within a group has:\n- **Name** (e.g., "36 inch", "Matte Black")\n- **Price modifier** — Added to or subtracted from the base price\n- **Image** — Shown when the customer selects this value\n- **SKU** — For procurement tracking\n- **Status** — Active, Discontinued, Backordered, etc.\n\n### Conditional Rules\n\nRules let you create dependencies between options:\n\n| Rule Type | Example |\n|-----------|--------|\n| **Availability** | When Size = 36", hide the 48" vanity top option |\n| **Price override** | When Colour = Custom, set price to +$200 |\n| **Warning** | When Finish = Oil Rubbed Bronze, show "May require special order" |\n| **Requires approval** | When Size = Custom, require staff approval |\n\n### Tips\n- Keep option groups simple — too many groups overwhelm customers\n- Use warnings for special-order or long-lead-time options\n- Use "requires approval" for anything that needs staff sign-off before the customer can submit',
        status: 'Published', review_status: 'Current', author: 'System', last_updated: now, app_version: '1.0', is_customer_facing: false, display_order: 7,
        feature_ids: [featureMap['Catalogue Management']]
      },
      {
        title: 'How to Generate Final Reports', category: 'Reports', applies_to_roles: ROLES, related_module: 'Reports',
        body: '## How to Generate Final Reports\n\nFrontier Selections offers several report types for different audiences:\n\n### Project Summary Report\n- Shows selection progress, allowance usage, and overage totals\n- Useful for: project coordinators, operations managers\n- Includes: per-area breakdown, completion percentage, budget vs actual\n\n### Procurement Report\n- Shows order status, delivery dates, and items needing attention\n- Useful for: project managers, construction team\n- Includes: PO numbers, supplier info, expected delivery, items that are backordered or delayed\n\n### Trade-Friendly Report\n- Simplified view for trades and installers\n- Shows only: item name, quantity, room, delivery location\n- Hides: pricing, allowances, internal notes\n\n### Final Selections Package\n- Customer-facing: approved selections with images and customer notes\n- Internal: adds procurement status, staff notes, and allowance details\n- Can be shared via link or exported\n\n### Generating Reports\n\n1. Navigate to Reports (or Final Package for the selections package)\n2. Select a project\n3. Choose the report type\n4. Review on screen or export/share',
        status: 'Published', review_status: 'Current', author: 'System', last_updated: now, app_version: '1.0', is_customer_facing: false, display_order: 8,
        feature_ids: [featureMap['Reports'], featureMap['Final Selections Package']]
      },
      {
        title: 'How to Use Practice Mode', category: 'Getting Started', applies_to_roles: ROLES, related_module: 'Training',
        body: '## How to Use Practice Mode\n\nPractice Mode lets new employees learn the system using sample data without affecting real client projects.\n\n### What\'s Included\n\nPractice Mode creates a sample project with:\n- A sample customer (clearly labelled "TRAINING")\n- Sample rooms (Kitchen, Main Bathroom, Ensuite)\n- Sample room templates\n- Sample catalogue items (with option groups and rules)\n- Sample allowances\n- Sample pending selections\n- Sample change requests\n- Sample procurement records\n\n### How to Access\n\n1. Go to **Help & Training** in the sidebar\n2. Click **Practice Mode** in the training dashboard\n3. Click **Create Practice Project** to generate sample data\n\n### Important Notes\n\n- All practice data is clearly labelled with "TRAINING" in the project name\n- Practice data does NOT affect real projects or reports\n- You can delete practice data at any time from the Practice Mode page\n- Practice data is visible only to you (not to other staff or customers)\n\n### Recommended Workflow\n\n1. Create a practice project\n2. Walk through the tutorials using the practice data\n3. Complete the onboarding checklist\n4. Delete the practice data when you\'re done',
        status: 'Published', review_status: 'Current', author: 'System', last_updated: now, app_version: '1.0', is_customer_facing: false, display_order: 9,
        feature_ids: [featureMap['Project Management']]
      }
    ]);

    // 4. Onboarding Checklists
    await base44.asServiceRole.entities.OnboardingChecklist.bulkCreate([
      {
        role: 'Admin / Operations Manager', title: 'Admin / Operations Manager Onboarding', is_active: true,
        items: [
          { name: 'Complete app overview', description: 'Take the Frontier Selections Overview tutorial', required: true, related_tutorial_id: tutorials[0].id },
          { name: 'Create a test project', description: 'Create a practice project in Practice Mode', required: true, related_tutorial_id: tutorials[1].id },
          { name: 'Add rooms/areas', description: 'Add areas and apply room templates', required: true, related_tutorial_id: tutorials[2].id },
          { name: 'Set allowances', description: 'Set project, area, and requirement allowances', required: true, related_tutorial_id: tutorials[4].id },
          { name: 'Invite a test customer', description: 'Invite a customer to the test project', required: true, related_tutorial_id: tutorials[3].id },
          { name: 'Review a submission', description: 'Review and approve a customer selection', required: true, related_tutorial_id: tutorials[5].id },
          { name: 'Handle a change request', description: 'Process a change request', required: true, related_tutorial_id: tutorials[6].id },
          { name: 'Create a catalogue item', description: 'Create a configurable catalogue item', required: true, related_tutorial_id: tutorials[7].id },
          { name: 'Review security settings', description: 'Complete the Security and Visibility tutorial', required: true, related_tutorial_id: tutorials[14].id },
          { name: 'Review reports', description: 'Review the available reports', required: true, related_tutorial_id: tutorials[13].id },
          { name: 'Complete final knowledge check', description: 'Pass the knowledge check quiz', required: true }
        ]
      },
      {
        role: 'Project Coordinator', title: 'Project Coordinator Onboarding', is_active: true,
        items: [
          { name: 'Complete app overview', description: 'Take the Frontier Selections Overview tutorial', required: true, related_tutorial_id: tutorials[0].id },
          { name: 'Create a test project', description: 'Create a practice project in Practice Mode', required: true, related_tutorial_id: tutorials[1].id },
          { name: 'Add rooms/areas', description: 'Add areas and apply room templates', required: true, related_tutorial_id: tutorials[2].id },
          { name: 'Add a custom selection', description: 'Add a custom selection requirement', required: true },
          { name: 'Set allowances', description: 'Set project, area, and requirement allowances', required: true, related_tutorial_id: tutorials[4].id },
          { name: 'Invite a test customer', description: 'Invite a customer to the test project', required: true, related_tutorial_id: tutorials[3].id },
          { name: 'Submit a test customer selection', description: 'Log in as customer and submit a selection', required: true },
          { name: 'Approve a selection', description: 'Review and approve a customer selection', required: true, related_tutorial_id: tutorials[5].id },
          { name: 'Request a revision', description: 'Request a revision on a selection', required: true },
          { name: 'Create a change request', description: 'Handle a change request', required: true, related_tutorial_id: tutorials[6].id },
          { name: 'Generate a customer-facing final package', description: 'Generate a final selections package', required: true, related_tutorial_id: tutorials[11].id },
          { name: 'Generate an internal package', description: 'Generate an internal final package', required: true },
          { name: 'Complete final knowledge check', description: 'Pass the knowledge check quiz', required: true }
        ]
      },
      {
        role: 'Sales / Pre-Construction', title: 'Sales / Pre-Construction Onboarding', is_active: true,
        items: [
          { name: 'Complete app overview', description: 'Take the Frontier Selections Overview tutorial', required: true, related_tutorial_id: tutorials[0].id },
          { name: 'Create an early-stage project', description: 'Create a project with preliminary allowances', required: true, related_tutorial_id: tutorials[1].id },
          { name: 'Set preliminary allowances', description: 'Set initial allowances for the project', required: true, related_tutorial_id: tutorials[4].id },
          { name: 'Use the mood board', description: 'Add inspiration items to the mood board', required: true, related_tutorial_id: tutorials[12].id },
          { name: 'Review customer-facing reports', description: 'Review the customer-facing final package', required: true, related_tutorial_id: tutorials[11].id },
          { name: 'Understand overages and allowances', description: 'Read the How Allowances Work article', required: true, related_article_id: articles[2].id },
          { name: 'Use project summaries', description: 'Review the project summary report', required: true, related_tutorial_id: tutorials[13].id },
          { name: 'Complete final knowledge check', description: 'Pass the knowledge check quiz', required: true }
        ]
      },
      {
        role: 'Project Manager / Construction Team', title: 'Project Manager / Construction Team Onboarding', is_active: true,
        items: [
          { name: 'Complete app overview', description: 'Take the Frontier Selections Overview tutorial', required: true, related_tutorial_id: tutorials[0].id },
          { name: 'Review approved selections', description: 'Learn how to read approved selections', required: true, related_tutorial_id: tutorials[5].id },
          { name: 'Review procurement', description: 'Track ordered, received, and delivered items', required: true, related_tutorial_id: tutorials[10].id },
          { name: 'View final construction packages', description: 'Generate and review the internal final package', required: true, related_tutorial_id: tutorials[11].id },
          { name: 'Use trade-friendly reports', description: 'Review the trade-friendly report', required: true, related_tutorial_id: tutorials[13].id },
          { name: 'Understand change requests', description: 'Learn how change requests work', required: true, related_tutorial_id: tutorials[6].id },
          { name: 'Complete final knowledge check', description: 'Pass the knowledge check quiz', required: true }
        ]
      },
      {
        role: 'Catalogue Manager', title: 'Catalogue Manager Onboarding', is_active: true,
        items: [
          { name: 'Complete app overview', description: 'Take the Frontier Selections Overview tutorial', required: true, related_tutorial_id: tutorials[0].id },
          { name: 'Create a catalogue item', description: 'Create a new catalogue item with images and specs', required: true, related_tutorial_id: tutorials[7].id },
          { name: 'Build a configurable item', description: 'Add option groups and values to an item', required: true, related_tutorial_id: tutorials[8].id },
          { name: 'Add conditional rules', description: 'Create conditional option rules', required: true, related_tutorial_id: tutorials[9].id },
          { name: 'Avoid duplicates', description: 'Read the How to Avoid Duplicate Catalogue Items article', required: true, related_article_id: articles[5].id },
          { name: 'Create a substitution recommendation', description: 'Create a substitution for a discontinued item', required: true },
          { name: 'Mark items inactive/backordered', description: 'Update item statuses correctly', required: true },
          { name: 'Complete final knowledge check', description: 'Pass the knowledge check quiz', required: true }
        ]
      }
    ]);

    // 5. Knowledge Checks
    await base44.asServiceRole.entities.KnowledgeCheck.bulkCreate([
      {
        question: 'What happens when a customer changes an approved selection?',
        answer_choices: ['The selection is automatically updated', 'A change request is created for staff review', 'The selection is locked permanently', 'Nothing — customers cannot change approved selections'],
        correct_answer: 'A change request is created for staff review',
        explanation: 'When a customer wants to change an approved selection, a change request is created. Staff review the request and can approve or reject it. The original selection remains in place until the change is approved.',
        required_for_roles: ROLES, category: 'Change Requests', related_article_id: articles[4].id
      },
      {
        question: 'Who can see internal notes?',
        answer_choices: ['Both staff and customers', 'Only staff members', 'Only admins', 'Anyone with the project link'],
        correct_answer: 'Only staff members',
        explanation: 'Internal notes are visible only to staff. They are never shown to customers, even in the final package. Always verify the visibility setting before posting a comment.',
        required_for_roles: ROLES, category: 'Security and Permissions', related_article_id: articles[1].id
      },
      {
        question: 'What is the correct way to add a vanity with multiple sizes and colours?',
        answer_choices: ['Create a separate catalogue item for each size/colour combination', 'Create one catalogue item with option groups for Size and Colour', 'Create one item and list all options in the description', 'Create a separate project for each variant'],
        correct_answer: 'Create one catalogue item with option groups for Size and Colour',
        explanation: 'Create a single catalogue item and add option groups for Size and Colour. Each option value can have its own price modifier, image, and SKU. This avoids duplicate items and makes the customer experience cleaner.',
        required_for_roles: ['Catalogue Manager', 'Admin / Operations Manager', 'Project Coordinator'], category: 'Catalogue', related_article_id: articles[6].id
      },
      {
        question: 'What report should be used for the site crew?',
        answer_choices: ['Project Summary Report', 'Procurement Report', 'Trade-Friendly Report', 'Final Selections Package'],
        correct_answer: 'Trade-Friendly Report',
        explanation: 'The Trade-Friendly Report is designed for trades and installers. It shows only what they need: item names, quantities, rooms, and delivery locations — without pricing, allowances, or internal notes.',
        required_for_roles: ['Project Manager / Construction Team', 'Project Coordinator', 'Admin / Operations Manager'], category: 'Reports', related_article_id: articles[7].id
      },
      {
        question: 'What happens when an approved item is marked backordered?',
        answer_choices: ['The customer must reselect immediately', 'The selection is automatically cancelled', 'Staff can create a substitution recommendation, and the procurement item shows "Backordered" status', 'Nothing — backorder only affects the catalogue'],
        correct_answer: 'Staff can create a substitution recommendation, and the procurement item shows "Backordered" status',
        explanation: 'When an approved item is backordered, the procurement item status changes to "Backordered" to alert the construction team. Staff can create a Substitution Recommendation to offer the customer an alternative. The customer can accept or reject the substitution.',
        required_for_roles: ['Catalogue Manager', 'Project Coordinator', 'Project Manager / Construction Team'], category: 'Procurement', related_article_id: articles[5].id
      }
    ]);

    // Update features with tutorial/article IDs
    const tutorialByTitle = {};
    tutorials.forEach(t => tutorialByTitle[t.title] = t.id);
    const articleByTitle = {};
    articles.forEach(a => articleByTitle[a.title] = a.id);

    const featureUpdates = [
      { name: 'Project Management', tutorialIds: [tutorials[1].id, tutorials[2].id, tutorials[3].id], articleIds: [articles[8].id] },
      { name: 'Room Templates', tutorialIds: [tutorials[2].id], articleIds: [] },
      { name: 'Catalogue Management', tutorialIds: [tutorials[7].id, tutorials[8].id, tutorials[9].id], articleIds: [articles[5].id, articles[6].id] },
      { name: 'Selection Requirements', tutorialIds: [], articleIds: [] },
      { name: 'Customer Portal', tutorialIds: [tutorials[3].id], articleIds: [articles[0].id] },
      { name: 'Allowances', tutorialIds: [tutorials[4].id], articleIds: [articles[2].id] },
      { name: 'Approval Workflow', tutorialIds: [tutorials[5].id], articleIds: [articles[3].id] },
      { name: 'Change Requests', tutorialIds: [tutorials[6].id], articleIds: [articles[4].id] },
      { name: 'Procurement', tutorialIds: [tutorials[10].id], articleIds: [] },
      { name: 'Mood Board', tutorialIds: [tutorials[12].id], articleIds: [] },
      { name: 'Reports', tutorialIds: [tutorials[13].id], articleIds: [articles[7].id] },
      { name: 'Final Selections Package', tutorialIds: [tutorials[11].id], articleIds: [articles[7].id] },
      { name: 'Security and Permissions', tutorialIds: [tutorials[14].id], articleIds: [articles[0].id, articles[1].id] }
    ];

    for (const fu of featureUpdates) {
      const feat = features.find(f => f.name === fu.name);
      if (feat) {
        await base44.asServiceRole.entities.FeatureRegistry.update(feat.id, {
          related_tutorial_ids: fu.tutorialIds,
          related_article_ids: fu.articleIds
        });
      }
    }

    return Response.json({
      message: 'Tutorial content seeded successfully',
      tutorials: tutorials.length,
      articles: articles.length,
      features: features.length,
      checklists: 5,
      knowledgeChecks: 5
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});