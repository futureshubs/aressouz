import { X, Upload, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c`;

interface AddCompletedProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  portfolioId: string;
  accessToken: string;
  accentColor: { color: string };
  isDark: boolean;
  onSuccess?: () => void;
}

export function AddCompletedProjectModal({
  isOpen,
  onClose,
  portfolioId,
  accessToken,
  accentColor,
  isDark,
  onSuccess,
}: AddCompletedProjectModalProps) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);

  if (!isOpen) return null;

  const textPrimary = isDark ? '#ffffff' : '#111827';
  const textSecondary = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      const uploadedImages: string[] = [];

      for (const file of Array.from(files)) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          alert('Faqat rasm yuklash mumkin');
          continue;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          alert('Rasm hajmi 10MB dan oshmasligi kerak');
          continue;
        }

        // Upload to server
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE_URL}/api/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-Access-Token': accessToken || '',
          },
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Faylni yuklashda xatolik');
        }

        const data = await response.json();
        uploadedImages.push(data.url);
      }

      setImages([...images, ...uploadedImages]);
    } catch (error: any) {
      console.error('Image upload error:', error);
      alert(error.message || 'Rasmni yuklashda xatolik');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (images.length === 0) {
      alert('Kamida bitta rasm yuklang');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/services/portfolio/${portfolioId}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Access-Token': accessToken,
        },
        body: JSON.stringify({
          title: title || 'Yakunlangan loyiha',
          description,
          images,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Loyiha qo\'shishda xatolik');
      }

      alert('Loyiha muvaffaqiyatli qo\'shildi!');
      onSuccess?.();
      onClose();
      
      // Reset form
      setTitle('');
      setDescription('');
      setImages([]);
    } catch (error: any) {
      console.error('Add project error:', error);
      alert(error.message || 'Loyiha qo\'shishda xatolik');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center p-4"
      style={{
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6"
        style={{
          background: isDark ? 'rgba(0, 0, 0, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          boxShadow: isDark
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold" style={{ color: textPrimary }}>
            Yakunlangan ish qo'shish
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full transition-all active:scale-95"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
            }}
          >
            <X className="w-6 h-6" style={{ color: textPrimary }} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: textPrimary }}>
              Loyiha nomi (ixtiyoriy)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Masalan: Uy ta'miri"
              className="w-full px-4 py-3 rounded-xl outline-none transition-all"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                border: `1px solid ${borderColor}`,
                color: textPrimary,
              }}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: textPrimary }}>
              Tavsif (ixtiyoriy)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Loyiha haqida qisqacha ma'lumot..."
              rows={4}
              className="w-full px-4 py-3 rounded-xl outline-none transition-all resize-none"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                border: `1px solid ${borderColor}`,
                color: textPrimary,
              }}
            />
          </div>

          {/* Images */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: textPrimary }}>
              Rasmlar *
            </label>

            {/* Upload Button */}
            <label
              className="flex flex-col items-center justify-center gap-2 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:scale-[1.02]"
              style={{
                borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
              }}
            >
              <Upload className="size-8" style={{ color: accentColor.color }} />
              <span className="text-sm font-medium" style={{ color: textSecondary }}>
                {uploading ? 'Yuklanmoqda...' : 'Rasmlarni yuklash uchun bosing'}
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>

            {/* Image Preview */}
            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mt-4">
                {images.map((image, index) => (
                  <div key={index} className="relative aspect-square rounded-xl overflow-hidden">
                    <img
                      src={image}
                      alt={`Project ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500 text-white transition-all active:scale-90"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || images.length === 0}
            className="w-full py-4 rounded-xl font-semibold transition-all disabled:opacity-50 active:scale-[0.98]"
            style={{
              background: accentColor.color,
              color: '#fff',
              boxShadow: `0 4px 12px ${accentColor.color}40`,
            }}
          >
            {loading ? 'Yuklanmoqda...' : 'Loyiha qo\'shish'}
          </button>
        </form>
      </div>
    </div>
  );
}
