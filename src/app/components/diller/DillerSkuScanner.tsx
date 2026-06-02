import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';

type Props = {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  isDark: boolean;
};

export function DillerSkuScanner({ open, onClose, onScan, isDark }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const busyRef = useRef(false);
  const [manual, setManual] = useState('');

  useEffect(() => {
    if (!open) return;
    setManual('');
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        toast.error('Kameraga kirish mumkin emas — qo‘lda yozing');
      }
    })();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current?.srcObject) {
        const s = videoRef.current.srcObject as MediaStream;
        s.getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    type Detector = { detect: (src: CanvasImageSource) => Promise<Array<{ rawValue?: string }>> };
    const DetectorCtor = (
      window as unknown as { BarcodeDetector?: new (opts?: { formats: string[] }) => Detector }
    ).BarcodeDetector;
    if (!DetectorCtor) return;

    const detector = new DetectorCtor({
      formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'itf', 'qr_code'],
    });

    const tick = async () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || busyRef.current) {
        requestAnimationFrame(() => void tick());
        return;
      }
      try {
        const codes = await detector.detect(video);
        const raw = String(codes?.[0]?.rawValue || '').trim();
        if (raw) {
          busyRef.current = true;
          onScan(raw);
          onClose();
          setTimeout(() => {
            busyRef.current = false;
          }, 800);
          return;
        }
      } catch {
        // ignore
      }
      requestAnimationFrame(() => void tick());
    };
    void tick();
    return () => {
      cancelled = true;
      busyRef.current = false;
    };
  }, [open, onClose, onScan]);

  if (!open) return null;

  const applyManual = () => {
    const code = manual.trim();
    if (!code) {
      toast.error('Kod kiriting');
      return;
    }
    onScan(code);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col app-safe-pad" style={{ background: 'rgba(0,0,0,0.92)' }}>
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-lg font-bold text-white">SKU / shtrix-kod</h2>
        <button type="button" onClick={onClose} className="p-2 rounded-xl bg-white/10 text-white" aria-label="Yopish">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 relative mx-4 rounded-2xl overflow-hidden bg-black min-h-[40vh]">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-56 h-32 border-2 border-emerald-400 rounded-xl" style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }} />
        </div>
      </div>
      <p className="text-center text-xs text-white/60 px-4 py-2">Kamerani shtrix-kodga yo‘naltiring</p>
      <div className="p-4 space-y-2">
        <label className="text-xs font-medium text-white/70">Yoki qo‘lda</label>
        <div className="flex gap-2">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="SKU yoki barcode"
            className={`flex-1 px-3 py-2.5 rounded-xl border text-sm ${
              isDark ? 'bg-white/10 border-white/15 text-white' : 'bg-white border-gray-200'
            }`}
            onKeyDown={(e) => e.key === 'Enter' && applyManual()}
          />
          <button type="button" onClick={applyManual} className="px-4 py-2.5 rounded-xl font-bold bg-emerald-500 text-slate-900">
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
