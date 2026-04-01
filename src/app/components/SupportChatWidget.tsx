import { MessageSquareText } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { SupportChatModal } from './SupportChatModal';

interface SupportChatWidgetProps {
  /** AppContent activeTab */
  activeTab: string;
  /** Hide when profile overlay open */
  isProfileOpen: boolean;
}

const STORAGE_KEY = 'support_chat_widget_pos_v1';
const BTN = 56;
const MARGIN = 8;
const DRAG_THRESHOLD_PX = 10;

interface Pos {
  left: number;
  top: number;
}

const shouldShowOnTab = (tab: string) => {
  const t = String(tab || '').toLowerCase();
  return t !== 'community';
};

function layoutBodyInset(side: 'top' | 'bottom'): number {
  if (typeof document === 'undefined') return 0;
  const raw =
    side === 'top'
      ? getComputedStyle(document.body).paddingTop
      : getComputedStyle(document.body).paddingBottom;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

function clampPosition(p: Pos): Pos {
  if (typeof window === 'undefined') return p;
  const insetTop = layoutBodyInset('top');
  const insetBottom = layoutBodyInset('bottom');
  const minT = Math.max(MARGIN, insetTop + 4);
  const maxL = window.innerWidth - BTN - MARGIN;
  const maxT = window.innerHeight - BTN - Math.max(MARGIN, insetBottom + 4);
  return {
    left: Math.min(Math.max(MARGIN, p.left), maxL),
    top: Math.min(Math.max(minT, p.top), Math.max(minT, maxT)),
  };
}

function defaultPosition(): Pos {
  if (typeof window === 'undefined') return { left: 16, top: 400 };
  // Old fixed: right-4 bottom ~5.75rem + tab bar — taxminan past-o‘ng
  const bottomReserve = window.matchMedia('(min-width: 640px)').matches ? 112 : 100;
  return clampPosition({
    left: window.innerWidth - BTN - 16,
    top: window.innerHeight - BTN - bottomReserve,
  });
}

export function SupportChatWidget({ activeTab, isProfileOpen }: SupportChatWidgetProps) {
  const { theme, accentColor, supportChatEnabled } = useTheme() as any;
  const isDark = theme === 'dark';
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Pos | null>(null);
  const posRef = useRef<Pos | null>(null);
  const suppressClickRef = useRef(false);
  const dragRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    originL: 0,
    originT: 0,
  });

  useEffect(() => {
    posRef.current = position;
  }, [position]);

  useEffect(() => {
    if (!supportChatEnabled) {
      setOpen(false);
    }
  }, [supportChatEnabled]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Pos;
        if (typeof p.left === 'number' && typeof p.top === 'number') {
          setPosition(clampPosition(p));
          return;
        }
      }
    } catch {
      /* noop */
    }
    setPosition(defaultPosition());
  }, []);

  useEffect(() => {
    const onResize = () => {
      setPosition((prev) => (prev ? clampPosition(prev) : null));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const savePosition = useCallback((p: Pos) => {
    const c = clampPosition(p);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
    } catch {
      /* noop */
    }
    setPosition(c);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const p = posRef.current;
    if (!p) return;
    dragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      originL: p.left,
      originT: p.top,
    };
    (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.active || !posRef.current) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) {
      d.moved = true;
    }
    if (d.moved) {
      setPosition(
        clampPosition({
          left: d.originL + dx,
          top: d.originT + dy,
        }),
      );
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.active) return;
    d.active = false;
    try {
      (e.currentTarget as HTMLButtonElement).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    if (d.moved && posRef.current) {
      savePosition(posRef.current);
      suppressClickRef.current = true;
    }
    d.moved = false;
  };

  const onClick = (e: React.MouseEvent) => {
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClickRef.current = false;
      return;
    }
    setOpen(true);
  };

  if (!supportChatEnabled) return null;
  if (isProfileOpen) return null;
  if (!shouldShowOnTab(activeTab)) return null;
  if (position == null) return null;

  return (
    <>
      <button
        type="button"
        className="fixed z-50 touch-none select-none cursor-grab active:cursor-grabbing active:scale-95 transition-transform"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onClick}
        aria-label="Support chat — bosib chat, ushlab siljiting"
        title="Chat: bitta bosish. Joylashuv: ushlab sudrang"
        style={{
          left: position.left,
          top: position.top,
          width: BTN,
          height: BTN,
          borderRadius: 18,
          background: accentColor.gradient,
          boxShadow: `0 14px 40px ${accentColor.color}55`,
          border: isDark ? '0.5px solid rgba(255,255,255,0.12)' : '0.5px solid rgba(0,0,0,0.08)',
          touchAction: 'none',
        }}
      >
        <MessageSquareText className="size-6 mx-auto pointer-events-none" style={{ color: '#fff' }} />
      </button>

      <SupportChatModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
