import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Plus, Search, Package, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES } from "@/lib/constants";

export default function Catalogue() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [optionCounts, setOptionCounts] = useState({});

  useEffect(() => {
    Promise.all([
      base44.entities.CatalogueItem.list("-updated_date", 200),
      base44.entities.CatalogueOptionGroup.filter({ is_active: true }, null, 500)
    ]).then(([data, groups]) => {
      setItems(data);
      const counts = {};
      (groups || []).forEach(g => {
        counts[g.catalogue_item_id] = (counts[g.catalogue_item_id] || 0) + 1;
      });
      setOptionCounts(counts);
      setLoading(false);
    });
  }, []);

  const filtered = items.filter(item => {
    const matchSearch = !search || item.name?.toLowerCase().includes(search.toLowerCase()) || item.supplier?.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "all" || item.category === categoryFilter;
    return matchSearch && matchCat;
  });

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catalogue</h1>
          <p className="text-sm text-gray-500 mt-1">{items.length} items</p>
        </div>
        <Link to="/catalogue/new">
          <Button className="gap-2"><Plus size={16} /> Add Item</Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search catalogue..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Package size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 text-sm">No catalogue items found</p>
          <Link to="/catalogue/new"><Button variant="outline" className="mt-4">Add your first item</Button></Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(item => (
            <Link
              key={item.id}
              to={`/catalogue/${item.id}`}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group"
            >
              <div className="aspect-square bg-gray-100 relative overflow-hidden">
                {item.default_image ? (
                  <img src={item.default_image} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <Package size={48} />
                  </div>
                )}
                {item.status && item.status !== "Active" && (
                  <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">{item.status}</div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-medium text-gray-900 text-sm group-hover:text-gray-700">{item.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{item.category}{item.supplier ? ` • ${item.supplier}` : ""}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-sm font-semibold text-gray-900">${(item.base_price || 0).toLocaleString()}</p>
                  {(optionCounts[item.id] || 0) > 0 && (
                    <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">{optionCounts[item.id]} options</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}