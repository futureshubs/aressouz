import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { BarChart3, TrendingUp, Calendar, Package } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { toast } from 'sonner';
import { useVisibilityRefetch } from '../../utils/visibilityRefetch';

export function RentalAnalyticsView({ branchId }: { branchId: string }) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibilityTick, setVisibilityTick] = useState(0);
  useVisibilityRefetch(() => setVisibilityTick((t) => t + 1));

  useEffect(() => {
    loadData();
  }, [branchId, visibilityTick]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [ordersRes, productsRes] = await Promise.all([
        fetch(`https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/rentals/orders/${branchId}`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }),
        fetch(`https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/rentals/products/${branchId}`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        })
      ]);

      const ordersData = await ordersRes.json();
      const productsData = await productsRes.json();

      if (ordersData.success) setOrders(ordersData.orders);
      if (productsData.success) setProducts(productsData.products);
    } catch (error) {
      console.error('Error loading analytics data:', error);
      toast.error('Ma\'lumotlarni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  // Calculate analytics
  const getMonthlyData = () => {
    const monthlyRevenue: { [key: string]: number } = {};
    const monthlyOrders: { [key: string]: number } = {};

    orders.forEach(order => {
      if (order.status === 'returned') {
        const month = new Date(order.createdAt).toLocaleDateString('uz-UZ', { 
          year: 'numeric', 
          month: 'short' 
        });
        
        monthlyRevenue[month] = (monthlyRevenue[month] || 0) + (order.totalPrice || 0);
        monthlyOrders[month] = (monthlyOrders[month] || 0) + 1;
      }
    });

    return { monthlyRevenue, monthlyOrders };
  };

  const getTopProducts = () => {
    const productStats: { [key: string]: { count: number; revenue: number; name: string } } = {};

    orders.forEach(order => {
      if (!productStats[order.productId]) {
        const product = products.find(p => p.id === order.productId);
        productStats[order.productId] = {
          count: 0,
          revenue: 0,
          name: product?.name || 'Noma\'lum'
        };
      }

      productStats[order.productId].count++;
      if (order.status === 'returned') {
        productStats[order.productId].revenue += order.totalPrice || 0;
      }
    });

    return Object.entries(productStats)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  };

  const getCategoryDistribution = () => {
    const categories: { [key: string]: number } = {};
    
    products.forEach(product => {
      categories[product.category] = (categories[product.category] || 0) + 1;
    });

    return Object.entries(categories)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  };

  const { monthlyRevenue, monthlyOrders } = getMonthlyData();
  const topProducts = getTopProducts();
  const categoryDistribution = getCategoryDistribution();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4" 
               style={{ 
                 borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                 borderTopColor: accentColor.color 
               }}
          />
          <p style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
            Yuklanmoqda...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Data Analitika</h2>
        <p style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
          Ijara bo'limi tahlili va hisobotlar
        </p>
      </div>

      {/* Top Products */}
      <div 
        className="rounded-3xl p-6 border"
        style={{
          background: isDark 
            ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
            : 'linear-gradient(145deg, #ffffff, #f9fafb)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div 
            className="p-3 rounded-2xl"
            style={{ background: `${accentColor.color}20` }}
          >
            <TrendingUp className="w-6 h-6" style={{ color: accentColor.color }} />
          </div>
          <div>
            <h3 className="text-lg font-bold">Eng ko'p daromad keltirgan mahsulotlar</h3>
            <p className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
              TOP 5 mahsulotlar
            </p>
          </div>
        </div>

        {topProducts.length === 0 ? (
          <p className="text-center py-8" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
            Ma'lumot yo'q
          </p>
        ) : (
          <div className="space-y-4">
            {topProducts.map((product, index) => {
              const maxRevenue = topProducts[0].revenue;
              const percentage = maxRevenue > 0 ? (product.revenue / maxRevenue) * 100 : 0;

              return (
                <div key={product.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm"
                        style={{ 
                          background: index === 0 
                            ? `${accentColor.color}20` 
                            : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                          color: index === 0 ? accentColor.color : undefined
                        }}
                      >
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                          {product.count} ta buyurtma
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{parseInt(product.revenue).toLocaleString()} so'm</p>
                    </div>
                  </div>
                  <div 
                    className="h-2 rounded-full overflow-hidden"
                    style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
                  >
                    <div 
                      className="h-full transition-all"
                      style={{ 
                        width: `${percentage}%`,
                        background: index === 0 ? accentColor.color : isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Monthly Revenue */}
      <div 
        className="rounded-3xl p-6 border"
        style={{
          background: isDark 
            ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
            : 'linear-gradient(145deg, #ffffff, #f9fafb)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div 
            className="p-3 rounded-2xl"
            style={{ background: `${accentColor.color}20` }}
          >
            <Calendar className="w-6 h-6" style={{ color: accentColor.color }} />
          </div>
          <div>
            <h3 className="text-lg font-bold">Oylik daromad</h3>
            <p className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
              So'nggi oylar bo'yicha
            </p>
          </div>
        </div>

        {Object.keys(monthlyRevenue).length === 0 ? (
          <p className="text-center py-8" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
            Ma'lumot yo'q
          </p>
        ) : (
          <div className="space-y-4">
            {Object.entries(monthlyRevenue).map(([month, revenue]) => {
              const maxRevenue = Math.max(...Object.values(monthlyRevenue));
              const percentage = maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0;

              return (
                <div key={month}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium">{month}</p>
                      <p className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                        {monthlyOrders[month]} ta buyurtma
                      </p>
                    </div>
                    <p className="font-bold">{parseInt(revenue.toString()).toLocaleString()} so'm</p>
                  </div>
                  <div 
                    className="h-2 rounded-full overflow-hidden"
                    style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
                  >
                    <div 
                      className="h-full transition-all"
                      style={{ 
                        width: `${percentage}%`,
                        background: accentColor.color
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Category Distribution */}
      <div 
        className="rounded-3xl p-6 border"
        style={{
          background: isDark 
            ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
            : 'linear-gradient(145deg, #ffffff, #f9fafb)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div 
            className="p-3 rounded-2xl"
            style={{ background: `${accentColor.color}20` }}
          >
            <Package className="w-6 h-6" style={{ color: accentColor.color }} />
          </div>
          <div>
            <h3 className="text-lg font-bold">Kategoriyalar bo'yicha taqsimot</h3>
            <p className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
              Mahsulotlar kategoriyalari
            </p>
          </div>
        </div>

        {categoryDistribution.length === 0 ? (
          <p className="text-center py-8" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
            Ma'lumot yo'q
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categoryDistribution.map((category, index) => {
              const colors = [
                accentColor.color,
                '#f59e0b',
                '#10b981',
                '#8b5cf6',
                '#ef4444',
                '#06b6d4',
                '#ec4899'
              ];
              const color = colors[index % colors.length];

              return (
                <div 
                  key={category.name}
                  className="p-4 rounded-2xl text-center"
                  style={{ background: `${color}20` }}
                >
                  <div className="text-3xl font-bold mb-1" style={{ color }}>
                    {category.count}
                  </div>
                  <div className="text-sm font-medium">{category.name}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
