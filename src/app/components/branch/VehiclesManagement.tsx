import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Phone, 
  Image as ImageIcon,
  Loader2,
  Save,
  X,
  Upload,
  DollarSign,
  Calendar,
  Car
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { toast } from 'sonner';
import { useVisibilityTick } from '../../utils/visibilityRefetch';

// Dynamic vehicle data state
interface VehicleData {
  brands: string[];
  fuelTypes: { value: string; label: string }[];
  transmissionTypes: { value: string; label: string }[];
}

interface Vehicle {
  id: string;
  branchId: string;
  userId?: string;
  name: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  currency: string;
  mileage: number;
  color: string;
  fuelType: string;
  transmission: string;
  condition: string;
  description: string;
  images: string[];
  region?: string;
  district?: string;
  panoramaScenes?: {
    id: string;
    title: string;
    url: string;
    hotspots?: any[];
  }[];
  hasAutoCredit: boolean;
  autoCreditBank?: string;
  autoCreditPercent?: number;
  autoCreditPeriod?: number;
  autoCreditDownPayment?: number;
  hasHalalInstallment: boolean;
  halalInstallmentPercent?: number;
  halalInstallmentMonths?: number;
  halalDownPayment?: number;
  contactName: string;
  contactPhone: string;
  createdAt: string;
  updatedAt: string;
}

interface VehiclesManagementProps {
  branchId: string;
  userId?: string;
  branchInfo?: {
    phone?: string;
  };
}

export default function VehiclesManagement({ branchId, userId, branchInfo }: VehiclesManagementProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [availableBanks, setAvailableBanks] = useState<any[]>([]);
  
  // Location state
  const [regions, setRegions] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [filteredDistricts, setFilteredDistricts] = useState<any[]>([]);
  
  // Secret code modal state
  const [isSecretCodeModalOpen, setIsSecretCodeModalOpen] = useState(false);
  const [secretCode, setSecretCode] = useState('');
  const [secretCodeAction, setSecretCodeAction] = useState<{
    type: 'edit' | 'delete';
    vehicle: Vehicle;
  } | null>(null);

  // Vehicle data state
  const [vehicleData, setVehicleData] = useState<VehicleData>({
    brands: [],
    fuelTypes: [],
    transmissionTypes: []
  });
  const [isLoadingVehicleData, setIsLoadingVehicleData] = useState(true);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    model: '',
    year: new Date().getFullYear().toString(),
    price: '',
    currency: 'UZS',
    mileage: '',
    color: '',
    fuelType: 'petrol',
    transmission: 'manual',
    condition: 'normal',
    description: '',
    region: '',
    district: '',
    hasAutoCredit: false,
    autoCreditBank: '',
    autoCreditPercent: '',
    autoCreditPeriod: '',
    autoCreditDownPayment: '',
    hasHalalInstallment: false,
    halalInstallmentPercent: '',
    halalInstallmentMonths: '',
    halalDownPayment: '',
    contactName: '',
    contactPhone: branchInfo?.phone || '',
  });

  // Images state
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);

  // Panorama state
  const [panoramaScenes, setPanoramaScenes] = useState<{
    id: string;
    title: string;
    file: File | null;
    preview: string;
    hotspots: any[];
  }[]>([]);
  const visibilityRefetchTick = useVisibilityTick();

  // Load available banks, regions, and districts
  useEffect(() => {
    loadBanks();
    loadLocations();
    loadVehicleData();
  }, [visibilityRefetchTick]);

  const loadBanks = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/banks`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAvailableBanks(data.banks || []);
      }
    } catch (error) {
      console.error('❌ Failed to load banks:', error);
    }
  };

  const loadVehicleData = async () => {
    try {
      setIsLoadingVehicleData(true);
      console.log('🚗 Loading vehicle data...');

      // Load brands
      const brandsResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/vehicle-brands`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Load fuel types
      const fuelTypesResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/fuel-types`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Load transmission types
      const transmissionTypesResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/transmission-types`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!brandsResponse.ok || !fuelTypesResponse.ok || !transmissionTypesResponse.ok) {
        console.error('❌ Vehicle data API response not ok:', {
          brands: { status: brandsResponse.status, ok: brandsResponse.ok },
          fuelTypes: { status: fuelTypesResponse.status, ok: fuelTypesResponse.ok },
          transmissionTypes: { status: transmissionTypesResponse.status, ok: transmissionTypesResponse.ok },
        });
        toast.error('Mashina ma’lumotlarini yuklashda xatolik');
        setVehicleData({ brands: [], fuelTypes: [], transmissionTypes: [] });
        return;
      }

      const [brandsData, fuelTypesData, transmissionTypesData] = await Promise.all([
        brandsResponse.json(),
        fuelTypesResponse.json(),
        transmissionTypesResponse.json(),
      ]);

      setVehicleData({
        brands: brandsData.success ? brandsData.data : [],
        fuelTypes: fuelTypesData.success ? fuelTypesData.data : [],
        transmissionTypes: transmissionTypesData.success ? transmissionTypesData.data : []
      });

      console.log('✅ Vehicle data loaded');
    } catch (error) {
      console.error('❌ Error loading vehicle data:', error);
      toast.error('Mashina ma’lumotlarini yuklashda xatolik');
      setVehicleData({ brands: [], fuelTypes: [], transmissionTypes: [] });
    } finally {
      setIsLoadingVehicleData(false);
    }
  };

  const loadLocations = async () => {
    try {
      // Load regions
      const regionsResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/regions`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (regionsResponse.ok) {
        const regionsData = await regionsResponse.json();
        setRegions(regionsData.regions || []);
      }

      // Load districts
      const districtsResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/districts`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (districtsResponse.ok) {
        const districtsData = await districtsResponse.json();
        setDistricts(districtsData.districts || []);
      }
    } catch (error) {
      console.error('❌ Failed to load locations:', error);
    }
  };

  // Update filtered districts when region changes
  useEffect(() => {
    if (formData.region) {
      const filtered = districts.filter(d => d.regionId === formData.region);
      setFilteredDistricts(filtered);
    } else {
      setFilteredDistricts([]);
    }
  }, [formData.region, districts]);

  // Load vehicles
  useEffect(() => {
    loadVehicles();
  }, [branchId, visibilityRefetchTick]);

  const loadVehicles = async () => {
    try {
      setIsLoading(true);
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branch-vehicles?branchId=${branchId}`;
      
      console.log('🚗 Loading vehicles for branch:', branchId);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Vehicles loaded:', data.vehicles?.length || 0);
      
      setVehicles(data.vehicles || []);
    } catch (error: any) {
      console.error('❌ Load vehicles error:', error);
      toast.error('Mashinalarni yuklashda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
      setImageFiles(prev => [...prev, file]);
    });
  };

  const removeImage = (index: number) => {
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Panorama functions
  const addPanoramaScene = () => {
    setPanoramaScenes(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        title: '',
        file: null,
        preview: '',
        hotspots: [],
      }
    ]);
  };

  const removePanoramaScene = (id: string) => {
    setPanoramaScenes(prev => prev.filter(scene => scene.id !== id));
  };

  const updatePanoramaScene = (id: string, field: string, value: any) => {
    setPanoramaScenes(prev =>
      prev.map(scene =>
        scene.id === id ? { ...scene, [field]: value } : scene
      )
    );
  };

  const handlePanoramaFileChange = (index: number, file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      updatePanoramaScene(index, 'file', file);
      updatePanoramaScene(index, 'preview', reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const openModal = (vehicle?: Vehicle) => {
    if (vehicle) {
      // Check if this is a user-created vehicle (not from this branch)
      const isUserVehicle = vehicle.id?.startsWith('car:') || 
        (vehicle.userId && vehicle.userId !== userId);
      
      if (isUserVehicle) {
        // Show secret code modal for user vehicles
        setSecretCodeAction({ type: 'edit', vehicle });
        setIsSecretCodeModalOpen(true);
        return;
      }
      
      // Regular vehicle - open edit modal directly
      setEditingId(vehicle.id);
      setFormData({
        name: vehicle.name,
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year.toString(),
        price: vehicle.price.toString(),
        currency: vehicle.currency,
        mileage: vehicle.mileage.toString(),
        color: vehicle.color,
        fuelType: vehicle.fuelType,
        transmission: vehicle.transmission,
        condition: vehicle.condition,
        description: vehicle.description,
        region: vehicle.region || '',
        district: vehicle.district || '',
        hasAutoCredit: vehicle.hasAutoCredit,
        autoCreditBank: vehicle.autoCreditBank || '',
        autoCreditPercent: vehicle.autoCreditPercent?.toString() || '',
        autoCreditPeriod: vehicle.autoCreditPeriod?.toString() || '',
        autoCreditDownPayment: vehicle.autoCreditDownPayment?.toString() || '',
        hasHalalInstallment: vehicle.hasHalalInstallment || false,
        halalInstallmentPercent: vehicle.halalInstallmentPercent?.toString() || '',
        halalInstallmentMonths: vehicle.halalInstallmentMonths?.toString() || '',
        halalDownPayment: vehicle.halalDownPayment?.toString() || '',
        contactName: vehicle.contactName || '',
        contactPhone: vehicle.contactPhone || branchInfo?.phone || '',
      });
      
      // Set existing images
      if (vehicle.images && vehicle.images.length > 0) {
        setImagePreviews(vehicle.images);
      }
      
      // Set panorama scenes if exist
      if (vehicle.panoramaScenes && vehicle.panoramaScenes.length > 0) {
        setPanoramaScenes(vehicle.panoramaScenes.map((scene: any) => ({
          id: scene.id || Math.random().toString(36).substr(2, 9),
          title: scene.title || '',
          file: null,
          preview: scene.url || '',
          hotspots: scene.hotspots || [],
        })));
      }
    } else {
      // Reset form for new vehicle
      setEditingId(null);
      setFormData({
        name: '',
        brand: '',
        model: '',
        year: new Date().getFullYear().toString(),
        price: '',
        currency: 'UZS',
        mileage: '',
        color: '',
        fuelType: 'petrol',
        transmission: 'manual',
        condition: 'normal',
        description: '',
        region: '',
        district: '',
        hasAutoCredit: false,
        autoCreditBank: '',
        autoCreditPercent: '',
        autoCreditPeriod: '',
        autoCreditDownPayment: '',
        hasHalalInstallment: false,
        halalInstallmentPercent: '',
        halalInstallmentMonths: '',
        halalDownPayment: '',
        contactName: '',
        contactPhone: branchInfo?.phone || '',
      });
      setImagePreviews([]);
      setImageFiles([]);
      setPanoramaScenes([]);
    }
    
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setError('');
    setFormData({
      name: '',
      brand: '',
      model: '',
      year: new Date().getFullYear().toString(),
      price: '',
      currency: 'UZS',
      mileage: '',
      color: '',
      fuelType: 'petrol',
      transmission: 'manual',
      condition: 'normal',
      description: '',
      region: '',
      district: '',
      hasAutoCredit: false,
      autoCreditBank: '',
      autoCreditPercent: '',
      autoCreditPeriod: '',
      autoCreditDownPayment: '',
      hasHalalInstallment: false,
      halalInstallmentPercent: '',
      halalInstallmentMonths: '',
      halalDownPayment: '',
      contactName: '',
      contactPhone: branchInfo?.phone || '',
    });
    setImagePreviews([]);
    setImageFiles([]);
    setPanoramaScenes([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.brand || !formData.price) {
      setError('Majburiy maydonlarni to\'ldiring');
      toast.error('Majburiy maydonlarni to\'ldiring');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const vehicleData = {
        branchId,
        userId,
        name: formData.name,
        brand: formData.brand,
        model: formData.model,
        year: parseInt(formData.year),
        price: parseFloat(formData.price),
        currency: formData.currency,
        mileage: parseInt(formData.mileage) || 0,
        color: formData.color,
        fuelType: formData.fuelType,
        transmission: formData.transmission,
        condition: formData.condition,
        description: formData.description,
        region: formData.region,
        district: formData.district,
        images: imagePreviews,
        panoramaScenes: panoramaScenes.length > 0 ? panoramaScenes.map(scene => ({
          id: scene.id,
          title: scene.title,
          preview: scene.preview,
          hotspots: scene.hotspots,
        })) : undefined,
        hasAutoCredit: formData.hasAutoCredit,
        autoCreditBank: formData.hasAutoCredit ? formData.autoCreditBank : undefined,
        autoCreditPercent: formData.hasAutoCredit && formData.autoCreditPercent ? parseFloat(formData.autoCreditPercent) : undefined,
        autoCreditPeriod: formData.hasAutoCredit && formData.autoCreditPeriod ? parseInt(formData.autoCreditPeriod) : undefined,
        autoCreditDownPayment: formData.hasAutoCredit && formData.autoCreditDownPayment ? parseFloat(formData.autoCreditDownPayment) : undefined,
        hasHalalInstallment: formData.hasHalalInstallment,
        halalInstallmentPercent: formData.hasHalalInstallment && formData.halalInstallmentPercent ? parseFloat(formData.halalInstallmentPercent) : undefined,
        halalInstallmentMonths: formData.hasHalalInstallment && formData.halalInstallmentMonths ? parseInt(formData.halalInstallmentMonths) : undefined,
        halalDownPayment: formData.hasHalalInstallment && formData.halalDownPayment ? parseFloat(formData.halalDownPayment) : undefined,
        contactName: formData.contactName,
        contactPhone: formData.contactPhone,
      };

      const url = editingId
        ? `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branch-vehicles/${editingId}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branch-vehicles`;

      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify(vehicleData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Xatolik yuz berdi');
      }

      const data = await response.json();
      toast.success(data.message || (editingId ? 'Mashina yangilandi' : 'Mashina qo\'shildi'));
      
      closeModal();
      loadVehicles();
    } catch (error: any) {
      console.error('❌ Submit error:', error);
      setError(error.message || 'Xatolik yuz berdi');
      toast.error(error.message || 'Xatolik yuz berdi');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, vehicle?: any) => {
    // Check if this is a user-created vehicle (not from this branch)
    const isUserVehicle = vehicle && (
      vehicle.id?.startsWith('car:') || 
      (vehicle.userId && vehicle.userId !== userId)
    );
    
    if (isUserVehicle) {
      // Show secret code modal for user vehicles
      setSecretCodeAction({ type: 'delete', vehicle });
      setIsSecretCodeModalOpen(true);
      return;
    }
    
    // Regular vehicle - delete directly with confirmation
    if (!confirm('Rostdan ham o\'chirmoqchimisiz?')) return;

    const prevVehicles = vehicles;
    setVehicles((prev) => prev.filter((v) => v.id !== id));

    try {
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branch-vehicles/${id}?branchId=${branchId}${userId ? `&userId=${userId}` : ''}`;
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

      toast.success('Mashina o\'chirildi');
    } catch (error: any) {
      console.error('❌ Delete error:', error);
      setVehicles(prevVehicles);
      toast.error(error.message || 'O\'chirishda xatolik');
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
      // Open edit modal with vehicle data
      const vehicle = secretCodeAction.vehicle;
      setEditingId(vehicle.id);
      setFormData({
        name: vehicle.name,
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year.toString(),
        price: vehicle.price.toString(),
        currency: vehicle.currency,
        mileage: vehicle.mileage.toString(),
        color: vehicle.color,
        fuelType: vehicle.fuelType,
        transmission: vehicle.transmission,
        condition: vehicle.condition,
        description: vehicle.description,
        region: vehicle.region || '',
        district: vehicle.district || '',
        hasAutoCredit: vehicle.hasAutoCredit,
        autoCreditBank: vehicle.autoCreditBank || '',
        autoCreditPercent: vehicle.autoCreditPercent?.toString() || '',
        autoCreditPeriod: vehicle.autoCreditPeriod?.toString() || '',
        autoCreditDownPayment: vehicle.autoCreditDownPayment?.toString() || '',
        hasHalalInstallment: vehicle.hasHalalInstallment || false,
        halalInstallmentPercent: vehicle.halalInstallmentPercent?.toString() || '',
        halalInstallmentMonths: vehicle.halalInstallmentMonths?.toString() || '',
        halalDownPayment: vehicle.halalDownPayment?.toString() || '',
        contactName: vehicle.contactName || '',
        contactPhone: vehicle.contactPhone || branchInfo?.phone || '',
      });
      
      if (vehicle.images && vehicle.images.length > 0) {
        setImagePreviews(vehicle.images);
      }
      
      if (vehicle.panoramaScenes && vehicle.panoramaScenes.length > 0) {
        setPanoramaScenes(vehicle.panoramaScenes.map((scene: any) => ({
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
      
      const id = secretCodeAction.vehicle.id;
      const prevVehicles = vehicles;
      setVehicles((prev) => prev.filter((v) => v.id !== id));
      try {
        const url = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branch-vehicles/${id}?branchId=${branchId}${userId ? `&userId=${userId}` : ''}`;
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

        toast.success('Mashina o\'chirildi');
      } catch (error: any) {
        console.error('❌ Delete error:', error);
        setVehicles(prevVehicles);
        toast.error(error.message || 'O\'chirishda xatolik');
      }
    }
    
    setSecretCodeAction(null);
  };

  const handleClearVehicles = async () => {
    if (!confirm('Barcha mashinalarni o\'chirmoqchimisiz? Bu amalni bekor qilib bo\'lmaydi!')) return;

    try {
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branch-vehicles?branchId=${branchId}`;
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

      toast.success('Barcha mashinalar o\'chirildi');
      loadVehicles();
    } catch (error: any) {
      console.error('❌ Clear error:', error);
      toast.error(error.message || 'O\'chirishda xatolik');
    }
  };

  // Check if vehicle can be edited
  const canEdit = (vehicle: Vehicle) => {
    // Admin can edit ALL vehicles (will be asked for secret code for user vehicles)
    return true;
  };

  const getConditionLabel = (condition: string) => {
    const conditions: Record<string, string> = {
      'new': 'Yangi',
      'normal': 'Oddiy',
      'good': 'Yaxshi',
    };
    return conditions[condition] || condition;
  };

  const getFuelTypeLabel = (fuelType: string) => {
    const fuel = vehicleData.fuelTypes.find(f => f.value === fuelType);
    return fuel ? fuel.label : fuelType;
  };

  const getTransmissionLabel = (transmission: string) => {
    const trans = vehicleData.transmissionTypes.find(t => t.value === transmission);
    return trans ? trans.label : transmission;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Mashinalar</h2>
          <p className="opacity-70 text-sm mt-1">
            Mashinalarni boshqarish va qo'shish
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => openModal()}
            className="px-6 py-3 rounded-2xl font-semibold transition-all flex items-center gap-2"
            style={{
              background: `linear-gradient(135deg, ${accentColor.color}, ${accentColor.color}dd)`,
              color: '#fff',
            }}
          >
            <Plus className="w-5 h-5" />
            Mashina qo'shish
          </button>
          {vehicles.length > 0 && (
            <button
              onClick={handleClearVehicles}
              className="px-4 py-3 rounded-2xl font-semibold transition-all"
              style={{
                background: isDark ? 'rgba(255, 59, 48, 0.1)' : 'rgba(255, 59, 48, 0.1)',
                color: '#ff3b30',
              }}
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor.color }} />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && vehicles.length === 0 && (
        <div 
          className="text-center py-12 rounded-3xl border"
          style={{
            background: isDark 
              ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
              : 'linear-gradient(145deg, #ffffff, #f9fafb)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <div 
            className="inline-flex p-6 rounded-3xl mb-4"
            style={{ background: `${accentColor.color}20` }}
          >
            <Car className="w-12 h-12" style={{ color: accentColor.color }} />
          </div>
          <h3 className="text-xl font-bold mb-2">Hali mashinalar yo'q</h3>
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            "Mashina qo'shish" tugmasini bosing
          </p>
        </div>
      )}

      {/* Vehicles grid */}
      {!isLoading && vehicles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vehicles.map((vehicle) => {
            const isUserVehicle = vehicle.id?.startsWith('car:') || 
              (vehicle.userId && vehicle.userId !== userId);
            
            return (
              <div
                key={vehicle.id}
                className="rounded-3xl overflow-hidden border transition-all"
                style={{
                  background: isDark 
                    ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                    : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                {/* Image */}
                {vehicle.images && vehicle.images.length > 0 ? (
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={vehicle.images[0]}
                      alt={vehicle.name}
                      className="w-full h-full object-cover"
                    />
                    {vehicle.images.length > 1 && (
                      <div
                        className="absolute top-3 right-3 px-3 py-1 rounded-xl text-sm font-semibold"
                        style={{
                          background: 'rgba(0, 0, 0, 0.6)',
                          backdropFilter: 'blur(8px)',
                          color: '#fff',
                        }}
                      >
                        +{vehicle.images.length - 1}
                      </div>
                    )}
                    {isUserVehicle && (
                      <div
                        className="absolute top-3 left-3 px-3 py-1 rounded-xl text-xs font-semibold"
                        style={{
                          background: 'rgba(255, 149, 0, 0.9)',
                          backdropFilter: 'blur(8px)',
                          color: '#fff',
                        }}
                      >
                        👤 FOYDALANUVCHI
                      </div>
                    )}
                    {!isUserVehicle && (
                      <div
                        className="absolute top-3 left-3 px-3 py-1 rounded-xl text-xs font-semibold"
                        style={{
                          background: `${accentColor.color}dd`,
                          backdropFilter: 'blur(8px)',
                          color: '#fff',
                        }}
                      >
                        🏢 FILIAL
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className="h-48 flex items-center justify-center"
                    style={{
                      background: isDark
                        ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01))'
                        : 'linear-gradient(145deg, #f5f5f5, #e8e8e8)',
                    }}
                  >
                    <Car className="w-16 h-16 opacity-30" />
                  </div>
                )}

                {/* Content */}
                <div className="p-6 space-y-4">
                  <div>
                    <h3 className="text-xl font-bold mb-1">{vehicle.name}</h3>
                    <p className="text-sm opacity-70">
                      {vehicle.brand} {vehicle.model} • {vehicle.year}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-2xl font-bold">
                    <DollarSign className="w-6 h-6" style={{ color: accentColor.color }} />
                    {vehicle.price.toLocaleString()} {vehicle.currency}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2 opacity-70">
                      <Calendar className="w-4 h-4" />
                      {vehicle.mileage.toLocaleString()} km
                    </div>
                    <div className="flex items-center gap-2 opacity-70">
                      ⛽ {getFuelTypeLabel(vehicle.fuelType)}
                    </div>
                    <div className="flex items-center gap-2 opacity-70">
                      ⚙️ {getTransmissionLabel(vehicle.transmission)}
                    </div>
                    <div className="flex items-center gap-2 opacity-70">
                      🎨 {vehicle.color}
                    </div>
                  </div>

                  {(vehicle.hasAutoCredit || vehicle.hasHalalInstallment) && (
                    <div className="flex flex-wrap gap-2">
                      {vehicle.hasAutoCredit && (
                        <div
                          className="px-3 py-1 rounded-xl text-xs font-semibold"
                          style={{
                            background: `${accentColor.color}20`,
                            color: accentColor.color,
                          }}
                        >
                          🏦 Avto kredit
                        </div>
                      )}
                      {vehicle.hasHalalInstallment && (
                        <div
                          className="px-3 py-1 rounded-xl text-xs font-semibold"
                          style={{
                            background: 'rgba(52, 199, 89, 0.2)',
                            color: '#34c759',
                          }}
                        >
                          ✅ Halol nasiya
                        </div>
                      )}
                    </div>
                  )}

                  {vehicle.contactPhone && (
                    <div className="flex items-center gap-2 text-sm opacity-70">
                      <Phone className="w-4 h-4" />
                      {vehicle.contactPhone}
                    </div>
                  )}

                  {/* Actions */}
                  {canEdit(vehicle) && (
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => openModal(vehicle)}
                        className="flex-1 px-4 py-2 rounded-xl font-semibold transition-all"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                        }}
                      >
                        <Pencil className="w-4 h-4 mx-auto" />
                      </button>
                      <button
                        onClick={() => handleDelete(vehicle.id, vehicle)}
                        className="flex-1 px-4 py-2 rounded-xl font-semibold transition-all"
                        style={{
                          background: 'rgba(255, 59, 48, 0.1)',
                          color: '#ff3b30',
                        }}
                      >
                        <Trash2 className="w-4 h-4 mx-auto" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 app-safe-pad z-50 overflow-y-auto"
          style={{
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
          }}
          onClick={closeModal}
        >
          <div className="min-h-screen px-4 flex items-center justify-center py-8">
            <div
              className="w-full max-w-4xl rounded-3xl p-8 max-h-[90vh] overflow-y-auto"
              style={{
                background: isDark ? 'rgba(30, 30, 30, 0.98)' : 'rgba(255, 255, 255, 0.98)',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold">
                  {editingId ? 'Mashinani tahrirlash' : 'Mashina qo\'shish'}
                </h3>
                <button
                  onClick={closeModal}
                  className="p-2 rounded-xl transition-all"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div
                  className="mb-6 p-4 rounded-2xl"
                  style={{
                    background: 'rgba(255, 59, 48, 0.1)',
                    color: '#ff3b30',
                  }}
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <h4 className="font-semibold">Asosiy ma'lumot</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Nomi *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border outline-none"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        }}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Brend *</label>
                      <select
                        value={formData.brand}
                        onChange={e => setFormData({ ...formData, brand: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border outline-none"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        }}
                        required
                      >
                        <option value="">Brendni tanlang</option>
                        {vehicleData.brands.map(brand => (
                          <option key={brand} value={brand}>{brand}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Model</label>
                      <input
                        type="text"
                        value={formData.model}
                        onChange={e => setFormData({ ...formData, model: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border outline-none"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Yili</label>
                      <input
                        type="number"
                        value={formData.year}
                        onChange={e => setFormData({ ...formData, year: e.target.value })}
                        min="1950"
                        max={new Date().getFullYear() + 1}
                        className="w-full px-4 py-3 rounded-xl border outline-none"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Narxi *</label>
                      <input
                        type="number"
                        value={formData.price}
                        onChange={e => setFormData({ ...formData, price: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border outline-none"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        }}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Valyuta</label>
                      <select
                        value={formData.currency}
                        onChange={e => setFormData({ ...formData, currency: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border outline-none"
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
                      <label className="block text-sm font-medium mb-2">Kilometraj</label>
                      <input
                        type="number"
                        value={formData.mileage}
                        onChange={e => setFormData({ ...formData, mileage: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border outline-none"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Rangi</label>
                      <input
                        type="text"
                        value={formData.color}
                        onChange={e => setFormData({ ...formData, color: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border outline-none"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Yoqilg'i turi</label>
                      <select
                        value={formData.fuelType}
                        onChange={e => setFormData({ ...formData, fuelType: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border outline-none"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        }}
                      >
                        {vehicleData.fuelTypes.map(fuel => (
                          <option key={fuel.value} value={fuel.value}>{fuel.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Uzatmalar qutisi</label>
                      <select
                        value={formData.transmission}
                        onChange={e => setFormData({ ...formData, transmission: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border outline-none"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        }}
                      >
                        {vehicleData.transmissionTypes.map(trans => (
                          <option key={trans.value} value={trans.value}>{trans.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Holati</label>
                      <select
                        value={formData.condition}
                        onChange={e => setFormData({ ...formData, condition: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border outline-none"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        }}
                      >
                        <option value="new">Yangi</option>
                        <option value="good">Yaxshi</option>
                        <option value="normal">Oddiy</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Aloqa telefoni</label>
                      <input
                        type="tel"
                        value={formData.contactPhone}
                        onChange={e => setFormData({ ...formData, contactPhone: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border outline-none"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Viloyat</label>
                      <select
                        value={formData.region}
                        onChange={e => {
                          setFormData({ ...formData, region: e.target.value, district: '' });
                        }}
                        className="w-full px-4 py-3 rounded-xl border outline-none"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        }}
                      >
                        <option value="">Viloyatni tanlang</option>
                        {regions.map(region => (
                          <option key={region.id} value={region.id}>{region.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Tuman</label>
                      <select
                        value={formData.district}
                        onChange={e => setFormData({ ...formData, district: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border outline-none"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        }}
                        disabled={!formData.region}
                      >
                        <option value="">Tumanni tanlang</option>
                        {filteredDistricts.map(district => (
                          <option key={district.id} value={district.id}>{district.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Tavsif</label>
                    <textarea
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border outline-none"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      }}
                    />
                  </div>
                </div>

                {/* Images */}
                <div className="space-y-4">
                  <h4 className="font-semibold">Rasmlar</h4>
                  
                  <div>
                    <label className="cursor-pointer block">
                      <div
                        className="border-2 border-dashed rounded-2xl p-8 text-center transition-all"
                        style={{
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                        }}
                      >
                        <Upload className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="font-semibold mb-1">Rasmlarni yuklang</p>
                        <p className="text-sm opacity-70">Bir necha rasm tanlash mumkin</p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {imagePreviews.length > 0 && (
                    <div className="grid grid-cols-4 gap-4">
                      {imagePreviews.map((preview, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={preview}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-24 object-cover rounded-xl"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute top-2 right-2 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                            style={{
                              background: 'rgba(255, 59, 48, 0.9)',
                              color: '#fff',
                            }}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Auto Credit */}
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.hasAutoCredit}
                      onChange={e => setFormData({ ...formData, hasAutoCredit: e.target.checked })}
                      className="w-5 h-5"
                    />
                    <span className="font-semibold">🏦 Avto kredit</span>
                  </label>

                  {formData.hasAutoCredit && (
                    <div className="grid grid-cols-2 gap-4 pl-8">
                      <div>
                        <label className="block text-sm font-medium mb-2">Bank</label>
                        <select
                          value={formData.autoCreditBank}
                          onChange={e => setFormData({ ...formData, autoCreditBank: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border outline-none"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                          }}
                        >
                          <option value="">Bankni tanlang</option>
                          {availableBanks.map((bank: any) => (
                            <option key={bank.id} value={bank.name}>{bank.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Boshlang'ich to'lov</label>
                        <input
                          type="number"
                          value={formData.autoCreditDownPayment}
                          onChange={e => setFormData({ ...formData, autoCreditDownPayment: e.target.value })}
                          placeholder="Masalan: 10000000"
                          className="w-full px-4 py-3 rounded-xl border outline-none"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Foiz (%)</label>
                        <input
                          type="number"
                          value={formData.autoCreditPercent}
                          onChange={e => setFormData({ ...formData, autoCreditPercent: e.target.value })}
                          placeholder="Masalan: 20"
                          className="w-full px-4 py-3 rounded-xl border outline-none"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Muddat (oy)</label>
                        <input
                          type="number"
                          value={formData.autoCreditPeriod}
                          onChange={e => setFormData({ ...formData, autoCreditPeriod: e.target.value })}
                          placeholder="Masalan: 12"
                          className="w-full px-4 py-3 rounded-xl border outline-none"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Halol Installment */}
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.hasHalalInstallment}
                      onChange={e => setFormData({ ...formData, hasHalalInstallment: e.target.checked })}
                      className="w-5 h-5"
                    />
                    <span className="font-semibold">✅ Halol nasiya</span>
                  </label>

                  {formData.hasHalalInstallment && (
                    <div className="grid grid-cols-3 gap-4 pl-8">
                      <div>
                        <label className="block text-sm font-medium mb-2">Boshlang'ich to'lov</label>
                        <input
                          type="number"
                          value={formData.halalDownPayment}
                          onChange={e => setFormData({ ...formData, halalDownPayment: e.target.value })}
                          placeholder="Masalan: 5000000"
                          className="w-full px-4 py-3 rounded-xl border outline-none"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Foiz (%)</label>
                        <input
                          type="number"
                          value={formData.halalInstallmentPercent}
                          onChange={e => setFormData({ ...formData, halalInstallmentPercent: e.target.value })}
                          placeholder="Masalan: 0"
                          className="w-full px-4 py-3 rounded-xl border outline-none"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Muddat (oy)</label>
                        <input
                          type="number"
                          value={formData.halalInstallmentMonths}
                          onChange={e => setFormData({ ...formData, halalInstallmentMonths: e.target.value })}
                          placeholder="Masalan: 12"
                          className="w-full px-4 py-3 rounded-xl border outline-none"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-6 py-3 rounded-2xl font-semibold transition-all"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    }}
                  >
                    Bekor qilish
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 px-6 py-3 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2"
                    style={{
                      background: isSaving 
                        ? (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)')
                        : `linear-gradient(135deg, ${accentColor.color}, ${accentColor.color}dd)`,
                      color: '#fff',
                    }}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        Saqlash
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Secret Code Modal */}
      {isSecretCodeModalOpen && (
        <div 
          className="fixed inset-0 app-safe-pad z-50 flex items-center justify-center p-4"
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
                  background: `linear-gradient(135deg, ${accentColor.color}, ${accentColor.color}dd)`,
                }}
              >
                🔐
              </div>
              <h3 className="text-2xl font-bold mb-2">Maxsus Kod</h3>
              <p className="opacity-70">
                {secretCodeAction?.type === 'edit' 
                  ? 'Foydalanuvchi mashinasini tahrirlash uchun maxsus kodni kiriting'
                  : 'Foydalanuvchi mashinasini o\'chirish uchun maxsus kodni kiriting'
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
                  borderColor: secretCode ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
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
                    background: secretCode ? `linear-gradient(135deg, ${accentColor.color}, ${accentColor.color}dd)` : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
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
