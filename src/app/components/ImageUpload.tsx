import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { uploadImage, validateImageFile, formatFileSize } from '../services/imageService';
import { useAuth } from '../context/AuthContext';

interface ImageUploadProps {
  onUploadComplete: (imageUrl: string) => void;
  onUploadError?: (error: string) => void;
  maxFiles?: number;
  currentImages?: string[];
}

export function ImageUpload({
  onUploadComplete,
  onUploadError,
  maxFiles = 5,
  currentImages = [],
}: ImageUploadProps) {
  const { session } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<string[]>(currentImages);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    // Check if user is authenticated
    if (!session?.access_token) {
      onUploadError?.('Avtorizatsiya kerak. Iltimos, profilga kirib qayta urinib ko\'ring.');
      return;
    }

    // Check max files limit
    if (previewUrls.length + files.length > maxFiles) {
      onUploadError?.(`Maksimal ${maxFiles} ta rasm yuklash mumkin`);
      return;
    }

    setUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Validate file
        const validation = validateImageFile(file);
        if (!validation.valid) {
          onUploadError?.(validation.error || 'Fayl noto\'g\'ri');
          continue;
        }

        // Upload to R2
        console.log('🚀 Starting upload for file:', file.name);
        const result = await uploadImage(file, session.access_token);
        console.log('✅ Upload successful:', result);
        
        // Add to preview
        setPreviewUrls(prev => [...prev, result.url]);
        
        // Notify parent
        onUploadComplete(result.url);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      
      // Check for specific error messages
      if (error.message.includes('Token') || error.message.includes('Avtorizatsiya')) {
        onUploadError?.('Avtorizatsiya kerak. Iltimos, profilga kirib qayta urinib ko\'ring.');
      } else {
        onUploadError?.(error.message || 'Rasm yuklashda xatolik');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const removeImage = (index: number) => {
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
          dragActive
            ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/5'
            : 'border-white/10 hover:border-white/20'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
          disabled={uploading || previewUrls.length >= maxFiles}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-12 h-12 text-[var(--accent-color)] animate-spin" />
            <p className="text-white/60"></p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-[var(--accent-color)]/10 flex items-center justify-center">
              <Upload className="w-8 h-8 text-[var(--accent-color)]" />
            </div>
            <div>
              <p className="text-white font-medium mb-1">
                Rasmlarni yuklash uchun bosing yoki torting
              </p>
              <p className="text-white/40 text-sm">
                PNG, JPG, WebP, GIF (Maksimal 10MB)
              </p>
              <p className="text-white/40 text-xs mt-1">
                {previewUrls.length} / {maxFiles} rasm yuklandi
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={previewUrls.length >= maxFiles}
              className="px-6 py-2 bg-[var(--accent-color)] text-white rounded-xl font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Rasm tanlash
            </button>
          </div>
        )}
      </div>

      {/* Preview Grid */}
      {previewUrls.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {previewUrls.map((url, index) => (
            <div
              key={index}
              className="relative aspect-square rounded-xl overflow-hidden bg-white/5 group"
            >
              <img
                src={url}
                alt={`Preview ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute top-2 right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}