export const CATEGORIES = [
  "Vanity", "Cabinet", "Countertop", "Tile", "Flooring", "Faucet", "Sink",
  "Toilet", "Shower System", "Tub", "Mirror", "Lighting", "Paint", "Trim",
  "Door", "Door Hardware", "Exterior Siding", "Roofing", "Decking", "Railing",
  "Appliance", "Fireplace", "Other"
];

export const AREA_TYPES = [
  "Kitchen", "Main Bathroom", "Ensuite", "Powder Room", "Living Room",
  "Basement", "Laundry Room", "Flooring", "Doors and Trim", "Lighting",
  "Plumbing Fixtures", "Paint", "Deck", "Addition", "Garage", "Exterior",
  "Global", "Other"
];

export const MOOD_BOARD_TAGS = [
  "Kitchen", "Bathroom", "Ensuite", "Exterior", "Flooring", "Tile", "Vanity",
  "Cabinets", "Countertop", "Lighting", "Paint", "Trim", "Modern",
  "Traditional", "Warm", "Clean", "Rustic", "High priority", "Maybe", "Favourite"
];

export const PROJECT_STATUSES = [
  "Draft", "Active", "Waiting on Customer", "Waiting on Staff",
  "Selections Complete", "In Construction", "Completed", "Archived"
];

export const SELECTION_STATUSES = [
  "Not Started", "Viewed", "In Progress", "Submitted", "Revision Requested",
  "Approved", "Rejected", "Change Requested", "Changed After Approval",
  "Locked", "Ready to Order", "Ordered", "Received", "Installed"
];

export const PROCUREMENT_STATUSES = [
  "Not Ready to Order", "Ready to Order", "Ordered", "Backordered", "Delayed",
  "Received", "Delivered to Site", "Installed", "Cancelled", "Returned",
  "Substitution Required"
];

export const ITEM_STATUSES = [
  "Draft", "Active", "Inactive", "Discontinued", "Temporarily Unavailable",
  "Backordered", "Special Order Only", "Substitution Recommended"
];

export const OPTION_STATUSES = [
  "Active", "Inactive", "Discontinued", "Temporarily Unavailable",
  "Backordered", "Special Order Only", "Substitution Recommended"
];

export const SUBSTITUTION_STATUSES = [
  "Draft", "Sent to customer", "Customer accepted", "Customer rejected",
  "Staff approved", "Cancelled"
];

export const STATUS_COLORS = {
  "Draft": "bg-gray-100 text-gray-700",
  "Active": "bg-emerald-100 text-emerald-700",
  "Waiting on Customer": "bg-amber-100 text-amber-700",
  "Waiting on Staff": "bg-blue-100 text-blue-700",
  "Selections Complete": "bg-purple-100 text-purple-700",
  "In Construction": "bg-orange-100 text-orange-700",
  "Completed": "bg-green-100 text-green-700",
  "Archived": "bg-gray-100 text-gray-500",
  "Not Started": "bg-gray-100 text-gray-600",
  "Viewed": "bg-sky-100 text-sky-700",
  "In Progress": "bg-blue-100 text-blue-700",
  "Submitted": "bg-indigo-100 text-indigo-700",
  "Revision Requested": "bg-amber-100 text-amber-700",
  "Approved": "bg-emerald-100 text-emerald-700",
  "Rejected": "bg-red-100 text-red-700",
  "Change Requested": "bg-orange-100 text-orange-700",
  "Changed After Approval": "bg-yellow-100 text-yellow-700",
  "Locked": "bg-gray-200 text-gray-700",
  "Ready to Order": "bg-cyan-100 text-cyan-700",
  "Ordered": "bg-blue-100 text-blue-700",
  "Received": "bg-teal-100 text-teal-700",
  "Installed": "bg-green-100 text-green-700",
  "Pending": "bg-amber-100 text-amber-700",
  "Requested": "bg-amber-100 text-amber-700",
  "Under Review": "bg-blue-100 text-blue-700",
  "Cancelled": "bg-gray-100 text-gray-500",
  "Not Ready to Order": "bg-gray-100 text-gray-600",
  "Backordered": "bg-red-100 text-red-700",
  "Delayed": "bg-orange-100 text-orange-700",
  "Substitution Required": "bg-purple-100 text-purple-700",
  "Delivered to Site": "bg-teal-100 text-teal-700",
  "Returned": "bg-rose-100 text-rose-700",
  "Superseded": "bg-gray-100 text-gray-500",
  "Price Adjustment Required": "bg-orange-100 text-orange-700",
  "Ordered Item Conflict": "bg-red-100 text-red-700",
  "Signed off": "bg-violet-100 text-violet-700",
  "Pending approval": "bg-amber-100 text-amber-700",
  "Change request required": "bg-orange-100 text-orange-700",
  "Change request sent": "bg-orange-100 text-orange-700",
  "Needs your choice": "bg-gray-100 text-gray-600",
  "Waiting for Frontier review": "bg-blue-100 text-blue-700",
  "Frontier needs more info": "bg-amber-100 text-amber-700",
  "Please choose again": "bg-red-100 text-red-700",
  "Replaced": "bg-gray-100 text-gray-500",
  "Started": "bg-sky-100 text-sky-700",
  "Sent to Frontier": "bg-indigo-100 text-indigo-700",
  "Approved and ready to order": "bg-cyan-100 text-cyan-700",
  "Inactive": "bg-gray-100 text-gray-600",
  "Temporarily Unavailable": "bg-orange-100 text-orange-700",
  "Special Order Only": "bg-purple-100 text-purple-700",
  "Substitution Recommended": "bg-rose-100 text-rose-700",
  "Draft": "bg-gray-100 text-gray-600",
  "Sent to customer": "bg-blue-100 text-blue-700",
  "Customer accepted": "bg-emerald-100 text-emerald-700",
  "Customer rejected": "bg-red-100 text-red-700",
  "Staff approved": "bg-green-100 text-green-700",
  "Cancelled": "bg-gray-100 text-gray-500",
  "Not invited": "bg-gray-100 text-gray-500",
  "Invitation sent": "bg-amber-100 text-amber-700",
  "Invitation opened": "bg-blue-100 text-blue-700",
  "Account created": "bg-indigo-100 text-indigo-700",
  "Expired": "bg-red-100 text-red-700",
  "Deactivated": "bg-red-100 text-red-700"
};

const CUSTOMER_STATUS_LABELS = {
  "Not Started": "Needs your choice",
  "Viewed": "Started",
  "In Progress": "In progress",
  "Submitted": "Sent to Frontier",
  "Pending": "Waiting for Frontier review",
  "Revision Requested": "Frontier needs more info",
  "Rejected": "Please choose again",
  "Approved": "Approved",
  "Change Requested": "Change request sent",
  "Locked": "Locked",
  "Signed off": "Signed off",
  "Ready to Order": "Approved and ready to order",
  "Ordered": "Ordered",
  "Received": "Received",
  "Installed": "Installed"
};

export function customerDisplayStatus(req, sel, hasOpenChangeRequest) {
  if (sel?.locked || req?.status === "Locked") return "Locked";
  if (sel?.signed_off) return "Signed off";
  if (sel?.status === "Approved" || req?.status === "Approved") return "Approved";
  if (hasOpenChangeRequest || req?.status === "Change Requested") return "Change request sent";
  if (!sel) {
    if (req?.status === "Not Started" || req?.status === "Viewed") return "Needs your choice";
    if (req?.status === "Submitted") return "Sent to Frontier";
    return "Needs your choice";
  }
  if (sel.status === "Pending") return "Waiting for Frontier review";
  if (sel.status === "Revision Requested" || req?.status === "Revision Requested") return "Frontier needs more info";
  if (sel.status === "Rejected") return "Please choose again";
  if (sel.status === "Superseded") return "Replaced";
  return CUSTOMER_STATUS_LABELS[sel.status] || CUSTOMER_STATUS_LABELS[req?.status] || sel.status;
}

export const DEFAULT_TEMPLATES = {
  "Main Bathroom": [
    { name: "Vanity", category: "Vanity", required: true },
    { name: "Vanity Top", category: "Countertop", required: true },
    { name: "Sink", category: "Sink", required: true },
    { name: "Faucet", category: "Faucet", required: true },
    { name: "Toilet", category: "Toilet", required: true },
    { name: "Floor Tile", category: "Tile", required: true },
    { name: "Shower Wall Tile", category: "Tile", required: true },
    { name: "Shower Floor Tile", category: "Tile", required: true },
    { name: "Grout Colour", category: "Other", required: true },
    { name: "Shower Fixture", category: "Shower System", required: true },
    { name: "Mirror", category: "Mirror", required: true },
    { name: "Lighting", category: "Lighting", required: true },
    { name: "Towel Bar", category: "Other", required: false },
    { name: "Toilet Paper Holder", category: "Other", required: false },
    { name: "Paint Colour", category: "Paint", required: true },
    { name: "Trim Colour", category: "Trim", required: true }
  ],
  "Ensuite": [
    { name: "Vanity", category: "Vanity", required: true },
    { name: "Vanity Top", category: "Countertop", required: true },
    { name: "Sink", category: "Sink", required: true },
    { name: "Faucet", category: "Faucet", required: true },
    { name: "Toilet", category: "Toilet", required: true },
    { name: "Floor Tile", category: "Tile", required: true },
    { name: "Shower Wall Tile", category: "Tile", required: true },
    { name: "Shower Floor Tile", category: "Tile", required: true },
    { name: "Grout Colour", category: "Other", required: true },
    { name: "Shower Fixture", category: "Shower System", required: true },
    { name: "Mirror", category: "Mirror", required: true },
    { name: "Lighting", category: "Lighting", required: true },
    { name: "Paint Colour", category: "Paint", required: true },
    { name: "Trim Colour", category: "Trim", required: true }
  ],
  "Powder Room": [
    { name: "Vanity", category: "Vanity", required: true },
    { name: "Vanity Top", category: "Countertop", required: true },
    { name: "Sink", category: "Sink", required: true },
    { name: "Faucet", category: "Faucet", required: true },
    { name: "Toilet", category: "Toilet", required: true },
    { name: "Floor Tile", category: "Tile", required: true },
    { name: "Mirror", category: "Mirror", required: true },
    { name: "Lighting", category: "Lighting", required: true },
    { name: "Paint Colour", category: "Paint", required: true }
  ],
  "Kitchen": [
    { name: "Cabinet Style", category: "Cabinet", required: true },
    { name: "Cabinet Colour", category: "Cabinet", required: true },
    { name: "Countertop", category: "Countertop", required: true },
    { name: "Backsplash", category: "Tile", required: true },
    { name: "Sink", category: "Sink", required: true },
    { name: "Faucet", category: "Faucet", required: true },
    { name: "Cabinet Hardware", category: "Door Hardware", required: true },
    { name: "Flooring", category: "Flooring", required: true },
    { name: "Lighting", category: "Lighting", required: true },
    { name: "Appliances", category: "Appliance", required: true },
    { name: "Paint Colour", category: "Paint", required: true }
  ],
  "Global": [
    { name: "Interior Doors", category: "Door", required: true },
    { name: "Door Hardware", category: "Door Hardware", required: true },
    { name: "Trim Profile", category: "Trim", required: true },
    { name: "Trim Colour", category: "Trim", required: true },
    { name: "Wall Paint Colour", category: "Paint", required: true },
    { name: "Ceiling Paint Colour", category: "Paint", required: true },
    { name: "Flooring", category: "Flooring", required: true },
    { name: "Electrical Devices", category: "Other", required: false },
    { name: "General Finish Package", category: "Other", required: false }
  ],
  "Exterior": [
    { name: "Siding", category: "Exterior Siding", required: true },
    { name: "Soffit", category: "Other", required: true },
    { name: "Fascia", category: "Other", required: true },
    { name: "Eavestrough", category: "Other", required: true },
    { name: "Roofing", category: "Roofing", required: true },
    { name: "Exterior Doors", category: "Door", required: true },
    { name: "Windows", category: "Other", required: true },
    { name: "Exterior Lighting", category: "Lighting", required: true },
    { name: "Decking", category: "Decking", required: false },
    { name: "Railing", category: "Railing", required: false },
    { name: "Stone or Masonry", category: "Other", required: false },
    { name: "Exterior Paint/Stain", category: "Paint", required: true }
  ]
};

export const STAFF_ROLES = [
  "Owner/Admin",
  "Operations Manager",
  "Project Coordinator",
  "Project Manager",
  "Sales / Pre-Construction",
  "Catalogue Manager",
  "Read-Only Staff"
];

export const PERMISSIONS = [
  "manage_users",
  "manage_roles",
  "manage_permissions",
  "manage_customers",
  "invite_customers",
  "deactivate_users",
  "view_audit_logs",
  "create_projects",
  "edit_projects",
  "delete_archive_projects",
  "view_all_projects",
  "view_assigned_projects_only",
  "manage_project_areas",
  "manage_selection_requirements",
  "manage_catalogue",
  "manage_catalogue_rules",
  "manage_allowances",
  "view_hidden_pricing",
  "override_pricing",
  "approve_selections",
  "reject_selections",
  "request_revisions",
  "lock_selections",
  "unlock_selections",
  "manage_change_requests",
  "manage_procurement",
  "generate_customer_reports",
  "generate_internal_reports",
  "view_internal_notes",
  "add_internal_notes",
  "add_customer_comments",
  "view_as_customer",
  "preview_customer_view",
  "act_as_customer",
  "act_as_customer_submit",
  "act_as_customer_upload",
  "act_as_customer_comment",
  "act_as_customer_request_changes",
  "manage_customer_access",
  "resend_invites",
  "deactivate_customer_access",
  "manage_tutorial_content",
  "view_training_progress",
  "view_selections_tracker",
  "manage_suggested_options",
  "override_suggested_option_pricing",
  "set_catalogue_access_mode",
  "preview_customer_view"
];

export const CATALOGUE_ACCESS_MODES = [
  { value: "suggested_only", label: "Suggested options only" },
  { value: "suggested_plus_request", label: "Suggested options plus request other" },
  { value: "full_category", label: "Full category catalogue" },
  { value: "full_plus_request", label: "Full category catalogue plus request other" },
  { value: "staff_only", label: "Staff selection only / customer cannot choose" }
];

export const ROLE_PERMISSIONS = {
  "Owner/Admin": PERMISSIONS,
  "Operations Manager": [
    "create_projects", "edit_projects", "view_all_projects",
    "manage_project_areas", "manage_selection_requirements",
    "manage_customers", "invite_customers", "manage_customer_access", "resend_invites",
    "manage_change_requests", "manage_procurement",
    "generate_customer_reports", "generate_internal_reports",
    "view_internal_notes", "add_internal_notes", "add_customer_comments",
    "view_as_customer", "act_as_customer", "preview_customer_view",
    "manage_allowances", "view_hidden_pricing",
    "approve_selections", "reject_selections", "request_revisions",
    "lock_selections", "unlock_selections",
    "view_selections_tracker", "manage_suggested_options",
    "override_suggested_option_pricing", "set_catalogue_access_mode"
  ],
  "Project Coordinator": [
    "view_assigned_projects_only", "edit_projects",
    "manage_project_areas", "manage_selection_requirements",
    "invite_customers", "resend_invites",
    "approve_selections", "reject_selections", "request_revisions",
    "manage_change_requests", "manage_procurement",
    "generate_customer_reports",
    "view_internal_notes", "add_internal_notes", "add_customer_comments",
    "view_as_customer", "preview_customer_view",
    "manage_deadlines",
    "view_selections_tracker", "manage_suggested_options",
    "set_catalogue_access_mode"
  ],
  "Project Manager": [
    "view_assigned_projects_only",
    "manage_procurement",
    "add_internal_notes",
    "generate_customer_reports"
  ],
  "Sales / Pre-Construction": [
    "create_projects", "edit_projects",
    "manage_project_areas",
    "invite_customers",
    "add_customer_comments",
    "view_as_customer",
    "preview_customer_view"
  ],
  "Catalogue Manager": [
    "manage_catalogue", "manage_catalogue_rules"
  ],
  "Read-Only Staff": [
    "view_assigned_projects_only",
    "generate_customer_reports",
    "preview_customer_view"
  ]
};

export const INVITATION_STATUSES = [
  "Not invited", "Invitation sent", "Invitation opened", "Account created",
  "Active", "Expired", "Cancelled", "Deactivated"
];

export function isStaff(user) {
  return user?.role === 'admin' || user?.role === 'staff';
}

export function hasPermission(user, permission) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role !== 'staff') return false;
  const perms = user.permissions || ROLE_PERMISSIONS[user.staff_role] || [];
  return perms.includes(permission);
}

export function hasAnyPermission(user, permissions) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role !== 'staff') return false;
  const perms = user.permissions || ROLE_PERMISSIONS[user.staff_role] || [];
  return permissions.some(p => perms.includes(p));
}