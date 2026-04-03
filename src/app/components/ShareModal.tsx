import { useState, useEffect } from 'react';
import { X, Copy, Check, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useVisibilityTick } from '../utils/visibilityRefetch';
import { useTheme } from '../context/ThemeContext';
import { projectId, publicAnonKey, edgeFunctionSlug } from '../../../utils/supabase/info';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  placeId: string;
  placeName: string;
  placeImage: string;
}

export function ShareModal({ isOpen, onClose, placeId, placeName, placeImage }: ShareModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [shareUrl, setShareUrl] = useState('');
  const [shareCode, setShareCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const visibilityRefetchTick = useVisibilityTick();

  const generateShareLink = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/${edgeFunctionSlug}/places/${placeId}/share`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        throw new Error('Link yaratishda xatolik');
      }

      const data = await response.json();
      setShareUrl(data.shareUrl);
      setShareCode(data.shareCode);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Link yaratishda xatolik';
      console.error('Share link generation error:', err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy error:', err);
      setError('Nusxa olishda xatolik');
    }
  };

  const shareToTelegram = () => {
    const text = `${placeName} - Aresso.app da ko'ring!`;
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`,
      '_blank',
    );
  };

  const shareToWhatsApp = () => {
    const text = `${placeName} - Aresso.app da ko'ring! ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  useEffect(() => {
    if (!isOpen) return;
    void generateShareLink();
  }, [isOpen, placeId, visibilityRefetchTick]);

  const cardBg = isDark ? 'bg-[#0a0a0a] border-white/10' : 'bg-card border-border';
  const subtext = isDark ? 'text-white/60' : 'text-muted-foreground';
  const labelText = isDark ? 'text-white/80' : 'text-foreground/80';
  const previewBox = isDark ? 'bg-white/5' : 'bg-muted/80';
  const inputBox = isDark ? 'bg-white/5 border-white/10' : 'bg-muted border border-border';
  const codeBox = isDark ? 'bg-white/5 border-white/10' : 'bg-muted/60 border border-border';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className={`fixed inset-0 z-50 backdrop-blur-sm ${isDark ? 'bg-black/60' : 'bg-black/40'}`}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90%] max-w-md"
          >
            <div className={`rounded-3xl shadow-2xl overflow-hidden border ${cardBg}`}>
              <div className={`relative p-6 pb-4 border-b ${isDark ? 'border-white/10' : 'border-border'}`}>
                <button
                  onClick={onClose}
                  className={`absolute top-4 right-4 p-2 rounded-xl transition-colors ${
                    isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  <X className={`size-5 ${isDark ? 'text-white' : 'text-foreground'}`} />
                </button>

                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-[#14b8a6]/20">
                    <Share2 className="size-6 text-[#14b8a6]" />
                  </div>
                  <div>
                    <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-foreground'}`}>Ulashish</h3>
                    <p className={`text-sm mt-0.5 ${subtext}`}>Joyni do'stlaringiz bilan ulashing</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className={`flex items-center gap-3 p-3 rounded-2xl ${previewBox}`}>
                  <img src={placeImage} alt={placeName} className="w-16 h-16 rounded-xl object-cover" />
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-base font-semibold truncate ${isDark ? 'text-white' : 'text-foreground'}`}>
                      {placeName}
                    </h4>
                    <p className={`text-sm ${subtext}`}>Aresso.app</p>
                  </div>
                </div>

                {loading && (
                  <div className="text-center py-4">
                    <div className="inline-block w-8 h-8 border-4 border-[#14b8a6]/30 border-t-[#14b8a6] rounded-full animate-spin" />
                    <p className={`${subtext} mt-2`}>Link yaratilmoqda...</p>
                  </div>
                )}

                {error && (
                  <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
                    <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                  </div>
                )}

                {shareUrl && !loading && (
                  <>
                    <div className="space-y-3">
                      <label className={`text-sm font-medium ${labelText}`}>Ulashish linki:</label>
                      <div className="flex items-center gap-2">
                        <div className={`flex-1 px-4 py-3 rounded-xl border ${inputBox}`}>
                          <p className={`text-sm truncate ${isDark ? 'text-white/80' : 'text-foreground/80'}`}>
                            {shareUrl}
                          </p>
                        </div>
                        <button
                          onClick={copyToClipboard}
                          className="p-3 rounded-xl bg-[#14b8a6] hover:bg-[#14b8a6]/90 transition-all active:scale-95"
                        >
                          {copied ? <Check className="size-5 text-white" /> : <Copy className="size-5 text-white" />}
                        </button>
                      </div>
                      {copied && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-sm text-[#14b8a6] text-center"
                        >
                          ✓ Nusxa olindi!
                        </motion.p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <label className={`text-sm font-medium ${labelText}`}>Ijtimoiy tarmoqlarda:</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={shareToTelegram}
                          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#0088cc] hover:bg-[#0088cc]/90 transition-all active:scale-95"
                        >
                          <svg className="size-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                          </svg>
                          <span className="text-sm font-semibold text-white">Telegram</span>
                        </button>

                        <button
                          onClick={shareToWhatsApp}
                          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#25D366] hover:bg-[#25D366]/90 transition-all active:scale-95"
                        >
                          <svg className="size-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                          </svg>
                          <span className="text-sm font-semibold text-white">WhatsApp</span>
                        </button>
                      </div>
                    </div>

                    <div className={`p-4 rounded-xl border ${codeBox}`}>
                      <p className={`text-xs mb-1 ${isDark ? 'text-white/40' : 'text-muted-foreground'}`}>Ulashish kodi:</p>
                      <p className="text-sm font-mono text-[#14b8a6]">{shareCode}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
