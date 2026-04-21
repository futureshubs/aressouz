import { useState, useEffect, useMemo, useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { 
  Package, 
  Plus, 
  Edit2, 
  Trash2, 
  X,
  Save,
  Upload,
  ShoppingCart,
  QrCode,
  Search,
  Minus,
  Receipt,
  Printer,
  TrendingUp,
  Calendar,
  Clock,
  CreditCard,
  Smartphone,
  Wallet,
  Filter,
  BarChart3,
  Banknote,
  Globe,
  History,
  Download,
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowUp,
  ArrowDown,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { getCategoriesByCatalog, Product, ProductVariant } from '../../data/categories';
import {
  projectId,
  publicAnonKey,
  API_BASE_URL,
  DEV_API_BASE_URL,
} from '../../../../utils/supabase/info';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useIntersectionSentinel } from '../../hooks/useIntersectionSentinel';
import { fetchPagedBranchProducts } from '../../services/pagedCatalogApi';
import { buildBranchHeaders, getStoredBranchToken } from '../../utils/requestAuth';
import { ReceiptModal } from '../ReceiptModal';

// Dynamic categories state
interface Catalog {
  id: string;
  name: string;
  image: string;
  categories: {
    id: string;
    name: string;
    catalog: string;
    image: string;
  }[];
}

interface MarketViewProps {
  branchId: string;
  readOnly?: boolean;
}

interface CartItem {
  product: Product;
  variant: ProductVariant;
  quantity: number;
}

interface SaleItem {
  productName: string;
  variantName: string;
  quantity: number;
  price: number;
}

interface Sale {
  id: string;
  branchId: string;
  items: SaleItem[];
  total: number;
  paymentMethod: 'cash' | 'card' | 'qr';
  type: 'online' | 'offline';
  date: string;
  timestamp: number;
}

interface InventoryOperation {
  id: string;
  branchId: string;
  productName: string;
  variantName: string;
  operationType: 'add' | 'remove' | 'damage' | 'expired' | 'return' | 'correction';
  quantity: number;
  reason: string;
  date: string;
  timestamp: number;
  userName: string;
}

export default function MarketView({ branchId, readOnly = false }: MarketViewProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const canEdit = !readOnly;

  const [activeTab, setActiveTab] = useState<'products' | 'warehouse' | 'inventory' | 'sales'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  /** Variant rasmini R2 ga yuklash — qaysi variant.id hozir yuklanmoqda */
  const [variantImageUploadingId, setVariantImageUploadingId] = useState<string | null>(null);

  // POS States
  const [isPOSOpen, setIsPOSOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState<any>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isInventoryLoading, setIsInventoryLoading] = useState(false);

  const branchProductsQuery = useInfiniteQuery({
    queryKey: ['branchMarket-products', branchId],
    enabled: Boolean(branchId) && activeTab === 'products',
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }) => {
      return await fetchPagedBranchProducts<any>({
        branchId,
        includeSold: false,
        page: Number(pageParam) || 1,
        limit: 20,
        signal,
      });
    },
    getNextPageParam: (last) => (last?.hasMore ? (last.page ?? 1) + 1 : undefined),
  });

  const productsSentinelRef = useIntersectionSentinel({
    enabled: Boolean(activeTab === 'products' && branchProductsQuery.hasNextPage && !branchProductsQuery.isFetchingNextPage),
    onIntersect: () => {
      if (branchProductsQuery.hasNextPage) void branchProductsQuery.fetchNextPage();
    },
    rootMargin: '900px 0px',
  });

  useEffect(() => {
    if (!branchProductsQuery.data) return;
    const list = branchProductsQuery.data.pages.flatMap((p: any) => (Array.isArray(p?.products) ? p.products : []));
    setProducts(list);
  }, [branchProductsQuery.data]);

  // Sales History States
  const [sales, setSales] = useState<Sale[]>([]);
  const [salesPeriod, setSalesPeriod] = useState<'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('hourly');
  const [salesFilter, setSalesFilter] = useState<'all' | 'online' | 'offline'>('all');
  /** Onlayn market: variant «foida narx» bo‘yicha (faqat filial, to‘langan buyurtmalar). */
  const [marketOnlineProfit, setMarketOnlineProfit] = useState<{
    today: number;
    allTime: number;
  } | null>(null);
  const [isQRScanning, setIsQRScanning] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('cash');
  const qrReaderRef = useRef<any>(null);
  const [, setIsCameraActive] = useState(false);

  // Inventory Operations States
  const [inventoryOperations, setInventoryOperations] = useState<InventoryOperation[]>([]);
  const [inventoryPeriod, setInventoryPeriod] = useState<'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('hourly');
  const [inventoryFilter, setInventoryFilter] = useState<'all' | 'add' | 'remove' | 'damage' | 'expired' | 'return' | 'correction'>('all');
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [selectedInventoryProduct, setSelectedInventoryProduct] = useState<{product: Product, variant: ProductVariant} | null>(null);
  const [inventoryOperation, setInventoryOperation] = useState({
    type: 'add' as 'add' | 'remove' | 'damage' | 'expired' | 'return' | 'correction',
    quantity: 1,
    reason: ''
  });

  const [formData, setFormData] = useState({
    name: '',
    catalogId: '',
    categoryId: '',
    description: '',
    recommendation: '',
    weightKg: '',
  });

  const [variants, setVariants] = useState<ProductVariant[]>([{
    id: Date.now().toString(),
    name: '',
    price: 0,
    stockQuantity: 0,
    attributes: [],
  }]);

  const [availableCategories, setAvailableCategories] = useState<any[]>([]);
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [, setIsLoadingCategories] = useState(true);

  // Load categories from API
  const loadCategories = async () => {
    try {
      setIsLoadingCategories(true);
      console.log('📦 Loading categories for branch:', branchId);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/categories`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        setCatalogs([]);
        console.error('❌ Categories API response not ok:', response.status, response.statusText);
        toast.error('Kategoriyalarni yuklashda xatolik');
        return;
      }

      const data = await response.json();
      if (data.success) {
        setCatalogs(data.data.catalogs);
        console.log('✅ Categories loaded from API:', data.data.catalogs);
      }
    } catch (error) {
      console.error('❌ Error loading categories:', error);
      toast.error('Kategoriyalarni yuklashda xatolik');
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const loadMarketOnlineProfit = async () => {
    if (!branchId) return;
    const token = getStoredBranchToken();
    if (!token) {
      setMarketOnlineProfit(null);
      return;
    }
    const apiBaseUrl =
      typeof window !== 'undefined' && window.location.hostname === 'localhost'
        ? DEV_API_BASE_URL
        : API_BASE_URL;
    try {
      const params = new URLSearchParams({ branchId });
      const res = await fetch(`${apiBaseUrl}/branch/dashboard/stats?${params.toString()}`, {
        headers: buildBranchHeaders({ 'Content-Type': 'application/json' }),
      });
      if (!res.ok) {
        setMarketOnlineProfit(null);
        return;
      }
      const data = await res.json();
      if (!data?.success || !data.stats) {
        setMarketOnlineProfit(null);
        return;
      }
      setMarketOnlineProfit({
        today: Number(data.stats.marketBranchProfitToday) || 0,
        allTime: Number(data.stats.marketBranchProfitAllTime) || 0,
      });
    } catch {
      setMarketOnlineProfit(null);
    }
  };

  useEffect(() => {
    loadCategories();
    loadSales();
    loadInventoryOperations();
  }, [branchId]);

  useEffect(() => {
    if (branchId && activeTab === 'sales') {
      void loadMarketOnlineProfit();
    }
  }, [branchId, activeTab]);

  /** Kataloglar serverda kengaytirilganda (seed merge) — modal ochilganda qayta yuklash */
  useEffect(() => {
    if (isModalOpen && branchId) {
      void loadCategories();
    }
  }, [isModalOpen, branchId]);

  useEffect(() => {
    if (!isModalOpen) setVariantImageUploadingId(null);
  }, [isModalOpen]);

  useEffect(() => {
    if (formData.catalogId) {
      const selectedCatalog = catalogs.find(c => c.id === formData.catalogId);
      const categories = selectedCatalog?.categories || [];
      setAvailableCategories(categories);
      if (formData.categoryId && !categories.find(c => c.id === formData.categoryId)) {
        setFormData(prev => ({ ...prev, categoryId: '' }));
      }
    } else {
      setAvailableCategories([]);
    }
  }, [formData.catalogId, catalogs]);

  const refreshProducts = async () => {
    await branchProductsQuery.refetch();
  };

  const loadSales = async () => {
    try {
      console.log('💰 Loading sales for branch:', branchId);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/sales-history?branchId=${branchId}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load sales');
      }

      const data = await response.json();
      console.log('✅ Sales loaded:', data.sales.length);
      setSales(data.sales || []);
    } catch (error) {
      console.error('❌ Error loading sales:', error);
      toast.error('Sotuv tarixini yuklashda xatolik');
      setSales([]);
    }
  };

  const saveSale = async (sale: Sale) => {
    try {
      console.log('💰 Saving sale:', sale);
      
      // Sale will be saved via the POS system which calls the /sales endpoint
      // This function is kept for compatibility
      setSales(prev => [...prev, sale]);
      await loadSales();
    } catch (error) {
      console.error('❌ Error saving sale:', error);
      toast.error('Sotuvni saqlashda xatolik');
    }
  };

  const loadInventoryOperations = async () => {
    try {
      console.log('📦 Loading inventory history for branch:', branchId);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/inventory-history?branchId=${branchId}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load inventory history');
      }

      const data = await response.json();
      console.log('✅ Inventory history loaded:', data.history.length);
      setInventoryOperations(data.history || []);
    } catch (error) {
      console.error('❌ Error loading inventory history:', error);
      toast.error('Ombor tarixini yuklashda xatolik');
      setInventoryOperations([]);
    }
  };

  const saveInventoryOperation = async (operation: InventoryOperation) => {
    try {
      console.log('📝 Saving inventory operation:', operation);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/inventory-history`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            branchId: operation.branchId,
            productId: '',
            productName: operation.productName,
            variantId: '',
            variantName: operation.variantName,
            type: operation.operationType,
            quantity: operation.quantity,
            reason: operation.reason,
            note: `User: ${operation.userName}`,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save inventory operation');
      }

      console.log('✅ Inventory operation saved');
      setInventoryOperations(prev => [...prev, operation]);
    } catch (error) {
      console.error('❌ Error saving inventory operation:', error);
      toast.error('Ombor operatsiyasini saqlashda xatolik');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.catalogId || !formData.categoryId) {
      toast.error('Mahsulot nomi, katalog va kategoriyani to\'ldiring');
      return;
    }
    const w = Number(String(formData.weightKg || '').replace(',', '.'));
    if (!Number.isFinite(w) || w <= 0) {
      toast.error('Vazn (kg) ni kiriting');
      return;
    }

    if (variants.length === 0) {
      toast.error('Kamida 1 ta variant qo\'shing');
      return;
    }
    const badSizeVariant = variants.find((v) => !String(v?.name || '').trim());
    if (badSizeVariant) {
      toast.error('Variant o‘lchami (variant nomi) majburiy');
      return;
    }

    setIsSaving(true);

    try {
      const branchSession = localStorage.getItem('branchSession');
      const branchInfo = branchSession ? JSON.parse(branchSession) : null;
      
      const productData = {
        name: formData.name,
        catalogId: formData.catalogId,
        categoryId: formData.categoryId,
        branchId,
        branchName: branchInfo?.branchName || 'Filial',
        description: formData.description || '',
        recommendation: formData.recommendation || '',
        weightKg: Math.max(0, Number(formData.weightKg) || 0),
        variants: variants.map(v => {
          const rawProfit = v.profitPrice as number | string | undefined | null;
          let profitPrice: number | undefined;
          if (rawProfit !== '' && rawProfit != null) {
            const n = Number(rawProfit);
            if (Number.isFinite(n) && n >= 0) profitPrice = n;
          }
          return {
            ...v,
            stockQuantity: Number(v.stockQuantity) || 0,
            price: Number(v.price) || 0,
            oldPrice: v.oldPrice ? Number(v.oldPrice) : undefined,
            profitPrice,
          };
        }),
      };

      if (editingProduct) {
        console.log('📝 Updating product:', editingProduct.id);
        
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branch-products/${editingProduct.id}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(productData),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to update product');
        }

        console.log('✅ Product updated');
        toast.success('Mahsulot muvaffaqiyatli yangilandi');
      } else {
        console.log('📝 Creating new product...');
        
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branch-products`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(productData),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to create product');
        }

        const data = await response.json();
        console.log('✅ Product created:', data.product.id);
        toast.success('Mahsulot muvaffaqiyatli qo\'shildi');
        
        // Add inventory history for initial stock
        for (const variant of variants) {
          if (variant.stockQuantity && variant.stockQuantity > 0) {
            await saveInventoryOperation({
              id: `inv_${Date.now()}`,
              branchId,
              productName: formData.name,
              variantName: variant.name,
              operationType: 'add',
              quantity: variant.stockQuantity,
              reason: 'Dastlabki qo\'shish',
              date: new Date().toISOString(),
              timestamp: Date.now(),
              userName: branchInfo?.managerName || 'Manager',
            });
          }
        }
      }

      await refreshProducts();
      resetForm();
      setIsModalOpen(false);
    } catch (error) {
      console.error('❌ Error saving product:', error);
      toast.error('Saqlashda xatolik');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      catalogId: product.catalogId,
      categoryId: product.categoryId,
      description: product.description,
      recommendation: product.recommendation || '',
      weightKg:
        product && (product as any).weightKg != null
          ? String((product as any).weightKg)
          : '',
    });
    setVariants(product.variants);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Rostdan ham o\'chirmoqchimisiz?')) {
      try {
        console.log('🗑️ Deleting product:', id);
        
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branch-products/${id}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to delete product');
        }

        console.log('✅ Product deleted');
        toast.success('Mahsulot o\'chirildi');
        await refreshProducts();
      } catch (error) {
        console.error('❌ Error deleting product:', error);
        toast.error('O\'chirishda xatolik');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      catalogId: '',
      categoryId: '',
      description: '',
      recommendation: '',
    });
    setVariants([{
      id: Date.now().toString(),
      name: '',
      price: 0,
      stockQuantity: 0,
      attributes: [],
    }]);
    setEditingProduct(null);
    setAvailableCategories([]);
  };

  const handleInventoryChange = async () => {
    if (!selectedInventoryProduct) return;

    if (inventoryOperation.quantity <= 0) {
      toast.error('Miqdor 0 dan katta bo\'lishi kerak');
      return;
    }

    if (!inventoryOperation.reason.trim()) {
      toast.error('Sabab ko\'rsating');
      return;
    }

    const { product, variant } = selectedInventoryProduct;

    // Validatsiya: ayirish operatsiyalarida ombordan ko'p bo'lmasligi kerak
    const isRemovalType = ['remove', 'damage', 'expired'].includes(inventoryOperation.type);
    if (isRemovalType && inventoryOperation.quantity > variant.stockQuantity) {
      toast.error(`Omborda faqat ${variant.stockQuantity} dona bor! Ko'proq ayira olmaysiz.`);
      return;
    }

    // Calculate new stock quantity
    let newQuantity = variant.stockQuantity;
    
    if (inventoryOperation.type === 'add' || inventoryOperation.type === 'return') {
      newQuantity += inventoryOperation.quantity;
    } else {
      newQuantity -= inventoryOperation.quantity;
    }
    newQuantity = Math.max(0, newQuantity);

    // Update stock on server
    setIsInventoryLoading(true);
    try {
      console.log('📦 Updating stock on server:', { productId: product.id, variantId: variant.id, newQuantity });
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branch-products/${product.id}/stock`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            variantId: variant.id,
            stockQuantity: newQuantity,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Stock update failed:', { status: response.status, error: errorData });
        throw new Error(errorData.error || 'Failed to update stock');
      }

      const data = await response.json();
      console.log('✅ Stock updated on server:', data);
      
      // Reload products to reflect changes
      await refreshProducts();
    } catch (error) {
      console.error('❌ Error updating stock:', error);
      toast.error(`Omborni yangilashda xatolik: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsInventoryLoading(false);
      return;
    }

    // Save operation to history
    const operation: InventoryOperation = {
      id: Date.now().toString(),
      branchId,
      productName: product.name,
      variantName: variant.name,
      operationType: inventoryOperation.type,
      quantity: inventoryOperation.quantity,
      reason: inventoryOperation.reason,
      date: new Date().toLocaleDateString('uz-UZ'),
      timestamp: Date.now(),
      userName: 'Admin' // You can replace this with actual user name
    };

    await saveInventoryOperation(operation);

    // Reset and close
    setIsInventoryModalOpen(false);
    setSelectedInventoryProduct(null);
    setInventoryOperation({
      type: 'add',
      quantity: 1,
      reason: ''
    });

    const operationNames = {
      add: 'Qo\'shildi',
      remove: 'Olib tashlandi',
      damage: 'Buzilgan',
      expired: 'Muddati o\'tgan',
      return: 'Qaytarildi',
      correction: 'To\'g\'irlandi'
    };

    setIsInventoryLoading(false);
    toast.success(`${operationNames[inventoryOperation.type]}: ${inventoryOperation.quantity} dona`);
  };

  const addVariant = () => {
    setVariants([...variants, {
      id: Date.now().toString(),
      name: '',
      price: 0,
      stockQuantity: 0,
      attributes: [],
    }]);
  };

  const removeVariant = (id: string) => {
    if (variants.length > 1) {
      setVariants(variants.filter(v => v.id !== id));
    } else {
      toast.error('Kamida 1 ta variant bo\'lishi kerak');
    }
  };

  const updateVariant = (id: string, field: string, value: any) => {
    setVariants(variants.map(v => v.id === id ? { ...v, [field]: value } : v));
  };

  const addAttribute = (variantId: string) => {
    setVariants(variants.map(v => 
      v.id === variantId 
        ? { ...v, attributes: [...v.attributes, { name: '', value: '' }] }
        : v
    ));
  };

  const updateAttribute = (variantId: string, index: number, field: 'name' | 'value', value: string) => {
    setVariants(variants.map(v => {
      if (v.id === variantId) {
        const newAttrs = [...v.attributes];
        const current = newAttrs[index] || { name: '', value: '' };
        // Har doim {name, value} ko‘rinishida qiymat qo‘yamiz (TS xatolarini oldini oladi)
        newAttrs[index] = { ...current, [field]: value };
        return { ...v, attributes: newAttrs };
      }
      return v;
    }));
  };

  const removeAttribute = (variantId: string, index: number) => {
    setVariants(variants.map(v => {
      if (v.id === variantId) {
        return { ...v, attributes: v.attributes.filter((_, i) => i !== index) };
      }
      return v;
    }));
  };

  const handleImageUpload = async (variantId: string, file: File) => {
    setVariantImageUploadingId(variantId);
    try {
      console.log('📤 Uploading image to R2:', file.name);

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/public/upload`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      console.log('✅ Image uploaded to R2:', data.url);

      updateVariant(variantId, 'image', data.url);
      toast.success('Rasm yuklandi');
    } catch (error) {
      console.error('❌ Error uploading image:', error);
      toast.error('Rasm yuklashda xatolik');
    } finally {
      setVariantImageUploadingId(null);
    }
  };

  const getCatalogName = (id: string) => catalogs.find(c => c.id === id)?.name || id;
  const getCategoryName = (catalogId: string, categoryId: string) => {
    const categories = getCategoriesByCatalog(catalogId);
    return categories.find(c => c.id === categoryId)?.name || categoryId;
  };

  const totalStock = products.reduce((sum, p) => 
    sum + p.variants.reduce((vSum, v) => vSum + v.stockQuantity, 0), 0
  );

  // Filter Functions
  const getFilteredSales = () => {
    const now = Date.now();
    const periodMap = {
      hourly: 1 * 60 * 60 * 1000,
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000,
      yearly: 365 * 24 * 60 * 60 * 1000,
    };
    
    return sales.filter(sale => {
      const timeMatch = now - sale.timestamp <= periodMap[salesPeriod];
      const typeMatch = salesFilter === 'all' || sale.type === salesFilter;
      return timeMatch && typeMatch;
    });
  };

  const getFilteredInventoryOperations = () => {
    const now = Date.now();
    const periodMap = {
      hourly: 1 * 60 * 60 * 1000,
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000,
      yearly: 365 * 24 * 60 * 60 * 1000,
    };
    
    return inventoryOperations.filter(op => {
      const timeMatch = now - op.timestamp <= periodMap[inventoryPeriod];
      const typeMatch = inventoryFilter === 'all' || op.operationType === inventoryFilter;
      return timeMatch && typeMatch;
    });
  };

  // PDF Export Functions
  const exportSalesToPDF = async () => {
    const jsPDFMod = await import('jspdf');
    const autoTableMod = await import('jspdf-autotable');
    const JsPDF = (jsPDFMod as any).jsPDF || (jsPDFMod as any).default || jsPDFMod;
    const autoTable = (autoTableMod as any).default || autoTableMod;

    const doc = new JsPDF();
    const filteredSales = getFilteredSales();

    // Add title
    doc.setFontSize(18);
    doc.text('Sotuv hisoboti', 14, 22);
    
    doc.setFontSize(11);
    doc.text(
      `Davr: ${
        salesPeriod === 'hourly'
          ? '1 soatlik'
          : salesPeriod === 'daily'
          ? 'Kunlik'
          : salesPeriod === 'weekly'
          ? 'Haftalik'
          : salesPeriod === 'monthly'
          ? 'Oylik'
          : 'Yillik'
      }`,
      14,
      30
    );
    doc.text(`Sana: ${new Date().toLocaleDateString('uz-UZ')}`, 14, 36);

    // Prepare table data
    const tableData = filteredSales.map(sale => [
      sale.id,
      sale.date,
      new Date(sale.timestamp).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
      sale.items.length,
      sale.total.toLocaleString() + ' so\'m',
      sale.paymentMethod === 'cash' ? 'Naqd' : sale.paymentMethod === 'card' ? 'Karta' : 'QR'
    ]);

    autoTable(doc, {
      head: [['№', 'Sana', 'Vaqt', 'Mahsulotlar', 'Summa', 'To\'lov']],
      body: tableData,
      startY: 42,
      styles: { font: 'helvetica', fontSize: 10 },
      headStyles: { fillColor: [20, 184, 166] }
    });

    // Add summary
    const totalAmount = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
    const finalY = (doc as any).lastAutoTable.finalY || 42;
    
    doc.setFontSize(12);
    doc.text(`Jami savdolar: ${filteredSales.length}`, 14, finalY + 10);
    doc.text(`Umumiy summa: ${totalAmount.toLocaleString()} so'm`, 14, finalY + 18);

    doc.save(`sotuv-hisoboti-${Date.now()}.pdf`);
    toast.success('PDF yuklandi!');
  };

  const exportInventoryToPDF = async () => {
    const jsPDFMod = await import('jspdf');
    const autoTableMod = await import('jspdf-autotable');
    const JsPDF = (jsPDFMod as any).jsPDF || (jsPDFMod as any).default || jsPDFMod;
    const autoTable = (autoTableMod as any).default || autoTableMod;

    const doc = new JsPDF();
    const filteredOps = getFilteredInventoryOperations();

    // Add title
    doc.setFontSize(18);
    doc.text('Ombor operatsiyalari hisoboti', 14, 22);
    
    doc.setFontSize(11);
    doc.text(
      `Davr: ${
        inventoryPeriod === 'hourly'
          ? '1 soatlik'
          : inventoryPeriod === 'daily'
          ? 'Kunlik'
          : inventoryPeriod === 'weekly'
          ? 'Haftalik'
          : inventoryPeriod === 'monthly'
          ? 'Oylik'
          : 'Yillik'
      }`,
      14,
      30
    );
    doc.text(`Sana: ${new Date().toLocaleDateString('uz-UZ')}`, 14, 36);

    // Prepare table data
    const operationNames = {
      add: 'Qo\'shildi',
      remove: 'Olib tashlandi',
      damage: 'Buzilgan',
      expired: 'Muddati o\'tgan',
      return: 'Qaytarildi',
      correction: 'To\'g\'irlandi'
    };

    const tableData = filteredOps.map(op => [
      op.id,
      op.date,
      new Date(op.timestamp).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
      op.productName,
      op.variantName,
      operationNames[op.operationType],
      op.quantity,
      op.reason
    ]);

    autoTable(doc, {
      head: [['№', 'Sana', 'Vaqt', 'Mahsulot', 'Variant', 'Operatsiya', 'Miqdor', 'Sabab']],
      body: tableData,
      startY: 42,
      styles: { font: 'helvetica', fontSize: 9 },
      headStyles: { fillColor: [20, 184, 166] },
      columnStyles: {
        7: { cellWidth: 40 }
      }
    });

    doc.save(`ombor-hisoboti-${Date.now()}.pdf`);
    toast.success('PDF yuklandi!');
  };

  // POS Functions
  const handleAddToCart = (product: Product, variant: ProductVariant) => {
    const existingItem = cart.find(item => item.product.id === product.id && item.variant.id === variant.id);
    
    // Check stock availability
    const availableStock = variant.stockQuantity || 0;
    const currentCartQuantity = existingItem ? existingItem.quantity : 0;
    
    if (currentCartQuantity >= availableStock) {
      toast.error(`Omborda faqat ${availableStock} ta bor! Ortiqcha qo'shib bo'lmaydi.`);
      return;
    }
    
    if (existingItem) {
      setCart(cart.map(item => 
        item.product.id === product.id && item.variant.id === variant.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { product, variant, quantity: 1 }]);
    }
  };

  const handleRemoveFromCart = (product: Product, variant: ProductVariant) => {
    setCart(cart.filter(item => !(item.product.id === product.id && item.variant.id === variant.id)));
  };

  const handleQuantityChange = (product: Product, variant: ProductVariant, quantity: number) => {
    // Check minimum quantity
    if (quantity < 1) {
      handleRemoveFromCart(product, variant);
      return;
    }
    
    // Check stock availability
    const availableStock = variant.stockQuantity || 0;
    
    if (quantity > availableStock) {
      toast.error(`Omborda faqat ${availableStock} ta bor!`);
      return;
    }
    
    setCart(cart.map(item => 
      item.product.id === product.id && item.variant.id === variant.id 
        ? { ...item, quantity }
        : item
    ));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  // Print Receipt Function (POS thermal optimized: 58mm/80mm)
  const printReceipt = (sale: Sale, paperWidthMm: 58 | 80 = 58) => {
    const popupWidth = paperWidthMm === 58 ? 240 : 320;
    const printWindow = window.open('', '', `width=${popupWidth},height=900`);
    if (!printWindow) {
      toast.error('Chek chiqarishda xatolik! Popup blocker tekshiring.');
      return;
    }

    const currentBranch = JSON.parse(localStorage.getItem('branches') || '[]')
      .find((b: any) => b.id === branchId);

    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Chek #${sale.id}</title>
        <style>
          :root {
            --paper-width: ${paperWidthMm}mm;
            --font-size: ${paperWidthMm === 58 ? '10px' : '11px'};
            --pad-x: ${paperWidthMm === 58 ? '1.5mm' : '2.5mm'};
            --pad-y: 0mm;
          }

          @page {
            size: var(--paper-width) auto;
            margin: 0;
          }

          * {
            box-sizing: border-box;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: var(--paper-width) !important;
            min-width: var(--paper-width) !important;
            max-width: var(--paper-width) !important;
            background: #fff;
            color: #000;
            font-family: "Courier New", monospace;
            font-size: var(--font-size);
            line-height: 1.32;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .app-shell,
          .toolbar,
          .controls {
            display: none !important;
          }

          .receipt {
            width: 100%;
            margin: 0;
            padding: var(--pad-y) var(--pad-x);
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .receipt * {
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .row {
            display: flex;
            justify-content: space-between;
            gap: 4px;
          }

          .header {
            text-align: center;
            border-bottom: 1px dashed #000;
            padding-bottom: 6px;
            margin-bottom: 6px;
          }

          .header h1 {
            margin: 0 0 3px;
            font-size: ${paperWidthMm === 58 ? '13px' : '15px'};
            font-weight: 700;
            word-break: break-word;
          }

          .header p {
            margin: 1px 0;
            font-size: ${paperWidthMm === 58 ? '9px' : '10px'};
            word-break: break-word;
          }

          .section {
            border-bottom: 1px dashed #000;
            padding-bottom: 6px;
            margin-bottom: 6px;
          }

          .item {
            margin: 5px 0;
          }

          .item-name {
            font-weight: 700;
            margin-bottom: 1px;
            word-break: break-word;
          }

          .muted {
            opacity: 0.85;
          }

          .total {
            border-top: 2px solid #000;
            margin-top: 6px;
            padding-top: 6px;
            font-weight: 700;
            font-size: ${paperWidthMm === 58 ? '12px' : '14px'};
          }

          .footer {
            text-align: center;
            margin-top: 6px;
            font-size: ${paperWidthMm === 58 ? '9px' : '10px'};
          }

          @media print {
            @page {
              size: var(--paper-width) auto;
              margin: 0 !important;
            }

            html, body {
              width: var(--paper-width) !important;
              min-width: var(--paper-width) !important;
              max-width: var(--paper-width) !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: visible !important;
              position: static !important;
              inset: auto !important;
              zoom: 1 !important;
              transform: none !important;
            }

            .receipt {
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
              width: var(--paper-width) !important;
              min-width: var(--paper-width) !important;
              max-width: var(--paper-width) !important;
              display: block !important;
              margin: 0 !important;
              padding: var(--pad-y) var(--pad-x) !important;
              box-shadow: none !important;
              border: none !important;
              transform: none !important;
              page-break-before: avoid !important;
              page-break-after: avoid !important;
              page-break-inside: avoid !important;
              break-before: avoid !important;
              break-after: avoid !important;
              break-inside: avoid !important;
            }

            .receipt * {
              transform: none !important;
              box-shadow: none !important;
              border-color: transparent !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <h1>${currentBranch?.name || "Do'kon"}</h1>
            <p>${currentBranch?.address || ''}</p>
            <p>Tel: ${currentBranch?.phone || ''}</p>
          </div>

          <div class="section">
            <div class="row"><span>Chek №:</span><strong>${sale.id}</strong></div>
            <div class="row"><span>Sana:</span><span>${new Date(sale.timestamp).toLocaleDateString('uz-UZ')}</span></div>
            <div class="row"><span>Vaqt:</span><span>${new Date(sale.timestamp).toLocaleTimeString('uz-UZ')}</span></div>
            <div class="row">
              <span>To'lov turi:</span>
              <span>${
                sale.paymentMethod === 'cash' ? 'Naqd' :
                sale.paymentMethod === 'card' ? 'Karta' :
                'Online'
              }</span>
            </div>
          </div>

          <div class="section">
            ${sale.items.map(item => `
              <div class="item">
                <div class="item-name">${item.productName}</div>
                <div class="row muted"><span>${item.variantName}</span><span></span></div>
                <div class="row">
                  <span>${item.quantity} x ${item.price.toLocaleString('uz-UZ')} so'm</span>
                  <strong>${(item.quantity * item.price).toLocaleString('uz-UZ')} so'm</strong>
                </div>
              </div>
            `).join('')}
          </div>

          <div>
            <div class="row"><span>Mahsulotlar soni:</span><span>${sale.items.reduce((sum, item) => sum + item.quantity, 0)} ta</span></div>
            <div class="row total"><span>JAMI:</span><span>${sale.total.toLocaleString('uz-UZ')} so'm</span></div>
          </div>

          <div class="footer">
            <p>Xaridingiz uchun rahmat!</p>
            <p>Yana kutib qolamiz!</p>
            <p>${new Date().toLocaleString('uz-UZ')}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(receiptHTML);
    printWindow.document.close();

    const triggerPrint = () => {
      const doc = printWindow.document;
      const receiptEl = doc.querySelector('.receipt') as HTMLElement | null;
      if (receiptEl) {
        const pxToMm = (px: number) => (px * 25.4) / 96;
        const contentHeightMm = Math.max(20, pxToMm(receiptEl.scrollHeight) + 1.5);
        const dynamicPageStyle = doc.createElement('style');
        dynamicPageStyle.textContent = `@media print { @page { size: ${paperWidthMm}mm ${contentHeightMm.toFixed(2)}mm !important; margin: 0 !important; } }`;
        doc.head.appendChild(dynamicPageStyle);
      }

      printWindow.focus();
      printWindow.print();
      printWindow.close();
    };

    if (printWindow.document.readyState === 'complete') {
      setTimeout(triggerPrint, 120);
    } else {
      printWindow.onload = () => setTimeout(triggerPrint, 120);
    }
  };

  const handlePayment = async () => {
    if (cart.length === 0) {
      toast.error('Savat bo\'sh');
      return;
    }

    const branchSession = localStorage.getItem('branchSession');
    const branchInfo = branchSession ? JSON.parse(branchSession) : null;

    const subtotal = cart.reduce((sum, item) => sum + (item.variant.price * item.quantity), 0);
    const total = subtotal;

    // Determine sale type based on payment method
    const onlinePaymentMethods = ['click', 'payme', 'uzum', 'humo', 'qr'];
    const saleType = onlinePaymentMethods.includes(selectedPaymentMethod) ? 'online' : 'offline';

    // Create sale via API (will auto-update stock and create inventory history)
    setIsProcessingPayment(true);
    console.log('💳 To\'lovni boshlash...', { total, items: cart.length, paymentMethod: selectedPaymentMethod, type: saleType });
    
    try {
      console.log('📡 Server bilan bog\'lanish...');
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/sales`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            branchId,
            branchName: branchInfo?.branchName || 'Filial',
            items: cart.map(item => ({
              productId: item.product.id,
              productName: item.product.name,
              variantId: item.variant.id,
              variantName: item.variant.name,
              quantity: item.quantity,
              price: item.variant.price,
              total: item.variant.price * item.quantity,
            })),
            subtotal,
            tax: 0,
            total,
            paymentMethod: selectedPaymentMethod,
            type: saleType,
            customerInfo: null,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create sale');
      }

      const data = await response.json();
      console.log('✅ Sale created:', data.sale);
      
      // Reload products to reflect updated stock
      await refreshProducts();
      await loadSales();

      // Create receipt data
      const now = new Date();
      const receiptData = {
        receiptNumber: data.sale.id,
        date: now.toLocaleDateString('uz-UZ', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric' 
        }),
        time: now.toLocaleTimeString('uz-UZ', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        branch: `Filial #${branchId}`,
        items: cart.map(item => ({
          name: item.product.name,
          variant: item.variant.name,
          quantity: item.quantity,
          price: item.variant.price,
          total: item.variant.price * item.quantity,
        })),
        subtotal: total,
        total: total,
        paymentMethod: selectedPaymentMethod,
        cashier: 'Ali (Admin)',
      };

      // Show receipt modal
      setCurrentReceipt(receiptData);
      setIsReceiptOpen(true);

      console.log('✅ To\'lov muvaffaqiyatli amalga oshirildi!', { receiptNumber: receiptData.receiptNumber });
      toast.success(`To'lov muvaffaqiyatli! Jami: ${total.toLocaleString('uz-UZ')} so'm`);
      handleClearCart();
      setIsPOSOpen(false);
    } catch (error) {
      console.error('❌ To\'lovda xatolik yuz berdi:', error);
      toast.error('Sotuv amalga oshirishda xatolik');
      return;
    } finally {
      console.log('🔄 To\'lov jarayoni tugadi');
      setIsProcessingPayment(false);
    }
  };

  const handleQRScan = async () => {
    setIsQRScanning(true);
    setIsCameraActive(true);
    try {
      const mod = await import('html5-qrcode');
      const Html5Qrcode = (mod as any).Html5Qrcode;
      const qrReader = new Html5Qrcode('qr-reader');
      qrReaderRef.current = qrReader;
      qrReader.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        (decodedText: string) => {
          const product = products.find((p) => p.variants.some((v) => v.barcode === decodedText));
          if (product) {
            const variant = product.variants.find((v) => v.barcode === decodedText);
            if (variant) {
              handleAddToCart(product, variant);
            }
          } else {
            toast.error('Mahsulot topilmadi');
          }
          qrReader.stop().then(() => {
            setIsQRScanning(false);
            setIsCameraActive(false);
          });
        },
        (error: any) => {
          console.error('Error scanning QR code:', error);
        },
      );
    } catch (error) {
      console.error('QR scanner load/start error:', error);
      toast.error('QR skanerni yuklashda xatolik');
      setIsQRScanning(false);
      setIsCameraActive(false);
    }
  };

  // keep utilities reachable for future UI hooks (avoid unused warnings)
  void saveSale;
  void printReceipt;
  void handleQRScan;

  const handleQRStop = () => {
    if (qrReaderRef.current) {
      qrReaderRef.current.stop().then(() => {
        setIsQRScanning(false);
        setIsCameraActive(false);
      });
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const filteredProducts = products.filter(product => {
    const query = searchQuery.toLowerCase();
    
    // Mahsulot nomi bo'yicha qidiruv
    if (product.name.toLowerCase().includes(query)) {
      return true;
    }
    
    // Variant nomi, shtrix kod yoki SKU bo'yicha qidiruv
    return product.variants.some(variant => 
      variant.name.toLowerCase().includes(query) ||
      (variant.barcode && variant.barcode.toLowerCase().includes(query)) ||
      (variant.sku && variant.sku.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setActiveTab('products')}
          className="px-6 py-3 rounded-2xl font-semibold transition-all"
          style={{
            background: activeTab === 'products' 
              ? accentColor.gradient 
              : isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
            color: activeTab === 'products' ? '#ffffff' : (isDark ? '#ffffff' : '#111827'),
          }}
        >
          Mahsulotlar ({products.length})
        </button>
        <button
          onClick={() => setActiveTab('warehouse')}
          className="px-6 py-3 rounded-2xl font-semibold transition-all"
          style={{
            background: activeTab === 'warehouse' 
              ? accentColor.gradient 
              : isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
            color: activeTab === 'warehouse' ? '#ffffff' : (isDark ? '#ffffff' : '#111827'),
          }}
        >
          Ombor ({totalStock})
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className="px-6 py-3 rounded-2xl font-semibold transition-all"
          style={{
            background: activeTab === 'inventory' 
              ? accentColor.gradient 
              : isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
            color: activeTab === 'inventory' ? '#ffffff' : (isDark ? '#ffffff' : '#111827'),
          }}
        >
          🧾 Bogalteriya (Ombor tarixi)
        </button>
        <button
          onClick={() => setActiveTab('sales')}
          className="px-6 py-3 rounded-2xl font-semibold transition-all"
          style={{
            background: activeTab === 'sales' 
              ? accentColor.gradient 
              : isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
            color: activeTab === 'sales' ? '#ffffff' : (isDark ? '#ffffff' : '#111827'),
          }}
        >
          🧾 Bogalteriya (Sotuv tarixi)
        </button>
      </div>

      {activeTab === 'products' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold mb-1">Mahsulotlar</h3>
              <p 
                className="text-sm"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
              >
                Jami {products.length} ta mahsulot
              </p>
            </div>
            {canEdit && (
              <button
                onClick={() => {
                  resetForm();
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold transition-all active:scale-95"
                style={{
                  background: accentColor.gradient,
                  color: '#ffffff',
                  boxShadow: `0 4px 16px ${accentColor.color}40`,
                }}
              >
                <Plus className="w-5 h-5" />
                Mahsulot qo'shish
              </button>
            )}
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="p-4 rounded-3xl border group"
                style={{
                  background: isDark 
                    ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                    : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                {/* Image */}
                {product.variants[0]?.image && (
                  <div className="mb-3 rounded-2xl overflow-hidden aspect-square">
                    <img 
                      src={product.variants[0].image} 
                      alt={product.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                )}

                {/* Info */}
                <div className="space-y-2">
                  <h4 className="font-bold line-clamp-2">{product.name}</h4>
                  <div className="flex items-center gap-2 text-xs">
                    <span 
                      className="px-2 py-1 rounded-lg"
                      style={{ 
                        background: `${accentColor.color}20`,
                        color: accentColor.color,
                      }}
                    >
                      {getCatalogName(product.catalogId)}
                    </span>
                    <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                      {getCategoryName(product.catalogId, product.categoryId)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-lg" style={{ color: accentColor.color }}>
                      {product.variants[0]?.price.toLocaleString()} so'm
                    </span>
                    <span 
                      className="text-xs"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                    >
                      {product.variants.length} variant
                    </span>
                  </div>
                </div>

                {/* Actions */}
                {canEdit && (
                  <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(product)}
                      className="flex-1 p-2 rounded-xl transition-all active:scale-90"
                      style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}
                    >
                      <Edit2 className="w-4 h-4 mx-auto" />
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="flex-1 p-2 rounded-xl transition-all active:scale-90"
                      style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
                    >
                      <Trash2 className="w-4 h-4 mx-auto" />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {branchProductsQuery.hasNextPage ? (
              <div ref={productsSentinelRef} className="h-4 w-full md:col-span-2 lg:col-span-3" aria-hidden />
            ) : null}
          </div>

          {/* Loading State */}
          {branchProductsQuery.isLoading && (
            <div 
              className="text-center py-12 rounded-3xl border"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <Loader2 
                className="w-12 h-12 mx-auto mb-4 animate-spin"
                style={{ color: accentColor.color }}
              />
              <p 
                className="text-lg font-medium"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
              >
                
              </p>
            </div>
          )}

          {/* Empty State */}
          {!branchProductsQuery.isLoading && products.length === 0 && (
            <div 
              className="text-center py-12 rounded-3xl border"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <Package 
                className="w-12 h-12 mx-auto mb-4"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' }}
              />
              <p 
                className="text-lg font-medium mb-2"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
              >
                Hozircha mahsulotlar yo'q
              </p>
              <p 
                className="text-sm"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
              >
                Yangi mahsulot qo'shish uchun yuqoridagi tugmani bosing
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'warehouse' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">Ombor</h3>
            <button
              onClick={() => setIsPOSOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold transition-all active:scale-95"
              style={{
                background: accentColor.gradient,
                color: '#ffffff',
                boxShadow: `0 4px 16px ${accentColor.color}40`,
              }}
            >
              <ShoppingCart className="w-5 h-5" />
              Sotuv
            </button>
          </div>
          
          <div
            className="rounded-3xl border overflow-hidden"
            style={{
              background: isDark 
                ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                : 'linear-gradient(145deg, #ffffff, #f9fafb)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr 
                    className="border-b"
                    style={{ 
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                    }}
                  >
                    <th className="text-left px-6 py-4 text-sm font-semibold">Mahsulot</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Variant</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Narx</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Omborda</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Shtrix kod</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">SKU</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Amallar</th>
                  </tr>
                </thead>
                <tbody>
                  {products.flatMap((product) =>
                    product.variants.map((variant, idx) => (
                      <tr 
                        key={`${product.id}-${variant.id}`}
                        className="border-b last:border-b-0"
                        style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
                      >
                        <td className="px-6 py-4 font-medium">{idx === 0 ? product.name : ''}</td>
                        <td className="px-6 py-4">{variant.name}</td>
                        <td className="px-6 py-4 font-semibold">{variant.price.toLocaleString()} so'm</td>
                        <td className="px-6 py-4">
                          <span 
                            className="px-3 py-1 rounded-full text-sm font-medium"
                            style={{
                              background: variant.stockQuantity > 0 
                                ? 'rgba(16, 185, 129, 0.15)' 
                                : 'rgba(239, 68, 68, 0.15)',
                              color: variant.stockQuantity > 0 ? '#10b981' : '#ef4444',
                            }}
                          >
                            {variant.stockQuantity} dona
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">{variant.barcode || '-'}</td>
                        <td className="px-6 py-4 text-sm">{variant.sku || '-'}</td>
                        <td className="px-6 py-4">
                          {canEdit ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setSelectedInventoryProduct({ product, variant });
                                  setInventoryOperation({ type: 'add', quantity: 1, reason: '' });
                                  setIsInventoryModalOpen(true);
                                }}
                                className="p-2 rounded-xl transition-all active:scale-95"
                                style={{
                                  background: 'rgba(16, 185, 129, 0.15)',
                                  color: '#10b981',
                                }}
                                title="Qo'shish"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedInventoryProduct({ product, variant });
                                  setInventoryOperation({ type: 'remove', quantity: 1, reason: '' });
                                  setIsInventoryModalOpen(true);
                                }}
                                className="p-2 rounded-xl transition-all active:scale-95"
                                style={{
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  color: '#ef4444',
                                }}
                                title="Ayirish"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {products.length === 0 && (
            <div 
              className="text-center py-12 rounded-3xl border"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <Package 
                className="w-12 h-12 mx-auto mb-4"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' }}
              />
              <p 
                className="text-lg font-medium"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
              >
                Omborda hozircha mahsulotlar yo'q
              </p>
            </div>
          )}
        </div>
      )}

      {/* Inventory History Tab */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold mb-1">Bogalteriya: ombor operatsiyalari tarixi</h3>
              <p 
                className="text-sm"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
              >
                Oxirgi 1 soat ichidagi o'zgarishlar (soat bo‘yicha filtr)
              </p>
            </div>
            <button
              onClick={exportInventoryToPDF}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold transition-all active:scale-95"
              style={{
                background: accentColor.gradient,
                color: '#ffffff',
                boxShadow: `0 4px 16px ${accentColor.color}40`,
              }}
            >
              <Download className="w-5 h-5" />
              PDF yuklab olish
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Period Filter */}
            <div className="flex items-center gap-2">
              {(['hourly', 'daily', 'weekly', 'monthly', 'yearly'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setInventoryPeriod(period)}
                  className="px-4 py-2 rounded-xl font-medium text-sm transition-all"
                  style={{
                    background: inventoryPeriod === period 
                      ? accentColor.gradient 
                      : isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    color: inventoryPeriod === period ? '#ffffff' : (isDark ? '#ffffff' : '#111827'),
                  }}
                >
                  {period === 'hourly' && '1 soatlik'}
                  {period === 'daily' && 'Kunlik'}
                  {period === 'weekly' && 'Haftalik'}
                  {period === 'monthly' && 'Oylik'}
                  {period === 'yearly' && 'Yillik'}
                </button>
              ))}
            </div>

            {/* Type Filter */}
            <select
              value={inventoryFilter}
              onChange={(e) => setInventoryFilter(e.target.value as any)}
              className="px-4 py-2 rounded-xl font-medium text-sm transition-all outline-none"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                color: isDark ? '#ffffff' : '#111827',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <option value="all">Barchasi</option>
              <option value="add">Qo'shildi</option>
              <option value="remove">Olib tashlandi</option>
              <option value="damage">Buzilgan</option>
              <option value="expired">Muddati o'tgan</option>
              <option value="return">Qaytarildi</option>
              <option value="correction">To'g'irlandi</option>
            </select>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(() => {
              const filteredOps = getFilteredInventoryOperations();
              const totalAdded = filteredOps
                .filter(op => op.operationType === 'add' || op.operationType === 'return')
                .reduce((sum, op) => sum + op.quantity, 0);
              const totalRemoved = filteredOps
                .filter(op => ['remove', 'damage', 'expired'].includes(op.operationType))
                .reduce((sum, op) => sum + op.quantity, 0);

              return (
                <>
                  <div
                    className="p-6 rounded-3xl"
                    style={{
                      background: isDark 
                        ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                        : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                    }}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div 
                        className="p-3 rounded-2xl"
                        style={{ background: 'rgba(16, 185, 129, 0.15)' }}
                      >
                        <ArrowUp className="w-6 h-6" style={{ color: '#10b981' }} />
                      </div>
                      <div>
                        <p 
                          className="text-sm font-medium"
                          style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                        >
                          Qo'shildi
                        </p>
                        <p className="text-2xl font-bold" style={{ color: '#10b981' }}>
                          +{totalAdded}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div
                    className="p-6 rounded-3xl"
                    style={{
                      background: isDark 
                        ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                        : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                    }}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div 
                        className="p-3 rounded-2xl"
                        style={{ background: 'rgba(239, 68, 68, 0.15)' }}
                      >
                        <ArrowDown className="w-6 h-6" style={{ color: '#ef4444' }} />
                      </div>
                      <div>
                        <p 
                          className="text-sm font-medium"
                          style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                        >
                          Ayirildi
                        </p>
                        <p className="text-2xl font-bold" style={{ color: '#ef4444' }}>
                          -{totalRemoved}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div
                    className="p-6 rounded-3xl"
                    style={{
                      background: isDark 
                        ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                        : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                    }}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div 
                        className="p-3 rounded-2xl"
                        style={{ background: `${accentColor.color}25` }}
                      >
                        <History className="w-6 h-6" style={{ color: accentColor.color }} />
                      </div>
                      <div>
                        <p 
                          className="text-sm font-medium"
                          style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                        >
                          Operatsiyalar
                        </p>
                        <p className="text-2xl font-bold" style={{ color: accentColor.color }}>
                          {filteredOps.length}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Operations List */}
          {(() => {
            const filteredOps = getFilteredInventoryOperations();

            const operationIcons = {
              add: <Plus className="w-5 h-5" />,
              remove: <Minus className="w-5 h-5" />,
              damage: <XCircle className="w-5 h-5" />,
              expired: <AlertCircle className="w-5 h-5" />,
              return: <CheckCircle className="w-5 h-5" />,
              correction: <Edit2 className="w-5 h-5" />
            };

            const operationColors = {
              add: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981' },
              remove: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' },
              damage: { bg: 'rgba(249, 115, 22, 0.15)', color: '#f97316' },
              expired: { bg: 'rgba(234, 179, 8, 0.15)', color: '#eab308' },
              return: { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' },
              correction: { bg: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }
            };

            const operationNames = {
              add: 'Qo\'shildi',
              remove: 'Olib tashlandi',
              damage: 'Buzilgan',
              expired: 'Muddati o\'tgan',
              return: 'Qaytarildi',
              correction: 'To\'g\'irlandi'
            };

            if (filteredOps.length === 0) {
              return (
                <div 
                  className="text-center py-16 rounded-3xl border"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <History 
                    className="w-16 h-16 mx-auto mb-4"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)' }}
                  />
                  <p 
                    className="text-lg font-medium"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                  >
                    Hali operatsiyalar yo'q
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {filteredOps.map((operation) => (
                  <div
                    key={operation.id}
                    className="p-5 rounded-3xl border"
                    style={{
                      background: isDark 
                        ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                        : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        {/* Icon */}
                        <div 
                          className="p-3 rounded-2xl flex-shrink-0"
                          style={{ 
                            background: operationColors[operation.operationType].bg,
                            color: operationColors[operation.operationType].color
                          }}
                        >
                          {operationIcons[operation.operationType]}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <span 
                              className="px-3 py-1 rounded-full text-xs font-semibold"
                              style={{
                                background: operationColors[operation.operationType].bg,
                                color: operationColors[operation.operationType].color
                              }}
                            >
                              {operationNames[operation.operationType]}
                            </span>
                            <span 
                              className="text-sm font-semibold"
                              style={{ color: isDark ? '#ffffff' : '#111827' }}
                            >
                              {operation.quantity} dona
                            </span>
                          </div>

                          <h4 
                            className="font-bold text-lg mb-1"
                            style={{ color: isDark ? '#ffffff' : '#111827' }}
                          >
                            {operation.productName}
                          </h4>
                          
                          <p 
                            className="text-sm mb-3"
                            style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                          >
                            {operation.variantName}
                          </p>

                          <div className="flex flex-wrap items-center gap-3 text-sm mb-2">
                            <div className="flex items-center gap-1">
                              <Receipt className="w-4 h-4" style={{ opacity: 0.5 }} />
                              <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                                №{operation.id}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" style={{ opacity: 0.5 }} />
                              <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                                {operation.date}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" style={{ opacity: 0.5 }} />
                              <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                                {new Date(operation.timestamp).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>

                          {/* Reason */}
                          <div 
                            className="p-3 rounded-xl mt-3"
                            style={{
                              background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                            }}
                          >
                            <p 
                              className="text-xs font-medium mb-1"
                              style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                            >
                              Sabab:
                            </p>
                            <p 
                              className="text-sm"
                              style={{ color: isDark ? '#ffffff' : '#111827' }}
                            >
                              {operation.reason}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Sales History Tab */}
      {activeTab === 'sales' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold mb-1">Bogalteriya: sotuv tarixi</h3>
              <p 
                className="text-sm"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
              >
                Oxirgi 1 soat ichidagi savdolar (soat bo‘yicha filtr)
              </p>
            </div>

            <button
              onClick={exportSalesToPDF}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold transition-all active:scale-95"
              style={{
                background: accentColor.gradient,
                color: '#ffffff',
                boxShadow: `0 4px 16px ${accentColor.color}40`,
              }}
            >
              <Download className="w-5 h-5" />
              PDF yuklab olish
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Period Filter */}
            {[
              { id: 'hourly', label: '1 soatlik' },
              { id: 'daily', label: 'Kunlik' },
              { id: 'weekly', label: 'Haftalik' },
              { id: 'monthly', label: 'Oylik' },
              { id: 'yearly', label: 'Yillik' }
            ].map(period => (
              <button
                key={period.id}
                onClick={() => setSalesPeriod(period.id as any)}
                className="px-4 py-2 rounded-xl font-medium text-sm transition-all"
                style={{
                  background: salesPeriod === period.id 
                    ? accentColor.gradient 
                    : isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                  color: salesPeriod === period.id ? '#ffffff' : (isDark ? '#ffffff' : '#111827'),
                }}
              >
                {period.label}
              </button>
            ))}

            {/* Divider */}
            <div 
              className="w-px h-8"
              style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
            />

            {/* Type Filter */}
            {[
              { id: 'all', label: 'Barchasi', icon: BarChart3 },
              { id: 'online', label: 'Online', icon: Smartphone },
              { id: 'offline', label: 'Offline (POS)', icon: ShoppingCart }
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setSalesFilter(filter.id as any)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all"
                style={{
                  background: salesFilter === filter.id 
                    ? `${accentColor.color}20`
                    : isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                  color: salesFilter === filter.id ? accentColor.color : (isDark ? '#ffffff' : '#111827'),
                  borderWidth: salesFilter === filter.id ? '2px' : '0',
                  borderColor: salesFilter === filter.id ? accentColor.color : 'transparent',
                }}
              >
                <filter.icon className="w-4 h-4" />
                {filter.label}
              </button>
            ))}
          </div>

          {/* Statistics Cards */}
          {(() => {
            const now = Date.now();
            const periodMap = {
              hourly: 1 * 60 * 60 * 1000,
              daily: 24 * 60 * 60 * 1000,
              weekly: 7 * 24 * 60 * 60 * 1000,
              monthly: 30 * 24 * 60 * 60 * 1000,
              yearly: 365 * 24 * 60 * 60 * 1000,
            };
            
            const filteredSales = sales.filter(sale => {
              const timeMatch = now - sale.timestamp <= periodMap[salesPeriod];
              const typeMatch = salesFilter === 'all' || sale.type === salesFilter;
              return timeMatch && typeMatch;
            });

            const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
            const totalOrders = filteredSales.length;
            const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
            
            const onlineSales = filteredSales.filter(s => s.type === 'online');
            const offlineSales = filteredSales.filter(s => s.type === 'offline');

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Revenue */}
                <div 
                  className="p-6 rounded-3xl border"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    boxShadow: isDark 
                      ? '0 4px 16px rgba(0, 0, 0, 0.3)'
                      : '0 2px 8px rgba(0, 0, 0, 0.06)',
                  }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div 
                      className="p-3 rounded-2xl"
                      style={{ background: `${accentColor.color}20` }}
                    >
                      <TrendingUp className="w-6 h-6" style={{ color: accentColor.color }} />
                    </div>
                  </div>
                  <p 
                    className="text-sm mb-1"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                  >
                    Jami daromad
                  </p>
                  <h4 className="text-2xl font-bold">
                    {totalRevenue.toLocaleString('uz-UZ')} so'm
                  </h4>
                </div>

                {/* Total Orders */}
                <div 
                  className="p-6 rounded-3xl border"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    boxShadow: isDark 
                      ? '0 4px 16px rgba(0, 0, 0, 0.3)'
                      : '0 2px 8px rgba(0, 0, 0, 0.06)',
                  }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div 
                      className="p-3 rounded-2xl"
                      style={{ background: 'rgba(34, 197, 94, 0.2)' }}
                    >
                      <Receipt className="w-6 h-6" style={{ color: '#22c55e' }} />
                    </div>
                  </div>
                  <p 
                    className="text-sm mb-1"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                  >
                    Sotuvlar soni
                  </p>
                  <h4 className="text-2xl font-bold">
                    {totalOrders.toLocaleString('uz-UZ')} ta
                  </h4>
                </div>

                {/* Average Order */}
                <div 
                  className="p-6 rounded-3xl border"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    boxShadow: isDark 
                      ? '0 4px 16px rgba(0, 0, 0, 0.3)'
                      : '0 2px 8px rgba(0, 0, 0, 0.06)',
                  }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div 
                      className="p-3 rounded-2xl"
                      style={{ background: 'rgba(59, 130, 246, 0.2)' }}
                    >
                      <BarChart3 className="w-6 h-6" style={{ color: '#3b82f6' }} />
                    </div>
                  </div>
                  <p 
                    className="text-sm mb-1"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                  >
                    O'rtacha sotuv
                  </p>
                  <h4 className="text-2xl font-bold">
                    {avgOrder.toLocaleString('uz-UZ')} so'm
                  </h4>
                </div>

                {/* Online vs Offline */}
                <div 
                  className="p-6 rounded-3xl border"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    boxShadow: isDark 
                      ? '0 4px 16px rgba(0, 0, 0, 0.3)'
                      : '0 2px 8px rgba(0, 0, 0, 0.06)',
                  }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div 
                      className="p-3 rounded-2xl"
                      style={{ background: 'rgba(168, 85, 247, 0.2)' }}
                    >
                      <Filter className="w-6 h-6" style={{ color: '#a855f7' }} />
                    </div>
                  </div>
                  <p 
                    className="text-sm mb-1"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                  >
                    Online / Offline
                  </p>
                  <h4 className="text-lg font-bold">
                    {onlineSales.length} / {offlineSales.length}
                  </h4>
                </div>
              </div>
            );
          })()}

          {/* Onlayn market foyda (foida narx × sotilgan miqdor, faqat to‘langan buyurtmalar) */}
          <div
            className="p-5 rounded-3xl border space-y-4"
            style={{
              background: isDark ? 'rgba(34, 197, 94, 0.08)' : 'rgba(34, 197, 94, 0.06)',
              borderColor: isDark ? 'rgba(34, 197, 94, 0.25)' : 'rgba(34, 197, 94, 0.2)',
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="p-3 rounded-2xl shrink-0"
                style={{ background: 'rgba(34, 197, 94, 0.2)' }}
              >
                <Banknote className="w-6 h-6" style={{ color: '#16a34a' }} />
              </div>
              <div>
                <h4 className="text-lg font-bold" style={{ color: isDark ? '#fff' : '#111827' }}>
                  Onlayn market — foida (foida narx × sotilgan dona)
                </h4>
                <p
                  className="text-sm mt-1"
                  style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)' }}
                >
                  Variantdagi «Foida narx» miqdori har bir sotilgan birlik uchun: masalan narx 10&nbsp;000
                  so‘m va foida narx 2&nbsp;000 so‘m bo‘lsa, har donadan 2&nbsp;000 so‘m qator foydasiga
                  yoziladi. Buyurtma yaratilganda snapshot; statistikada faqat to‘langan onlayn market
                  buyurtmalari. Ko‘rsatkichlar faqat filial Market → Sotuvlar; Data Analitika sahifasida
                  chiqmaydi.
                </p>
              </div>
            </div>
            {marketOnlineProfit ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  className="p-5 rounded-2xl border"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                  }}
                >
                  <p
                    className="text-sm mb-1"
                    style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)' }}
                  >
                    Bugun (to‘langan)
                  </p>
                  <p className="text-2xl font-bold" style={{ color: isDark ? '#fff' : '#111827' }}>
                    {marketOnlineProfit.today.toLocaleString('uz-UZ')} so'm
                  </p>
                </div>
                <div
                  className="p-5 rounded-2xl border"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                  }}
                >
                  <p
                    className="text-sm mb-1"
                    style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)' }}
                  >
                    Jami (to‘langan, barcha vaqt)
                  </p>
                  <p className="text-2xl font-bold" style={{ color: isDark ? '#fff' : '#111827' }}>
                    {marketOnlineProfit.allTime.toLocaleString('uz-UZ')} so'm
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)' }}>
                Ko‘rsatkichni yuklash uchun filial akkaunti bilan kirilgan bo‘lishingiz kerak.
              </p>
            )}
          </div>

          {/* Sales List */}
          {(() => {
            const now = Date.now();
            const periodMap = {
              hourly: 1 * 60 * 60 * 1000,
              daily: 24 * 60 * 60 * 1000,
              weekly: 7 * 24 * 60 * 60 * 1000,
              monthly: 30 * 24 * 60 * 60 * 1000,
              yearly: 365 * 24 * 60 * 60 * 1000,
            };
            
            const filteredSales = sales
              .filter(sale => {
                const timeMatch = now - sale.timestamp <= periodMap[salesPeriod];
                const typeMatch = salesFilter === 'all' || sale.type === salesFilter;
                return timeMatch && typeMatch;
              })
              .sort((a, b) => b.timestamp - a.timestamp);

            if (filteredSales.length === 0) {
              return (
                <div 
                  className="p-12 rounded-3xl border text-center"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <div 
                    className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                    style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }}
                  >
                    <Receipt className="w-8 h-8" style={{ opacity: 0.5 }} />
                  </div>
                  <p 
                    className="text-sm font-medium"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                  >
                    Sotuvlar topilmadi
                  </p>
                  <p 
                    className="text-xs mt-1"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
                  >
                    Tanlangan davr uchun sotuvlar mavjud emas
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-4">
                <h4 className="font-semibold">
                  Sotuvlar ro'yxati ({filteredSales.length})
                </h4>
                {filteredSales.map(sale => (
                  <div
                    key={sale.id}
                    className="p-6 rounded-3xl border"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      boxShadow: isDark 
                        ? '0 4px 16px rgba(0, 0, 0, 0.3)'
                        : '0 2px 8px rgba(0, 0, 0, 0.06)',
                    }}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div 
                          className="p-3 rounded-2xl"
                          style={{ 
                            background: sale.type === 'online' 
                              ? 'rgba(59, 130, 246, 0.2)' 
                              : 'rgba(168, 85, 247, 0.2)' 
                          }}
                        >
                          {sale.type === 'online' ? (
                            <Smartphone className="w-6 h-6" style={{ color: '#3b82f6' }} />
                          ) : (
                            <ShoppingCart className="w-6 h-6" style={{ color: '#a855f7' }} />
                          )}
                        </div>
                        <div>
                          <h5 className="font-semibold mb-1">
                            {sale.type === 'online' ? 'Online sotuv' : 'Offline sotuv (POS)'}
                          </h5>
                          <div className="flex flex-wrap items-center gap-3 text-sm">
                            <div className="flex items-center gap-1">
                              <Receipt className="w-4 h-4" style={{ opacity: 0.5 }} />
                              <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                                №{sale.id}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" style={{ opacity: 0.5 }} />
                              <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                                {sale.date}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" style={{ opacity: 0.5 }} />
                              <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                                {new Date(sale.timestamp).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {sale.paymentMethod === 'cash' && <Wallet className="w-4 h-4" style={{ opacity: 0.5 }} />}
                              {sale.paymentMethod === 'card' && <CreditCard className="w-4 h-4" style={{ opacity: 0.5 }} />}
                              {sale.paymentMethod === 'qr' && <QrCode className="w-4 h-4" style={{ opacity: 0.5 }} />}
                              <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                                {sale.paymentMethod === 'cash' && 'Naqd'}
                                {sale.paymentMethod === 'card' && 'Plastik karta'}
                                {sale.paymentMethod === 'qr' && 'QR kod'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p 
                          className="text-xs mb-1"
                          style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                        >
                          Jami
                        </p>
                        <p className="text-xl font-bold" style={{ color: accentColor.color }}>
                          {sale.total.toLocaleString('uz-UZ')} so'm
                        </p>
                      </div>
                    </div>

                    {/* Items */}
                    <div 
                      className="space-y-2 pt-4"
                      style={{ 
                        borderTop: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` 
                      }}
                    >
                      {sale.items.map((item, idx) => (
                        <div 
                          key={idx}
                          className="flex items-center justify-between py-2"
                        >
                          <div>
                            <p className="font-medium">{item.productName}</p>
                            <p 
                              className="text-sm"
                              style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                            >
                              {item.variantName} × {item.quantity}
                            </p>
                          </div>
                          <p className="font-semibold">
                            {(item.price * item.quantity).toLocaleString('uz-UZ')} so'm
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Add/Edit Product Modal */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 app-safe-pad z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0, 0, 0, 0.7)' }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-4xl rounded-3xl border p-6 max-h-[90vh] overflow-y-auto"
            style={{
              background: isDark ? '#0a0a0a' : '#ffffff',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">
                {editingProduct ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot qo\'shish'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl transition-all active:scale-90"
                style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h4 className="font-semibold">Asosiy ma'lumotlar</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.9)' : '#374151' }}
                    >
                      Mahsulot nomi *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="iPhone 15 Pro Max"
                      className="w-full px-4 py-3 rounded-2xl border outline-none transition-all"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        color: isDark ? '#ffffff' : '#111827',
                        boxShadow: isDark 
                          ? '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                          : '0 2px 6px rgba(0, 0, 0, 0.06)',
                      }}
                    />
                  </div>

                  <div>
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.9)' : '#374151' }}
                    >
                      Katalog *
                    </label>
                    <p className="text-xs mb-2" style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }}>
                      Oziq-ovqatdan tortib elektronika va uy-ro‘zg‘orgacha — ro‘yxat serverdan keladi; kam bo‘lsa sahifani yangilang.
                    </p>
                    <p className="text-xs mb-1" style={{ color: isDark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.4)' }}>
                      Pastdagi ro‘yxatni ichida skroll qiling — barcha kataloglar ko‘rinadi.
                    </p>
                    <select
                      size={catalogs.length ? Math.min(catalogs.length + 1, 14) : 1}
                      value={formData.catalogId}
                      onChange={(e) => setFormData({ ...formData, catalogId: e.target.value, categoryId: '' })}
                      className="w-full px-3 py-2 rounded-2xl border outline-none transition-all cursor-pointer"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        color: isDark ? '#ffffff' : '#111827',
                        boxShadow: isDark 
                          ? '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                          : '0 2px 6px rgba(0, 0, 0, 0.06)',
                      }}
                    >
                      <option 
                        value=""
                        style={{
                          background: isDark ? '#1f2937' : '#ffffff',
                          color: isDark ? 'rgba(255, 255, 255, 0.6)' : '#9ca3af',
                        }}
                      >
                        Tanlang
                      </option>
                      {catalogs.map((catalog) => (
                        <option 
                          key={catalog.id} 
                          value={catalog.id}
                          style={{
                            background: isDark ? '#1f2937' : '#ffffff',
                            color: isDark ? '#ffffff' : '#111827',
                            padding: '8px 12px',
                          }}
                        >
                          {catalog.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.9)' : '#374151' }}
                    >
                      Kategoriya *
                    </label>
                    <p className="text-xs mb-1" style={{ color: isDark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.4)' }}>
                      Tanlangan katalog bo‘yicha barcha kategoriyalar — ro‘yxat ichida pastga skroll qiling.
                    </p>
                    <select
                      size={
                        formData.catalogId && availableCategories.length > 0
                          ? Math.min(availableCategories.length + 1, 16)
                          : 1
                      }
                      value={formData.categoryId}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      disabled={!formData.catalogId}
                      className="w-full px-3 py-2 rounded-2xl border outline-none disabled:opacity-50 transition-all cursor-pointer disabled:cursor-not-allowed"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        color: isDark ? '#ffffff' : '#111827',
                        boxShadow: isDark 
                          ? '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                          : '0 2px 6px rgba(0, 0, 0, 0.06)',
                      }}
                    >
                      <option 
                        value=""
                        style={{
                          background: isDark ? '#1f2937' : '#ffffff',
                          color: isDark ? 'rgba(255, 255, 255, 0.6)' : '#9ca3af',
                        }}
                      >
                        {formData.catalogId ? 'Tanlang' : 'Avval katalog tanlang'}
                      </option>
                      {availableCategories.map((category) => (
                        <option 
                          key={category.id} 
                          value={category.id}
                          style={{
                            background: isDark ? '#1f2937' : '#ffffff',
                            color: isDark ? '#ffffff' : '#111827',
                            padding: '8px 12px',
                          }}
                        >
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.9)' : '#374151' }}
                    >
                      Ta'rif
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Mahsulot haqida batafsil ma'lumot..."
                      rows={3}
                      className="w-full px-4 py-3 rounded-2xl border outline-none resize-none transition-all"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        color: isDark ? '#ffffff' : '#111827',
                        boxShadow: isDark 
                          ? '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                          : '0 2px 6px rgba(0, 0, 0, 0.06)',
                      }}
                    />
                  </div>

                <div className="md:col-span-2">
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.9)' : '#374151' }}
                  >
                    Vazn (kg) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={formData.weightKg}
                    onChange={(e) => setFormData({ ...formData, weightKg: e.target.value })}
                    placeholder="Masalan: 2.5"
                    className="w-full px-4 py-3 rounded-2xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      color: isDark ? '#ffffff' : '#111827',
                      boxShadow: isDark
                        ? '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                        : '0 2px 6px rgba(0, 0, 0, 0.06)',
                    }}
                  />
                  <p className="text-xs mt-2" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
                    Buyurtma umumiy vazni 30 kg dan oshsa avtomatik avto-kuryerga chiqadi.
                  </p>
                </div>

                  <div className="md:col-span-2">
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.9)' : '#374151' }}
                    >
                      Maslahat
                    </label>
                    <textarea
                      value={formData.recommendation}
                      onChange={(e) => setFormData({ ...formData, recommendation: e.target.value })}
                      placeholder="Foydalanish bo'yicha maslahatlar..."
                      rows={2}
                      className="w-full px-4 py-3 rounded-2xl border outline-none resize-none transition-all"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        color: isDark ? '#ffffff' : '#111827',
                        boxShadow: isDark 
                          ? '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                          : '0 2px 6px rgba(0, 0, 0, 0.06)',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Variants */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Variantlar ({variants.length})</h4>
                  <button
                    type="button"
                    onClick={addVariant}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all active:scale-95"
                    style={{
                      background: `${accentColor.color}20`,
                      color: accentColor.color,
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    Variant qo'shish
                  </button>
                </div>

                {variants.map((variant, vIdx) => (
                  <div
                    key={variant.id}
                    className="p-4 rounded-2xl border space-y-4"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Variant {vIdx + 1}</span>
                      {variants.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeVariant(variant.id)}
                          className="p-1.5 rounded-lg transition-all active:scale-90"
                          style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium mb-2">O‘lchami (variant nomi) *</label>
                        <input
                          type="text"
                          value={variant.name}
                          onChange={(e) => updateVariant(variant.id, 'name', e.target.value)}
                          placeholder="256GB Titanium Blue"
                          className="w-full px-4 py-2.5 rounded-xl border outline-none"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                            color: isDark ? '#ffffff' : '#111827',
                          }}
                        />
                      </div>

                      {/* Image Upload */}
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium mb-2">Rasm</label>
                        {(() => {
                          const isUploadingThis = variantImageUploadingId === variant.id;
                          return (
                            <div className="flex flex-wrap items-center gap-3">
                              {variant.image ? (
                                <div className="relative h-20 w-20 shrink-0">
                                  <img
                                    src={variant.image}
                                    alt="Preview"
                                    className={`h-20 w-20 rounded-xl object-cover ${isUploadingThis ? 'opacity-50' : ''}`}
                                  />
                                  {isUploadingThis ? (
                                    <div
                                      className="absolute inset-0 flex items-center justify-center rounded-xl"
                                      style={{ background: 'rgba(0,0,0,0.45)' }}
                                    >
                                      <Loader2 className="h-8 w-8 animate-spin text-white" aria-hidden />
                                    </div>
                                  ) : null}
                                </div>
                              ) : isUploadingThis ? (
                                <div
                                  className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border"
                                  style={{
                                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                                  }}
                                >
                                  <Loader2
                                    className="h-8 w-8 animate-spin"
                                    style={{ color: accentColor.color }}
                                    aria-hidden
                                  />
                                </div>
                              ) : null}
                              <label
                                className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 transition-all active:scale-95 ${
                                  isUploadingThis ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                                }`}
                                style={{
                                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                                }}
                              >
                                {isUploadingThis ? (
                                  <>
                                    <Loader2
                                      className="h-4 w-4 shrink-0 animate-spin"
                                      style={{ color: accentColor.color }}
                                      aria-hidden
                                    />
                                    <span className="text-sm"></span>
                                  </>
                                ) : (
                                  <>
                                    <Upload className="h-4 w-4 shrink-0" aria-hidden />
                                    <span className="text-sm">Rasm yuklash</span>
                                  </>
                                )}
                                <input
                                  type="file"
                                  accept="image/*"
                                  disabled={isUploadingThis}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) void handleImageUpload(variant.id, f);
                                    e.target.value = '';
                                  }}
                                  className="hidden"
                                />
                              </label>
                            </div>
                          );
                        })()}
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Narx *</label>
                        <input
                          type="number"
                          value={variant.price || ''}
                          onChange={(e) => updateVariant(variant.id, 'price', Number(e.target.value))}
                          placeholder="0"
                          className="w-full px-4 py-2.5 rounded-xl border outline-none"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                            color: isDark ? '#ffffff' : '#111827',
                          }}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Eski narx</label>
                        <input
                          type="number"
                          value={variant.oldPrice || ''}
                          onChange={(e) => updateVariant(variant.id, 'oldPrice', Number(e.target.value))}
                          placeholder="0"
                          className="w-full px-4 py-2.5 rounded-xl border outline-none"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                            color: isDark ? '#ffffff' : '#111827',
                          }}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Foida narx</label>
                        <input
                          type="number"
                          value={variant.profitPrice || ''}
                          onChange={(e) => updateVariant(variant.id, 'profitPrice', Number(e.target.value))}
                          placeholder="0"
                          className="w-full px-4 py-2.5 rounded-xl border outline-none"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                            color: isDark ? '#ffffff' : '#111827',
                          }}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Omborda *</label>
                        <input
                          type="number"
                          value={variant.stockQuantity || ''}
                          onChange={(e) => updateVariant(variant.id, 'stockQuantity', Number(e.target.value))}
                          placeholder="0"
                          className="w-full px-4 py-2.5 rounded-xl border outline-none"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                            color: isDark ? '#ffffff' : '#111827',
                          }}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Shtrix kod</label>
                        <input
                          type="text"
                          value={variant.barcode || ''}
                          onChange={(e) => updateVariant(variant.id, 'barcode', e.target.value)}
                          placeholder="1234567890123"
                          className="w-full px-4 py-2.5 rounded-xl border outline-none"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                            color: isDark ? '#ffffff' : '#111827',
                          }}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">SKU / Rasta raqami</label>
                        <input
                          type="text"
                          value={variant.sku || ''}
                          onChange={(e) => updateVariant(variant.id, 'sku', e.target.value)}
                          placeholder="SKU-12345"
                          className="w-full px-4 py-2.5 rounded-xl border outline-none"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                            color: isDark ? '#ffffff' : '#111827',
                          }}
                        />
                      </div>
                    </div>

                    {/* Attributes */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Xususiyatlar</label>
                        <button
                          type="button"
                          onClick={() => addAttribute(variant.id)}
                          className="text-xs px-2 py-1 rounded-lg transition-all active:scale-95"
                          style={{
                            background: `${accentColor.color}20`,
                            color: accentColor.color,
                          }}
                        >
                          + Xususiyat
                        </button>
                      </div>
                      {variant.attributes.map((attr, aIdx) => (
                        <div key={aIdx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={attr.name}
                            onChange={(e) => updateAttribute(variant.id, aIdx, 'name', e.target.value)}
                            placeholder="Xususiyat nomi"
                            className="flex-1 px-3 py-2 rounded-lg border outline-none text-sm"
                            style={{
                              background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                              color: isDark ? '#ffffff' : '#111827',
                            }}
                          />
                          <input
                            type="text"
                            value={attr.value}
                            onChange={(e) => updateAttribute(variant.id, aIdx, 'value', e.target.value)}
                            placeholder="Qiymati"
                            className="flex-1 px-3 py-2 rounded-lg border outline-none text-sm"
                            style={{
                              background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                              color: isDark ? '#ffffff' : '#111827',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => removeAttribute(variant.id, aIdx)}
                            className="p-2 rounded-lg transition-all active:scale-90"
                            style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 rounded-2xl font-medium border transition-all active:scale-95"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                  style={{
                    background: accentColor.gradient,
                    color: '#ffffff',
                    boxShadow: `0 4px 16px ${accentColor.color}40`,
                  }}
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  {isSaving ? '' : 'Saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inventory Operation Modal */}
      {isInventoryModalOpen && selectedInventoryProduct && (
        <div 
          className="fixed inset-0 app-safe-pad z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0, 0, 0, 0.6)' }}
          onClick={() => setIsInventoryModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-3xl overflow-hidden"
            style={{
              background: isDark 
                ? 'linear-gradient(145deg, #1f2937, #111827)'
                : 'linear-gradient(145deg, #ffffff, #f9fafb)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div 
              className="p-6 border-b"
              style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold">Ombor operatsiyasi</h3>
                <button
                  onClick={() => setIsInventoryModalOpen(false)}
                  className="p-2 rounded-xl transition-all active:scale-90"
                  style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p 
                className="text-sm"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
              >
                {selectedInventoryProduct.product.name} - {selectedInventoryProduct.variant.name}
              </p>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              {/* Operation Type */}
              <div>
                <label className="block text-sm font-semibold mb-3">Operatsiya turi *</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { type: 'add' as const, label: 'Qo\'shish', icon: Plus, color: '#10b981' },
                    { type: 'remove' as const, label: 'Ayirish', icon: Minus, color: '#ef4444' },
                    { type: 'damage' as const, label: 'Buzilgan', icon: XCircle, color: '#f97316' },
                    { type: 'expired' as const, label: 'Muddati o\'tgan', icon: AlertCircle, color: '#eab308' },
                    { type: 'return' as const, label: 'Qaytarildi', icon: CheckCircle, color: '#3b82f6' },
                    { type: 'correction' as const, label: 'To\'g\'irlandi', icon: Edit2, color: '#a855f7' }
                  ].map(({ type, label, icon: Icon, color }) => (
                    <button
                      key={type}
                      onClick={() => setInventoryOperation(prev => ({ ...prev, type }))}
                      className="p-3 rounded-2xl border-2 transition-all active:scale-95"
                      style={{
                        background: inventoryOperation.type === type 
                          ? `${color}15` 
                          : isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
                        borderColor: inventoryOperation.type === type ? color : 'transparent',
                        color: inventoryOperation.type === type ? color : (isDark ? '#ffffff' : '#111827'),
                      }}
                    >
                      <Icon className="w-5 h-5 mx-auto mb-1" />
                      <p className="text-sm font-semibold">{label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-semibold mb-2">Miqdor *</label>
                <input
                  type="number"
                  value={inventoryOperation.quantity}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    const maxStock = selectedInventoryProduct.variant.stockQuantity;
                    const isRemovalType = ['remove', 'damage', 'expired'].includes(inventoryOperation.type);
                    
                    // Ayirish operatsiyalarida ombordan ko'p bo'lmasligi kerak
                    if (isRemovalType && value > maxStock) {
                      return; // Ombordan ko'p yozish mumkin emas
                    }
                    
                    setInventoryOperation(prev => ({ ...prev, quantity: value }));
                  }}
                  min="1"
                  max={['remove', 'damage', 'expired'].includes(inventoryOperation.type) 
                    ? selectedInventoryProduct.variant.stockQuantity 
                    : undefined}
                  className="w-full px-4 py-3 rounded-2xl border outline-none text-lg font-semibold"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDark ? '#ffffff' : '#111827',
                  }}
                />
                {/* Validation Warning */}
                {(() => {
                  const isRemovalType = ['remove', 'damage', 'expired'].includes(inventoryOperation.type);
                  const maxStock = selectedInventoryProduct.variant.stockQuantity;
                  const showWarning = isRemovalType && inventoryOperation.quantity > maxStock;
                  
                  if (showWarning) {
                    return (
                      <div 
                        className="mt-2 p-2 rounded-xl flex items-center gap-2"
                        style={{ background: 'rgba(239, 68, 68, 0.1)' }}
                      >
                        <AlertCircle className="w-4 h-4" style={{ color: '#ef4444' }} />
                        <p className="text-sm font-medium" style={{ color: '#ef4444' }}>
                          Omborda faqat {maxStock} dona bor!
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-semibold mb-2">Sabab *</label>
                <textarea
                  value={inventoryOperation.reason}
                  onChange={(e) => setInventoryOperation(prev => ({ ...prev, reason: e.target.value }))}
                  rows={3}
                  placeholder="Operatsiya sababini yozing..."
                  className="w-full px-4 py-3 rounded-2xl border outline-none resize-none"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDark ? '#ffffff' : '#111827',
                  }}
                />
              </div>

              {/* Current Stock Info */}
              <div 
                className="p-4 rounded-2xl"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                }}
              >
                <div className="flex items-center justify-between">
                  <span 
                    className="text-sm font-medium"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                  >
                    Hozirgi ombor:
                  </span>
                  <span className="text-lg font-bold">
                    {selectedInventoryProduct.variant.stockQuantity} dona
                  </span>
                </div>
                {inventoryOperation.quantity > 0 && (
                  <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }}>
                    <span 
                      className="text-sm font-medium"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                    >
                      Yangi ombor:
                    </span>
                    <span className="text-lg font-bold" style={{ color: accentColor.color }}>
                      {(inventoryOperation.type === 'add' || inventoryOperation.type === 'return')
                        ? selectedInventoryProduct.variant.stockQuantity + inventoryOperation.quantity
                        : Math.max(0, selectedInventoryProduct.variant.stockQuantity - inventoryOperation.quantity)
                      } dona
                    </span>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                onClick={handleInventoryChange}
                disabled={(() => {
                  // Loading paytida disable
                  if (isInventoryLoading) return true;
                  
                  // Validatsiya: miqdor 0 dan katta bo'lishi kerak
                  if (inventoryOperation.quantity <= 0) return true;
                  
                  // Validatsiya: sabab yozilgan bo'lishi kerak
                  if (!inventoryOperation.reason.trim()) return true;
                  
                  // Validatsiya: ayirish operatsiyalarida ombordan ko'p bo'lmasligi kerak
                  const isRemovalType = ['remove', 'damage', 'expired'].includes(inventoryOperation.type);
                  if (isRemovalType && inventoryOperation.quantity > selectedInventoryProduct.variant.stockQuantity) {
                    return true;
                  }
                  
                  return false;
                })()}
                className="w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                style={{
                  background: (() => {
                    const isDisabled = isInventoryLoading || 
                      inventoryOperation.quantity <= 0 || 
                      !inventoryOperation.reason.trim() ||
                      (['remove', 'damage', 'expired'].includes(inventoryOperation.type) && 
                       inventoryOperation.quantity > selectedInventoryProduct.variant.stockQuantity);
                    
                    return isDisabled 
                      ? (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)')
                      : accentColor.gradient;
                  })(),
                  color: (() => {
                    const isDisabled = isInventoryLoading || 
                      inventoryOperation.quantity <= 0 || 
                      !inventoryOperation.reason.trim() ||
                      (['remove', 'damage', 'expired'].includes(inventoryOperation.type) && 
                       inventoryOperation.quantity > selectedInventoryProduct.variant.stockQuantity);
                    
                    return isDisabled 
                      ? (isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)')
                      : '#ffffff';
                  })(),
                  boxShadow: (() => {
                    const isDisabled = isInventoryLoading || 
                      inventoryOperation.quantity <= 0 || 
                      !inventoryOperation.reason.trim() ||
                      (['remove', 'damage', 'expired'].includes(inventoryOperation.type) && 
                       inventoryOperation.quantity > selectedInventoryProduct.variant.stockQuantity);
                    
                    return isDisabled ? 'none' : `0 4px 16px ${accentColor.color}40`;
                  })(),
                  cursor: (() => {
                    const isDisabled = isInventoryLoading || 
                      inventoryOperation.quantity <= 0 || 
                      !inventoryOperation.reason.trim() ||
                      (['remove', 'damage', 'expired'].includes(inventoryOperation.type) && 
                       inventoryOperation.quantity > selectedInventoryProduct.variant.stockQuantity);
                    
                    return isDisabled ? 'not-allowed' : 'pointer';
                  })(),
                  opacity: (() => {
                    const isDisabled = isInventoryLoading || 
                      inventoryOperation.quantity <= 0 || 
                      !inventoryOperation.reason.trim() ||
                      (['remove', 'damage', 'expired'].includes(inventoryOperation.type) && 
                       inventoryOperation.quantity > selectedInventoryProduct.variant.stockQuantity);
                    
                    return isDisabled ? 0.5 : 1;
                  })()
                }}
              >
                {isInventoryLoading ? (
                  <>
                    <svg 
                      className="animate-spin h-5 w-5" 
                      xmlns="http://www.w3.org/2000/svg" 
                      fill="none" 
                      viewBox="0 0 24 24"
                    >
                      <circle 
                        className="opacity-25" 
                        cx="12" 
                        cy="12" 
                        r="10" 
                        stroke="currentColor" 
                        strokeWidth="4"
                      />
                      <path 
                        className="opacity-75" 
                        fill="currentColor" 
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    
                  </>
                ) : (
                  'Tasdiqlash'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POS Modal */}
      {isPOSOpen && (
        <div 
          className="fixed inset-0 app-safe-pad z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0, 0, 0, 0.7)' }}
          onClick={() => setIsPOSOpen(false)}
        >
          <div
            className="w-full max-w-4xl rounded-3xl border p-6 max-h-[90vh] overflow-y-auto"
            style={{
              background: isDark ? '#0a0a0a' : '#ffffff',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">
                POS Sistemi
              </h3>
              <button
                onClick={() => setIsPOSOpen(false)}
                className="p-2 rounded-xl transition-all active:scale-90"
                style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Mahsulot nomini yoki shtrix kodini kiriting..."
                className="w-full px-4 py-3 rounded-2xl border outline-none transition-all"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  color: isDark ? '#ffffff' : '#111827',
                  boxShadow: isDark 
                    ? '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                    : '0 2px 6px rgba(0, 0, 0, 0.06)',
                }}
              />
              <Search 
                className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
              />
            </div>

            {/* QR Scanner */}
            {isQRScanning && (
              <div className="relative mb-4">
                <div 
                  id="qr-reader"
                  className="w-full h-60 rounded-2xl border"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                />
                <button
                  onClick={handleQRStop}
                  className="absolute top-2 right-2 p-2 rounded-xl transition-all active:scale-90"
                  style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Products List */}
            {!isQRScanning && searchQuery && filteredProducts.length > 0 && (
              <div className="mb-4 space-y-2">
                <h4 className="font-semibold mb-2">Mahsulotlar</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                  {filteredProducts.map((product) => (
                    product.variants.map((variant) => (
                      <button
                        key={`${product.id}-${variant.id}`}
                        onClick={() => handleAddToCart(product, variant)}
                        className="p-3 rounded-xl border text-left transition-all active:scale-95"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {variant.image && (
                            <img 
                              src={variant.image} 
                              alt={product.name}
                              className="w-10 h-10 rounded-lg object-cover"
                            />
                          )}
                          <div className="flex-1">
                            <h5 className="font-semibold text-sm">{product.name}</h5>
                            <p className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                              {variant.name}
                            </p>
                            <p className="text-sm font-bold" style={{ color: accentColor.color }}>
                              {variant.price.toLocaleString()} so'm
                            </p>
                          </div>
                          <Plus className="w-5 h-5" style={{ color: accentColor.color }} />
                        </div>
                      </button>
                    ))
                  ))}
                </div>
              </div>
            )}

            {/* Cart */}
            {cart.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold mb-2">Savat ({cart.length})</h4>
              </div>
            )}
            <div className="space-y-4">
              {cart.map(item => (
                <div
                  key={item.product.id + item.variant.id}
                  className="p-4 rounded-2xl border flex items-center justify-between"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <div className="flex items-center gap-4">
                    {item.variant.image && (
                      <img 
                        src={item.variant.image} 
                        alt={item.product.name}
                        className="w-10 h-10 rounded-xl object-cover"
                      />
                    )}
                    <div>
                      <h4 className="font-bold line-clamp-2">{item.product.name}</h4>
                      <p className="text-sm">{item.variant.name}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleQuantityChange(item.product, item.variant, item.quantity - 1)}
                        className="p-1.5 rounded-lg transition-all active:scale-90"
                        style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(item.product, item.variant, Number(e.target.value))}
                        className="w-14 px-2 py-1 rounded-lg border outline-none text-sm text-center font-semibold"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                          color: isDark ? '#ffffff' : '#111827',
                        }}
                        min="1"
                        max={item.variant.stockQuantity}
                      />
                      <button
                        onClick={() => handleQuantityChange(item.product, item.variant, item.quantity + 1)}
                        disabled={item.quantity >= (item.variant.stockQuantity || 0)}
                        className="p-1.5 rounded-lg transition-all active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ 
                          background: item.quantity >= (item.variant.stockQuantity || 0) 
                            ? 'rgba(156, 163, 175, 0.1)' 
                            : 'rgba(59, 130, 246, 0.1)', 
                          color: item.quantity >= (item.variant.stockQuantity || 0)
                            ? '#9ca3af'
                            : '#3b82f6'
                        }}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div 
                      className="text-xs text-center px-2 py-0.5 rounded-md"
                      style={{ 
                        background: item.quantity >= (item.variant.stockQuantity || 0)
                          ? 'rgba(239, 68, 68, 0.1)'
                          : 'rgba(59, 130, 246, 0.1)',
                        color: item.quantity >= (item.variant.stockQuantity || 0)
                          ? '#ef4444'
                          : '#3b82f6'
                      }}
                    >
                      Omborda: {item.variant.stockQuantity || 0} ta
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg" style={{ color: accentColor.color }}>
                      {item.variant.price.toLocaleString()} so'm
                    </span>
                    <span 
                      className="text-xs"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                    >
                      {item.quantity} dona
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveFromCart(item.product, item.variant)}
                    className="p-2 rounded-xl transition-all active:scale-90"
                    style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="flex items-center justify-between mt-4">
              <h4 className="font-bold">Jami:</h4>
              <span className="font-bold text-lg" style={{ color: accentColor.color }}>
                {cart.reduce((sum, item) => sum + item.variant.price * item.quantity, 0).toLocaleString()} so'm
              </span>
            </div>

            {/* Payment Methods */}
            <div className="grid grid-cols-1 gap-3 mt-4">
              {/* Naqd pul */}
              <button
                onClick={() => setSelectedPaymentMethod('cash')}
                className="relative p-4 rounded-2xl transition-all duration-300 active:scale-98"
                style={{
                  background: selectedPaymentMethod === 'cash'
                    ? accentColor.gradient
                    : isDark 
                      ? 'rgba(255, 255, 255, 0.05)' 
                      : 'rgba(0, 0, 0, 0.03)',
                  border: selectedPaymentMethod === 'cash'
                    ? `2px solid ${accentColor.color}`
                    : `2px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                  boxShadow: selectedPaymentMethod === 'cash'
                    ? `0 8px 24px ${accentColor.color}40, inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                    : isDark
                      ? '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                      : '0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                  transform: selectedPaymentMethod === 'cash' ? 'translateY(-2px)' : 'translateY(0)',
                }}
              >
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300"
                    style={{
                      background: selectedPaymentMethod === 'cash'
                        ? 'rgba(255, 255, 255, 0.2)'
                        : isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.05)',
                      boxShadow: selectedPaymentMethod === 'cash'
                        ? 'inset 0 2px 8px rgba(0, 0, 0, 0.2)'
                        : 'inset 0 2px 4px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <Banknote 
                      className="w-6 h-6" 
                      style={{ 
                        color: selectedPaymentMethod === 'cash' 
                          ? '#ffffff' 
                          : accentColor.color 
                      }} 
                    />
                  </div>
                  <div className="flex-1 text-left">
                    <div 
                      className="font-semibold text-base"
                      style={{ 
                        color: selectedPaymentMethod === 'cash' 
                          ? '#ffffff' 
                          : isDark ? '#ffffff' : '#000000' 
                      }}
                    >
                      Naqd pul
                    </div>
                    <div 
                      className="text-xs mt-0.5"
                      style={{ 
                        color: selectedPaymentMethod === 'cash' 
                          ? 'rgba(255, 255, 255, 0.8)' 
                          : isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' 
                      }}
                    >
                      Kassada to'lash
                    </div>
                  </div>
                  <div 
                    className="w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300"
                    style={{
                      background: selectedPaymentMethod === 'cash'
                        ? 'rgba(255, 255, 255, 0.3)'
                        : isDark
                          ? 'rgba(255, 255, 255, 0.1)'
                          : 'rgba(0, 0, 0, 0.1)',
                      border: selectedPaymentMethod === 'cash'
                        ? '2px solid rgba(255, 255, 255, 0.5)'
                        : `2px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'}`,
                    }}
                  >
                    {selectedPaymentMethod === 'cash' && (
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ background: '#ffffff' }}
                      />
                    )}
                  </div>
                </div>
              </button>

              {/* Plastik karta */}
              <button
                onClick={() => setSelectedPaymentMethod('card')}
                className="relative p-4 rounded-2xl transition-all duration-300 active:scale-98"
                style={{
                  background: selectedPaymentMethod === 'card'
                    ? accentColor.gradient
                    : isDark 
                      ? 'rgba(255, 255, 255, 0.05)' 
                      : 'rgba(0, 0, 0, 0.03)',
                  border: selectedPaymentMethod === 'card'
                    ? `2px solid ${accentColor.color}`
                    : `2px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                  boxShadow: selectedPaymentMethod === 'card'
                    ? `0 8px 24px ${accentColor.color}40, inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                    : isDark
                      ? '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                      : '0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                  transform: selectedPaymentMethod === 'card' ? 'translateY(-2px)' : 'translateY(0)',
                }}
              >
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300"
                    style={{
                      background: selectedPaymentMethod === 'card'
                        ? 'rgba(255, 255, 255, 0.2)'
                        : isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.05)',
                      boxShadow: selectedPaymentMethod === 'card'
                        ? 'inset 0 2px 8px rgba(0, 0, 0, 0.2)'
                        : 'inset 0 2px 4px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <CreditCard 
                      className="w-6 h-6" 
                      style={{ 
                        color: selectedPaymentMethod === 'card' 
                          ? '#ffffff' 
                          : accentColor.color 
                      }} 
                    />
                  </div>
                  <div className="flex-1 text-left">
                    <div 
                      className="font-semibold text-base"
                      style={{ 
                        color: selectedPaymentMethod === 'card' 
                          ? '#ffffff' 
                          : isDark ? '#ffffff' : '#000000' 
                      }}
                    >
                      Plastik karta
                    </div>
                    <div 
                      className="text-xs mt-0.5"
                      style={{ 
                        color: selectedPaymentMethod === 'card' 
                          ? 'rgba(255, 255, 255, 0.8)' 
                          : isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' 
                      }}
                    >
                      Terminal orqali
                    </div>
                  </div>
                  <div 
                    className="w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300"
                    style={{
                      background: selectedPaymentMethod === 'card'
                        ? 'rgba(255, 255, 255, 0.3)'
                        : isDark
                          ? 'rgba(255, 255, 255, 0.1)'
                          : 'rgba(0, 0, 0, 0.1)',
                      border: selectedPaymentMethod === 'card'
                        ? '2px solid rgba(255, 255, 255, 0.5)'
                        : `2px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'}`,
                    }}
                  >
                    {selectedPaymentMethod === 'card' && (
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ background: '#ffffff' }}
                      />
                    )}
                  </div>
                </div>
              </button>

              {/* Onlayn to'lov */}
              <button
                onClick={() => setSelectedPaymentMethod('online')}
                className="relative p-4 rounded-2xl transition-all duration-300 active:scale-98"
                style={{
                  background: selectedPaymentMethod === 'online'
                    ? accentColor.gradient
                    : isDark 
                      ? 'rgba(255, 255, 255, 0.05)' 
                      : 'rgba(0, 0, 0, 0.03)',
                  border: selectedPaymentMethod === 'online'
                    ? `2px solid ${accentColor.color}`
                    : `2px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                  boxShadow: selectedPaymentMethod === 'online'
                    ? `0 8px 24px ${accentColor.color}40, inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                    : isDark
                      ? '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                      : '0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                  transform: selectedPaymentMethod === 'online' ? 'translateY(-2px)' : 'translateY(0)',
                }}
              >
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300"
                    style={{
                      background: selectedPaymentMethod === 'online'
                        ? 'rgba(255, 255, 255, 0.2)'
                        : isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.05)',
                      boxShadow: selectedPaymentMethod === 'online'
                        ? 'inset 0 2px 8px rgba(0, 0, 0, 0.2)'
                        : 'inset 0 2px 4px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <Globe 
                      className="w-6 h-6" 
                      style={{ 
                        color: selectedPaymentMethod === 'online' 
                          ? '#ffffff' 
                          : accentColor.color 
                      }} 
                    />
                  </div>
                  <div className="flex-1 text-left">
                    <div 
                      className="font-semibold text-base"
                      style={{ 
                        color: selectedPaymentMethod === 'online' 
                          ? '#ffffff' 
                          : isDark ? '#ffffff' : '#000000' 
                      }}
                    >
                      Onlayn to'lov
                    </div>
                    <div 
                      className="text-xs mt-0.5"
                      style={{ 
                        color: selectedPaymentMethod === 'online' 
                          ? 'rgba(255, 255, 255, 0.8)' 
                          : isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' 
                      }}
                    >
                      Click, Payme va boshqalar
                    </div>
                  </div>
                  <div 
                    className="w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300"
                    style={{
                      background: selectedPaymentMethod === 'online'
                        ? 'rgba(255, 255, 255, 0.3)'
                        : isDark
                          ? 'rgba(255, 255, 255, 0.1)'
                          : 'rgba(0, 0, 0, 0.1)',
                      border: selectedPaymentMethod === 'online'
                        ? '2px solid rgba(255, 255, 255, 0.5)'
                        : `2px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'}`,
                    }}
                  >
                    {selectedPaymentMethod === 'online' && (
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ background: '#ffffff' }}
                      />
                    )}
                  </div>
                </div>
              </button>
            </div>

            {/* Empty Cart Message */}
            {cart.length === 0 && (
              <div 
                className="text-center py-8 rounded-2xl border"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                <ShoppingCart 
                  className="w-12 h-12 mx-auto mb-3"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' }}
                />
                <p 
                  className="text-sm font-medium"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                >
                  Savat bo'sh
                </p>
                <p 
                  className="text-xs mt-1"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
                >
                  Mahsulot qo'shish uchun QR kodni skanerlang yoki qidiruvdan foydalaning
                </p>
              </div>
            )}

            {/* Actions */}
            {cart.length > 0 && (
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleClearCart}
                  className="flex-1 py-3 rounded-2xl font-medium border transition-all active:scale-95"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                >
                  Savatni tozalash
                </button>
                <button
                  type="button"
                  onClick={handlePayment}
                  disabled={cart.length === 0 || isProcessingPayment}
                  className="flex-1 py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                  style={{
                    background: accentColor.gradient,
                    color: '#ffffff',
                    boxShadow: `0 4px 16px ${accentColor.color}40`,
                  }}
                >
                  {isProcessingPayment ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      
                    </>
                  ) : (
                    <>
                      <Printer className="w-5 h-5" />
                      <Receipt className="w-5 h-5" />
                      To'lovni amalga oshirish
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      <ReceiptModal 
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        receipt={currentReceipt}
      />
    </div>
  );
}