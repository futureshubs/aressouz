import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { uploadDillerProductQrcodeImage } from '../../utils/dillerProductImageUpload';

type Props = {
  imageUrl: string;
  onChange: (url: string) => void;
  isDark: boolean;
  accentColor: string;
};

export function DillerQrcodeImageField({ imageUrl, onChange, isDark, accentColor }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const pick = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadDillerProductQrcodeImage(file);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onChange(res.url);
      toast.success('Rasm yuklandi');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <label className="block text-xs font-medium opacity-80 mb-1">
        QR buyurtma rasmi <span className="opacity-50 font-normal">(ixtiyoriy)</span>
      </label>
      <p className="text-[10px] opacity-45 mb-2 leading-relaxed">
        Faqat /qrcode sahifasida mahsulot yonida ko‘rinadi. Diller panel ro‘yxatida ko‘rinmaydi.
      </p>

      {imageUrl ? (
        <div className="flex items-center gap-3">
          <div
            className="w-16 h-16 rounded-xl overflow-hidden border shrink-0"
            style={{ borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }}
          >
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="text-xs font-semibold py-2 px-3 rounded-xl border active:opacity-80 disabled:opacity-40"
              style={{
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                color: accentColor,
              }}
            >
              Boshqa rasm
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={() => onChange('')}
              className="text-xs font-semibold py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 text-red-400 active:opacity-80 disabled:opacity-40"
              style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              O‘chirish
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="w-full py-4 rounded-xl border border-dashed flex flex-col items-center justify-center gap-2 active:opacity-80 disabled:opacity-40"
          style={{
            borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
            color: accentColor,
          }}
        >
          {uploading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <>
              <ImagePlus className="w-6 h-6" />
              <span className="text-xs font-semibold">Rasm yuklash</span>
            </>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
