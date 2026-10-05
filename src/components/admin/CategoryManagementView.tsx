import React, { useState } from 'react';
import {
  Sparkles,
  UtensilsCrossed,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Layers,
  Utensils,
  Coffee,
  Pizza,
  Flame,
  Cake,
  Sandwich,
  Wine,
  IceCream,
  Salad,
  Soup,
  Heart,
  Tag,
  Search,
} from 'lucide-react';
import type { Category, MenuItem } from '../../types';
import { api } from '../../services/api';

interface CategoryManagementViewProps {
  categories: Category[];
  menuItems: MenuItem[];
  token: string;
  onUpdateCategories?: (cats: Category[]) => void;
  onUpdateMenuItems?: (items: MenuItem[]) => void;
  onMenuUpdated?: () => void;
  showNotification: (msg: string) => void;
}

const ICON_PRESETS = [
  { name: 'Sparkles', icon: Sparkles, label: 'Special' },
  { name: 'UtensilsCrossed', icon: UtensilsCrossed, label: 'Dishes' },
  { name: 'Utensils', icon: Utensils, label: 'Thali' },
  { name: 'Cake', icon: Cake, label: 'Bakery' },
  { name: 'Pizza', icon: Pizza, label: 'Pizza' },
  { name: 'Sandwich', icon: Sandwich, label: 'Burger' },
  { name: 'Flame', icon: Flame, label: 'Spicy/Hot' },
  { name: 'Coffee', icon: Coffee, label: 'Beverage' },
  { name: 'Soup', icon: Soup, label: 'Chinese/Soup' },
  { name: 'Salad', icon: Salad, label: 'Healthy' },
  { name: 'IceCream', icon: IceCream, label: 'Dessert' },
  { name: 'Wine', icon: Wine, label: 'Cooler' },
  { name: 'Tag', icon: Tag, label: 'Offer' },
  { name: 'Heart', icon: Heart, label: 'Favorite' },
];

export const CategoryManagementView: React.FC<CategoryManagementViewProps> = ({
  categories,
  menuItems,
  token,
  onUpdateCategories,
  onUpdateMenuItems,
  onMenuUpdated,
  showNotification,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);

  // Edit form state
  const [editForm, setEditForm] = useState<{
    name: string;
    slug: string;
    icon: string;
    description: string;
  }>({
    name: '',
    slug: '',
    icon: 'UtensilsCrossed',
    description: '',
  });

  // Add category form state
  const [isAddingOpen, setIsAddingOpen] = useState(false);
  const [newCat, setNewCat] = useState({
    name: '',
    slug: '',
    icon: 'UtensilsCrossed',
    description: '',
  });

  const activeCategories = categories.filter((c) => c.slug !== 'all');

  const filteredCategories = activeCategories.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStartEdit = (cat: Category) => {
    setEditingCatId(cat.id || cat.slug);
    setEditForm({
      name: cat.name,
      slug: cat.slug,
      icon: cat.icon || 'UtensilsCrossed',
      description: cat.description || '',
    });
  };

  const handleCancelEdit = () => {
    setEditingCatId(null);
  };

  const handleSaveEdit = async (cat: Category) => {
    if (!editForm.name.trim()) {
      showNotification('Category name cannot be empty');
      return;
    }

    const catId = cat.id || cat.slug;
    const oldSlug = cat.slug;
    const newSlug = editForm.slug.trim() || editForm.name.toLowerCase().replace(/[^a-z0-9]/g, '-');

    const prevCategories = categories;
    const updatedCategories = categories.map((c) =>
      (c.id === catId || c.slug === oldSlug)
        ? {
            ...c,
            name: editForm.name.trim(),
            slug: newSlug,
            icon: editForm.icon,
            description: editForm.description,
          }
        : c
    );

    onUpdateCategories?.(updatedCategories);

    // If slug changed, update menu items in state
    if (oldSlug !== newSlug) {
      const updatedMenuItems = menuItems.map((item) =>
        item.category === oldSlug ? { ...item, category: newSlug } : item
      );
      onUpdateMenuItems?.(updatedMenuItems);
    }

    setEditingCatId(null);
    showNotification(`Category "${editForm.name}" updated successfully!`);

    try {
      await api.updateCategory(token, catId, {
        name: editForm.name.trim(),
        slug: newSlug,
        icon: editForm.icon,
        description: editForm.description,
      });
      onMenuUpdated?.();
    } catch (err: any) {
      onUpdateCategories?.(prevCategories);
      showNotification('Failed to update category: ' + err.message);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCat.name.trim()) return;

    const name = newCat.name.trim();
    const slug = newCat.slug.trim() || name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const tempId = `cat-${Date.now()}`;

    const createdCat: Category = {
      id: tempId,
      name,
      slug,
      icon: newCat.icon || 'UtensilsCrossed',
      description: newCat.description || `Fresh handcrafted ${name}`,
    };

    const nextCats = [...categories, createdCat];
    onUpdateCategories?.(nextCats);
    setIsAddingOpen(false);
    setNewCat({ name: '', slug: '', icon: 'UtensilsCrossed', description: '' });
    showNotification(`Food category "${name}" added!`);

    try {
      const saved = await api.addCategory(token, {
        name,
        slug,
        icon: createdCat.icon,
        description: createdCat.description,
      });
      const finalCats = nextCats.map((c) => (c.id === tempId ? saved : c));
      onUpdateCategories?.(finalCats);
      onMenuUpdated?.();
    } catch (err: any) {
      onUpdateCategories?.(categories);
      showNotification('Failed to add category: ' + err.message);
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    const catId = cat.id || cat.slug;
    const dishCount = menuItems.filter(
      (m) => m.category === cat.slug || m.category.toLowerCase() === cat.name.toLowerCase()
    ).length;

    if (dishCount > 0) {
      const confirmDelete = window.confirm(
        `Category "${cat.name}" has ${dishCount} assigned dishes. Are you sure you want to remove it?`
      );
      if (!confirmDelete) return;
    }

    const prevCats = categories;
    const nextCats = categories.filter((c) => c.id !== catId && c.slug !== cat.slug);
    onUpdateCategories?.(nextCats);
    showNotification(`Category "${cat.name}" removed`);

    try {
      await api.deleteCategory(token, catId);
      onMenuUpdated?.();
    } catch (err: any) {
      onUpdateCategories?.(prevCats);
      showNotification('Failed to delete category: ' + err.message);
    }
  };

  const renderCategoryIcon = (iconName?: string) => {
    const found = ICON_PRESETS.find((p) => p.name === iconName);
    const IconComp = found ? found.icon : UtensilsCrossed;
    return <IconComp className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-600" />
            <span>Food Categories Management</span>
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Organize dishes, customize names, slugs, and visual icons across the customer storefront and menu.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsAddingOpen(!isAddingOpen)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Category</span>
          </button>
        </div>
      </div>

      {/* Add New Category Panel */}
      {isAddingOpen && (
        <form
          onSubmit={handleAddCategory}
          className="p-5 rounded-2xl bg-amber-500/10 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 shadow-sm space-y-4 animate-in fade-in"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-amber-600" />
              <span>Create New Food Category</span>
            </h3>
            <button
              type="button"
              onClick={() => setIsAddingOpen(false)}
              className="p-1 text-stone-400 hover:text-stone-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                Category Display Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. South Indian, Mocktails, Cakes"
                value={newCat.name}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewCat({
                    ...newCat,
                    name: val,
                    slug: val.toLowerCase().replace(/[^a-z0-9]/g, '-'),
                  });
                }}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-amber-300 dark:border-amber-700 text-stone-900 dark:text-stone-100 font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                Slug (URL &amp; Database Key) *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. south-indian, mocktails"
                value={newCat.slug}
                onChange={(e) => setNewCat({ ...newCat, slug: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-amber-300 dark:border-amber-700 text-stone-900 dark:text-stone-100 font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                Description
              </label>
              <input
                type="text"
                placeholder="Short tagline (e.g. Traditional Dosa & Uttapam)"
                value={newCat.description}
                onChange={(e) => setNewCat({ ...newCat, description: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-amber-300 dark:border-amber-700 text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>

          {/* Icon Selector */}
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
              Select Icon
            </label>
            <div className="flex flex-wrap gap-2">
              {ICON_PRESETS.map((p) => {
                const IconComp = p.icon;
                const isSelected = newCat.icon === p.name;
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setNewCat({ ...newCat, icon: p.name })}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-800 hover:bg-amber-50'
                    }`}
                  >
                    <IconComp className="w-3.5 h-3.5" />
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddingOpen(false)}
              className="px-4 py-2 rounded-xl bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-semibold cursor-pointer border border-stone-200 dark:border-stone-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Create Category</span>
            </button>
          </div>
        </form>
      )}

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCategories.map((cat) => {
          const isEditing = editingCatId === (cat.id || cat.slug);
          const dishCount = menuItems.filter(
            (m) => m.category === cat.slug || m.category.toLowerCase() === cat.name.toLowerCase()
          ).length;

          if (isEditing) {
            return (
              <div
                key={cat.id || cat.slug}
                className="p-5 rounded-2xl bg-white dark:bg-stone-900 border-2 border-amber-500 shadow-md flex flex-col justify-between gap-4"
              >
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between pb-1 border-b border-stone-100 dark:border-stone-800">
                    <span className="font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                      Editing Category
                    </span>
                    <span className="font-mono text-stone-400">{cat.slug}</span>
                  </div>

                  <div>
                    <label className="block font-bold mb-1 text-stone-700 dark:text-stone-300">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-1 text-stone-700 dark:text-stone-300">
                      Category Slug (Key)
                    </label>
                    <input
                      type="text"
                      value={editForm.slug}
                      onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 font-mono text-[11px]"
                    />
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                      ⚠️ Note: Renaming the slug will automatically update all {dishCount} assigned dishes!
                    </p>
                  </div>

                  <div>
                    <label className="block font-bold mb-1 text-stone-700 dark:text-stone-300">
                      Select Icon
                    </label>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto no-scrollbar p-1 bg-stone-50 dark:bg-stone-800/60 rounded-lg">
                      {ICON_PRESETS.map((p) => {
                        const IconComp = p.icon;
                        const isSel = editForm.icon === p.name;
                        return (
                          <button
                            key={p.name}
                            type="button"
                            onClick={() => setEditForm({ ...editForm, icon: p.name })}
                            className={`p-1.5 rounded-md text-[10px] flex items-center gap-1 cursor-pointer ${
                              isSel
                                ? 'bg-amber-600 text-white font-bold'
                                : 'bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                            }`}
                          >
                            <IconComp className="w-3 h-3" />
                            <span>{p.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold mb-1 text-stone-700 dark:text-stone-300">
                      Description / Tagline
                    </label>
                    <input
                      type="text"
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveEdit(cat)}
                    className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={cat.id || cat.slug}
              className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col justify-between gap-4 hover:border-amber-300 dark:hover:border-amber-700/60 transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center shrink-0">
                      {renderCategoryIcon(cat.icon)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                        {cat.name}
                      </h4>
                      <p className="text-[11px] font-mono text-stone-500 dark:text-stone-400">
                        slug: {cat.slug}
                      </p>
                    </div>
                  </div>

                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
                    {dishCount} dishes
                  </span>
                </div>

                {cat.description && (
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-3 line-clamp-2">
                    {cat.description}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-stone-100 dark:border-stone-800 text-xs">
                <button
                  type="button"
                  onClick={() => handleStartEdit(cat)}
                  className="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Category</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteCategory(cat)}
                  className="p-1.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer transition-all"
                  title="Delete category"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredCategories.length === 0 && (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-500">
          <Layers className="w-8 h-8 mx-auto mb-2 text-stone-400" />
          <p className="text-sm font-semibold">No food categories match your search</p>
        </div>
      )}
    </div>
  );
};
