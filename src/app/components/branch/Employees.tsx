import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { 
  Users, 
  Plus, 
  Edit2, 
  Trash2, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Award, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Star,
  TrendingUp,
  Activity,
  Target,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Save,
  X,
  User,
  Briefcase,
  DollarSign,
  BarChart3,
  Shield,
  Key,
  Smartphone,
  Camera,
  FileText,
  Settings,
  LogOut,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { useVisibilityTick } from '../../utils/visibilityRefetch';

interface Employee {
  id: string;
  branchId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  role: 'admin' | 'manager' | 'seller' | 'courier' | 'staff';
  status: 'active' | 'inactive' | 'on_leave';
  avatar?: string;
  hireDate: string;
  salary: number;
  workSchedule: {
    start: string;
    end: string;
    days: string[];
  };
  permissions: string[];
  performance: {
    rating: number;
    totalSales: number;
    totalOrders: number;
    customerSatisfaction: number;
    attendance: number;
  };
  documents: {
    contract: string;
    passport: string;
    medicalCertificate: string;
    workBook: string;
  };
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

interface EmployeesProps {
  branchId: string;
  branchInfo?: {
    region?: string;
    district?: string;
    phone?: string;
  };
}

export function Employees({ branchId, branchInfo }: EmployeesProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showDetails, setShowDetails] = useState<Employee | null>(null);
  const [employeeMutationBusy, setEmployeeMutationBusy] = useState(false);
  const [employeeDeleteBusyId, setEmployeeDeleteBusyId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    position: '',
    department: '',
    role: 'staff' as 'admin' | 'manager' | 'seller' | 'courier' | 'staff',
    salary: 0,
    workSchedule: {
      start: '09:00',
      end: '18:00',
      days: ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma']
    },
    emergencyContact: {
      name: '',
      phone: '',
      relationship: ''
    }
  });
  const visibilityRefetchTick = useVisibilityTick();

  const loadEmployees = async () => {
    try {
      setIsLoading(true);
      console.log('👥 Loading employees for branch:', branchId);

      const params = new URLSearchParams({
        branchId,
        search: searchTerm,
        status: statusFilter !== 'all' ? statusFilter : '',
        role: roleFilter !== 'all' ? roleFilter : ''
      });

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/employees?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        // Mock data for now
        setEmployees([]);
        console.error('❌ Employees API response not ok:', response.status, response.statusText);
        toast.error('Ishchilarni yuklashda xatolik');
        return;
      }

      const data = await response.json();
      if (data.success) {
        setEmployees(data.employees);
        console.log('✅ Employees loaded from API');
      }
    } catch (error) {
      console.error('❌ Error loading employees:', error);
      toast.error('Ishchilarni yuklashda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, [branchId, searchTerm, statusFilter, roleFilter, visibilityRefetchTick]);

  const handleAddEmployee = async () => {
    setEmployeeMutationBusy(true);
    try {
      console.log('➕ Adding new employee...');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/employees`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...formData,
            branchId
          })
        }
      );

      if (!response.ok) {
        throw new Error('Ishchini qo\'shishda xatolik');
      }

      setIsAddingEmployee(false);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        position: '',
        department: '',
        role: 'staff',
        salary: 0,
        workSchedule: {
          start: '09:00',
          end: '18:00',
          days: ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma']
        },
        emergencyContact: {
          name: '',
          phone: '',
          relationship: ''
        }
      });
      
      toast.success('Ishchi muvaffaqiyatli qo\'shildi');
      loadEmployees();
    } catch (error) {
      console.error('❌ Error adding employee:', error);
      toast.error('Ishchini qo\'shishda xatolik');
    } finally {
      setEmployeeMutationBusy(false);
    }
  };

  const handleUpdateEmployee = async () => {
    if (!editingEmployee) return;
    setEmployeeMutationBusy(true);
    try {
      console.log('✏️ Updating employee...');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/employees/${editingEmployee.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData)
        }
      );

      if (!response.ok) {
        throw new Error('Ishchini yangilashda xatolik');
      }

      setEditingEmployee(null);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        position: '',
        department: '',
        role: 'staff',
        salary: 0,
        workSchedule: {
          start: '09:00',
          end: '18:00',
          days: ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma']
        },
        emergencyContact: {
          name: '',
          phone: '',
          relationship: ''
        }
      });
      
      toast.success('Ishchi muvaffaqiyatli yangilandi');
      loadEmployees();
    } catch (error) {
      console.error('❌ Error updating employee:', error);
      toast.error('Ishchini yangilashda xatolik');
    } finally {
      setEmployeeMutationBusy(false);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('Rostdan ham bu ishchini o\'chirmoqchimisiz?')) return;

    setEmployeeDeleteBusyId(id);
    try {
      console.log('🗑️ Deleting employee:', id);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/employees/${id}?branchId=${branchId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Ishchini o\'chirishda xatolik');
      }

      setEmployees((prev) => prev.filter((e) => e.id !== id));
      toast.success('Ishchi muvaffaqiyatli o\'chirildi');
    } catch (error) {
      console.error('❌ Error deleting employee:', error);
      toast.error('Ishchini o\'chirishda xatolik');
    } finally {
      setEmployeeDeleteBusyId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'inactive': return '#6b7280';
      case 'on_leave': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Faol';
      case 'inactive': return 'Nofaol';
      case 'on_leave': return 'Ta\'tilda';
      default: return status;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return Shield;
      case 'manager': return Briefcase;
      case 'seller': return DollarSign;
      case 'courier': return Users;
      case 'staff': return User;
      default: return User;
    }
  };

  const getRoleText = (role: string) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'manager': return 'Menejer';
      case 'seller': return 'Sotuvchi';
      case 'courier': return 'Kuryer';
      case 'staff': return 'Xodim';
      default: return role;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uz-UZ', {
      style: 'currency',
      currency: 'UZS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('uz-UZ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 mx-auto mb-4 animate-spin" style={{ color: accentColor.color }} />
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Ishchilar</h1>
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            Filial xodimlarini boshqarish
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddingEmployee(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all"
            style={{
              background: accentColor.gradient,
              color: '#ffffff'
            }}
          >
            <Plus className="w-4 h-4" />
            Yangi ishchi
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }} />
            <input
              type="text"
              placeholder="Ismi yoki telefon raqami..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border outline-none"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
              }}
            />
          </div>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 rounded-xl border outline-none"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
          }}
        >
          <option value="all">Barcha holatlar</option>
          <option value="active">Faol</option>
          <option value="inactive">Nofaol</option>
          <option value="on_leave">Ta'tilga</option>
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2 rounded-xl border outline-none"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
          }}
        >
          <option value="all">Barcha rollar</option>
          <option value="admin">Admin</option>
          <option value="manager">Menejer</option>
          <option value="seller">Sotuvchi</option>
          <option value="courier">Kuryer</option>
          <option value="staff">Xodim</option>
        </select>
        <button
          onClick={loadEmployees}
          className="p-2 rounded-xl border transition-all hover:shadow-lg"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
          }}
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Employees Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {employees.map((employee) => {
          const RoleIcon = getRoleIcon(employee.role);
          
          return (
            <div 
              key={employee.id}
              className="p-6 rounded-2xl border transition-all hover:shadow-lg cursor-pointer"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
              }}
              onClick={() => setShowDetails(employee)}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
                    style={{ 
                      background: accentColor.gradient,
                      color: '#ffffff'
                    }}
                  >
                    {employee.firstName[0]}{employee.lastName[0]}
                  </div>
                  <div>
                    <h3 className="font-semibold">{employee.firstName} {employee.lastName}</h3>
                    <p className="text-sm" style={{ 
                      color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                    }}>
                      {employee.position}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div 
                    className="px-2 py-1 rounded-lg text-xs font-medium"
                    style={{
                      background: `${getStatusColor(employee.status)}20`,
                      color: getStatusColor(employee.status)
                    }}
                  >
                    {getStatusText(employee.status)}
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4" style={{ color: accentColor.color }} />
                  <span className="text-sm">{employee.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" style={{ color: accentColor.color }} />
                  <span className="text-sm truncate">{employee.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <RoleIcon className="w-4 h-4" style={{ color: accentColor.color }} />
                  <span className="text-sm">{getRoleText(employee.role)}</span>
                </div>
              </div>

              {/* Performance Stats */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="text-center p-3 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  }}
                >
                  <p className="text-lg font-bold" style={{ color: accentColor.color }}>
                    {employee.performance.rating}
                  </p>
                  <p className="text-xs" style={{ 
                    color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                  }}>
                    Reyting
                  </p>
                </div>
                <div className="text-center p-3 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  }}
                >
                  <p className="text-lg font-bold" style={{ color: accentColor.color }}>
                    {employee.performance.attendance}%
                  </p>
                  <p className="text-xs" style={{ 
                    color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                  }}>
                    Davomat
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingEmployee(employee);
                    setFormData({
                      firstName: employee.firstName,
                      lastName: employee.lastName,
                      email: employee.email,
                      phone: employee.phone,
                      position: employee.position,
                      department: employee.department,
                      role: employee.role,
                      salary: employee.salary,
                      workSchedule: employee.workSchedule,
                      emergencyContact: employee.emergencyContact
                    });
                  }}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg border text-sm transition-all hover:shadow-lg"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                  }}
                >
                  <Edit2 className="w-4 h-4" />
                  Tahrirlash
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDeleteEmployee(employee.id);
                  }}
                  disabled={employeeDeleteBusyId === employee.id}
                  className="p-2 rounded-lg border text-red-500 transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[40px]"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                  }}
                >
                  {employeeDeleteBusyId === employee.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add/Edit Employee Modal */}
      {(isAddingEmployee || editingEmployee) && (
        <div className="fixed inset-0 app-safe-pad bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div 
            className="w-full max-w-2xl p-6 rounded-2xl max-h-[80vh] overflow-y-auto"
            style={{
              background: isDark ? '#1a1a1a' : '#ffffff',
            }}
          >
            <h2 className="text-xl font-bold mb-4">
              {editingEmployee ? 'Ishchini tahrirlash' : 'Yangi ishchi qo\'shish'}
            </h2>
            
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Ism *</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                    }}
                    placeholder="Ism"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Familiya *</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                    }}
                    placeholder="Familiya"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                    }}
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Telefon *</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                    }}
                    placeholder="+998 90 123 45 67"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Lavozim *</label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                    }}
                    placeholder="Lavozim"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Bo'lim *</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                    }}
                    placeholder="Bo'lim"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Rol *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'manager' | 'seller' | 'courier' | 'staff' })}
                    className="w-full px-3 py-2 rounded-xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                    }}
                  >
                    <option value="staff">Xodim</option>
                    <option value="seller">Sotuvchi</option>
                    <option value="courier">Kuryer</option>
                    <option value="manager">Menejer</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Oylik maosh *</label>
                  <input
                    type="number"
                    value={formData.salary}
                    onChange={(e) => setFormData({ ...formData, salary: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                    }}
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Work Schedule */}
              <div>
                <label className="block text-sm font-medium mb-2">Ish grafigi</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs mb-1">Boshlanish</label>
                    <input
                      type="time"
                      value={formData.workSchedule.start}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        workSchedule: { ...formData.workSchedule, start: e.target.value }
                      })}
                      className="w-full px-3 py-2 rounded-xl border outline-none"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Tugash</label>
                    <input
                      type="time"
                      value={formData.workSchedule.end}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        workSchedule: { ...formData.workSchedule, end: e.target.value }
                      })}
                      className="w-full px-3 py-2 rounded-xl border outline-none"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div>
                <label className="block text-sm font-medium mb-2">Favqulodda aloqa</label>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={formData.emergencyContact.name}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      emergencyContact: { ...formData.emergencyContact, name: e.target.value }
                    })}
                    className="w-full px-3 py-2 rounded-xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                    }}
                    placeholder="Ismi"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="tel"
                      value={formData.emergencyContact.phone}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        emergencyContact: { ...formData.emergencyContact, phone: e.target.value }
                      })}
                      className="w-full px-3 py-2 rounded-xl border outline-none"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                      }}
                      placeholder="Telefon"
                    />
                    <select
                      value={formData.emergencyContact.relationship}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        emergencyContact: { ...formData.emergencyContact, relationship: e.target.value }
                      })}
                      className="w-full px-3 py-2 rounded-xl border outline-none"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                      }}
                    >
                      <option value="">Qaysi bog'liq</option>
                      <option value="Ota">Ota</option>
                      <option value="Ona">Ona</option>
                      <option value="Aka">Aka</option>
                      <option value="Uka">Uka</option>
                      <option value="Opa">Opa</option>
                      <option value="Singil">Singil</option>
                      <option value="Xotini">Xotini</option>
                      <option value="Er">Er</option>
                      <option value="Boshqa">Boshqa</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  void (editingEmployee ? handleUpdateEmployee() : handleAddEmployee());
                }}
                disabled={employeeMutationBusy}
                className="flex-1 py-2 rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: accentColor.gradient,
                  color: '#ffffff'
                }}
              >
                {employeeMutationBusy && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
                {editingEmployee ? 'Yangilash' : 'Qo\'shish'}
              </button>
              <button
                type="button"
                disabled={employeeMutationBusy}
                onClick={() => {
                  setIsAddingEmployee(false);
                  setEditingEmployee(null);
                  setFormData({
                    firstName: '',
                    lastName: '',
                    email: '',
                    phone: '',
                    position: '',
                    department: '',
                    role: 'staff',
                    salary: 0,
                    workSchedule: {
                      start: '09:00',
                      end: '18:00',
                      days: ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma']
                    },
                    emergencyContact: {
                      name: '',
                      phone: '',
                      relationship: ''
                    }
                  });
                }}
                className="flex-1 py-2 rounded-xl border font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                }}
              >
                Bekor qilish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetails && (
        <div className="fixed inset-0 app-safe-pad bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div 
            className="w-full max-w-3xl p-6 rounded-2xl max-h-[80vh] overflow-y-auto"
            style={{
              background: isDark ? '#1a1a1a' : '#ffffff',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{showDetails.firstName} {showDetails.lastName}</h2>
              <button
                onClick={() => setShowDetails(null)}
                className="p-2 rounded-lg border"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Info */}
              <div>
                <h3 className="font-semibold mb-3">Asosiy ma'lumotlar</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Lavozim:</span>
                    <span className="font-bold">{showDetails.position}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Bo'lim:</span>
                    <span className="font-bold">{showDetails.department}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Rol:</span>
                    <span className="font-bold">{getRoleText(showDetails.role)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Holat:</span>
                    <span className="font-bold" style={{ color: getStatusColor(showDetails.status) }}>
                      {getStatusText(showDetails.status)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Oylik maosh:</span>
                    <span className="font-bold">{formatCurrency(showDetails.salary)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ishga qabul qilingan:</span>
                    <span className="font-bold">{formatDate(showDetails.hireDate)}</span>
                  </div>
                </div>
              </div>

              {/* Performance */}
              <div>
                <h3 className="font-semibold mb-3">Ish samaradorligi</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Reyting:</span>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-500" />
                      <span className="font-bold">{showDetails.performance.rating}</span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span>Jami sotuvlar:</span>
                    <span className="font-bold">{formatCurrency(showDetails.performance.totalSales)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Jami buyurtmalar:</span>
                    <span className="font-bold">{showDetails.performance.totalOrders}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mijozlar qoniqishi:</span>
                    <span className="font-bold">{showDetails.performance.customerSatisfaction}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Davomat:</span>
                    <span className="font-bold">{showDetails.performance.attendance}%</span>
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div>
                <h3 className="font-semibold mb-3">Aloqa ma'lumotlari</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" style={{ color: accentColor.color }} />
                    <span>{showDetails.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" style={{ color: accentColor.color }} />
                    <span>{showDetails.email}</span>
                  </div>
                  {showDetails.lastLogin && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" style={{ color: accentColor.color }} />
                      <span>Oxirgi kirish: {new Date(showDetails.lastLogin).toLocaleString('uz-UZ')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Emergency Contact */}
              <div>
                <h3 className="font-semibold mb-3">Favqulodda aloqa</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Ismi:</span>
                    <span className="font-bold">{showDetails.emergencyContact.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Telefon:</span>
                    <span className="font-bold">{showDetails.emergencyContact.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Bog'liq:</span>
                    <span className="font-bold">{showDetails.emergencyContact.relationship}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Work Schedule */}
            <div className="mt-6">
              <h3 className="font-semibold mb-3">Ish grafigi</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  }}
                >
                  <p className="text-sm mb-1" style={{ 
                    color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                  }}>
                    Ish vaqti
                  </p>
                  <p className="font-medium">
                    {showDetails.workSchedule.start} - {showDetails.workSchedule.end}
                  </p>
                </div>
                <div className="p-4 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  }}
                >
                  <p className="text-sm mb-1" style={{ 
                    color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                  }}>
                    Ish kunlari
                  </p>
                  <p className="font-medium">{showDetails.workSchedule.days.join(', ')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
