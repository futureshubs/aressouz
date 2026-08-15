/** iOS-style floating bottom nav shell (BottomNav bilan bir xil). */
export function floatingNavShellStyle(isDark: boolean) {
  return {
    background: isDark ? 'rgba(28, 28, 30, 0.78)' : 'rgba(255, 255, 255, 0.82)',
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
    border: isDark ? '0.5px solid rgba(255,255,255,0.14)' : '0.5px solid rgba(255,255,255,0.9)',
    boxShadow: isDark
      ? '0 12px 40px rgba(0,0,0,0.48), inset 0 0.5px 0 rgba(255,255,255,0.1)'
      : '0 8px 28px rgba(15,23,42,0.08), inset 0 0.5px 0 rgba(255,255,255,0.95)',
    borderRadius: 28,
  } as const;
}
