import { Component, type ErrorInfo, type ReactNode } from 'react';

function keysEqual(a: unknown[] | undefined, b: unknown[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

type Props = {
  children: ReactNode;
  /** O‘zgarganda xatolik holati avtomatik tozalanadi (masalan: tab yoki marshrut) */
  resetKeys?: unknown[];
  /** Seller panel ichi: to‘liq ekran emas, yon paneldan boshqa tabga o‘tish mumkin */
  embedded?: boolean;
};

type State = { hasError: boolean; error: Error | null };

/**
 * Panel / lazy-chunk xatolari uchun. resetKeys — foydalanuvchi boshqa bo‘limga o‘tganda
 * to‘liq sahifani qayta yuklamasdan tiklanadi.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('RouteErrorBoundary:', error, errorInfo);
  }

  componentDidUpdate(prevProps: Props) {
    if (!keysEqual(this.props.resetKeys, prevProps.resetKeys) && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const embedded = this.props.embedded;
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: embedded ? 'min(420px, 60vh)' : '100vh',
            padding: embedded ? '24px 16px' : '20px',
            background: embedded ? 'transparent' : '#000',
            color: embedded ? 'inherit' : '#fff',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <h1 style={{ fontSize: embedded ? '18px' : '24px', marginBottom: '16px' }}>⚠️ Xatolik yuz berdi</h1>
          <p
            style={{
              marginBottom: '16px',
              opacity: embedded ? 0.85 : 0.7,
              textAlign: 'center',
              maxWidth: '420px',
            }}
          >
            {this.state.error.message}
          </p>
          <p style={{ marginBottom: '20px', opacity: 0.55, fontSize: '14px', textAlign: 'center', maxWidth: '400px' }}>
            Chapdagi menyudan boshqa bo‘limga o‘ting yoki «Qayta urinish»ni bosing.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={this.handleRetry}
              style={{
                padding: '12px 24px',
                background: '#0f766e',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
              }}
            >
              Qayta urinish
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '12px 24px',
                background: '#14b8a6',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
              }}
            >
              Qayta yuklash
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
