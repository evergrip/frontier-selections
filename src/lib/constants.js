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
  "Change request required": "bg-orange-100 text-orange-700"
};

export function customerDisplayStatus(req, sel, hasOpenChangeRequest) {
  if (sel?.locked || req?.status === "Locked") return "Locked";
  if (sel?.signed_off) return "Signed off";
  if (sel?.status === "Approved" || req?.status === "Approved") return "Approved";
  if (hasOpenChangeRequest || req?.status === "Change Requested") return "Change request required";
  return "Pending approval";
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

export function isStaff(user) {
  return user?.role === 'admin' || user?.role === 'staff';
}