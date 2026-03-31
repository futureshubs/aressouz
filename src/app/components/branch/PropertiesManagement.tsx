import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  MapPin, 
  Phone, 
  Image as ImageIcon,
  Loader2,
  Save,
  X,
  Home,
  Building,
  Upload,
  DollarSign,
  Maximize,
  Users,
  Calendar,
  Wifi,
  ParkingCircle,
  Bed
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { toast } from 'sonner';
import { useVisibilityTick } from '../../utils/visibilityRefetch';

// Dynamic geo data state
interface GeoData {
  regions: string[];
  districts: Record<string, string[]>;
}

interface Property {
  id: string;
  branchId: string;
  userId?: string; // The user who created this property
  name: string;
  propertyType: string;
  description: string;
  price: number;
  priceType: string;
  currency: string;
  region: string;
  district: string;
  address: string;
  coordinates: number[];
  rooms: number;
  bathrooms: number;
  area: number;
  floor: number;
  totalFloors: number;
  buildYear: number;
  condition: string;
  hasParking: boolean;
  hasFurniture: boolean;
  hasElevator: boolean;
  hasBalcony: boolean;
  hasMortgage: boolean;
  mortgageBank?: string;
  mortgagePercent?: number;
  mortgagePeriod?: number;
  hasHalalInstallment: boolean;
  halalInstallmentBank?: string;
  halalInstallmentMonths?: number;
  halalDownPayment?: number;
  images: string[];
  panoramaScenes?: {
    id: string;
    title: string;
    imageUrl: string;
    hotSpots?: any[];
  }[];
  features: string[];
  contactName: string;
  contactPhone: string;
  createdAt: string;
  updatedAt: string;
}

interface PropertiesManagementProps {
  branchId: string;
  userId?: string; // Current logged-in user ID
  branchInfo?: {
    region?: string;
    district?: string;
    phone?: string;
  };
}

export default function PropertiesManagement({ branchId, userId, branchInfo }: PropertiesManagementProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  // Geo data state
  const [geoData, setGeoData] = useState<GeoData>({
    regions: [],
    districts: {},
  });

  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [availableBanks, setAvailableBanks] = useState<any[]>([]);
  
  // Secret code modal state
  const [isSecretCodeModalOpen, setIsSecretCodeModalOpen] = useState(false);
  const [secretCode, setSecretCode] = useState('');
  const [secretCodeAction, setSecretCodeAction] = useState<{
    type: 'edit' | 'delete';
    property: Property;
  } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    propertyType: 'apartment',
    description: '',
    price: '',
    priceType: 'sale',
    currency: 'UZS',
    region: branchInfo?.region || '',
    district: branchInfo?.district || '',
    address: '',
    rooms: '1',
    bathrooms: '1',
    area: '',
    floor: '1',
    totalFloors: '1',
    buildYear: new Date().getFullYear().toString(),
    condition: 'normal',
    hasParking: false,
    hasFurniture: false,
    hasElevator: false,
    hasBalcony: false,
    hasMortgage: false,
    mortgageBank: '',
    mortgagePercent: '',
    mortgagePeriod: '',
    hasHalalInstallment: false,
    halalInstallmentBank: '',
    halalInstallmentMonths: '',
    halalDownPayment: '',
    latitude: '',
    longitude: '',
    contactName: '',
    contactPhone: branchInfo?.phone || '',
    features: '',
  });

  // Images state
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  // 360 Panorama state
  const [panoramaScenes, setPanoramaScenes] = useState<{
    id: string;
    title: string;
    file: File | null;
    preview: string;
  }[]>([]);
  const visibilityRefetchTick = useVisibilityTick();

  // Load geo data from API
  const loadGeoData = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/geo-data`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        // Mock data fallback
        const mockGeoData: GeoData = {
          regions: [
            'Toshkent shahar',
            'Toshkent viloyati',
            'Andijon',
            'Buxoro',
            'Jizzax',
            'Qashqadaryo',
            'Navoiy',
            'Namangan',
            'Samarqand',
            'Sirdaryo',
            'Surxondaryo',
            'Farg\'ona',
            'Xorazm',
            'Qoraqalpog\'iston'
          ],
          districts: {
            'Toshkent shahar': [
              'Bektemir', 'Chilonzor', 'Mirzo Ulug\'bek', 'Mirobod', 'Olmazor', 
              'Sergeli', 'Shayxontohur', 'Uchtepa', 'Yakkasaroy', 'Yashnobod', 
              'Yunusobod', 'Yashnaobod'
            ],
            'Toshkent viloyati': [
              'Angren', 'Bekobod', 'Bo\'ka', 'Bo\'stonliq', 'Chinoz', 'Qibray', 
              'Ohangaron', 'Oqqo\'rg\'on', 'Parkent', 'Piskent', 'Quyi Chirchiq', 
              'O\'rta Chirchiq', 'Yangiyo\'l', 'Yuqori Chirchiq', 'Zangiota'
            ],
            'Andijon': [
              'Andijon', 'Asaka', 'Baliqchi', 'Bo\'z', 'Buloqboshi', 'Jalaquduq', 
              'Izboskan', 'Qo\'rg\'ontepa', 'Marhamat', 'Oltinko\'l', 'Paxtaobod', 
              'Shahrixon', 'Ulug\'nor', 'Xo\'jaobod'
            ],
            'Buxoro': [
              'Buxoro', 'Kogon', 'G\'ijduvon', 'Jondor', 'Olot', 'Peshku', 
              'Qorako\'l', 'Qorovulbozor', 'Romitan', 'Shofirkon', 'Vobkent'
            ],
            'Farg\'ona': [
              'Farg\'ona', 'Beshariq', 'Bog\'dod', 'Buvayda', 'Dang\'ara', 'Farg\'ona', 
              'Furqat', 'O\'zbekiston', 'Qo\'qon', 'Qo\'shtepa', 'Quva', 'Rishton', 
              'So\'x', 'Toshloq', 'Uchko\'prik', 'Yozyovon'
            ],
            'Jizzax': [
              'Jizzax', 'Arnasoy', 'Baxmal', 'Do\'stlik', 'Forish', 'G\'allaorol', 
              'Sharof Rashidov', 'Mirzacho\'l', 'Paxtakor', 'Yangiobod', 'Zomin', 'Zafarobod'
            ],
            'Namangan': [
              'Namangan', 'Chortoq', 'Chust', 'Kosonsoy', 'Mingbuloq', 'Norin', 
              'Pop', 'To\'raqo\'rg\'on', 'Uchqo\'rg\'on', 'Uychi', 'Yangiqo\'rg\'on'
            ],
            'Navoiy': [
              'Navoiy', 'Konimex', 'Karmana', 'Qiziltepa', 'Xatirchi', 'Navbahor', 
              'Nurota', 'Tomdi', 'Uchquduq'
            ],
            'Qashqadaryo': [
              'Qarshi', 'Chiroqchi', 'Dehqonobod', 'G\'uzor', 'Kasbi', 'Kitob', 
              'Koson', 'Mirishkor', 'Muborak', 'Nishon', 'Qamashi', 'Shahrisabz', 'Yakkabog\''
            ],
            'Qoraqalpog\'iston': [
              'Nukus', 'Amudaryo', 'Beruniy', 'Chimboy', 'Ellikqal\'a', 'Kegeyli', 
              'Mo\'ynoq', 'Nukus', 'Qanliko\'l', 'Qo\'ng\'irot', 'Shumanay', 'Taxtako\'pir', 
              'To\'rtko\'l', 'Xo\'jayli'
            ],
            'Samarqand': [
              'Samarqand', 'Bulung\'ur', 'Ishtixon', 'Jomboy', 'Kattaqo\'rg\'on', 
              'Narpay', 'Nurobod', 'Oqdaryo', 'Paxtachi', 'Payariq', 'Pastdarg\'om', 
              'Qo\'shrabot', 'Samarqand', 'Toyloq', 'Urgut'
            ],
            'Sirdaryo': [
              'Guliston', 'Boyovut', 'Guliston', 'Mirzaobod', 'Oqoltin', 'Sardoba', 
              'Sayxunobod', 'Sirdaryo', 'Xovos'
            ],
            'Surxondaryo': [
              'Termiz', 'Angor', 'Boysun', 'Denov', 'Jarqo\'rg\'on', 'Qiziriq', 
              'Qo\'mqo\'rg\'on', 'Muzrabot', 'Oltinsoy', 'Sariosiyo', 'Sherobod', 
              'Sho\'rchi', 'Termiz', 'Uzun'
            ],
            'Xorazm': [
              'Urganch', 'Bog\'ot', 'Gurlan', 'Xonqa', 'Xazorasp', 'Qo\'shko\'pir', 
              'Shovot', 'Urganch', 'Yangiariq', 'Yangibozor'
            ]
          }
        };
        
        setGeoData({ regions: [], districts: {} });
        console.error('❌ Geo data API response not ok:', response.status, response.statusText);
        toast.error('Hudud ma\'lumotlarini yuklashda xatolik');
        return;
      }

      const data = await response.json();
      if (data.success) {
        setGeoData(data.data);
        console.log('✅ Geo data loaded from API:', data.data);
      }
    } catch (error) {
      console.error('❌ Error loading geo data:', error);
    }
  };

  // Load properties
  useEffect(() => {
    loadGeoData();
    loadProperties();
    loadBanks();
  }, [branchId, userId, visibilityRefetchTick]);

  // Debug properties
  useEffect(() => {
    console.log('🔍 Properties state changed:', properties.length, properties);
  }, [properties]);

  const loadProperties = async () => {
    try {
      setIsLoading(true);
      
      console.log('🏠 Loading properties for region/district:', {
        region: branchInfo?.region,
        district: branchInfo?.district,
        currentBranchId: branchId
      });
      
      const params = new URLSearchParams();
      // DO NOT send branchId - we want ALL properties from this region/district
      // This includes BOTH filial properties (property:) AND user houses (house:)
      if (branchInfo?.region) params.append('region', branchInfo.region.toLowerCase());
      if (branchInfo?.district) params.append('district', branchInfo.district.toLowerCase());
      
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branch-properties?${params}`;
      
      console.log('🔗 Fetching from:', url);
      console.log('📤 Request params:', {
        region: branchInfo?.region?.toLowerCase(),
        district: branchInfo?.district?.toLowerCase(),
        branchIdNOTSent: 'intentionally not sending branchId to get ALL properties (property: + house:)'
      });
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Load failed - Status:', response.status, 'Error:', errorData);
        throw new Error(errorData.error || 'Ko\'chmas mulklarni yuklashda xatolik');
      }

      const data = await response.json();
      console.log('📦 Properties loaded:', data.properties?.length || 0);
      console.log('📋 Properties data:', data.properties);
      
      // Debug each property's region/district/branchId
      if (data.properties && data.properties.length > 0) {
        console.log('🔍 Property details:');
        data.properties.forEach((p: any, idx: number) => {
          console.log(`  ${idx + 1}. ${p.name}:`, {
            region: p.region,
            district: p.district,
            branchId: p.branchId,
            userId: p.userId,
            source: p.id?.startsWith('property:') ? '🏢 FILIAL' : '👤 FOYDALANUVCHI'
          });
        });
      } else {
        console.warn('⚠️ No properties found!');
        console.warn('   📍 Searching for: Region =', branchInfo?.region, ', District =', branchInfo?.district);
        console.warn('   💡 Iltimos, "Ko\'chmas mulk qo\'shish" tugmasidan yangi mulk qo\'shing');
        console.warn('   🔍 Yoki filial sozlamalarida viloyat/tuman to\'g\'ri ko\'rsatilganligini tekshiring');
        
        // Show info toast instead of error
        toast.info(`${branchInfo?.region || 'Ushbu'} / ${branchInfo?.district || 'ushbu tuman'} uchun hozircha ko'chmas mulklar yo'q. Yangi mulk qo'shing!`, {
          duration: 5000,
        });
      }
      
      setProperties(data.properties || []);
    } catch (error: any) {
      console.error('❌ Load properties error:', error);
      toast.error(error.message || 'Ko\'chmas mulklarni yuklashda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  // Load available banks
  const loadBanks = async () => {
    try {
      const params = new URLSearchParams();
      params.append('branchId', branchId);
      
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/banks?${params}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAvailableBanks(data.banks || []);
        console.log('🏦 Loaded banks:', data.banks?.length || 0);
      }
    } catch (error) {
      console.error('Load banks error:', error);
    }
  };

  const handleMultipleImagesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileArray = Array.from(files).slice(0, 5);
    const currentCount = selectedImages.length;
    const availableSlots = 5 - currentCount;
    const newFiles = fileArray.slice(0, availableSlots);

    if (newFiles.length === 0) {
      toast.error('Maksimal 5 ta rasm yuklash mumkin');
      return;
    }

    setSelectedImages([...selectedImages, ...newFiles]);

    newFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  // 360 Panorama handlers
  const addPanoramaScene = () => {
    if (panoramaScenes.length >= 10) {
      toast.error('Maksimal 10 ta 360° ko\'rinish qo\'shish mumkin');
      return;
    }

    const newScene = {
      id: `scene-${Date.now()}`,
      title: `Xona ${panoramaScenes.length + 1}`,
      file: null,
      preview: '',
    };
    setPanoramaScenes([...panoramaScenes, newScene]);
  };

  const removePanoramaScene = (index: number) => {
    setPanoramaScenes(prev => prev.filter((_, i) => i !== index));
  };

  const updatePanoramaScene = (index: number, field: string, value: any) => {
    setPanoramaScenes(prev => prev.map((scene, i) => {
      if (i === index) {
        return { ...scene, [field]: value };
      }
      return scene;
    }));
  };

  const handlePanoramaImageSelect = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Faqat rasm fayllari yuklanishi mumkin');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      updatePanoramaScene(index, 'file', file);
      updatePanoramaScene(index, 'preview', reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const openModal = (property?: Property) => {
    if (property) {
      // Check if this is a user-created property (not from this branch)
      const isUserProperty = property.id?.startsWith('house:') || 
        (property.userId && property.userId !== userId);
      
      if (isUserProperty) {
        // Show secret code modal for user properties
        setSecretCodeAction({ type: 'edit', property });
        setIsSecretCodeModalOpen(true);
        return;
      }
      
      // Regular property - open edit modal directly
      setEditingId(property.id);
      setFormData({
        name: property.name,
        propertyType: property.propertyType,
        description: property.description,
        price: property.price.toString(),
        priceType: property.priceType,
        currency: property.currency,
        region: property.region,
        district: property.district,
        address: property.address,
        rooms: property.rooms.toString(),
        bathrooms: property.bathrooms.toString(),
        area: property.area.toString(),
        floor: property.floor.toString(),
        totalFloors: property.totalFloors.toString(),
        buildYear: property.buildYear.toString(),
        condition: property.condition,
        hasParking: property.hasParking,
        hasFurniture: property.hasFurniture,
        hasElevator: property.hasElevator,
        hasBalcony: property.hasBalcony,
        hasMortgage: property.hasMortgage,
        mortgageBank: property.mortgageBank || '',
        mortgagePercent: property.mortgagePercent?.toString() || '',
        mortgagePeriod: property.mortgagePeriod?.toString() || '',
        hasHalalInstallment: property.hasHalalInstallment || false,
        halalInstallmentBank: property.halalInstallmentBank || '',
        halalInstallmentMonths: property.halalInstallmentMonths?.toString() || '',
        halalDownPayment: property.halalDownPayment?.toString() || '',
        latitude: property.coordinates?.[0]?.toString() || '',
        longitude: property.coordinates?.[1]?.toString() || '',
        contactName: property.contactName,
        contactPhone: property.contactPhone,
        features: property.features?.join(', ') || '',
      });
      setImagePreviews(property.images || []);
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        propertyType: 'apartment',
        description: '',
        price: '',
        priceType: 'sale',
        currency: 'UZS',
        region: branchInfo?.region || '',
        district: branchInfo?.district || '',
        address: '',
        rooms: '1',
        bathrooms: '1',
        area: '',
        floor: '1',
        totalFloors: '1',
        buildYear: new Date().getFullYear().toString(),
        condition: 'normal',
        hasParking: false,
        hasFurniture: false,
        hasElevator: false,
        hasBalcony: false,
        hasMortgage: false,
        mortgageBank: '',
        mortgagePercent: '',
        mortgagePeriod: '',
        hasHalalInstallment: false,
        halalInstallmentBank: '',
        halalInstallmentMonths: '',
        halalDownPayment: '',
        latitude: '',
        longitude: '',
        contactName: '',
        contactPhone: branchInfo?.phone || '',
        features: '',
      });
      setImagePreviews([]);
      setSelectedImages([]);
    }
    setIsModalOpen(true);
    setError('');
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setSelectedImages([]);
    setImagePreviews([]);
    setPanoramaScenes([]);
    setError('');
  };

  const handleSubmit = async () => {
    try {
      if (!formData.name || !formData.price || !formData.propertyType) {
        setError('Iltimos, barcha majburiy maydonlarni to\'ldiring');
        return;
      }

      if (!editingId && imagePreviews.length === 0) {
        setError('Kamida bitta rasm yuklang');
        return;
      }

      setIsSaving(true);
      setError('');

      // Prepare panorama scenes data
      const panoramaData = panoramaScenes
        .filter(scene => scene.preview) // Only include scenes with images
        .map(scene => ({
          id: scene.id,
          title: scene.title,
          imageUrl: scene.preview, // Base64 image data
        }));

      const propertyData = {
        branchId,
        userId: userId || branchId, // Use userId if available, otherwise fallback to branchId
        name: formData.name,
        propertyType: formData.propertyType,
        description: formData.description,
        price: parseFloat(formData.price),
        priceType: formData.priceType,
        currency: formData.currency,
        region: formData.region.toLowerCase(),
        district: formData.district.toLowerCase(),
        address: formData.address,
        rooms: parseInt(formData.rooms),
        bathrooms: parseInt(formData.bathrooms),
        area: parseFloat(formData.area),
        floor: parseInt(formData.floor),
        totalFloors: parseInt(formData.totalFloors),
        buildYear: parseInt(formData.buildYear),
        condition: formData.condition,
        hasParking: formData.hasParking,
        hasFurniture: formData.hasFurniture,
        hasElevator: formData.hasElevator,
        hasBalcony: formData.hasBalcony,
        hasMortgage: formData.hasMortgage,
        mortgageBank: formData.hasMortgage ? formData.mortgageBank : '',
        mortgagePercent: formData.hasMortgage ? parseFloat(formData.mortgagePercent) : 0,
        mortgagePeriod: formData.hasMortgage ? parseInt(formData.mortgagePeriod) : 0,
        hasHalalInstallment: formData.hasHalalInstallment,
        halalInstallmentBank: formData.hasHalalInstallment ? formData.halalInstallmentBank : '',
        halalInstallmentMonths: formData.hasHalalInstallment ? parseInt(formData.halalInstallmentMonths) : 0,
        halalDownPayment: formData.hasHalalInstallment ? parseFloat(formData.halalDownPayment) : 0,
        coordinates: formData.latitude && formData.longitude 
          ? [parseFloat(formData.latitude), parseFloat(formData.longitude)]
          : [41.311, 69.279],
        images: imagePreviews,
        panoramaScenes: panoramaData.length > 0 ? panoramaData : undefined,
        features: formData.features ? formData.features.split(',').map((f: string) => f.trim()).filter(Boolean) : [],
        contactName: formData.contactName,
        contactPhone: formData.contactPhone,
      };

      const url = editingId
        ? `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branch-properties/${editingId}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branch-properties`;

      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(propertyData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Xatolik yuz berdi');
      }

      const result = await response.json();
      toast.success(result.message || 'Muvaffaqiyatli saqlandi');
      
      closeModal();
      loadProperties();
    } catch (error: any) {
      console.error('❌ Submit error:', error);
      setError(error.message || 'Xatolik yuz berdi');
      toast.error(error.message || 'Xatolik yuz berdi');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, property?: any) => {
    // Check if this is a user-created property (not from this branch)
    const isUserProperty = property && (
      property.id?.startsWith('house:') || 
      (property.userId && property.userId !== userId)
    );
    
    if (isUserProperty) {
      // Show secret code modal for user properties
      setSecretCodeAction({ type: 'delete', property });
      setIsSecretCodeModalOpen(true);
      return;
    }
    
    // Regular property - delete directly with confirmation
    if (!confirm('Rostdan ham o\'chirmoqchimisiz?')) return;

    const prevProperties = properties;
    setProperties((prev) => prev.filter((p) => p.id !== id));

    try {
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branch-properties/${id}?branchId=${branchId}${userId ? `&userId=${userId}` : ''}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'O\'chirishda xatolik');
      }

      toast.success('Ko\'chmas mulk o\'chirildi');
    } catch (error: any) {
      console.error('❌ Delete error:', error);
      setProperties(prevProperties);
      toast.error(error.message || 'O\'chirishda xatolik');
    }
  };

  const handleSeedProperties = async () => {
    if (!confirm('Test mulklar qo\'shilsinmi?')) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branch-properties/seed`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Seed failed - Status:', response.status, 'Error:', errorData);
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Seed success:', data);
      toast.success(data.message || 'Test mulklar qo\'shildi');
      
      // Reload properties - wrap in try-catch
      try {
        await loadProperties();
      } catch (loadError) {
        console.error('⚠️ Failed to reload properties after seed:', loadError);
      }
    } catch (error: any) {
      console.error('❌ Seed error:', error);
      toast.error(error.message || 'Test mulklar qo\'shishda xatolik');
    }
  };

  // Handle secret code submission
  const handleSecretCodeSubmit = async () => {
    if (secretCode !== '0099') {
      toast.error('❌ Noto\'g\'ri kod!');
      setSecretCode('');
      return;
    }
    
    // Code is correct
    console.log('✅ Secret code correct');
    setIsSecretCodeModalOpen(false);
    setSecretCode('');
    
    if (!secretCodeAction) return;
    
    if (secretCodeAction.type === 'edit') {
      // Open edit modal
      const property = secretCodeAction.property;
      setEditingId(property.id);
      setFormData({
        name: property.name,
        propertyType: property.propertyType,
        description: property.description,
        price: property.price.toString(),
        priceType: property.priceType,
        currency: property.currency,
        region: property.region,
        district: property.district,
        address: property.address,
        rooms: property.rooms.toString(),
        bathrooms: property.bathrooms.toString(),
        area: property.area.toString(),
        floor: property.floor.toString(),
        totalFloors: property.totalFloors.toString(),
        buildYear: property.buildYear.toString(),
        condition: property.condition,
        hasParking: property.hasParking,
        hasFurniture: property.hasFurniture,
        hasElevator: property.hasElevator,
        hasBalcony: property.hasBalcony,
        hasMortgage: property.hasMortgage,
        mortgageBank: property.mortgageBank || '',
        mortgagePercent: property.mortgagePercent?.toString() || '',
        mortgagePeriod: property.mortgagePeriod?.toString() || '',
        hasHalalInstallment: property.hasHalalInstallment || false,
        halalInstallmentBank: property.halalInstallmentBank || '',
        halalInstallmentMonths: property.halalInstallmentMonths?.toString() || '',
        halalDownPayment: property.halalDownPayment?.toString() || '',
        latitude: property.latitude?.toString() || '',
        longitude: property.longitude?.toString() || '',
        contactName: property.contactName || '',
        contactPhone: property.contactPhone || branchInfo?.phone || '',
        features: property.features || '',
      });
      
      // Set existing images
      if (property.images && property.images.length > 0) {
        setImagePreviews(property.images);
      }
      
      // Set panorama scenes if exist
      if (property.panoramaScenes && property.panoramaScenes.length > 0) {
        setPanoramaScenes(property.panoramaScenes.map((scene: any) => ({
          id: scene.id || Math.random().toString(36).substr(2, 9),
          title: scene.title || '',
          file: null,
          preview: scene.url || '',
          hotspots: scene.hotspots || [],
        })));
      }
      
      setIsModalOpen(true);
      
    } else if (secretCodeAction.type === 'delete') {
      // Perform delete
      if (!confirm('Rostdan ham o\'chirmoqchimisiz?')) {
        setSecretCodeAction(null);
        return;
      }
      
      const id = secretCodeAction.property.id;
      try {
        const url = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branch-properties/${id}?branchId=${branchId}${userId ? `&userId=${userId}` : ''}`;
        const response = await fetch(url, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'O\'chirishda xatolik');
        }

        toast.success('Ko\'chmas mulk o\'chirildi');
        loadProperties();
      } catch (error: any) {
        console.error('❌ Delete error:', error);
        toast.error(error.message || 'O\'chirishda xatolik');
      }
    }
    
    setSecretCodeAction(null);
  };

  const handleClearProperties = async () => {
    if (!confirm('Barcha mulklarni o\'chirmoqchimisiz? Bu amalni bekor qilib bo\'lmaydi!')) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branch-properties/clear`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Clear failed - Status:', response.status, 'Error:', errorData);
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Clear success:', data);
      toast.success(data.message || 'Barcha mulklar o\'chirildi');
      
      // Reload properties - wrap in try-catch to prevent clear success from being hidden
      try {
        await loadProperties();
      } catch (loadError) {
        console.error('⚠️ Failed to reload properties after clear:', loadError);
        // Don't show error toast here since clear was successful
      }
    } catch (error: any) {
      console.error('❌ Clear error:', error);
      toast.error(error.message || 'O\'chirishda xatolik');
    }
  };

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('uz-UZ').format(price) + ' ' + currency;
  };

  const getPropertyTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'apartment': 'Kvartira',
      'house': 'Uy',
      'commercial': 'Tijorat',
      'land': 'Yer',
      'cottage': 'Kottej',
      'office': 'Ofis',
    };
    return types[type] || type;
  };

  const getConditionLabel = (condition: string) => {
    const conditions: Record<string, string> = {
      'new': 'Yangi',
      'normal': 'Oddiy',
      'renovation': 'Ta\'mirlangan',
    };
    return conditions[condition] || condition;
  };

  // Check if property belongs to current user (only creator can edit/delete)
  const canEdit = (property: Property) => {
    // Admin can edit ALL properties (will be asked for secret code for user properties)
    // This allows buttons to show, but openModal and handleDelete will verify the code
    return true;
    
    // OLD LOGIC (commented out):
    // If property has userId, check if it matches current userId
    // if (property.userId) {
    //   return userId ? property.userId === userId : false;
    // }
    // For old data without userId, fallback to branchId check
    // return property.branchId === branchId;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Ko'chmas Mulk</h2>
          <p 
            className="text-sm mt-1"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
          >
            {branchInfo?.region && branchInfo?.district 
              ? `${branchInfo.region}, ${branchInfo.district} - Uylar va mulklar`
              : 'Uylar va mulklar boshqaruvi'
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          {properties.length > 0 && (
            <button
              onClick={handleClearProperties}
              className="px-4 py-3 rounded-2xl font-medium flex items-center gap-2 transition-all border"
              style={{ 
                background: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
                borderColor: 'rgba(239, 68, 68, 0.3)',
                color: '#ef4444'
              }}
            >
              <Trash2 className="w-5 h-5" />
              Barcha o'chirish
            </button>
          )}
          <button
            onClick={() => openModal()}
            className="px-6 py-3 rounded-2xl font-medium flex items-center gap-2 transition-all shadow-lg hover:shadow-xl"
            style={{ 
              background: accentColor.color,
              color: '#ffffff'
            }}
          >
            <Plus className="w-5 h-5" />
            Mulk Qo'shish
          </button>
        </div>
      </div>

      {/* Properties Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div 
              key={i}
              className="rounded-3xl overflow-hidden border animate-pulse"
              style={{
                background: isDark 
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                  : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <div 
                className="h-48"
                style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
              />
              <div className="p-4 space-y-3">
                <div 
                  className="h-5 rounded-lg"
                  style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
                />
                <div 
                  className="h-4 rounded-lg w-3/4"
                  style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : properties.length === 0 ? (
        <div 
          className="flex items-center justify-center min-h-[60vh] rounded-3xl border"
          style={{
            background: isDark 
              ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
              : 'linear-gradient(145deg, #ffffff, #f9fafb)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <div className="text-center max-w-md mx-auto px-4">
            <div 
              className="inline-flex p-6 rounded-3xl mb-4"
              style={{ background: `${accentColor.color}20` }}
            >
              <Home className="w-12 h-12" style={{ color: accentColor.color }} />
            </div>
            <h3 className="text-xl font-bold mb-2">Ko'chmas mulklar topilmadi</h3>
            <p className="mb-4" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
              {branchInfo?.region && branchInfo?.district ? (
                <>
                  <span className="font-semibold">{branchInfo.region} / {branchInfo.district}</span> uchun hozircha mulklar yo'q
                </>
              ) : (
                'Filial uchun viloyat/tuman belgilanmagan'
              )}
            </p>
            <div className="space-y-2 mb-4 text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
              <p>💡 Yangi mulk qo'shish uchun yuqoridagi tugmani bosing</p>
              <p>🔍 Yoki filial sozlamalarida viloyat/tuman to'g'riligini tekshiring</p>
            </div>
            <button
              onClick={handleSeedProperties}
              className="mt-4 px-6 py-3 rounded-xl font-medium transition-all hover:opacity-80"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
              }}
            >
              📦 Test mulklar qo'shish (Demo)
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map(property => (
            <div
              key={property.id}
              className="rounded-3xl overflow-hidden border transition-all hover:shadow-xl"
              style={{
                background: isDark 
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                  : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              {/* Image */}
              <div className="relative h-48 overflow-hidden">
                {property.images && property.images.length > 0 ? (
                  <img
                    src={property.images[0]}
                    alt={property.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div 
                    className="w-full h-full flex items-center justify-center"
                    style={{ background: `${accentColor.color}20` }}
                  >
                    <Home className="w-16 h-16" style={{ color: accentColor.color }} />
                  </div>
                )}
                
                {/* Type Badge */}
                <div 
                  className="absolute top-3 left-3 px-3 py-1.5 rounded-xl text-xs font-medium"
                  style={{ 
                    background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  {getPropertyTypeLabel(property.propertyType)}
                </div>

                {/* Price Type Badge */}
                <div 
                  className="absolute top-3 right-3 px-3 py-1.5 rounded-xl text-xs font-medium"
                  style={{ 
                    background: property.priceType === 'sale' 
                      ? accentColor.color 
                      : isDark ? 'rgba(100, 100, 100, 0.9)' : 'rgba(200, 200, 200, 0.9)',
                    color: '#ffffff'
                  }}
                >
                  {property.priceType === 'sale' ? 'Sotuv' : 'Ijara'}
                </div>

                {/* Mortgage Badge */}
                {property.hasMortgage && (
                  <div 
                    className="absolute bottom-3 left-3 px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1"
                    style={{ 
                      background: 'rgba(34, 197, 94, 0.9)',
                      color: '#ffffff'
                    }}
                  >
                    <DollarSign className="w-3 h-3" />
                    Ipoteka
                  </div>
                )}

                {/* Halal Installment Badge */}
                {property.hasHalalInstallment && (
                  <div 
                    className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1"
                    style={{ 
                      background: accentColor.color,
                      color: '#ffffff',
                      boxShadow: `0 4px 12px ${accentColor.color}50`
                    }}
                  >
                    ✓ Xalol Nasiya
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="font-bold text-lg mb-2 line-clamp-1">{property.name}</h3>
                
                {/* DEBUG INFO - qaysi filial va user */}
                <div 
                  className="mb-3 p-2 rounded-lg text-xs"
                  style={{ 
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                  }}
                >
                  <div>
                    {property.id?.startsWith('property:') ? '🏢 FILIAL' : '👤 FOYDALANUVCHI'} e'loni
                  </div>
                  <div>🏢 Filial: {property.branchId || 'N/A'}</div>
                  <div>👤 User: {property.userId || 'N/A'}</div>
                  <div>📍 Hudud: {property.region} / {property.district}</div>
                  {canEdit(property) && (
                    <div style={{ color: accentColor.color }}>✏️ Tahrirlash mumkin</div>
                  )}
                  {!canEdit(property) && (
                    <div style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                      🔒 Boshqa foydalanuvchining e'loni
                    </div>
                  )}
                </div>
                
                <div 
                  className="text-2xl font-bold mb-3"
                  style={{ color: accentColor.color }}
                >
                  {formatPrice(property.price, property.currency)}
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Bed className="w-4 h-4" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }} />
                    <span>{property.rooms} xona</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Maximize className="w-4 h-4" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }} />
                    <span>{property.area} m²</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Building className="w-4 h-4" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }} />
                    <span>{property.floor}/{property.totalFloors} qavat</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }} />
                    <span>{property.buildYear} yil</span>
                  </div>
                </div>

                {/* Features */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {property.hasParking && (
                    <div 
                      className="px-2 py-1 rounded-lg text-xs flex items-center gap-1"
                      style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
                    >
                      <ParkingCircle className="w-3 h-3" />
                      Parking
                    </div>
                  )}
                  {property.hasFurniture && (
                    <div 
                      className="px-2 py-1 rounded-lg text-xs"
                      style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
                    >
                      Mebel
                    </div>
                  )}
                  {property.hasBalcony && (
                    <div 
                      className="px-2 py-1 rounded-lg text-xs"
                      style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
                    >
                      Balkon
                    </div>
                  )}
                </div>

                {/* Location */}
                <div className="flex items-center gap-2 text-sm mb-4">
                  <MapPin className="w-4 h-4" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }} />
                  <span className="line-clamp-1">{property.address || `${property.region}, ${property.district}`}</span>
                </div>

                {/* Contact */}
                {property.contactPhone && (
                  <div className="flex items-center gap-2 text-sm mb-4">
                    <Phone className="w-4 h-4" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }} />
                    <span>{property.contactPhone}</span>
                  </div>
                )}

                {/* Actions */}
                {canEdit(property) && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => openModal(property)}
                      className="flex-1 px-4 py-2.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                      Tahrirlash
                    </button>
                    <button
                      onClick={() => handleDelete(property.id, property)}
                      className="px-4 py-2.5 rounded-xl font-medium transition-all"
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444',
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0"
            style={{ 
              background: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(10px)'
            }}
            onClick={closeModal}
          />

          {/* Modal Content */}
          <div
            className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl p-6"
            style={{
              background: isDark 
                ? 'linear-gradient(145deg, #1a1a1a, #0a0a0a)'
                : 'linear-gradient(145deg, #ffffff, #f9fafb)',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold">
                {editingId ? 'Ko\'chmas mulkni tahrirlash' : 'Yangi ko\'chmas mulk qo\'shish'}
              </h3>
              <button
                onClick={closeModal}
                className="p-2 rounded-xl transition-all"
                style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div 
                className="mb-4 p-4 rounded-2xl text-sm"
                style={{ 
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.2)'
                }}
              >
                {error}
              </div>
            )}

            {/* Form */}
            <div className="space-y-4">
              {/* Images */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Rasmlar (maksimal 5 ta) *
                </label>
                
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={preview}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-32 object-cover rounded-xl"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  
                  {imagePreviews.length < 5 && (
                    <label 
                      className="h-32 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all hover:border-opacity-100"
                      style={{ 
                        borderColor: `${accentColor.color}40`,
                        background: `${accentColor.color}10`
                      }}
                    >
                      <Upload className="w-6 h-6 mb-2" style={{ color: accentColor.color }} />
                      <span className="text-xs">Rasm yuklash</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleMultipleImagesSelect}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* 360° Panorama Images */}
              <div
                className="p-4 rounded-2xl border"
                style={{
                  background: `${accentColor.color}08`,
                  borderColor: `${accentColor.color}30`,
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      360° Panorama Ko'rinishlar (Ixtiyoriy)
                    </label>
                    <p className="text-xs opacity-60">
                      Virtual 3D tur uchun 360° rasmlar yuklang
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addPanoramaScene}
                    className="px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition-all active:scale-95"
                    style={{
                      background: accentColor.color,
                      color: '#ffffff',
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    Qo'shish
                  </button>
                </div>

                {panoramaScenes.length === 0 ? (
                  <div
                    className="p-8 rounded-xl text-center"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
                    }}
                  >
                    <div className="text-4xl mb-3">🏠</div>
                    <p className="text-sm font-medium mb-1">360° ko'rinish qo'shilmagan</p>
                    <p className="text-xs opacity-60">
                      "Qo'shish" tugmasini bosing va 360° panorama rasmlarni yuklang
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {panoramaScenes.map((scene, index) => (
                      <div
                        key={scene.id}
                        className="p-3 rounded-xl border"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        }}
                      >
                        <div className="flex items-start gap-3">
                          {/* Preview */}
                          <div className="flex-shrink-0">
                            {scene.preview ? (
                              <img
                                src={scene.preview}
                                alt={scene.title}
                                className="w-24 h-24 object-cover rounded-lg"
                              />
                            ) : (
                              <label
                                className="w-24 h-24 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all hover:border-opacity-100"
                                style={{
                                  borderColor: `${accentColor.color}40`,
                                  background: `${accentColor.color}10`,
                                }}
                              >
                                <Upload className="w-5 h-5 mb-1" style={{ color: accentColor.color }} />
                                <span className="text-xs" style={{ color: accentColor.color }}>
                                  360° rasm
                                </span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handlePanoramaImageSelect(index, e)}
                                  className="hidden"
                                />
                              </label>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 space-y-2">
                            <input
                              type="text"
                              value={scene.title}
                              onChange={(e) => updatePanoramaScene(index, 'title', e.target.value)}
                              placeholder="Masalan: Yashash xonasi"
                              className="w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all"
                              style={{
                                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                              }}
                            />
                            {scene.preview && (
                              <label
                                className="inline-block px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all"
                                style={{
                                  background: `${accentColor.color}20`,
                                  color: accentColor.color,
                                }}
                              >
                                <Upload className="w-3 h-3 inline mr-1" />
                                Rasmni o'zgartirish
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handlePanoramaImageSelect(index, e)}
                                  className="hidden"
                                />
                              </label>
                            )}
                          </div>

                          {/* Remove button */}
                          <button
                            type="button"
                            onClick={() => removePanoramaScene(index)}
                            className="p-2 rounded-lg transition-all hover:bg-red-500/10"
                            style={{ color: '#ef4444' }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Nomi *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Masalan: 3-xonali kvartira"
                    className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Turi *</label>
                  <select
                    value={formData.propertyType}
                    onChange={e => setFormData({ ...formData, propertyType: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <option value="apartment">Kvartira</option>
                    <option value="house">Uy</option>
                    <option value="commercial">Tijorat</option>
                    <option value="land">Yer</option>
                    <option value="cottage">Kottej</option>
                    <option value="office">Ofis</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-2">Tavsif</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Qo'shimcha ma'lumotlar..."
                  className="w-full px-4 py-3 rounded-xl border outline-none transition-all resize-none"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                />
              </div>

              {/* Price */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Narx *</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={e => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Valyuta</label>
                  <select
                    value={formData.currency}
                    onChange={e => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <option value="UZS">UZS</option>
                    <option value="USD">USD</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Narx turi</label>
                  <select
                    value={formData.priceType}
                    onChange={e => setFormData({ ...formData, priceType: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <option value="sale">Sotuv</option>
                    <option value="rent">Ijara</option>
                  </select>
                </div>
              </div>

              {/* Property Details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Xonalar *</label>
                  <input
                    type="number"
                    value={formData.rooms}
                    onChange={e => setFormData({ ...formData, rooms: e.target.value })}
                    min="1"
                    className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Hammomlar</label>
                  <input
                    type="number"
                    value={formData.bathrooms}
                    onChange={e => setFormData({ ...formData, bathrooms: e.target.value })}
                    min="1"
                    className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Maydoni (m²) *</label>
                  <input
                    type="number"
                    value={formData.area}
                    onChange={e => setFormData({ ...formData, area: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Qavat</label>
                  <input
                    type="number"
                    value={formData.floor}
                    onChange={e => setFormData({ ...formData, floor: e.target.value })}
                    min="1"
                    className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Jami qavatlar</label>
                  <input
                    type="number"
                    value={formData.totalFloors}
                    onChange={e => setFormData({ ...formData, totalFloors: e.target.value })}
                    min="1"
                    className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Qurilgan yili</label>
                  <input
                    type="number"
                    value={formData.buildYear}
                    onChange={e => setFormData({ ...formData, buildYear: e.target.value })}
                    min="1900"
                    max={new Date().getFullYear() + 5}
                    className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-2">Holati</label>
                  <select
                    value={formData.condition}
                    onChange={e => setFormData({ ...formData, condition: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <option value="new">Yangi</option>
                    <option value="normal">Oddiy</option>
                    <option value="renovation">Ta'mirlangan</option>
                  </select>
                </div>
              </div>

              {/* Features Checkboxes */}
              <div>
                <label className="block text-sm font-medium mb-3">Xususiyatlari</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.hasParking}
                      onChange={e => setFormData({ ...formData, hasParking: e.target.checked })}
                      className="w-5 h-5 rounded-lg"
                      style={{ accentColor: accentColor.color }}
                    />
                    <span className="text-sm">Parking</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.hasFurniture}
                      onChange={e => setFormData({ ...formData, hasFurniture: e.target.checked })}
                      className="w-5 h-5 rounded-lg"
                      style={{ accentColor: accentColor.color }}
                    />
                    <span className="text-sm">Mebel</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.hasElevator}
                      onChange={e => setFormData({ ...formData, hasElevator: e.target.checked })}
                      className="w-5 h-5 rounded-lg"
                      style={{ accentColor: accentColor.color }}
                    />
                    <span className="text-sm">Lift</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.hasBalcony}
                      onChange={e => setFormData({ ...formData, hasBalcony: e.target.checked })}
                      className="w-5 h-5 rounded-lg"
                      style={{ accentColor: accentColor.color }}
                    />
                    <span className="text-sm">Balkon</span>
                  </label>
                </div>
              </div>

              {/* Mortgage */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer mb-3">
                  <input
                    type="checkbox"
                    checked={formData.hasMortgage}
                    onChange={e => setFormData({ ...formData, hasMortgage: e.target.checked })}
                    className="w-5 h-5 rounded-lg"
                    style={{ accentColor: accentColor.color }}
                  />
                  <span className="text-sm font-medium">Ipoteka mavjud</span>
                </label>

                {formData.hasMortgage && (
                  <div className="space-y-4 pl-7">
                    {/* Bank Selection */}
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Bank tanlang {availableBanks.length > 0 && `(${availableBanks.length} ta mavjud)`}
                      </label>
                      {availableBanks.length === 0 ? (
                        <div
                          className="p-4 rounded-xl text-center"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                          }}
                        >
                          <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                            Hali banklar qo'shilmagan. "Bank" bo'limidan bank qo'shing.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {availableBanks.map((bank) => (
                            <button
                              key={bank.id}
                              type="button"
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  mortgageBank: bank.id,
                                  mortgagePercent: bank.mortgagePercent.toString(),
                                  mortgagePeriod: bank.maxPeriod.toString(),
                                });
                              }}
                              className="w-full p-3 rounded-xl text-left transition-all hover:scale-[1.02]"
                              style={{
                                background: formData.mortgageBank === bank.id
                                  ? `${accentColor.color}20`
                                  : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'),
                                border: formData.mortgageBank === bank.id 
                                  ? `2px solid ${accentColor.color}` 
                                  : '2px solid transparent',
                              }}
                            >
                              <div className="flex items-center gap-3">
                                {bank.logo && (
                                  <img
                                    src={bank.logo}
                                    alt={bank.name}
                                    className="w-12 h-12 object-contain rounded-lg"
                                    style={{
                                      background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                                    }}
                                  />
                                )}
                                <div className="flex-1">
                                  <p className="font-bold text-sm" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                    {bank.name}
                                  </p>
                                  <div className="flex items-center gap-3 mt-1">
                                    <span
                                      className="text-xs font-medium px-2 py-1 rounded-lg"
                                      style={{
                                        background: `${accentColor.color}20`,
                                        color: accentColor.color,
                                      }}
                                    >
                                      {bank.mortgagePercent}% foiz
                                    </span>
                                    <span className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                                      {bank.maxPeriod} yil
                                    </span>
                                    {bank.viloyat && (
                                      <span className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                                        📍 {bank.viloyat}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {formData.mortgageBank === bank.id && (
                                  <div
                                    className="size-6 rounded-full flex items-center justify-center text-white font-bold text-xs"
                                    style={{ background: accentColor.color }}
                                  >
                                    ✓
                                  </div>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Display selected bank info */}
                    {formData.mortgageBank && (() => {
                      const selectedBank = availableBanks.find(b => b.id === formData.mortgageBank);
                      return selectedBank ? (
                        <div
                          className="p-4 rounded-xl"
                          style={{
                            background: `${accentColor.color}15`,
                            borderColor: `${accentColor.color}40`,
                            border: '1px solid',
                          }}
                        >
                          <p className="text-xs font-bold mb-2" style={{ color: accentColor.color }}>
                            TANLANGAN BANK MA'LUMOTLARI:
                          </p>
                          <div className="grid grid-cols-3 gap-3 text-xs">
                            <div>
                              <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                                Bank:
                              </p>
                              <p className="font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                {selectedBank.name}
                              </p>
                            </div>
                            <div>
                              <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                                Foiz:
                              </p>
                              <p className="font-bold" style={{ color: accentColor.color }}>
                                {selectedBank.mortgagePercent}%
                              </p>
                            </div>
                            <div>
                              <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                                Muddat:
                              </p>
                              <p className="font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                {selectedBank.maxPeriod} yil
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}
              </div>

              {/* Halal Installment (Xalol Nasiya) */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer mb-3">
                  <input
                    type="checkbox"
                    checked={formData.hasHalalInstallment}
                    onChange={e => setFormData({ ...formData, hasHalalInstallment: e.target.checked })}
                    className="w-5 h-5 rounded-lg"
                    style={{ accentColor: accentColor.color }}
                  />
                  <span className="text-sm font-medium">Xalol Nasiya mavjud</span>
                  <span className="text-xs px-2 py-1 rounded-lg font-bold" style={{ 
                    background: `${accentColor.color}20`,
                    color: accentColor.color 
                  }}>
                    HALAL ✓ FOIZSIZ
                  </span>
                </label>

                {formData.hasHalalInstallment && (
                  <div className="space-y-4 pl-7">
                    <div
                      className="p-3 rounded-xl text-sm"
                      style={{
                        background: `${accentColor.color}10`,
                        borderColor: `${accentColor.color}30`,
                        border: '1px solid',
                      }}
                    >
                      💡 <strong>Xalol Nasiya:</strong> E'lon beruvchi bilan to'g'ridan-to'g'ri foizsiz kelishuv. Bank arizasi yo'q.
                    </div>

                    {/* Simplified 3 Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Boshlang'ich to'lov (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={formData.halalDownPayment}
                          onChange={e => setFormData({ ...formData, halalDownPayment: e.target.value })}
                          placeholder="0"
                          className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                          }}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Muddat (oy)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="120"
                          value={formData.halalInstallmentMonths}
                          onChange={e => setFormData({ ...formData, halalInstallmentMonths: e.target.value })}
                          placeholder="12"
                          className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                          }}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Yillik foiz (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={formData.halalInstallmentBank}
                          onChange={e => setFormData({ ...formData, halalInstallmentBank: e.target.value })}
                          placeholder="0"
                          className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                          }}
                        />
                      </div>
                    </div>

                    {/* Calculations START */}
                    {formData.halalInstallmentMonths && formData.halalDownPayment !== '' && formData.price && (() => {
                      const propertyPrice = parseFloat(formData.price) || 0;
                      const downPaymentPercent = parseFloat(formData.halalDownPayment) || 0;
                      const downPaymentAmount = propertyPrice * (downPaymentPercent / 100);
                      const financedAmount = propertyPrice - downPaymentAmount;
                      const months = parseInt(formData.halalInstallmentMonths) || 1;
                      const yearlyInterestRate = parseFloat(formData.halalInstallmentBank) || 0;
                      
                      // Calculate monthly payment with interest
                      let monthlyPayment;
                      let totalPayment;
                      
                      if (yearlyInterestRate === 0) {
                        // No interest
                        monthlyPayment = financedAmount / months;
                        totalPayment = propertyPrice;
                      } else {
                        // With interest - using compound interest formula
                        const monthlyRate = yearlyInterestRate / 100 / 12;
                        monthlyPayment = financedAmount * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
                        totalPayment = downPaymentAmount + (monthlyPayment * months);
                      }
                      
                      const years = Math.ceil(months / 12);
                      const totalInterest = totalPayment - propertyPrice;
                      
                      return propertyPrice > 0 ? (
                        <div
                          className="p-4 rounded-xl"
                          style={{
                            background: `${accentColor.color}15`,
                            borderColor: `${accentColor.color}40`,
                            border: '1px solid',
                          }}
                        >
                          <p className="text-xs font-bold mb-3 flex items-center gap-2" style={{ color: accentColor.color }}>
                            <span>XALOL NASIYA HISOB-KITOBI:</span>
                            <span className="px-2 py-1 rounded-lg bg-white/20">HALAL ✓</span>
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                            <div>
                              <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                                Boshlang'ich:
                              </p>
                              <p className="font-bold" style={{ color: accentColor.color }}>
                                {downPaymentAmount.toLocaleString()} {formData.currency}
                              </p>
                            </div>
                            <div>
                              <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                                Oylik to'lov:
                              </p>
                              <p className="font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                {monthlyPayment.toLocaleString()} {formData.currency}
                              </p>
                            </div>
                            <div>
                              <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                                Muddat:
                              </p>
                              <p className="font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                {months} oy ({years} yil)
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t" style={{ borderColor: `${accentColor.color}30` }}>
                            <div className="grid grid-cols-2 gap-3 mb-2">
                              <div>
                                <p className="text-xs mb-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                                  Jami to'lov:
                                </p>
                                <p className="text-lg font-bold" style={{ color: accentColor.color }}>
                                  {totalPayment.toLocaleString()} {formData.currency}
                                </p>
                              </div>
                              {yearlyInterestRate > 0 && (
                                <div>
                                  <p className="text-xs mb-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                                    Foiz summasi:
                                  </p>
                                  <p className="text-lg font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                    {totalInterest.toLocaleString()} {formData.currency}
                                  </p>
                                </div>
                              )}
                            </div>
                            <p className="text-xs font-medium" style={{ color: accentColor.color }}>
                              {yearlyInterestRate === 0 ? '⭐ Foizsiz, Halal!' : `📊 ${yearlyInterestRate}% yillik foiz bilan`} E'lon beruvchi bilan kelishuv. Bank arizasi yo'q!
                            </p>
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}
              </div>

              {/* Location */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Viloyat *</label>
                  <select
                    value={formData.region}
                    onChange={e => {
                      setFormData({ ...formData, region: e.target.value, district: '' });
                    }}
                    className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <option value="">Viloyatni tanlang</option>
                    {geoData.regions.map(region => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Tuman *</label>
                  <select
                    value={formData.district}
                    onChange={e => setFormData({ ...formData, district: e.target.value })}
                    disabled={!formData.region}
                    className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      opacity: !formData.region ? 0.5 : 1,
                    }}
                  >
                    <option value="">Tumanni tanlang</option>
                    {formData.region && geoData.districts[formData.region]?.map(district => (
                      <option key={district} value={district}>{district}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Qo'shimcha manzil</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Ko'cha, uy raqami"
                    className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>
              </div>

              {/* Coordinates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Kenglik (Latitude)</label>
                  <input
                    type="number"
                    value={formData.latitude}
                    onChange={e => setFormData({ ...formData, latitude: e.target.value })}
                    placeholder="41.311"
                    step="0.000001"
                    className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Uzunlik (Longitude)</label>
                  <input
                    type="number"
                    value={formData.longitude}
                    onChange={e => setFormData({ ...formData, longitude: e.target.value })}
                    placeholder="69.279"
                    step="0.000001"
                    className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>
              </div>

              {/* Contact */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Aloqa shaxsi</label>
                  <input
                    type="text"
                    value={formData.contactName}
                    onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                    placeholder="Ism familiya"
                    className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Telefon raqami</label>
                  <input
                    type="tel"
                    value={formData.contactPhone}
                    onChange={e => setFormData({ ...formData, contactPhone: e.target.value })}
                    placeholder="+998 90 123 45 67"
                    className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>
              </div>

              {/* Additional Features */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Qo'shimcha xususiyatlar (vergul bilan ajrating)
                </label>
                <input
                  type="text"
                  value={formData.features}
                  onChange={e => setFormData({ ...formData, features: e.target.value })}
                  placeholder="WiFi, Konditsioner, Oshxona jihozlari"
                  className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={closeModal}
                disabled={isSaving}
                className="flex-1 px-6 py-3 rounded-2xl font-medium transition-all"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                }}
              >
                Bekor qilish
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSaving}
                className="flex-1 px-6 py-3 rounded-2xl font-medium flex items-center justify-center gap-2 transition-all shadow-lg"
                style={{ 
                  background: accentColor.color,
                  color: '#ffffff',
                  opacity: isSaving ? 0.7 : 1
                }}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saqlanmoqda...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Saqlash
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Secret Code Modal */}
      {isSecretCodeModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
          }}
          onClick={() => {
            setIsSecretCodeModalOpen(false);
            setSecretCode('');
            setSecretCodeAction(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-3xl p-8 shadow-2xl"
            style={{
              background: isDark ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl"
                style={{
                  background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
                }}
              >
                🔐
              </div>
              <h3 className="text-2xl font-bold mb-2">Maxsus Kod</h3>
              <p className="opacity-70">
                {secretCodeAction?.type === 'edit' 
                  ? 'Foydalanuvchi e\'lonini tahrirlash uchun maxsus kodni kiriting'
                  : 'Foydalanuvchi e\'lonini o\'chirish uchun maxsus kodni kiriting'
                }
              </p>
            </div>

            <div className="space-y-4">
              <input
                type="password"
                value={secretCode}
                onChange={e => setSecretCode(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleSecretCodeSubmit();
                  }
                }}
                placeholder="Maxsus kodni kiriting"
                autoFocus
                className="w-full px-6 py-4 rounded-2xl border-2 outline-none text-center text-2xl font-mono tracking-widest transition-all"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                  borderColor: secretCode ? accentColor : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
                }}
                maxLength={10}
              />

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsSecretCodeModalOpen(false);
                    setSecretCode('');
                    setSecretCodeAction(null);
                  }}
                  className="flex-1 px-6 py-4 rounded-2xl font-semibold transition-all"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    color: isDark ? '#fff' : '#000',
                  }}
                >
                  Bekor qilish
                </button>
                <button
                  onClick={handleSecretCodeSubmit}
                  disabled={!secretCode}
                  className="flex-1 px-6 py-4 rounded-2xl font-semibold transition-all disabled:opacity-50"
                  style={{
                    background: secretCode ? `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)` : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
                    color: '#fff',
                  }}
                >
                  Tasdiqlash
                </button>
              </div>

              <p className="text-xs text-center opacity-50 mt-4">
                💡 Maxsus kodingizni esdan chiqarmang
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}