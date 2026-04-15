import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Package, AlertCircle, Loader2 } from 'lucide-react';
import { projectId } from '../../../../utils/supabase/info';
import { buildRentalPanelHeaders } from '../../utils/requestAuth';
import { toast } from 'sonner';
import { useVisibilityRefetch } from '../../utils/visibilityRefetch';

export function RentalWarehouseView({ branchId }: { branchId: string }) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [warehouse, setWarehouse] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibilityTick, setVisibilityTick] = useState(0);
  useVisibilityRefetch(() => setVisibilityTick((t) => t + 1));

  useEffect(() => {
    loadWarehouse();
    loadProducts();
  }, [branchId, visibilityTick]);

  const loadWarehouse = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/rentals/warehouse/${branchId}`,
        {
          headers: buildRentalPanelHeaders(),
        }
      );

      const data = await response.json();
      if (data.success) {
        setWarehouse(data.warehouse);
      }
    } catch (error) {
      console.error('Error loading warehouse:', error);
      toast.error('Omborni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/rentals/products/${branchId}`,
        {
          headers: buildRentalPanelHeaders(),
        }
      );

      const data = await response.json();
      if (data.success) {
        setProducts(data.products);
      }
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const getProductName = (productId: string) => {
    const product = products.find(p => p.id === productId);
    return product?.name || 'Noma\'lum mahsulot';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: accentColor.color }} />
          <p style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
            
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Ombor</h2>
        <p style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
          Mahsulotlar holati va mavjudligi
        </p>
      </div>

      {/* Warehouse Items */}
      {warehouse.length === 0 ? (
        <div 
          className="text-center py-12 rounded-3xl border"
          style={{
            background: isDark 
              ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
              : 'linear-gradient(145deg, #ffffff, #f9fafb)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <Package className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color, opacity: 0.5 }} />
          <h3 className="text-xl font-bold mb-2">Ombor bo'sh</h3>
          <p style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
            Mahsulotlar qo'shing
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {warehouse.map((item) => {
            const availablePercent = (item.available / item.total) * 100;
            const lowStock = availablePercent < 30;

            return (
              <div
                key={item.productId}
                className="rounded-3xl p-6 border"
                style={{
                  background: isDark 
                    ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                    : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold">{getProductName(item.productId)}</h3>
                      {lowStock && (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs" 
                             style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                          <AlertCircle className="w-3 h-3" />
                          Kam qoldi
                        </div>
                      )}
                    </div>
                    <p className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                      Oxirgi yangilanish: {new Date(item.lastUpdated).toLocaleString('uz-UZ')}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                      Mavjud
                    </span>
                    <span className="font-semibold">
                      {item.available} / {item.total}
                    </span>
                  </div>
                  <div 
                    className="h-2 rounded-full overflow-hidden"
                    style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
                  >
                    <div 
                      className="h-full transition-all"
                      style={{ 
                        width: `${availablePercent}%`,
                        background: lowStock ? '#ef4444' : accentColor.color
                      }}
                    />
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-4">
                  <div 
                    className="p-4 rounded-2xl text-center"
                    style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                  >
                    <div className="text-2xl font-bold">{item.total}</div>
                    <div className="text-sm mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                      Jami
                    </div>
                  </div>

                  <div 
                    className="p-4 rounded-2xl text-center"
                    style={{ background: `${accentColor.color}20` }}
                  >
                    <div className="text-2xl font-bold" style={{ color: accentColor.color }}>{item.available}</div>
                    <div className="text-sm mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                      Mavjud
                    </div>
                  </div>

                  <div 
                    className="p-4 rounded-2xl text-center"
                    style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                  >
                    <div className="text-2xl font-bold">{item.inRent}</div>
                    <div className="text-sm mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                      Ijarada
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
