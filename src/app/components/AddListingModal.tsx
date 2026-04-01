import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { X, Upload, Plus, Trash2, Home, Car, ChevronRight } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { houseCategories } from '../data/houses';
import { carCategories } from '../data/cars';
import { regions } from '../data/regions';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { compressImageIfNeeded, uploadFormDataWithProgress } from '../utils/uploadWithProgress';

interface AddListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  userPhone: string;
  accessToken: string;
  onSuccess: () => void;
  defaultType?: 'house' | 'car'; // Optional: Auto-select type
}

type ListingType = 'house' | 'car' | null;

const LISTING_FEE_UZS = 10_000;

function normalizeListingPhoneClient(value: string): string {
  const d = String(value || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 9 && d.startsWith('9')) return `998${d}`;
  if (d.startsWith('998')) return d;
  return d;
}

function listingFeeSessionKey(uid: string, phone: string) {
  return `ares_listing_fee_tx_${uid}_${normalizeListingPhoneClient(phone)}`;
}

export function AddListingModal({ isOpen, onClose, userId, userName, userPhone, accessToken, onSuccess, defaultType }: AddListingModalProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  
  const [step, setStep] = useState<'type' | 'form'>(defaultType ? 'form' : 'type');
  const [listingType, setListingType] = useState<ListingType>(defaultType || null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'UZS'>('UZS');
  const [categoryId, setCategoryId] = useState('');
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const uploadAbortRef = useRef<AbortController | null>(null);
  
  // House specific
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [address, setAddress] = useState('');
  const [rooms, setRooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [area, setArea] = useState('');
  const [floor, setFloor] = useState('');
  const [totalFloors, setTotalFloors] = useState('');
  const [condition, setCondition] = useState<'yangi' | 'ta\'mirlangan' | 'oddiy'>('oddiy');
  
  // Payment options
  const [paymentType, setPaymentType] = useState<'naqd' | 'nasiya' | 'ipoteka' | 'barchasi'>('barchasi');
  const [creditAvailable, setCreditAvailable] = useState(false);
  const [mortgageAvailable, setMortgageAvailable] = useState(false);
  const [creditTerm, setCreditTerm] = useState(''); // nasiya muddati (oyda)
  const [creditInterestRate, setCreditInterestRate] = useState(''); // yillik foiz stavkasi (%)
  const [initialPayment, setInitialPayment] = useState(''); // boshlang'ich to'lov (%)
  
  // Auto Credit (for cars)
  const [hasAutoCredit, setHasAutoCredit] = useState(false);
  const [autoCreditBank, setAutoCreditBank] = useState('');
  const [autoCreditPercent, setAutoCreditPercent] = useState('');
  const [autoCreditPeriod, setAutoCreditPeriod] = useState('');
  
  // Car specific
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [color, setColor] = useState('');
  const [mileage, setMileage] = useState('');
  const [fuelType, setFuelType] = useState('');
  const [transmission, setTransmission] = useState('');
  const [seats, setSeats] = useState('');
  
  // New car fields
  const [bodyType, setBodyType] = useState('');
  const [driveType, setDriveType] = useState('');
  const [engineVolume, setEngineVolume] = useState('');
  const [features, setFeatures] = useState<string[]>([]);
  const [carPaymentTypes, setCarPaymentTypes] = useState<string[]>(['cash']); // For cars: cash, credit, mortgage
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [listingQuota, setListingQuota] = useState<{
    phoneListingCount: number;
    requiresFeeForNext: boolean;
    feeAmountUzs: number;
    freeLimit: number;
    remainingFreeSlots: number;
  } | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [listingFeeTransactionId, setListingFeeTransactionId] = useState<string | null>(null);
  const [feePaymentBusy, setFeePaymentBusy] = useState(false);
  const [feePolling, setFeePolling] = useState(false);

  const apiBase = useMemo(
    () => `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c`,
    [],
  );

  const verifyListingFeeCredit = useCallback(
    async (txId: string): Promise<boolean> => {
      const phoneQ = encodeURIComponent(userPhone.trim());
      const res = await fetch(
        `${apiBase}/listings/fee/verify/${encodeURIComponent(txId)}?phone=${phoneQ}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'X-Access-Token': accessToken,
          },
        },
      );
      const data = await res.json().catch(() => ({}));
      return res.ok && data?.ok === true;
    },
    [apiBase, accessToken, userPhone],
  );

  useEffect(() => {
    if (!isOpen || !accessToken?.trim() || !userPhone?.trim()) {
      return;
    }

    let cancelled = false;
    const run = async () => {
      setQuotaLoading(true);
      try {
        const q = encodeURIComponent(userPhone.trim());
        const res = await fetch(`${apiBase}/check-listing-quota?phone=${q}`, {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'X-Access-Token': accessToken,
          },
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled || !res.ok) {
          if (!cancelled && !res.ok) setListingQuota(null);
          return;
        }
        setListingQuota({
          phoneListingCount: Number(data.phoneListingCount) || 0,
          requiresFeeForNext: !!data.requiresFeeForNext,
          feeAmountUzs: Number(data.feeAmountUzs) || LISTING_FEE_UZS,
          freeLimit: Number(data.freeLimit) || 2,
          remainingFreeSlots: Number(data.remainingFreeSlots) ?? 0,
        });

        const stored = sessionStorage.getItem(listingFeeSessionKey(userId, userPhone));
        if (stored && data.requiresFeeForNext && (await verifyListingFeeCredit(stored))) {
          if (!cancelled) setListingFeeTransactionId(stored);
        }
      } finally {
        if (!cancelled) setQuotaLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [isOpen, accessToken, userPhone, userId, apiBase, verifyListingFeeCredit]);

  useEffect(() => {
    if (!isOpen) {
      setListingQuota(null);
      setListingFeeTransactionId(null);
      setFeePolling(false);
      setFeePaymentBusy(false);
      setQuotaLoading(false);
    }
  }, [isOpen]);

  const startListingFeeClick = async () => {
    if (!accessToken?.trim() || !userPhone?.trim()) {
      setError('Telefon yoki sessiya yo‘q. Qayta kiring.');
      return;
    }
    setFeePaymentBusy(true);
    setError('');
    try {
      const res = await fetch(`${apiBase}/listings/fee/click-create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
          'X-Access-Token': accessToken,
        },
        body: JSON.stringify({ phone: userPhone.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Click hisob-faktura yaratilmadi');
      const txId = data.listingFeeTransactionId || data.transaction?.id;
      if (!txId || !data.paymentUrl) throw new Error('Server javobi noto‘g‘ri');
      sessionStorage.setItem(listingFeeSessionKey(userId, userPhone), txId);
      setListingFeeTransactionId(null);
      window.open(data.paymentUrl, '_blank', 'noopener,noreferrer');
      setFeePaymentBusy(false);
      setFeePolling(true);
      const started = Date.now();
      const pollLoop = async () => {
        while (Date.now() - started < 5 * 60_000) {
          await new Promise((r) => setTimeout(r, 2500));
          if (await verifyListingFeeCredit(txId)) {
            setListingFeeTransactionId(txId);
            setFeePolling(false);
            toast.success('To‘lov qabul qilindi — endi e‘lonni to‘ldiring va yuboring.');
            return;
          }
        }
        setFeePolling(false);
        setError('To‘lov kutilmoqda yoki vaqt tugadi. «To‘lovni tekshirish» tugmasini bosing.');
      };
      void pollLoop();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Click ochilmadi');
      setFeePaymentBusy(false);
      setFeePolling(false);
    }
  };

  const checkPaidFeeManually = async () => {
    if (!accessToken?.trim() || !userPhone?.trim()) {
      toast.error('Sessiya yoki telefon yo‘q.');
      return;
    }
    const stored = sessionStorage.getItem(listingFeeSessionKey(userId, userPhone));
    if (!stored) {
      toast.error('Avval «Click orqali to‘lash» ni bosing.');
      return;
    }
    setFeePolling(true);
    setError('');
    try {
      if (await verifyListingFeeCredit(stored)) {
        setListingFeeTransactionId(stored);
        toast.success('To‘lov qabul qilindi.');
      } else {
        toast.error('To‘lov hali tasdiqlanmagan. Click da to‘lovni yakunlang yoki biroz kuting.');
      }
    } finally {
      setFeePolling(false);
    }
  };

  const mustPayBeforeContinue =
    Boolean(listingQuota?.requiresFeeForNext) && !listingFeeTransactionId?.trim();

  const goToFormWithType = (t: 'house' | 'car') => {
    if (mustPayBeforeContinue) {
      toast.error('Avval e‘lon uchun to‘lovni yakunlang (yuqoridagi blok).');
      return;
    }
    setListingType(t);
    setStep('form');
  };

  const overallUploadPct = useMemo(() => {
    if (!uploadProgress.length) return null;
    const avg = uploadProgress.reduce((s, p) => s + p, 0) / uploadProgress.length;
    return Math.max(0, Math.min(100, Math.round(avg)));
  }, [uploadProgress]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (imagePreviews.length + files.length > 10) {
      setError('Maksimum 10 ta rasm yuklash mumkin');
      return;
    }
    
    const newPreviews = files.map((f) => URL.createObjectURL(f));
    setImagePreviews((prev) => [...prev, ...newPreviews]);
    setUploadProgress((prev) => [...prev, ...files.map(() => 0)]);

    // Auto-upload immediately
    void (async () => {
      try {
        setIsUploadingImages(true);
        uploadAbortRef.current?.abort();
        const controller = new AbortController();
        uploadAbortRef.current = controller;

        const startIndex = uploadedImageUrls.length;
        const urls: string[] = [];
        for (let i = 0; i < files.length; i++) {
          const file = await compressImageIfNeeded(files[i]);
          const formData = new FormData();
          formData.append('file', file);
          formData.append('type', listingType === 'house' ? 'house' : 'car');
          formData.append('accessToken', accessToken);

          const { data, status } = await uploadFormDataWithProgress<{ url?: string; error?: string; message?: string }>({
            url: `${apiBase}/upload-image`,
            formData,
            headers: {
              Authorization: `Bearer ${publicAnonKey}`,
              'X-Access-Token': accessToken,
            },
            abortSignal: controller.signal,
            onProgress: (pct) => {
              setUploadProgress((prev) => {
                const next = [...prev];
                next[startIndex + i] = pct;
                return next;
              });
            },
          });

          if (status < 200 || status >= 300 || !data?.url) {
            throw new Error(data?.error || data?.message || `Rasm yuklashda xatolik (${status})`);
          }
          urls.push(String(data.url));
        }

        setUploadedImageUrls((prev) => [...prev, ...urls].slice(0, 10));
      } catch (err: any) {
        if (err?.name !== 'AbortError') setError(err?.message || 'Rasm yuklashda xatolik');
      } finally {
        setIsUploadingImages(false);
      }
    })();
  };

  const removeImage = (index: number) => {
    const url = imagePreviews[index];
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    setUploadedImageUrls((prev) => prev.filter((_, i) => i !== index));
    setUploadProgress((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title || !description || !price || !categoryId || uploadedImageUrls.length === 0) {
      setError('Barcha majburiy maydonlarni to\'ldiring va kamida 1 ta rasm yuklang');
      return;
    }

    if (listingType === 'house' && (!region || !district || !rooms || !area)) {
      setError('Uy uchun barcha maydonlarni to\'ldiring');
      return;
    }

    if (listingType === 'car' && (!brand || !model || !year || !color || !region || !district)) {
      setError('Moshina uchun barcha maydonlarni to\'ldiring');
      return;
    }

    if (isUploadingImages) {
      setError('Rasmlar yuklanmoqda, iltimos kuting…');
      return;
    }

    if (listingQuota?.requiresFeeForNext && !listingFeeTransactionId?.trim()) {
      setError(
        `Bu telefon bo‘yicha ${listingQuota.freeLimit} tadan ortiq e‘lon uchun avval ${(listingQuota.feeAmountUzs || LISTING_FEE_UZS).toLocaleString('uz-UZ')} so‘m to‘lang (Click).`,
      );
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Check if access token exists
      console.log('\n🚀 ===== LISTING SUBMISSION START =====');
      console.log('📋 Props received:');
      console.log('  - userId:', userId || 'MISSING');
      console.log('  - userName:', userName || 'MISSING');
      console.log('  - userPhone:', userPhone || 'MISSING');
      console.log('  - accessToken:', accessToken ? `${accessToken.substring(0, 20)}... (length: ${accessToken.length})` : 'MISSING/EMPTY');
      
      if (!accessToken || accessToken.trim() === '') {
        console.error('❌ No access token provided - token is empty or missing');
        setError('Avtorizatsiya kerak. Iltimos, qayta login qiling.');
        setIsSubmitting(false);
        return;
      }

      // Validate token format
      const tokenParts = accessToken.split('-');
      console.log('🔍 Token validation:');
      console.log('  - Token parts:', tokenParts.length);
      console.log('  - Expected: At least 7 parts (UUID has 5 dashes + timestamp + random)');
      
      if (tokenParts.length < 7) {
        console.error('❌ INVALID TOKEN FORMAT!');
        console.error('❌ This token appears to be just a userId, not a proper access token');
        console.error('❌ Please logout and login again to get a new token');
        console.error('❌ Token:', accessToken);
        
        setError('Token formati noto\'g\'ri. Iltimos, Settings > Cache tozalash bosing va qayta login qiling.');
        setIsSubmitting(false);
        return;
      }

      console.log('✅ Access token format is valid');
      const imageUrls = uploadedImageUrls;

      // Create listing
      console.log('\n📝 Creating listing...');
      const endpoint = listingType === 'house' ? '/create-house' : '/create-car';
      const listingData = {
        title,
        description,
        price: parseFloat(price),
        currency,
        categoryId,
        images: imageUrls,
        userId,
        ownerName: userName,
        ownerPhone: userPhone,
        ...(listingType === 'house' ? {
          region,
          district,
          address,
          rooms: parseInt(rooms),
          bathrooms: parseInt(bathrooms),
          area: parseFloat(area),
          floor: parseInt(floor),
          totalFloors: parseInt(totalFloors),
          condition,
          paymentType,
          hasHalalInstallment: creditAvailable,
          halalInstallmentMonths: creditAvailable && creditTerm ? parseInt(creditTerm) : 0,
          halalInstallmentBank: creditAvailable && creditInterestRate ? creditInterestRate : '0',
          halalDownPayment: creditAvailable && initialPayment ? parseFloat(initialPayment) : 0,
          creditAvailable,
          mortgageAvailable,
        } : {
          brand,
          model,
          year: parseInt(year),
          color,
          region,
          district,
          mileage,
          fuelType,
          transmission,
          seats: parseInt(seats),
          condition: condition === 'yangi' ? 'Yangi' : 'Ishlatilgan',
          bodyType,
          driveType,
          engineVolume: engineVolume ? parseFloat(engineVolume) : 0,
          features,
          paymentTypes: (() => {
            const types = ['cash']; // Naqd always available
            if (hasAutoCredit || creditAvailable) types.push('credit');
            if (mortgageAvailable) types.push('mortgage');
            if (creditAvailable) types.push('installment');
            return types;
          })(),
          // Auto Credit fields
          hasAutoCredit,
          autoCreditBank: hasAutoCredit ? autoCreditBank : '',
          autoCreditPercent: hasAutoCredit && autoCreditPercent ? parseFloat(autoCreditPercent) : 0,
          autoCreditPeriod: hasAutoCredit && autoCreditPeriod ? parseInt(autoCreditPeriod) : 0,
          // Halol Installment fields
          hasHalalInstallment: creditAvailable,
          halalInstallmentMonths: creditAvailable && creditTerm ? parseInt(creditTerm) : 0,
          halalInstallmentBank: creditAvailable ? creditInterestRate : '0',
          halalDownPayment: creditAvailable && initialPayment ? parseFloat(initialPayment) : 0,
          // Legacy fields
          creditAvailable: creditAvailable || hasAutoCredit,
          mortgageAvailable,
          paymentType,
        }),
        ...(listingQuota?.requiresFeeForNext && listingFeeTransactionId
          ? { listingFeeTransactionId }
          : {}),
      };

      console.log('📤 Sending to server:', {
        endpoint,
        listingType,
        paymentTypes: listingData.paymentTypes,
        fullData: listingData,
      });

      const res = await fetch(
        `${apiBase}${endpoint}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-Access-Token': accessToken,
          },
          body: JSON.stringify(listingData),
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        console.error('❌ Create listing failed:', errorData);
        throw new Error(errorData.error || 'E\'lon joylashtitishda xatolik');
      }

      console.log('✅ Listing created successfully');
      try {
        sessionStorage.removeItem(listingFeeSessionKey(userId, userPhone));
      } catch {
        /* ignore */
      }
      onSuccess();
      resetForm();
      onClose();
    } catch (err) {
      console.error('❌ Error creating listing:', err);
      console.error('❌ Error type:', typeof err);
      console.error('❌ Error instanceof Error:', err instanceof Error);
      console.error('❌ Error details:', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        raw: err,
      });
      
      const errorMessage = err instanceof Error && err.message 
        ? err.message 
        : (typeof err === 'string' ? err : 'Xatolik yuz berdi. Iltimos, qayta urinib ko\'ring.');
      
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep(defaultType ? 'form' : 'type');
    setListingType(defaultType || null);
    setTitle('');
    setDescription('');
    setPrice('');
    setCurrency('UZS');
    setCategoryId('');
    setImagePreviews([]);
    setRegion('');
    setDistrict('');
    setAddress('');
    setRooms('');
    setBathrooms('');
    setArea('');
    setFloor('');
    setTotalFloors('');
    setCondition('oddiy');
    setBrand('');
    setModel('');
    setYear('');
    setColor('');
    setMileage('');
    setFuelType('');
    setTransmission('');
    setHasAutoCredit(false);
    setAutoCreditBank('');
    setAutoCreditPercent('');
    setAutoCreditPeriod('');
    setSeats('');
    setBodyType('');
    setDriveType('');
    setEngineVolume('');
    setFeatures([]);
    setCarPaymentTypes(['cash']);
    setPaymentType('barchasi');
    setCreditAvailable(false);
    setMortgageAvailable(false);
    setCreditTerm('');
    setInitialPayment('');
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50"
      style={{
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      {/* Content Container - Full screen on mobile, centered on desktop */}
      <div className="w-full h-full flex items-start sm:items-center justify-center">
        <div 
          className="w-full h-full sm:h-auto sm:max-h-[95vh] sm:max-w-2xl sm:rounded-3xl overflow-y-auto"
          style={{
            background: isDark ? '#0a0a0a' : '#ffffff',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Sticky Header */}
          <div
            className="sticky top-0 z-10 flex items-center justify-between p-4 sm:p-6 border-b"
            style={{
              background: isDark ? '#0a0a0a' : '#ffffff',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
          >
          <h2
            className="text-xl sm:text-2xl font-bold"
            style={{ color: isDark ? '#ffffff' : '#111827' }}
          >
            E'lon joylash
          </h2>
          <button
            onClick={onClose}
            className="p-2.5 sm:p-3 rounded-full transition-all active:scale-95"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
            }}
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: isDark ? '#ffffff' : '#111827' }} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-5 pb-32">
          {(quotaLoading || listingQuota) && (
            <div
              className="p-4 rounded-2xl text-sm space-y-2"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
              }}
            >
              {quotaLoading && !listingQuota ? (
                <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.65)' }}>
                  Telefon bo&apos;yicha limit tekshirilmoqda…
                </p>
              ) : listingQuota ? (
                listingQuota.requiresFeeForNext ? (
                  <>
                    <p className="font-semibold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                      Bu telefon bo&apos;yicha {listingQuota.freeLimit} ta bepul e&apos;lon tugagan.
                    </p>
                    <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.7)' }}>
                      Keyingi har bir e&apos;lon:{' '}
                      <strong>
                        {(listingQuota.feeAmountUzs || LISTING_FEE_UZS).toLocaleString('uz-UZ')} so&apos;m
                      </strong>{' '}
                      (Click). Avval to&apos;lang, keyin turini tanlang va e&apos;lonni yuboring.
                    </p>
                    {listingFeeTransactionId ? (
                      <p className="font-medium" style={{ color: '#10b981' }}>
                        To&apos;lov qabul qilindi. Endi turini tanlab e&apos;lonni joylashtirishingiz mumkin.
                      </p>
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-2 mt-2">
                        <button
                          type="button"
                          onClick={startListingFeeClick}
                          disabled={feePaymentBusy || feePolling}
                          className="w-full py-3 rounded-xl font-semibold text-white disabled:opacity-50"
                          style={{ backgroundImage: accentColor.gradient }}
                        >
                          {feePaymentBusy
                            ? 'Tayyorlanmoqda…'
                            : feePolling
                              ? 'To&apos;lov kutilmoqda…'
                              : `${(listingQuota.feeAmountUzs || LISTING_FEE_UZS).toLocaleString('uz-UZ')} so&apos;m — Click orqali to&apos;lash`}
                        </button>
                        <button
                          type="button"
                          onClick={checkPaidFeeManually}
                          disabled={feePaymentBusy || feePolling}
                          className="w-full py-3 rounded-xl font-semibold transition-all disabled:opacity-50"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
                            color: isDark ? '#ffffff' : '#111827',
                          }}
                        >
                          To&apos;lovni tekshirish
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.7)' }}>
                    Bepul qolgan joylar: <strong>{listingQuota.remainingFreeSlots}</strong> (shu telefon bo&apos;yicha
                    jami {listingQuota.freeLimit} ta).
                  </p>
                )
              ) : null}
            </div>
          )}

          {step === 'type' ? (
            // Step 1: Choose type
            <div className="space-y-4">
              <p
                className="text-lg font-medium mb-6"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
              >
                E'lon turini tanlang:
              </p>

              <button
                onClick={() => goToFormWithType('house')}
                disabled={mustPayBeforeContinue}
                className="w-full p-6 rounded-2xl transition-all active:scale-98 flex items-center justify-between disabled:opacity-45 disabled:cursor-not-allowed"
                style={{
                  background: isDark
                    ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03))'
                    : 'linear-gradient(145deg, rgba(255, 255, 255, 0.9), rgba(250, 250, 250, 0.8))',
                  boxShadow: isDark
                    ? '0 8px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                    : '0 8px 24px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}`,
                }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="p-4 rounded-2xl"
                    style={{
                      background: `${accentColor.color}20`,
                    }}
                  >
                    <Home className="size-8" style={{ color: accentColor.color }} strokeWidth={2} />
                  </div>
                  <div className="text-left">
                    <h3
                      className="text-xl font-bold mb-1"
                      style={{ color: isDark ? '#ffffff' : '#111827' }}
                    >
                      Uy/Kvartira
                    </h3>
                    <p
                      className="text-sm"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                    >
                      Uy yoki kvartira sotish
                    </p>
                  </div>
                </div>
                <ChevronRight className="size-6" style={{ color: accentColor.color }} />
              </button>

              <button
                onClick={() => goToFormWithType('car')}
                disabled={mustPayBeforeContinue}
                className="w-full p-6 rounded-2xl transition-all active:scale-98 flex items-center justify-between disabled:opacity-45 disabled:cursor-not-allowed"
                style={{
                  background: isDark
                    ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03))'
                    : 'linear-gradient(145deg, rgba(255, 255, 255, 0.9), rgba(250, 250, 250, 0.8))',
                  boxShadow: isDark
                    ? '0 8px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                    : '0 8px 24px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}`,
                }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="p-4 rounded-2xl"
                    style={{
                      background: `${accentColor.color}20`,
                    }}
                  >
                    <Car className="size-8" style={{ color: accentColor.color }} strokeWidth={2} />
                  </div>
                  <div className="text-left">
                    <h3
                      className="text-xl font-bold mb-1"
                      style={{ color: isDark ? '#ffffff' : '#111827' }}
                    >
                      Moshina
                    </h3>
                    <p
                      className="text-sm"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                    >
                      Avtomobil sotish
                    </p>
                  </div>
                </div>
                <ChevronRight className="size-6" style={{ color: accentColor.color }} />
              </button>
            </div>
          ) : (
            // Step 2: Form
            <div className="space-y-6">
              {/* Back button */}
              <button
                onClick={() => {
                  setStep('type');
                  setListingType(null);
                }}
                className="text-sm font-medium flex items-center gap-2 mb-4"
                style={{ color: accentColor.color }}
              >
                ← Orqaga
              </button>

              {/* Category */}
              <div>
                <label className="block text-sm font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                  Kategoriya *
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-none outline-none"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                    color: isDark ? '#ffffff' : '#111827',
                  }}
                >
                  <option value="" style={{ background: isDark ? '#1e1e1e' : '#ffffff', color: isDark ? '#ffffff' : '#111827' }}>Tanlang</option>
                  {(listingType === 'house' ? houseCategories : carCategories).map((cat) => (
                    <option key={cat.id} value={cat.id} style={{ background: isDark ? '#1e1e1e' : '#ffffff', color: isDark ? '#ffffff' : '#111827' }}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                  Sarlavha *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Masalan: Yangi 3 xonali kvartira"
                  className="w-full px-4 py-3 rounded-xl border-none outline-none"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                    color: isDark ? '#ffffff' : '#111827',
                  }}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                  Ta'rif *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Batafsil ma'lumot..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border-none outline-none resize-none"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                    color: isDark ? '#ffffff' : '#111827',
                  }}
                />
              </div>

              {/* Price and Currency */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                    Narx *
                  </label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0"
                    className="w-full px-4 py-3 rounded-xl border-none outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                      color: isDark ? '#ffffff' : '#111827',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                    Valyuta *
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as 'USD' | 'UZS')}
                    className="w-full px-4 py-3 rounded-xl border-none outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                      color: isDark ? '#ffffff' : '#111827',
                    }}
                  >
                    <option value="UZS" style={{ background: isDark ? '#1e1e1e' : '#ffffff', color: isDark ? '#ffffff' : '#111827' }}>UZS (so'm)</option>
                    <option value="USD" style={{ background: isDark ? '#1e1e1e' : '#ffffff', color: isDark ? '#ffffff' : '#111827' }}>USD (dollar)</option>
                  </select>
                </div>
              </div>

              {/* House specific fields */}
              {listingType === 'house' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                        Viloyat *
                      </label>
                      <select
                        value={region}
                        onChange={(e) => {
                          setRegion(e.target.value);
                          setDistrict(''); // Reset district when region changes
                        }}
                        className="w-full px-4 py-3 rounded-xl border-none outline-none"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                          color: isDark ? '#ffffff' : '#111827',
                        }}
                      >
                        <option value="" style={{ background: isDark ? '#1e1e1e' : '#ffffff', color: isDark ? '#ffffff' : '#111827' }}>Tanlang</option>
                        {regions.map((reg) => (
                          <option key={reg.id} value={reg.name} style={{ background: isDark ? '#1e1e1e' : '#ffffff', color: isDark ? '#ffffff' : '#111827' }}>
                            {reg.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                        Tuman *
                      </label>
                      <select
                        value={district}
                        onChange={(e) => setDistrict(e.target.value)}
                        disabled={!region}
                        className="w-full px-4 py-3 rounded-xl border-none outline-none disabled:opacity-50"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                          color: isDark ? '#ffffff' : '#111827',
                        }}
                      >
                        <option value="" style={{ background: isDark ? '#1e1e1e' : '#ffffff', color: isDark ? '#ffffff' : '#111827' }}>Tanlang</option>
                        {region && regions.find(r => r.name === region)?.districts.map((dist) => (
                          <option key={dist.id} value={dist.name} style={{ background: isDark ? '#1e1e1e' : '#ffffff', color: isDark ? '#ffffff' : '#111827' }}>
                            {dist.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                      Manzil
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Ko'cha va uy raqami"
                      className="w-full px-4 py-3 rounded-xl border-none outline-none"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                        color: isDark ? '#ffffff' : '#111827',
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                        Xonalar *
                      </label>
                      <input
                        type="number"
                        value={rooms}
                        onChange={(e) => setRooms(e.target.value)}
                        placeholder="3"
                        className="w-full px-4 py-3 rounded-xl border-none outline-none"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                          color: isDark ? '#ffffff' : '#111827',
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                        Hammom
                      </label>
                      <input
                        type="number"
                        value={bathrooms}
                        onChange={(e) => setBathrooms(e.target.value)}
                        placeholder="1"
                        className="w-full px-4 py-3 rounded-xl border-none outline-none"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                          color: isDark ? '#ffffff' : '#111827',
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                        Maydoni (m²) *
                      </label>
                      <input
                        type="number"
                        value={area}
                        onChange={(e) => setArea(e.target.value)}
                        placeholder="75"
                        className="w-full px-4 py-3 rounded-xl border-none outline-none"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                          color: isDark ? '#ffffff' : '#111827',
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                        Qavat
                      </label>
                      <input
                        type="number"
                        value={floor}
                        onChange={(e) => setFloor(e.target.value)}
                        placeholder="5"
                        className="w-full px-4 py-3 rounded-xl border-none outline-none"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                          color: isDark ? '#ffffff' : '#111827',
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                        Jami qavatlar
                      </label>
                      <input
                        type="number"
                        value={totalFloors}
                        onChange={(e) => setTotalFloors(e.target.value)}
                        placeholder="9"
                        className="w-full px-4 py-3 rounded-xl border-none outline-none"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                          color: isDark ? '#ffffff' : '#111827',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                      Holati
                    </label>
                    <select
                      value={condition}
                      onChange={(e) => setCondition(e.target.value as any)}
                      className="w-full px-4 py-3 rounded-xl border-none outline-none"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                        color: isDark ? '#ffffff' : '#111827',
                      }}
                    >
                      <option value="oddiy" style={{ background: isDark ? '#1e1e1e' : '#ffffff', color: isDark ? '#ffffff' : '#111827' }}>Oddiy</option>
                      <option value="ta'mirlangan" style={{ background: isDark ? '#1e1e1e' : '#ffffff', color: isDark ? '#ffffff' : '#111827' }}>Ta'mirlangan</option>
                      <option value="yangi" style={{ background: isDark ? '#1e1e1e' : '#ffffff', color: isDark ? '#ffffff' : '#111827' }}>Yangi qurilish</option>
                    </select>
                  </div>

                  {/* Payment Options - Checkboxes */}
                  <div>
                    <label className="block text-sm font-bold mb-3" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                      To'lov turlari
                    </label>
                    
                    <div className="space-y-3">
                      {/* Naqd - Always available */}
                      <div 
                        className="flex items-center gap-3 p-3 rounded-xl"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
                        }}
                      >
                        <div 
                          className="flex items-center justify-center w-5 h-5 rounded-md"
                          style={{
                            background: accentColor.color,
                            boxShadow: `0 2px 8px ${accentColor.color}40`,
                          }}
                        >
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-sm font-semibold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                          💵 Naqd to'lov
                        </span>
                      </div>

                      {/* Halol Nasiya Checkbox */}
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            const newValue = !creditAvailable;
                            setCreditAvailable(newValue);
                            if (!newValue) {
                              setCreditTerm('');
                              setInitialPayment('');
                              setCreditInterestRate('');
                            }
                          }}
                          className="w-full flex items-center gap-3 p-3 rounded-xl transition-all active:scale-98"
                          style={{
                            background: creditAvailable 
                              ? `${accentColor.color}15`
                              : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'),
                            border: `1px solid ${creditAvailable ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)')}`,
                          }}
                        >
                          <div 
                            className="flex items-center justify-center w-5 h-5 rounded-md transition-all"
                            style={{
                              background: creditAvailable ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
                              boxShadow: creditAvailable ? `0 2px 8px ${accentColor.color}40` : 'none',
                            }}
                          >
                            {creditAvailable && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span 
                            className="text-sm font-semibold" 
                            style={{ color: creditAvailable ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)') }}
                          >
                            ✅ Halol Nasiya mavjud
                          </span>
                        </button>

                        {/* Credit Details */}
                        {creditAvailable && (
                          <div className="mt-3 ml-8 grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold mb-1.5" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                                Nasiya muddati (oyda)
                              </label>
                              <input
                                type="number"
                                value={creditTerm}
                                onChange={(e) => setCreditTerm(e.target.value)}
                                placeholder="12"
                                className="w-full px-3 py-2 rounded-lg border-none outline-none text-sm"
                                style={{
                                  background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                                  color: isDark ? '#ffffff' : '#111827',
                                }}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold mb-1.5" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                                Boshlang'ich to'lov (%)
                              </label>
                              <input
                                type="number"
                                value={initialPayment}
                                onChange={(e) => setInitialPayment(e.target.value)}
                                placeholder="20"
                                className="w-full px-3 py-2 rounded-lg border-none outline-none text-sm"
                                style={{
                                  background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                                  color: isDark ? '#ffffff' : '#111827',
                                }}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold mb-1.5" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                                Yillik foiz (%)
                              </label>
                              <input
                                type="number"
                                value={creditInterestRate}
                                onChange={(e) => setCreditInterestRate(e.target.value)}
                                placeholder="0"
                                className="w-full px-3 py-2 rounded-lg border-none outline-none text-sm"
                                style={{
                                  background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                                  color: isDark ? '#ffffff' : '#111827',
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Ipoteka Checkbox - ADMIN ONLY */}
                      <button
                        type="button"
                        onClick={() => setMortgageAvailable(!mortgageAvailable)}
                        className="w-full items-center gap-3 p-3 rounded-xl transition-all active:scale-98 hidden"
                        style={{
                          background: mortgageAvailable 
                            ? `${accentColor.color}15`
                            : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'),
                          border: `1px solid ${mortgageAvailable ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)')}`,
                        }}
                      >
                        <div 
                          className="flex items-center justify-center w-5 h-5 rounded-md transition-all"
                          style={{
                            background: mortgageAvailable ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
                            boxShadow: mortgageAvailable ? `0 2px 8px ${accentColor.color}40` : 'none',
                          }}
                        >
                          {mortgageAvailable && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span 
                          className="text-sm font-semibold" 
                          style={{ color: mortgageAvailable ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)') }}
                        >
                          🏦 Ipoteka mavjud
                        </span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Car specific fields */}
              {listingType === 'car' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                        Brend *
                      </label>
                      <input
                        type="text"
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        placeholder="Toyota"
                        className="w-full px-4 py-3 rounded-xl border-none outline-none"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                          color: isDark ? '#ffffff' : '#111827',
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                        Model *
                      </label>
                      <input
                        type="text"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        placeholder="Camry"
                        className="w-full px-4 py-3 rounded-xl border-none outline-none"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                          color: isDark ? '#ffffff' : '#111827',
                        }}
                      />
                    </div>
                  </div>

                  {/* Region and District for Cars */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                        Viloyat *
                      </label>
                      <select
                        value={region}
                        onChange={(e) => {
                          setRegion(e.target.value);
                          setDistrict(''); // Reset district when region changes
                        }}
                        className="w-full px-4 py-3 rounded-xl border-none outline-none"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                          color: isDark ? '#ffffff' : '#111827',
                        }}
                      >
                        <option value="" style={{ background: isDark ? '#1e1e1e' : '#ffffff', color: isDark ? '#ffffff' : '#111827' }}>Viloyatni tanlang</option>
                        {regions.map((reg) => (
                          <option key={reg.id} value={reg.name} style={{ background: isDark ? '#1e1e1e' : '#ffffff', color: isDark ? '#ffffff' : '#111827' }}>
                            {reg.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                        Tuman *
                      </label>
                      <select
                        value={district}
                        onChange={(e) => setDistrict(e.target.value)}
                        disabled={!region}
                        className="w-full px-4 py-3 rounded-xl border-none outline-none disabled:opacity-50"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                          color: isDark ? '#ffffff' : '#111827',
                        }}
                      >
                        <option value="" style={{ background: isDark ? '#1e1e1e' : '#ffffff', color: isDark ? '#ffffff' : '#111827' }}>Tumanni tanlang</option>
                        {region && regions.find(r => r.name === region)?.districts.map((dist) => (
                          <option key={dist.id} value={dist.name} style={{ background: isDark ? '#1e1e1e' : '#ffffff', color: isDark ? '#ffffff' : '#111827' }}>
                            {dist.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                        Yil *
                      </label>
                      <input
                        type="number"
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        placeholder="2023"
                        className="w-full px-4 py-3 rounded-xl border-none outline-none"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                          color: isDark ? '#ffffff' : '#111827',
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                        Rang *
                      </label>
                      <input
                        type="text"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        placeholder="Oq"
                        className="w-full px-4 py-3 rounded-xl border-none outline-none"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                          color: isDark ? '#ffffff' : '#111827',
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                        O'rindiqlar
                      </label>
                      <input
                        type="number"
                        value={seats}
                        onChange={(e) => setSeats(e.target.value)}
                        placeholder="5"
                        className="w-full px-4 py-3 rounded-xl border-none outline-none"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                          color: isDark ? '#ffffff' : '#111827',
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                        Yoqilg'i turi
                      </label>
                      <input
                        type="text"
                        value={fuelType}
                        onChange={(e) => setFuelType(e.target.value)}
                        placeholder="Benzin"
                        className="w-full px-4 py-3 rounded-xl border-none outline-none"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                          color: isDark ? '#ffffff' : '#111827',
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                        Uzatma qutisi
                      </label>
                      <input
                        type="text"
                        value={transmission}
                        onChange={(e) => setTransmission(e.target.value)}
                        placeholder="Avtomat"
                        className="w-full px-4 py-3 rounded-xl border-none outline-none"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                          color: isDark ? '#ffffff' : '#111827',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                      Yurgan masofa
                    </label>
                    <input
                      type="text"
                      value={mileage}
                      onChange={(e) => setMileage(e.target.value)}
                      placeholder="15,000 km"
                      className="w-full px-4 py-3 rounded-xl border-none outline-none"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                        color: isDark ? '#ffffff' : '#111827',
                      }}
                    />
                  </div>

                  {/* NEW FIELDS: Body Type, Drive Type, Engine Volume */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                        Kuzov turi
                      </label>
                      <select
                        value={bodyType}
                        onChange={(e) => setBodyType(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border-none outline-none"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                          color: isDark ? '#ffffff' : '#111827',
                        }}
                      >
                        <option value="" style={{ background: isDark ? '#1e1e1e' : '#ffffff', color: isDark ? '#ffffff' : '#111827' }}>Tanlang</option>
                        <option value="Sedan" style={{ background: isDark ? '#1e1e1e' : '#ffffff', color: isDark ? '#ffffff' : '#111827' }}>Sedan</option>
                        <option value="SUV" style={{ background: isDark ? '#1e1e1e' : '#ffffff', color: isDark ? '#ffffff' : '#111827' }}>SUV</option>
                        <option value="Crossover" style={{ background: isDark ? '#1e1e1e' : '#ffffff', color: isDark ? '#ffffff' : '#111827' }}>Crossover</option>
                        <option value="Hatchback" style={{ background: isDark ? '#1e1e1e' : '#ffffff', color: isDark ? '#ffffff' : '#111827' }}>Hatchback</option>
                        <option value="Coupe" style={{ background: isDark ? '#1e1e1e' : '#ffffff', color: isDark ? '#ffffff' : '#111827' }}>Coupe</option>
                        <option value="Minivan" style={{ background: isDark ? '#1e1e1e' : '#ffffff', color: isDark ? '#ffffff' : '#111827' }}>Minivan</option>
                        <option value="Pickup" style={{ background: isDark ? '#1e1e1e' : '#ffffff', color: isDark ? '#ffffff' : '#111827' }}>Pickup</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                        Privod
                      </label>
                      <select
                        value={driveType}
                        onChange={(e) => setDriveType(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border-none outline-none"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                          color: isDark ? '#ffffff' : '#111827',
                        }}
                      >
                        <option value="" style={{ background: isDark ? '#1e1e1e' : '#ffffff', color: isDark ? '#ffffff' : '#111827' }}>Tanlang</option>
                        <option value="Old" style={{ background: isDark ? '#1e1e1e' : '#ffffff', color: isDark ? '#ffffff' : '#111827' }}>Old (FWD)</option>
                        <option value="Orqa" style={{ background: isDark ? '#1e1e1e' : '#ffffff', color: isDark ? '#ffffff' : '#111827' }}>Orqa (RWD)</option>
                        <option value="4WD" style={{ background: isDark ? '#1e1e1e' : '#ffffff', color: isDark ? '#ffffff' : '#111827' }}>4WD (To'liq)</option>
                        <option value="AWD" style={{ background: isDark ? '#1e1e1e' : '#ffffff', color: isDark ? '#ffffff' : '#111827' }}>AWD</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                        Dvigatel (L)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={engineVolume}
                        onChange={(e) => setEngineVolume(e.target.value)}
                        placeholder="2.0"
                        className="w-full px-4 py-3 rounded-xl border-none outline-none"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                          color: isDark ? '#ffffff' : '#111827',
                        }}
                      />
                    </div>
                  </div>

                  {/* NEW FIELD: Additional Features */}
                  <div>
                    <label className="block text-sm font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                      Qo'shimcha jihozlar
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        'Teri salon',
                        'Panorama tom',
                        'Kamera 360°',
                        'Klimat-kontrol',
                        'Cruise control',
                        'Parkovka sensori',
                        'LED faralar',
                        'Isitgich',
                        'Sovutgich',
                        'ABS',
                        'Airbag',
                        'Alarm',
                      ].map((feature) => (
                        <button
                          key={feature}
                          type="button"
                          onClick={() => {
                            if (features.includes(feature)) {
                              setFeatures(features.filter(f => f !== feature));
                            } else {
                              setFeatures([...features, feature]);
                            }
                          }}
                          className="px-3 py-2 rounded-lg text-sm font-semibold transition-all active:scale-95"
                          style={{
                            background: features.includes(feature)
                              ? `${accentColor.color}20`
                              : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'),
                            border: `1px solid ${features.includes(feature) ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)')}`,
                            color: features.includes(feature) 
                              ? accentColor.color 
                              : (isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)'),
                          }}
                        >
                          {features.includes(feature) && '✓ '}
                          {feature}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                      Holati
                    </label>
                    <select
                      value={condition}
                      onChange={(e) => setCondition(e.target.value as any)}
                      className="w-full px-4 py-3 rounded-xl border-none outline-none"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                        color: isDark ? '#ffffff' : '#111827',
                      }}
                    >
                      <option value="oddiy" style={{ background: isDark ? '#1e1e1e' : '#ffffff', color: isDark ? '#ffffff' : '#111827' }}>Ishlatilgan</option>
                      <option value="yangi" style={{ background: isDark ? '#1e1e1e' : '#ffffff', color: isDark ? '#ffffff' : '#111827' }}>Yangi</option>
                    </select>
                  </div>

                  {/* Payment Options for Cars */}
                  <div>
                    <label className="block text-sm font-bold mb-3" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                      To'lov turlari
                    </label>
                    
                    <div className="space-y-3">
                      {/* Naqd - Always available */}
                      <div 
                        className="flex items-center gap-3 p-3 rounded-xl"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
                        }}
                      >
                        <div 
                          className="flex items-center justify-center w-5 h-5 rounded-md"
                          style={{
                            background: accentColor.color,
                            boxShadow: `0 2px 8px ${accentColor.color}40`,
                          }}
                        >
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-sm font-semibold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                          💵 Naqd to'lov
                        </span>
                      </div>

                      {/* Halol Nasiya Checkbox */}
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            const newValue = !creditAvailable;
                            setCreditAvailable(newValue);
                            if (!newValue) {
                              setCreditTerm('');
                              setInitialPayment('');
                              setCreditInterestRate('');
                            }
                          }}
                          className="w-full flex items-center gap-3 p-3 rounded-xl transition-all active:scale-98"
                          style={{
                            background: creditAvailable 
                              ? `${accentColor.color}15`
                              : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'),
                            border: `1px solid ${creditAvailable ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)')}`,
                          }}
                        >
                          <div 
                            className="flex items-center justify-center w-5 h-5 rounded-md transition-all"
                            style={{
                              background: creditAvailable ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
                              boxShadow: creditAvailable ? `0 2px 8px ${accentColor.color}40` : 'none',
                            }}
                          >
                            {creditAvailable && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span 
                            className="text-sm font-semibold" 
                            style={{ color: creditAvailable ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)') }}
                          >
                            ✅ Halol Nasiya mavjud
                          </span>
                        </button>

                        {/* Credit Details */}
                        {creditAvailable && (
                          <div className="mt-3 ml-8 grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold mb-1.5" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                                Nasiya muddati (oyda)
                              </label>
                              <input
                                type="number"
                                value={creditTerm}
                                onChange={(e) => setCreditTerm(e.target.value)}
                                placeholder="12"
                                className="w-full px-3 py-2 rounded-lg border-none outline-none text-sm"
                                style={{
                                  background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                                  color: isDark ? '#ffffff' : '#111827',
                                }}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold mb-1.5" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                                Boshlang'ich to'lov (%)
                              </label>
                              <input
                                type="number"
                                value={initialPayment}
                                onChange={(e) => setInitialPayment(e.target.value)}
                                placeholder="20"
                                className="w-full px-3 py-2 rounded-lg border-none outline-none text-sm"
                                style={{
                                  background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                                  color: isDark ? '#ffffff' : '#111827',
                                }}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold mb-1.5" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                                Yillik foiz (%)
                              </label>
                              <input
                                type="number"
                                value={creditInterestRate}
                                onChange={(e) => setCreditInterestRate(e.target.value)}
                                placeholder="0"
                                className="w-full px-3 py-2 rounded-lg border-none outline-none text-sm"
                                style={{
                                  background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                                  color: isDark ? '#ffffff' : '#111827',
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Ipoteka Checkbox - ADMIN ONLY */}
                      <button
                        type="button"
                        onClick={() => setMortgageAvailable(!mortgageAvailable)}
                        className="w-full items-center gap-3 p-3 rounded-xl transition-all active:scale-98 hidden"
                        style={{
                          background: mortgageAvailable 
                            ? `${accentColor.color}15`
                            : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'),
                          border: `1px solid ${mortgageAvailable ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)')}`,
                        }}
                      >
                        <div 
                          className="flex items-center justify-center w-5 h-5 rounded-md transition-all"
                          style={{
                            background: mortgageAvailable ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
                            boxShadow: mortgageAvailable ? `0 2px 8px ${accentColor.color}40` : 'none',
                          }}
                        >
                          {mortgageAvailable && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span 
                          className="text-sm font-semibold" 
                          style={{ color: mortgageAvailable ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)') }}
                        >
                          🏦 Ipoteka mavjud
                        </span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Image upload */}
              <div>
                <label className="block text-sm font-bold mb-3" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                  Rasmlar * (maksimum 10 ta)
                </label>

                {overallUploadPct !== null && (
                  <div
                    className="mb-3 p-3 rounded-2xl border"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                      borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
                    }}
                  >
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span style={{ color: isDark ? '#fff' : '#111827' }}>
                        {isUploadingImages ? 'Yuklanmoqda…' : 'Tayyor'}
                      </span>
                      <span style={{ color: accentColor.color }}>{overallUploadPct}%</span>
                    </div>
                    <div
                      className="mt-2 h-2 rounded-full overflow-hidden"
                      style={{ background: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${overallUploadPct}%`, background: accentColor.gradient }}
                      />
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="relative aspect-square rounded-xl overflow-hidden">
                      <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-500 text-white transition-all active:scale-90"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {imagePreviews.length < 10 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-6 rounded-xl border-2 border-dashed transition-all active:scale-98"
                    style={{
                      borderColor: accentColor.color,
                      background: `${accentColor.color}10`,
                    }}
                  >
                    <Upload className="size-8 mx-auto mb-2" style={{ color: accentColor.color }} />
                    <p className="text-sm font-medium" style={{ color: accentColor.color }}>
                      Rasm yuklash
                    </p>
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Error */}
              {error && (
                <div
                  className="p-4 rounded-xl text-sm font-medium"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                  }}
                >
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky Submit Button - Always visible at bottom */}
        {step === 'form' && (
          <div 
            className="sticky bottom-0 left-0 right-0 p-4 sm:p-6 border-t backdrop-blur-xl"
            style={{
              background: isDark 
                ? 'rgba(10, 10, 10, 0.95)' 
                : 'rgba(255, 255, 255, 0.95)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              boxShadow: isDark
                ? '0 -4px 24px rgba(0, 0, 0, 0.4)'
                : '0 -4px 24px rgba(0, 0, 0, 0.1)',
            }}
          >
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full p-4 rounded-2xl transition-all active:scale-98 disabled:opacity-50"
              style={{
                backgroundImage: accentColor.gradient,
                boxShadow: isDark
                  ? `0 8px 24px ${accentColor.color}66, inset 0 1px 0 rgba(255, 255, 255, 0.25)`
                  : `0 6px 20px ${accentColor.color}4d, inset 0 1px 0 rgba(255, 255, 255, 0.5)`,
              }}
            >
              <span className="font-bold text-white text-lg">
                {isSubmitting ? 'Yuklanmoqda...' : 'E\'lon joylash'}
              </span>
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}