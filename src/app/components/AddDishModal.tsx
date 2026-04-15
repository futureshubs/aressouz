import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { X, Upload, Utensils, Plus, Trash2, Star, Leaf, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL, DEV_API_BASE_URL, publicAnonKey } from '/utils/supabase/info';
import { platformCommissionHintUz, validateVariantCommissionsClient } from '../utils/platformCommission';

export function AddDishModal({ 
  restaurantId, 
  onClose, 
  onSuccess,
  dish 
}: { 
  restaurantId: string; 
  onClose: () => void; 
  onSuccess: () => void;
  dish?: any;
}) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const apiBaseUrl =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? DEV_API_BASE_URL
      : API_BASE_URL;

  const dishFormDefaults = (d: typeof dish) => {
    const hasVariants = Array.isArray(d?.variants) && d!.variants.length > 0;
    const fallbackVariant = d
      ? {
          name: 'Standart',
          price: Number((d as any)?.variants?.[0]?.price ?? (d as any)?.price) || 0,
          prepTime: String((d as any)?.variants?.[0]?.prepTime ?? ''),
          image: String((d as any)?.variants?.[0]?.image ?? (d as any)?.image ?? ''),
          commission: Number((d as any)?.variants?.[0]?.commission) || 0,
        }
      : null;
    return {
      name: d?.name || '',
      images:
        Array.isArray(d?.images) && d.images.length > 0
          ? d.images
          : d?.image
            ? [d.image]
            : [],
      kcal: d?.kcal || 0,
      calories: d?.calories || 0,
      description: d?.description || '',
      ingredients: Array.isArray(d?.ingredients) ? d.ingredients : [],
      weight: d?.weight || '',
      additionalProducts: Array.isArray(d?.additionalProducts) ? d.additionalProducts : [],
      variants: hasVariants
        ? d!.variants.map((v: any) => ({
            ...v,
            commission: Number(v?.commission) || 0,
          }))
        : d && fallbackVariant
          ? [fallbackVariant]
          : [],
      isPopular: Boolean(d?.isPopular),
      isNatural: Boolean(d?.isNatural),
    };
  };

  const [formData, setFormData] = useState(() => dishFormDefaults(dish));

  useEffect(() => {
    setFormData(dishFormDefaults(dish));
  }, [dish?.id]);

  const [newIngredient, setNewIngredient] = useState('');
  const [newAdditional, setNewAdditional] = useState({ name: '', price: 0 });
  const [uploading, setUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleImageUpload = async (file: File, type: 'main' | 'variant', variantIndex?: number) => {
    try {
      setUploading(true);
      
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const response = await fetch(
        `${apiBaseUrl}/public/upload`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: uploadFormData
        }
      );

      const result = await response.json();
      
      if (result.success) {
        if (type === 'main') {
          setFormData(prev => ({ ...prev, images: [...prev.images, result.url] }));
        } else if (type === 'variant' && variantIndex !== undefined) {
          const newVariants = [...formData.variants];
          newVariants[variantIndex] = { ...newVariants[variantIndex], image: result.url };
          setFormData(prev => ({ ...prev, variants: newVariants }));
        }
        toast.success('Rasm yuklandi!');
      } else {
        toast.error('Yuklashda xatolik!');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Yuklashda xatolik!');
    } finally {
      setUploading(false);
    }
  };

  const addIngredient = () => {
    if (newIngredient.trim()) {
      setFormData(prev => ({ 
        ...prev, 
        ingredients: [...prev.ingredients, newIngredient.trim()] 
      }));
      setNewIngredient('');
    }
  };

  const removeIngredient = (index: number) => {
    setFormData(prev => ({ 
      ...prev, 
      ingredients: prev.ingredients.filter((_, i) => i !== index) 
    }));
  };

  const addAdditionalProduct = () => {
    if (newAdditional.name && newAdditional.price > 0) {
      setFormData(prev => ({ 
        ...prev, 
        additionalProducts: [...prev.additionalProducts, newAdditional] 
      }));
      setNewAdditional({ name: '', price: 0 });
    }
  };

  const removeAdditionalProduct = (index: number) => {
    setFormData(prev => ({ 
      ...prev, 
      additionalProducts: prev.additionalProducts.filter((_, i) => i !== index) 
    }));
  };

  const addVariant = () => {
    setFormData(prev => ({ 
      ...prev, 
      variants: [...prev.variants, { name: '', image: '', price: 0, prepTime: '20-30 daqiqa', commission: 0 }] 
    }));
  };

  const updateVariant = (index: number, field: string, value: any) => {
    const newVariants = [...formData.variants];
    newVariants[index] = { ...newVariants[index], [field]: value };
    setFormData(prev => ({ ...prev, variants: newVariants }));
  };

  const removeVariant = (index: number) => {
    setFormData(prev => ({ 
      ...prev, 
      variants: prev.variants.filter((_, i) => i !== index) 
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || formData.variants.length === 0) {
      toast.error('Taom nomi va kamida 1 ta variant kerak!');
      return;
    }

    const cErr = validateVariantCommissionsClient(
      formData.variants.map((v: any) => ({ commission: v.commission })),
      'Taom',
    );
    if (cErr) {
      toast.error(cErr);
      return;
    }

    try {
      setIsSubmitting(true);
      
      const url = dish
        ? `${apiBaseUrl}/dishes/${encodeURIComponent(dish.id)}`
        : `${apiBaseUrl}/restaurants/${encodeURIComponent(restaurantId)}/dishes`;
      
      const response = await fetch(url, {
        method: dish ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success(dish ? 'Taom yangilandi! 🎉' : 'Taom qo\'shildi! 🎉');
        onSuccess();
        onClose();
      } else {
        toast.error(result.error || 'Xatolik yuz berdi!');
      }
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Xatolik yuz berdi!');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 app-safe-pad bg-black/60 backdrop-blur-sm z-[100] animate-fadeIn"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-5xl md:max-h-[90vh] z-[101] rounded-3xl overflow-hidden animate-slideUp"
        style={{ 
          background: isDark ? '#1a1a1a' : '#ffffff',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between p-6 border-b"
          style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: `${accentColor.color}20` }}
            >
              <Utensils className="w-6 h-6" style={{ color: accentColor.color }} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{dish ? 'Taomni tahrirlash' : 'Taom qo\'shish'}</h2>
              <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                {dish ? 'Taom ma\'lumotlarini yangilash' : 'Yangi taom qo\'shish'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90"
            style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="space-y-6">
            {/* Basic Info */}
            <div>
              <label className="block text-sm font-bold mb-2">Taom nomi *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                }}
                placeholder="Masalan: Osh"
                required
              />
            </div>

            {/* Main Images */}
            <div>
              <label className="block text-sm font-bold mb-2">Rasmlar</label>
              <div className="grid grid-cols-4 gap-3">
                {formData.images.map((img, idx) => (
                  <div key={idx} className="relative aspect-square rounded-xl overflow-hidden">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ 
                        ...prev, 
                        images: prev.images.filter((_, i) => i !== idx) 
                      }))}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ))}
                {formData.images.length < 5 && (
                  <div className="relative aspect-square">
                    <div 
                      className="w-full h-full rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer"
                      style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)' }}
                    >
                      <Upload className="w-8 h-8" style={{ color: accentColor.color }} />
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'main')}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Nutrition & Weight */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2">Kaloriya (kcal)</label>
                <input
                  type="number"
                  value={formData.kcal}
                  onChange={(e) => setFormData(prev => ({ ...prev, kcal: Number(e.target.value) }))}
                  className="w-full px-4 py-3 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                  }}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Calories</label>
                <input
                  type="number"
                  value={formData.calories}
                  onChange={(e) => setFormData(prev => ({ ...prev, calories: Number(e.target.value) }))}
                  className="w-full px-4 py-3 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                  }}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Vazn</label>
                <input
                  type="text"
                  value={formData.weight}
                  onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                  }}
                  placeholder="500g"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-bold mb-2">Tavsif</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl resize-none"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                }}
                rows={3}
                placeholder="Taom haqida ma'lumot"
              />
            </div>

            {/* Ingredients */}
            <div>
              <label className="block text-sm font-bold mb-2">Tarkib</label>
              <div className="space-y-2">
                {formData.ingredients.map((ing, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div 
                      className="flex-1 px-3 py-2 rounded-lg"
                      style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }}
                    >
                      {ing}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeIngredient(idx)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(239, 68, 68, 0.2)' }}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newIngredient}
                    onChange={(e) => setNewIngredient(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addIngredient())}
                    className="flex-1 px-4 py-2 rounded-lg"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                    }}
                    placeholder="Masalan: Go'sht"
                  />
                  <button
                    type="button"
                    onClick={addIngredient}
                    className="px-4 py-2 rounded-lg font-bold"
                    style={{ background: accentColor.color, color: '#fff' }}
                  >
                    Qo'shish
                  </button>
                </div>
              </div>
            </div>

            {/* Additional Products */}
            <div>
              <label className="block text-sm font-bold mb-2">Qo'shimcha mahsulotlar</label>
              <div className="space-y-2">
                {formData.additionalProducts.map((prod: any, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div 
                      className="flex-1 px-3 py-2 rounded-lg flex items-center justify-between"
                      style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }}
                    >
                      <span>{prod.name}</span>
                      <span className="font-bold" style={{ color: accentColor.color }}>
                        {prod.price.toLocaleString()} so'm
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAdditionalProduct(idx)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(239, 68, 68, 0.2)' }}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newAdditional.name}
                    onChange={(e) => setNewAdditional(prev => ({ ...prev, name: e.target.value }))}
                    className="flex-1 px-4 py-2 rounded-lg"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                    }}
                    placeholder="Nomi"
                  />
                  <input
                    type="number"
                    value={newAdditional.price}
                    onChange={(e) => setNewAdditional(prev => ({ ...prev, price: Number(e.target.value) }))}
                    className="w-32 px-4 py-2 rounded-lg"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                    }}
                    placeholder="Narx"
                  />
                  <button
                    type="button"
                    onClick={addAdditionalProduct}
                    className="px-4 py-2 rounded-lg font-bold"
                    style={{ background: accentColor.color, color: '#fff' }}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Variants */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-bold">Variantlar *</label>
                <button
                  type="button"
                  onClick={addVariant}
                  className="px-4 py-2 rounded-lg font-bold flex items-center gap-2"
                  style={{ background: accentColor.color, color: '#fff' }}
                >
                  <Plus className="w-4 h-4" />
                  Variant qo'shish
                </button>
              </div>
              <div className="space-y-3">
                {formData.variants.map((variant: any, idx) => (
                  <div 
                    key={idx} 
                    className="p-4 rounded-xl space-y-3"
                    style={{ 
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold">Variant {idx + 1}</h4>
                      <button
                        type="button"
                        onClick={() => removeVariant(idx)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(239, 68, 68, 0.2)' }}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={variant.name}
                        onChange={(e) => updateVariant(idx, 'name', e.target.value)}
                        className="px-3 py-2 rounded-lg"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                        }}
                        placeholder="Variant nomi (Kichik, Katta)"
                      />
                      <input
                        type="number"
                        value={variant.price}
                        onChange={(e) => updateVariant(idx, 'price', Number(e.target.value))}
                        className="px-3 py-2 rounded-lg"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                        }}
                        placeholder="Narx"
                      />
                      <input
                        type="number"
                        min={0}
                        max={15}
                        value={variant.commission ?? ''}
                        onChange={(e) =>
                          updateVariant(
                            idx,
                            'commission',
                            e.target.value === '' ? 0 : Number(e.target.value),
                          )
                        }
                        className="px-3 py-2 rounded-lg col-span-2 sm:col-span-1"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                        }}
                        placeholder="Berish % (0–15)"
                      />
                    </div>
                    <p className="text-xs opacity-60 -mt-1">{platformCommissionHintUz()}</p>
                    <input
                      type="text"
                      value={variant.prepTime}
                      onChange={(e) => updateVariant(idx, 'prepTime', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                      }}
                      placeholder="Tayyorlash vaqti (20-30 daqiqa)"
                    />
                    {variant.image ? (
                      <div className="relative w-full h-32 rounded-lg overflow-hidden">
                        <img src={variant.image} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => updateVariant(idx, 'image', '')}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    ) : (
                      <div className="relative w-full h-32">
                        <div 
                          className="w-full h-full rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer"
                          style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)' }}
                        >
                          <Upload className="w-6 h-6" style={{ color: accentColor.color }} />
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'variant', idx)}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isPopular}
                  onChange={(e) => setFormData(prev => ({ ...prev, isPopular: e.target.checked }))}
                  className="w-5 h-5 rounded"
                />
                <Star className="w-5 h-5" style={{ color: '#f59e0b' }} />
                <span>Mashhur</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isNatural}
                  onChange={(e) => setFormData(prev => ({ ...prev, isNatural: e.target.checked }))}
                  className="w-5 h-5 rounded"
                />
                <Leaf className="w-5 h-5" style={{ color: '#10b981' }} />
                <span>Tabiiy</span>
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || uploading}
              className="w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: accentColor.color, color: '#ffffff' }}
            >
              {isSubmitting && <Loader2 className="w-6 h-6 animate-spin shrink-0" />}
              {isSubmitting ? '' : dish ? 'Yangilash' : 'Taom qo\'shish'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
