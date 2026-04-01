import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useTheme } from '../context/ThemeContext';
import { toast } from 'sonner';
import MarketView from '../components/branch/MarketView';
import { PendingCashMarketBranchPanel } from '../components/branch/PendingCashMarketBranchPanel';
import { CashierPanel } from '../components/branch/CashierPanel';
import { OperatorSupportTabs } from '../components/branch/OperatorSupportTabs';
import { Payments } from '../components/branch/Payments';

type StaffRole = 'warehouse' | 'operator' | 'cashier' | 'accountant' | 'support';

export default function StaffDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const expectedRoleFromPath = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/omborchi')) return 'warehouse';
    // Operator paneli o'chirilgan: /operator url eski bo'lishi mumkin, uni supportga yo'naltiramiz.
    if (path.startsWith('/operator')) return 'support';
    if (path.startsWith('/support')) return 'support';
    if (path.startsWith('/kassa')) return 'cashier';
    return undefined;
  }, [location.pathname]);

  const panelLoginPath = useMemo(() => {
    if (expectedRoleFromPath === 'warehouse') return '/omborchi';
    if (expectedRoleFromPath === 'support') return '/support';
    if (expectedRoleFromPath === 'cashier') return '/kassa';
    return '/xodim';
  }, [expectedRoleFromPath]);

  const roleToPanelLoginPath = (r: StaffRole) => {
    if (r === 'warehouse') return '/omborchi';
    if (r === 'operator') return '/support';
    if (r === 'support') return '/support';
    if (r === 'cashier') return '/kassa';
    return '/xodim';
  };

  const roleToPanelDashboardPath = (r: StaffRole) => {
    if (r === 'warehouse') return '/omborchi/dashboard';
    if (r === 'operator') return '/support/dashboard';
    if (r === 'support') return '/support/dashboard';
    if (r === 'cashier') return '/kassa/dashboard';
    return '/xodim/dashboard';
  };

  const [session, setSession] = useState<any>(null);
  const [warehouseTab, setWarehouseTab] = useState<'market' | 'payments'>('market');
  const branchSession = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('branchSession') || 'null');
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('staffSession') || 'null');
      if (!s?.role) {
        // Kassa uchun login/parol hali yo'q: session bo'lmasa ham xabarni ko'rsatamiz.
        if (expectedRoleFromPath === 'cashier') return;
        navigate(panelLoginPath);
        return;
      }
      setSession(s);
    } catch {
      if (expectedRoleFromPath !== 'cashier') navigate(panelLoginPath);
    }
  }, [navigate, panelLoginPath, expectedRoleFromPath]);

  const role = session?.role as StaffRole | undefined;
  const effectiveRole: StaffRole | 'support' = role === 'operator' ? 'support' : role;
  const branchId = (branchSession?.id || branchSession?.branchId || branchSession?.branch_id) as string | undefined;

  useEffect(() => {
    if (role === 'accountant') navigate('/bogalter/dashboard');
  }, [role, navigate]);

  useEffect(() => {
    if (!role) return;
    // Kassa paneliga kirganda (hatto boshqa rol bilan session bo'lsa ham) operatorga o'tkazib yubormaymiz.
    if (expectedRoleFromPath === 'cashier') return;
    if (expectedRoleFromPath && role !== expectedRoleFromPath) {
      toast.error('Siz boshqa panelga kirgansiz. To‘g‘ri panelga o‘tkazdim.');
      navigate(roleToPanelDashboardPath(role));
    }
  }, [role, expectedRoleFromPath, navigate]);

  if (expectedRoleFromPath === 'cashier') {
    // Kassa panelida session majburiy emas: branchSession bo'lsa filial kassa ma'lumotlari ko'rinadi.
    // QR/to'lovlar hozircha demo ko'rinishda bo'lishi mumkin.
    // (Cashier login backendda yoqilmagan bo'lsa ham, UI ishlashi uchun shu yerda render qilamiz.)
    return (
      // eslint-disable-next-line react/jsx-no-undef
      <CashierPanel branchId={branchId} branchInfo={{ region: branchSession?.region || '', district: branchSession?.district || '', phone: branchSession?.phone || '' }} />
    );
  }

  if (!session || !role || !branchId) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: isDark ? '#fff' : '#111827' }}>Yuklanmoqda...</div>
      </div>
    );
  }

  const branchInfo = {
    region: branchSession?.region || '',
    district: branchSession?.district || '',
    phone: branchSession?.phone || '',
  };

  return (
    <div
      className="min-h-screen"
      style={{
        background: isDark ? '#000000' : '#f9fafb',
        color: isDark ? '#ffffff' : '#111827',
      }}
    >
      <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              {effectiveRole === 'warehouse'
                ? 'Omborchi paneli'
                : effectiveRole === 'support'
                ? 'Support paneli'
                : effectiveRole === 'cashier'
                ? 'Kassa paneli'
                : 'Xodim paneli'}
            </h1>
            <p style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)', marginTop: 4, fontSize: 13 }}>
              {branchSession?.branchName || 'Filial'} • {session?.firstName} {session?.lastName}
            </p>
          </div>

          <button
            onClick={() => {
              localStorage.removeItem('staffSession');
              toast.success('Chiqildi');
              navigate('/xodim');
            }}
            className="px-4 py-2 rounded-xl font-semibold"
            style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
          >
            Chiqish
          </button>
        </div>

        {effectiveRole === 'warehouse' && (
          <div>
            {/* Warehouse role: filyal market bo'limi (read-only) */}
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setWarehouseTab('market')}
                className="px-4 py-2 rounded-xl font-semibold transition-all active:scale-95"
                style={{
                  background:
                    warehouseTab === 'market'
                      ? accentColor.gradient
                      : isDark
                        ? 'rgba(255, 255, 255, 0.06)'
                        : 'rgba(0, 0, 0, 0.04)',
                  color:
                    warehouseTab === 'market'
                      ? '#ffffff'
                      : isDark
                        ? 'rgba(255, 255, 255, 0.7)'
                        : '#111827',
                  border:
                    warehouseTab === 'market'
                      ? 'none'
                      : isDark
                        ? '1px solid rgba(255,255,255,0.08)'
                        : '1px solid rgba(0,0,0,0.06)',
                }}
              >
                Market
              </button>
              <button
                onClick={() => setWarehouseTab('payments')}
                className="px-4 py-2 rounded-xl font-semibold transition-all active:scale-95"
                style={{
                  background:
                    warehouseTab === 'payments'
                      ? accentColor.gradient
                      : isDark
                        ? 'rgba(255, 255, 255, 0.06)'
                        : 'rgba(0, 0, 0, 0.04)',
                  color:
                    warehouseTab === 'payments'
                      ? '#ffffff'
                      : isDark
                        ? 'rgba(255, 255, 255, 0.7)'
                        : '#111827',
                  border:
                    warehouseTab === 'payments'
                      ? 'none'
                      : isDark
                        ? '1px solid rgba(255,255,255,0.08)'
                        : '1px solid rgba(0,0,0,0.06)',
                }}
              >
                To'lovlar
              </button>
            </div>

            {warehouseTab === 'market' ? (
              <div className="space-y-6">
                <PendingCashMarketBranchPanel />
                <MarketView branchId={branchId} />
              </div>
            ) : (
              <Payments branchId={branchId} branchInfo={branchInfo} />
            )}
          </div>
        )}

        {(effectiveRole === 'operator' || effectiveRole === 'support') && (
          <OperatorSupportTabs branchId={branchId} branchInfo={branchInfo} role="support" />
        )}

        {effectiveRole === 'cashier' && (
          <div className="p-10 rounded-3xl border text-center" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff' }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Kassa uchun login/parol hali yo‘q</div>
            <div style={{ marginTop: 8, opacity: 0.7, fontSize: 13 }}>
              Keyin qo‘shiladi
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

