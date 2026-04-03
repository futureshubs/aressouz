import { X, MapPin, Briefcase, Phone, Star, MessageSquare, Check, Award, Clock, Globe, Calendar, Edit, Trash2, Plus } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import { AddCompletedProjectModal } from './AddCompletedProjectModal';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { useVisibilityTick } from '../utils/visibilityRefetch';
import { devLog } from '../utils/devLog';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c`;

interface PortfolioMedia {
  url: string;
  type: 'image' | 'video';
}

interface Portfolio {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  profession: string;
  region: string;
  district: string;
  skills: string[];
  description: string;
  experience: number;
  priceAmount: number;
  priceType: string; // soat, kun, oy, ish, kv, m2
  media: PortfolioMedia[];
  rating?: number;
  reviewsCount?: number;
  createdAt: string;
  minRate?: number;
  maxRate?: number;
  verified?: boolean;
  completedProjects?: number;
  languages?: string[];
  workDays?: string[];
  workStartTime?: string;
  workEndTime?: string;
}

interface PortfolioDetailModalProps {
  portfolio: Portfolio | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (portfolio: Portfolio) => void;
  onDelete?: (portfolioId: string) => void;
}

export function PortfolioDetailModal({ portfolio, isOpen, onClose, onEdit, onDelete }: PortfolioDetailModalProps) {
  const { theme, accentColor } = useTheme();
  const { user, session } = useAuth();
  const isDark = theme === 'dark';
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'projects' | 'reviews'>('general');
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const visibilityRefetchTick = useVisibilityTick();

  console.log('PortfolioDetailModal rendered:', { portfolio, isOpen });

  // Fetch projects when projects tab is active
  useEffect(() => {
    if (activeTab === 'projects' && portfolio?.id) {
      fetchProjects();
    }
  }, [activeTab, portfolio?.id, visibilityRefetchTick]);

  // Fetch reviews when reviews tab is active
  useEffect(() => {
    if (activeTab === 'reviews' && portfolio?.id) {
      fetchReviews();
    }
  }, [activeTab, portfolio?.id, visibilityRefetchTick]);

  const fetchProjects = async () => {
    if (!portfolio?.id) return;

    setLoadingProjects(true);
    try {
      console.log('🔍 Fetching projects for portfolio:', portfolio.id);
      const response = await fetch(`${API_BASE_URL}/services/portfolio/${portfolio.id}/projects`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      console.log('📡 Projects response status:', response.status);
      const data = await response.json();
      console.log('📦 Projects data:', data);

      if (response.ok) {
        setProjects(data.projects || []);
        console.log('✅ Projects set:', data.projects);
      } else {
        console.error('❌ Projects fetch error:', data.error);
      }
    } catch (error) {
      console.error('❌ Fetch projects exception:', error);
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchReviews = async () => {
    if (!portfolio?.id) return;

    setLoadingReviews(true);
    try {
      const response = await fetch(`${API_BASE_URL}/services/portfolio/${portfolio.id}/reviews`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setReviews(data.reviews || []);
      }
    } catch (error) {
      console.error('Fetch reviews error:', error);
    } finally {
      setLoadingReviews(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !session?.access_token) {
      alert('Sharh yozish uchun tizimga kiring');
      return;
    }

    if (!newReview.comment.trim()) {
      alert('Sharh matnini kiriting');
      return;
    }

    setSubmittingReview(true);

    try {
      const response = await fetch(`${API_BASE_URL}/services/portfolio/${portfolio?.id}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Access-Token': session.access_token,
        },
        body: JSON.stringify(newReview),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Sharh qo\'shishda xatolik');
      }

      alert('Sharh muvaffaqiyatli qo\'shildi!');
      setNewReview({ rating: 5, comment: '' });
      fetchReviews();
    } catch (error: any) {
      console.error('❌ Submit review error:', error);
      console.error('❌ Error type:', typeof error);
      console.error('❌ Error details:', {
        message: error?.message,
        stack: error?.stack,
        raw: error,
      });
      
      const errorMessage = error?.message || 'Sharh yuborishda xatolik. Iltimos, qayta urinib ko\'ring.';
      alert(errorMessage);
    } finally {
      setSubmittingReview(false);
    }
  };

  useEffect(() => {
    if (isOpen && portfolio) {
      setSelectedMediaIndex(0);
      setShowDeleteConfirm(false);
      setActiveTab('general');
      setProjects([]);
      setReviews([]);
      setNewReview({ rating: 5, comment: '' });
      console.log('Modal opened with portfolio:', portfolio);
    }
  }, [isOpen, portfolio]);

  if (!isOpen || !portfolio) {
    console.log('Modal not rendering - isOpen:', isOpen, 'portfolio:', portfolio);
    return null;
  }

  const textPrimary = isDark ? '#ffffff' : '#111827';
  const textSecondary = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

  const currentMedia = portfolio.media?.[selectedMediaIndex];
  const completedProjects = 340;
  const minPrice = portfolio.minRate || 100000;
  const maxPrice = portfolio.maxRate || 500000;

  // Check if current user owns this portfolio
  const isOwner = user?.id === portfolio.userId;

  const handleDelete = () => {
    if (onDelete && portfolio.id) {
      onDelete(portfolio.id);
      onClose();
    }
  };

  const handleEdit = () => {
    if (onEdit && portfolio) {
      onEdit(portfolio);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end md:items-center justify-center"
      style={{
        backgroundColor: isDark ? 'rgba(0, 0, 0, 0.92)' : 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(16px)',
      }}
      onClick={onClose}
    >
      <div
        className="relative w-full md:w-[90%] md:max-w-2xl max-h-[92vh] rounded-t-3xl md:rounded-3xl overflow-hidden"
        style={{
          background: isDark
            ? 'linear-gradient(180deg, rgba(10, 10, 10, 0.98) 0%, rgba(20, 20, 20, 0.95) 100%)'
            : 'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(249, 250, 251, 0.95) 100%)',
          boxShadow: isDark
            ? `0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1)`
            : `0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scrollable Content */}
        <div className="overflow-y-auto max-h-[92vh]">
          {/* Hero Image with Overlay */}
          <div className="relative h-72 md:h-80 overflow-hidden">
            {currentMedia ? (
              currentMedia.type === 'image' ? (
                <img
                  src={currentMedia.url}
                  alt={portfolio.userName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  src={currentMedia.url}
                  className="w-full h-full object-cover"
                  controls
                />
              )
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{
                  backgroundImage: accentColor.gradient,
                }}
              >
                <span className="text-7xl">👷</span>
              </div>
            )}

            {/* Gradient Overlay */}
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(180deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.7) 100%)',
              }}
            />

            {/* Top Badges */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
              {/* Verified Badge */}
              {portfolio.verified !== false && (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-sm backdrop-blur-xl"
                  style={{
                    backgroundColor: accentColor.color,
                    color: '#ffffff',
                    boxShadow: `0 4px 12px ${accentColor.color}66`,
                  }}
                >
                  <Check className="size-4" strokeWidth={3} />
                  Tasdiqlangan
                </div>
              )}

              <div className="flex items-center gap-2 ml-auto">
                {/* Edit Button - only show for owner */}
                {isOwner && onEdit && (
                  <button
                    onClick={handleEdit}
                    className="p-2 rounded-xl transition-all active:scale-90 backdrop-blur-xl"
                    style={{
                      background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.95)',
                      color: accentColor.color,
                    }}
                  >
                    <Edit className="size-5" />
                  </button>
                )}

                {/* Delete Button - only show for owner */}
                {isOwner && onDelete && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-2 rounded-xl transition-all active:scale-90 backdrop-blur-xl"
                    style={{
                      background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.95)',
                      color: '#ef4444',
                    }}
                  >
                    <Trash2 className="size-5" />
                  </button>
                )}

                {/* Rating Badge */}
                <div
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold backdrop-blur-xl"
                  style={{
                    background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.95)',
                    color: isDark ? '#fff' : '#000',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                  }}
                >
                  <Star className="size-4 fill-yellow-400 text-yellow-400" />
                  <span>{(portfolio.rating || 5.0).toFixed(1)}</span>
                </div>

                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl transition-all active:scale-90 backdrop-blur-xl"
                  style={{
                    background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.95)',
                    color: isDark ? '#fff' : '#000',
                  }}
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Media Navigation */}
            {portfolio.media && portfolio.media.length > 1 && (
              <>
                <button
                  onClick={() =>
                    setSelectedMediaIndex((prev) =>
                      prev > 0 ? prev - 1 : portfolio.media.length - 1
                    )
                  }
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full transition-all active:scale-90 backdrop-blur-xl"
                  style={{
                    background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.95)',
                  }}
                >
                  <svg
                    className="size-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    style={{ color: textPrimary }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() =>
                    setSelectedMediaIndex((prev) =>
                      prev < portfolio.media.length - 1 ? prev + 1 : 0
                    )
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full transition-all active:scale-90 backdrop-blur-xl"
                  style={{
                    background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.95)',
                  }}
                >
                  <svg
                    className="size-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    style={{ color: textPrimary }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Dots */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {portfolio.media.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedMediaIndex(index)}
                      className="transition-all rounded-full"
                      style={{
                        width: selectedMediaIndex === index ? '24px' : '6px',
                        height: '6px',
                        background:
                          selectedMediaIndex === index
                            ? '#ffffff'
                            : 'rgba(255, 255, 255, 0.4)',
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Content */}
          <div className="p-5 md:p-6 space-y-5">
            {/* User Info */}
            <div>
              <h3 className="text-2xl md:text-3xl font-bold mb-1.5" style={{ color: textPrimary }}>
                {portfolio.userName || 'Usta'}
              </h3>
              <p
                className="text-base md:text-lg font-semibold"
                style={{
                  color: accentColor.color,
                }}
              >
                {portfolio.profession}
              </p>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 border-b" style={{ borderColor }}>
              <button
                onClick={() => setActiveTab('general')}
                className="px-4 py-3 font-semibold text-sm transition-all relative"
                style={{
                  color: activeTab === 'general' ? accentColor.color : textSecondary,
                }}
              >
                Umumiy
                {activeTab === 'general' && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ background: accentColor.color }}
                  />
                )}
              </button>

              <button
                onClick={() => setActiveTab('projects')}
                className="px-4 py-3 font-semibold text-sm transition-all relative"
                style={{
                  color: activeTab === 'projects' ? accentColor.color : textSecondary,
                }}
              >
                Bajarilgan ishlar
                {activeTab === 'projects' && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ background: accentColor.color }}
                  />
                )}
              </button>

              <button
                onClick={() => setActiveTab('reviews')}
                className="px-4 py-3 font-semibold text-sm transition-all relative"
                style={{
                  color: activeTab === 'reviews' ? accentColor.color : textSecondary,
                }}
              >
                Sharhlar
                {activeTab === 'reviews' && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ background: accentColor.color }}
                  />
                )}
              </button>
            </div>

            {/* Tab Content - General */}
            {activeTab === 'general' && (
              <>
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Experience */}
                  <div
                    className="p-4 rounded-2xl"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      border: `1px solid ${borderColor}`,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Briefcase className="size-4" style={{ color: accentColor.color }} />
                      <span className="text-xs font-medium" style={{ color: textSecondary }}>
                        Tajriba
                      </span>
                    </div>
                    <p className="text-lg font-bold" style={{ color: textPrimary }}>
                      {portfolio.experience || 0} yil
                    </p>
                  </div>

                  {/* Completed Projects */}
                  <div
                    className="p-4 rounded-2xl"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      border: `1px solid ${borderColor}`,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Award className="size-4" style={{ color: accentColor.color }} />
                      <span className="text-xs font-medium" style={{ color: textSecondary }}>
                        Bajarilgan ishlar
                      </span>
                    </div>
                    <p className="text-lg font-bold" style={{ color: textPrimary }}>
                      {portfolio.completedProjects || 0} ta
                    </p>
                  </div>

                  {/* Hourly Rate */}
                  <div
                    className="p-4 rounded-2xl"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      border: `1px solid ${borderColor}`,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Star className="size-4" style={{ color: accentColor.color }} />
                      <span className="text-xs font-medium" style={{ color: textSecondary }}>
                        {portfolio.priceType === 'soat' && 'Soatlik narx'}
                        {portfolio.priceType === 'kun' && 'Kunlik narx'}
                        {portfolio.priceType === 'oy' && 'Oylik narx'}
                        {portfolio.priceType === 'ish' && 'Ish narxi'}
                        {portfolio.priceType === 'kv' && 'Kv narxi (m²)'}
                        {portfolio.priceType === 'm2' && 'Metr narxi'}
                      </span>
                    </div>
                    <p className="text-lg font-bold" style={{ color: textPrimary }}>
                      {portfolio.priceAmount ? `${portfolio.priceAmount.toLocaleString()} so'm` : 'Kelishiladi'}
                    </p>
                  </div>

                  {/* Languages */}
                  <div
                    className="p-4 rounded-2xl"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      border: `1px solid ${borderColor}`,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Globe className="size-4" style={{ color: accentColor.color }} />
                      <span className="text-xs font-medium" style={{ color: textSecondary }}>
                        Tillar
                      </span>
                    </div>
                    <p className="text-lg font-bold" style={{ color: textPrimary }}>
                      {portfolio.languages && portfolio.languages.length > 0 
                        ? portfolio.languages.join(', ') 
                        : 'Kiritilmagan'}
                    </p>
                  </div>
                </div>

                {/* Description */}
                {portfolio.description && (
                  <div>
                    <h4 className="text-sm font-bold mb-2.5" style={{ color: textPrimary }}>
                      Tavsif
                    </h4>
                    <p
                      className="text-sm md:text-base leading-relaxed"
                      style={{
                        color: textSecondary,
                      }}
                    >
                      {portfolio.description}
                    </p>
                  </div>
                )}

                {/* Skills */}
                {portfolio.skills && portfolio.skills.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold mb-2.5" style={{ color: textPrimary }}>
                      Ko'nikmalar
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {portfolio.skills.map((skill, index) => (
                        <span
                          key={index}
                          className="px-3 py-2 rounded-xl text-sm font-medium"
                          style={{
                            background: isDark
                              ? `${accentColor.color}1a`
                              : `${accentColor.color}1a`,
                            color: accentColor.color,
                            border: `1px solid ${accentColor.color}33`,
                          }}
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Work Schedule */}
                <div>
                  <h4 className="text-sm font-bold mb-3" style={{ color: textPrimary }}>
                    Ish jadvali
                  </h4>
                  
                  {/* Work Days */}
                  {portfolio.workDays && portfolio.workDays.length > 0 && (
                    <div
                      className="flex items-start gap-3 p-4 rounded-2xl mb-3"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                        border: `1px solid ${borderColor}`,
                      }}
                    >
                      <Calendar className="size-5 mt-0.5" style={{ color: accentColor.color }} />
                      <div className="flex-1">
                        <p className="text-xs font-medium mb-1" style={{ color: textSecondary }}>
                          Ish kunlari
                        </p>
                        <p className="text-sm font-semibold" style={{ color: textPrimary }}>
                          {portfolio.workDays.join(', ')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Work Hours */}
                  {portfolio.workStartTime && portfolio.workEndTime && (
                    <div
                      className="flex items-center gap-3 p-4 rounded-2xl mb-3"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                        border: `1px solid ${borderColor}`,
                      }}
                    >
                      <Clock className="size-5" style={{ color: accentColor.color }} />
                      <div className="flex-1">
                        <p className="text-xs font-medium mb-1" style={{ color: textSecondary }}>
                          Ish vaqti
                        </p>
                        <p className="text-sm font-semibold" style={{ color: textPrimary }}>
                          {portfolio.workStartTime} - {portfolio.workEndTime}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Location */}
                  <div
                    className="flex items-center gap-3 p-4 rounded-2xl"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      border: `1px solid ${borderColor}`,
                    }}
                  >
                    <MapPin className="size-5" style={{ color: accentColor.color }} />
                    <div className="flex-1">
                      <p className="text-xs font-medium mb-1" style={{ color: textSecondary }}>
                        Manzil
                      </p>
                      <p className="text-sm font-semibold" style={{ color: textPrimary }}>
                        {portfolio.district}, {portfolio.region}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Tab Content - Projects */}
            {activeTab === 'projects' && (
              <>
                {console.log('🎯 Projects Tab Active - Data:', { 
                  loadingProjects, 
                  projectsCount: projects.length, 
                  projects: projects,
                  portfolioId: portfolio?.id 
                })}
                
                {/* Add Project Button - Only for owner */}
                {isOwner && (
                  <button
                    onClick={() => setShowAddProjectModal(true)}
                    className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl font-semibold transition-all active:scale-98 mb-4"
                    style={{
                      background: `linear-gradient(135deg, ${accentColor.color}, ${accentColor.color}dd)`,
                      color: '#fff',
                      boxShadow: `0 4px 16px ${accentColor.color}66`,
                    }}
                  >
                    <Plus className="size-5" />
                    Yakunlangan ish qo'shish
                  </button>
                )}

                {/* Projects Grid */}
                {loadingProjects ? (
                  <div className="flex justify-center py-12">
                    <div
                      className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin"
                      style={{ borderColor: `${accentColor.color} transparent transparent transparent` }}
                    />
                  </div>
                ) : projects.length > 0 ? (
                  <>
                    {console.log('✅ Rendering projects:', projects)}
                    <div className="grid grid-cols-1 gap-4">
                      {projects.filter(project => project && project.id).map((project) => (
                        <div
                          key={project.id}
                          className="rounded-2xl overflow-hidden"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                            border: `1px solid ${borderColor}`,
                          }}
                        >
                          {/* Project Images */}
                          {project?.images && project.images.length > 0 && (
                            <div className="grid grid-cols-3 gap-1 p-1">
                              {project.images.slice(0, 6).map((image: string, idx: number) => (
                                <div 
                                  key={idx} 
                                  className="aspect-square rounded-lg overflow-hidden cursor-pointer transition-all active:scale-95"
                                  onClick={() => setSelectedImage(image)}
                                >
                                  <img
                                    src={image}
                                    alt={`Project ${idx + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Project Info */}
                          <div className="p-4">
                            <h5 className="font-bold text-base mb-1" style={{ color: textPrimary }}>
                              {project?.title || 'Yakunlangan loyiha'}
                            </h5>
                            {project?.description && (
                              <p className="text-sm leading-relaxed" style={{ color: textSecondary }}>
                                {project.description}
                              </p>
                            )}
                            <p className="text-xs mt-2" style={{ color: textSecondary }}>
                              {project?.createdAt ? new Date(project.createdAt).toLocaleDateString('uz-UZ', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              }) : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    {console.log('⚠️ No projects found')}
                    <div
                      className="text-center py-12 rounded-2xl"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                      }}
                    >
                      <Award className="size-12 mx-auto mb-3 opacity-30" style={{ color: textSecondary }} />
                      <p className="text-sm font-medium" style={{ color: textSecondary }}>
                        {isOwner ? 'Hali yakunlangan ishlar yo\'q' : 'Yakunlangan ishlar yo\'q'}
                      </p>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Tab Content - Reviews */}
            {activeTab === 'reviews' && (
              <>
                {/* Rating Summary */}
                <div
                  className="p-5 rounded-2xl mb-5"
                  style={{
                    background: isDark
                      ? `linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(251, 191, 36, 0.05))`
                      : `linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(251, 191, 36, 0.05))`,
                    border: `2px solid rgba(251, 191, 36, 0.3)`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="size-5 fill-yellow-400 text-yellow-400" />
                    <p
                      className="text-sm font-bold uppercase tracking-wider"
                      style={{ color: '#fbbf24' }}
                    >
                      Mijozlar baholari
                    </p>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p
                      className="text-4xl font-bold"
                      style={{ color: '#fbbf24' }}
                    >
                      {portfolio.rating || '5.0'}
                    </p>
                    <p
                      className="text-lg font-semibold"
                      style={{ color: textSecondary }}
                    >
                      / 5.0
                    </p>
                  </div>
                  
                  {/* Visual Stars */}
                  <div className="flex items-center gap-1 mt-3">
                    {[1, 2, 3, 4, 5].map((starNumber) => {
                      const rating = portfolio.rating || 5.0;
                      const isFilled = starNumber <= Math.floor(rating);
                      const isPartial = starNumber === Math.ceil(rating) && rating % 1 !== 0;
                      const fillPercentage = isPartial ? (rating % 1) * 100 : 0;
                      
                      return (
                        <div key={starNumber} className="relative" style={{ width: '20px', height: '20px' }}>
                          {/* Background star (empty) */}
                          <Star 
                            className="absolute inset-0 size-5 text-yellow-400/30" 
                            style={{ strokeWidth: 2 }}
                          />
                          {/* Foreground star (filled) */}
                          {isFilled && (
                            <Star 
                              className="absolute inset-0 size-5 fill-yellow-400 text-yellow-400" 
                            />
                          )}
                          {/* Partial star */}
                          {isPartial && (
                            <div 
                              className="absolute inset-0 overflow-hidden"
                              style={{ width: `${fillPercentage}%` }}
                            >
                              <Star 
                                className="size-5 fill-yellow-400 text-yellow-400" 
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  <p
                    className="text-xs mt-2"
                    style={{ color: textSecondary }}
                  >
                    {reviews.length} ta sharh
                  </p>
                </div>

                {/* Add Review Form - Only for non-owners */}
                {user && !isOwner && (
                  <form onSubmit={handleSubmitReview} className="mb-5">
                    <div
                      className="p-4 rounded-2xl"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                        border: `1px solid ${borderColor}`,
                      }}
                    >
                      <h5 className="font-bold text-sm mb-3" style={{ color: textPrimary }}>
                        Sharh yozish
                      </h5>

                      {/* Rating Stars */}
                      <div className="flex gap-2 mb-3">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setNewReview({ ...newReview, rating: star })}
                            className="transition-all active:scale-90"
                          >
                            <Star
                              className={`size-8 ${
                                star <= newReview.rating
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-gray-400'
                              }`}
                            />
                          </button>
                        ))}
                      </div>

                      {/* Comment */}
                      <textarea
                        value={newReview.comment}
                        onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                        placeholder="Fikringizni yozing..."
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl outline-none resize-none mb-3"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                          border: `1px solid ${borderColor}`,
                          color: textPrimary,
                        }}
                      />

                      {/* Submit Button */}
                      <button
                        type="submit"
                        disabled={submittingReview || !newReview.comment.trim()}
                        className="w-full py-3 rounded-xl font-semibold transition-all active:scale-98 disabled:opacity-50"
                        style={{
                          background: accentColor.color,
                          color: '#fff',
                          boxShadow: `0 4px 12px ${accentColor.color}40`,
                        }}
                      >
                        {submittingReview ? 'Yuklanmoqda...' : 'Sharh yuborish'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Reviews List */}
                {loadingReviews ? (
                  <div className="flex justify-center py-12">
                    <div
                      className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin"
                      style={{ borderColor: `${accentColor.color} transparent transparent transparent` }}
                    />
                  </div>
                ) : reviews.length > 0 ? (
                  <div className="space-y-3">
                    {reviews.filter(review => review && review.id).map((review) => (
                      <div
                        key={review.id}
                        className="p-4 rounded-2xl"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                          border: `1px solid ${borderColor}`,
                        }}
                      >
                        {/* Review Header */}
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-bold text-sm" style={{ color: textPrimary }}>
                              {review.userName || 'Foydalanuvchi'}
                            </p>
                            <p className="text-xs" style={{ color: textSecondary }}>
                              {review.createdAt ? new Date(review.createdAt).toLocaleDateString('uz-UZ', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              }) : ''}
                            </p>
                          </div>
                          
                          {/* Rating */}
                          <div className="flex items-center gap-1">
                            <Star className="size-4 fill-yellow-400 text-yellow-400" />
                            <span className="font-bold text-sm" style={{ color: '#fbbf24' }}>
                              {review.rating || 5}
                            </span>
                          </div>
                        </div>

                        {/* Review Comment */}
                        <p className="text-sm leading-relaxed" style={{ color: textSecondary }}>
                          {review.comment || ''}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className="text-center py-12 rounded-2xl"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                    }}
                  >
                    <MessageSquare className="size-12 mx-auto mb-3 opacity-30" style={{ color: textSecondary }} />
                    <p className="text-sm font-medium" style={{ color: textSecondary }}>
                      Hali sharhlar yo'q
                    </p>
                    {!isOwner && user && (
                      <p className="text-xs mt-2" style={{ color: textSecondary }}>
                        Birinchi bo'lib sharh qoldiring!
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              {/* Call Button */}
              <a
                href={`tel:${portfolio.userPhone}`}
                className="flex items-center justify-center gap-2 py-4 px-4 rounded-2xl font-bold text-white transition-all active:scale-98"
                style={{
                  backgroundColor: accentColor.color,
                  boxShadow: isDark
                    ? `0 8px 24px ${accentColor.color}66, 0 4px 12px rgba(0, 0, 0, 0.4)`
                    : `0 6px 20px ${accentColor.color}4d, 0 2px 8px rgba(0, 0, 0, 0.15)`,
                }}
              >
                <Phone className="size-5" />
                Qo'ng'iroq
              </a>

              {/* Message Button - SMS Integration */}
              <a
                href={`sms:${portfolio.userPhone}`}
                className="flex items-center justify-center gap-2 py-4 px-4 rounded-2xl font-bold transition-all active:scale-98"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  color: textPrimary,
                  border: `1px solid ${borderColor}`,
                }}
              >
                <MessageSquare className="size-5" />
                Xabar
              </a>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div
            className="absolute inset-0 flex items-center justify-center p-6"
            style={{
              backgroundColor: isDark ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(8px)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-full max-w-sm p-6 rounded-3xl"
              style={{
                background: isDark
                  ? 'linear-gradient(180deg, rgba(30, 30, 30, 0.98) 0%, rgba(20, 20, 20, 0.95) 100%)'
                  : 'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(249, 250, 251, 0.95) 100%)',
                border: `1px solid ${borderColor}`,
              }}
            >
              <div className="flex items-center justify-center mb-4">
                <div
                  className="p-4 rounded-2xl"
                  style={{
                    background: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                  }}
                >
                  <Trash2 className="size-8" style={{ color: '#ef4444' }} />
                </div>
              </div>

              <h3 className="text-xl font-bold text-center mb-2" style={{ color: textPrimary }}>
                Portfolio o'chirish
              </h3>

              <p className="text-sm text-center mb-6" style={{ color: textSecondary }}>
                Haqiqatan ham ushbu portfolio'ni o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="py-3 px-4 rounded-2xl font-bold transition-all active:scale-95"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                    color: textPrimary,
                    border: `1px solid ${borderColor}`,
                  }}
                >
                  Bekor qilish
                </button>

                <button
                  onClick={handleDelete}
                  className="py-3 px-4 rounded-2xl font-bold text-white transition-all active:scale-95"
                  style={{
                    background: '#ef4444',
                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
                  }}
                >
                  O'chirish
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Completed Project Modal */}
      {showAddProjectModal && session?.access_token && (
        <AddCompletedProjectModal
          isOpen={showAddProjectModal}
          onClose={() => setShowAddProjectModal(false)}
          portfolioId={portfolio.id}
          accessToken={session.access_token}
          accentColor={accentColor}
          isDark={isDark}
          onSuccess={() => {
            fetchProjects();
            setShowAddProjectModal(false);
          }}
        />
      )}

      {/* Image Viewer Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            backdropFilter: 'blur(20px)',
          }}
          onClick={() => setSelectedImage(null)}
        >
          {/* Close Button */}
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 p-3 rounded-full transition-all active:scale-90 backdrop-blur-xl z-10"
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              color: '#fff',
            }}
          >
            <X className="size-6" />
          </button>

          {/* Image */}
          <img
            src={selectedImage}
            alt="Project preview"
            className="max-w-full max-h-[90vh] object-contain rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
            style={{
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          />
        </div>
      )}
    </div>
  );
}