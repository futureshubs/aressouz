/** iOS-style floating bottom nav shell (BottomNav bilan bir xil). */
export function floatingNavShellStyle(isDark: boolean) {
  return {
    background: isDark ? 'rgba(28, 28, 30, 0.78)' : 'rgba(255, 255, 255, 0.78)',
    backdropFilter: 'blur(44px) saturate(190%)',
    WebkitBackdropFilter: 'blur(44px) saturate(190%)',
    border: isDark ? '0.5px solid rgba(255,255,255,0.14)' : '0.5px solid rgba(255,255,255,0.85)',
    boxShadow: isDark
      ? '0 12px 48px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.35), inset 0 0.5px 0 rgba(255,255,255,0.1)'
      : '0 12px 48px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.06), inset 0 0.5px 0 rgba(255,255,255,0.95)',
    borderRadius: 28,
  } as const;
}
