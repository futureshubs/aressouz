import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { Search, Clock, TrendingUp, Tag, MapPin, Star, ChevronRight, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export interface Suggestion {
  id: string;
  text: string;
  type: 'query' | 'product' | 'category' | 'brand' | 'location' | 'trending' | 'recent';
  count?: number;
  image?: string;
  price?: number;
  rating?: number;
  location?: string;
  category?: string;
  description?: string;
  highlightedText?: string;
  metadata?: Record<string, any>;
}

export interface SearchHistory {
  id: string;
  query: string;
  timestamp: Date;
  resultsCount: number;
  clickedResult?: string;
  sessionId: string;
  userId?: string;
}

export interface PopularSearch {
  query: string;
  count: number;
  trend: 'up' | 'down' | 'stable';
  lastWeekCount: number;
  category?: string;
}

const mockSuggestions: Suggestion[] = [
  {
    id: '1',
    text: 'Samsung Galaxy S24',
    type: 'product',
    count: 1250,
    image: '/images/samsung-s24.jpg',
    price: 18990000,
    rating: 4.8,
    category: 'Smartfonlar',
    description: 'Yangi Samsung Galaxy S24 Ultra'
  },
  {
    id: '2',
    text: 'iPhone 15 Pro',
    type: 'product',
    count: 980,
    image: '/images/iphone15.jpg',
    price: 22450000,
    rating: 4.9,
    category: 'Smartfonlar',
    description: 'Apple iPhone 15 Pro Max'
  },
  {
    id: '3',
    text: 'Elektronika',
    type: 'category',
    count: 15420,
    description: 'Telefonlar, noutbuklar, planshetlar'
  },
  {
    id: '4',
    text: 'Toshkent',
    type: 'location',
    count: 8934,
    description: 'Toshkent shahridagi e\'lonlar'
  },
  {
    id: '5',
    text: 'MacBook',
    type: 'brand',
    count: 567,
    description: 'Apple MacBook noutbuklari'
  },
  {
    id: '6',
    text: 'Laptop 2025',
    type: 'trending',
    count: 234,
    description: 'Eng so\'nggi noutbuklar'
  }
];

const mockHistory: SearchHistory[] = [
  {
    id: '1',
    query: 'Samsung Galaxy',
    timestamp: new Date('2025-03-19T10:30:00'),
    resultsCount: 45,
    sessionId: 'session_1',
    userId: 'user_1'
  },
  {
    id: '2',
    query: 'iPhone 15',
    timestamp: new Date('2025-03-19T09:15:00'),
    resultsCount: 23,
    sessionId: 'session_1',
    userId: 'user_1'
  },
  {
    id: '3',
    query: 'Laptop',
    timestamp: new Date('2025-03-18T14:20:00'),
    resultsCount: 67,
    sessionId: 'session_2',
    userId: 'user_1'
  }
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Matnni React orqali ajratadi — `dangerouslySetInnerHTML` XSS yo‘lini yopadi */
function renderHighlightedText(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;
  let re: RegExp;
  try {
    re = new RegExp(`(${escapeRegex(q)})`, 'gi');
  } catch {
    return text;
  }
  const out: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    const offset = match.index;
    const m = match[0];
    if (offset > last) {
      out.push(<span key={`t${key++}`}>{text.slice(last, offset)}</span>);
    }
    out.push(
      <mark
        key={`m${key++}`}
        className="rounded bg-yellow-200 px-0.5 text-inherit dark:bg-yellow-700/40"
      >
        {m}
      </mark>,
    );
    last = offset + m.length;
    if (m.length === 0) re.lastIndex++;
  }
  if (last < text.length) {
    out.push(<span key={`t${key++}`}>{text.slice(last)}</span>);
  }
  return out.length > 0 ? <>{out}</> : text;
}

const mockPopularSearches: PopularSearch[] = [
  { query: 'Samsung Galaxy', count: 2340, trend: 'up', lastWeekCount: 1890, category: 'Elektronika' },
  { query: 'iPhone', count: 1980, trend: 'up', lastWeekCount: 1750, category: 'Elektronika' },
  { query: 'Laptop', count: 1560, trend: 'stable', lastWeekCount: 1520, category: 'Elektronika' },
  { query: 'Kiyim', count: 1230, trend: 'down', lastWeekCount: 1450, category: 'Kiyim-kechak' },
  { query: 'Uy', count: 980, trend: 'up', lastWeekCount: 820, category: 'Ko\'chmas mulk' }
];

export function useAutoComplete() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [history, setHistory] = useState<SearchHistory[]>(mockHistory);
  const [popularSearches, setPopularSearches] = useState<PopularSearch[]>(mockPopularSearches);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Get suggestions based on query
  const getSuggestions = useCallback(async (query: string) => {
    if (!query) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    setIsOpen(true);

    try {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 300));

      const queryLower = query.toLowerCase();
      
      // Filter suggestions based on query
      const filteredSuggestions = mockSuggestions
        .filter(suggestion => 
          suggestion.text.toLowerCase().includes(queryLower) ||
          suggestion.description?.toLowerCase().includes(queryLower)
        )
        .map(suggestion => ({
          ...suggestion,
          highlightedText: highlightText(suggestion.text, query)
        }));

      setSuggestions(filteredSuggestions);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Suggestions error:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Add to history
  const addToHistory = useCallback((query: string, resultsCount: number, sessionId: string, userId?: string) => {
    const newHistory: SearchHistory = {
      id: `history_${Date.now()}`,
      query,
      timestamp: new Date(),
      resultsCount,
      sessionId,
      userId
    };

    setHistory(prev => [newHistory, ...prev.slice(0, 9)]); // Keep only last 10
  }, []);

  // Clear history
  const clearHistory = useCallback(() => {
    setHistory([]);
    toast.success('Qidiruv tarixi tozalandi');
  }, []);

  // Remove from history
  const removeFromHistory = useCallback((id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  }, []);

  // Get trending suggestions
  const getTrendingSuggestions = useCallback(() => {
    return popularSearches
      .filter(search => search.trend === 'up')
      .slice(0, 5)
      .map(search => ({
        id: `trending_${search.query}`,
        text: search.query,
        type: 'trending' as const,
        count: search.count,
        category: search.category,
        metadata: { trend: search.trend, lastWeekCount: search.lastWeekCount }
      }));
  }, [popularSearches]);

  // Get recent suggestions from history
  const getRecentSuggestions = useCallback((limit: number = 5) => {
    return history.slice(0, limit).map(item => ({
      id: item.id,
      text: item.query,
      type: 'recent' as const,
      metadata: { timestamp: item.timestamp, resultsCount: item.resultsCount }
    }));
  }, [history]);

  // Navigate suggestions with keyboard
  const navigateSuggestions = useCallback((direction: 'up' | 'down') => {
    if (!isOpen || suggestions.length === 0) return;

    const newIndex = direction === 'down' 
      ? selectedIndex < suggestions.length - 1 ? selectedIndex + 1 : 0
      : selectedIndex > 0 ? selectedIndex - 1 : suggestions.length - 1;

    setSelectedIndex(newIndex);
  }, [isOpen, suggestions, selectedIndex]);

  // Select suggestion
  const selectSuggestion = useCallback((suggestion: Suggestion) => {
    setIsOpen(false);
    setSelectedIndex(-1);
    return suggestion.text;
  }, []);

  // Close suggestions
  const closeSuggestions = useCallback(() => {
    setIsOpen(false);
    setSelectedIndex(-1);
  }, []);

  return {
    suggestions,
    history,
    popularSearches,
    isLoading,
    isOpen,
    selectedIndex,
    getSuggestions,
    addToHistory,
    clearHistory,
    removeFromHistory,
    getTrendingSuggestions,
    getRecentSuggestions,
    navigateSuggestions,
    selectSuggestion,
    closeSuggestions
  };
}

interface AutoCompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: Suggestion) => void;
  placeholder?: string;
  className?: string;
  showHistory?: boolean;
  showTrending?: boolean;
  maxSuggestions?: number;
}

export default function AutoComplete({
  value,
  onChange,
  onSelect,
  placeholder = "Qidiruv...",
  className = "",
  showHistory = true,
  showTrending = true,
  maxSuggestions = 8
}: AutoCompleteProps) {
  const {
    suggestions,
    history,
    isLoading,
    isOpen,
    selectedIndex,
    getSuggestions,
    addToHistory,
    clearHistory,
    getTrendingSuggestions,
    getRecentSuggestions,
    navigateSuggestions,
    selectSuggestion,
    closeSuggestions
  } = useAutoComplete();

  const inputRef = useRef<HTMLInputElement>(null);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    getSuggestions(newValue);
  };

  // Handle input focus
  const handleInputFocus = () => {
    if (!value) {
      setShowAllSuggestions(true);
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: Suggestion) => {
    onChange(suggestion.text);
    onSelect(suggestion);
    addToHistory(suggestion.text, 0, 'session_current');
    closeSuggestions();
    setShowAllSuggestions(false);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        navigateSuggestions('down');
        break;
      case 'ArrowUp':
        e.preventDefault();
        navigateSuggestions('up');
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSuggestionClick(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        closeSuggestions();
        break;
    }
  };

  // Get suggestion icon
  const getSuggestionIcon = (type: Suggestion['type']) => {
    switch (type) {
      case 'product': return <Tag className="w-4 h-4 text-blue-500" />;
      case 'category': return <Star className="w-4 h-4 text-purple-500" />;
      case 'brand': return <Tag className="w-4 h-4 text-green-500" />;
      case 'location': return <MapPin className="w-4 h-4 text-red-500" />;
      case 'trending': return <TrendingUp className="w-4 h-4 text-orange-500" />;
      case 'recent': return <Clock className="w-4 h-4 text-gray-500" />;
      default: return <Search className="w-4 h-4 text-gray-500" />;
    }
  };

  // Format suggestion text (query XSS uchun HTML emas, faqat React tugunlari)
  const formatSuggestionText = (suggestion: Suggestion) =>
    renderHighlightedText(suggestion.text, value);

  // Render suggestion item
  const renderSuggestion = (suggestion: Suggestion, index: number) => {
    const isSelected = index === selectedIndex;

    return (
      <div
        key={suggestion.id}
        onClick={() => handleSuggestionClick(suggestion)}
        className={`px-4 py-3 cursor-pointer flex items-center space-x-3 transition-colors ${
          isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
        }`}
      >
        {getSuggestionIcon(suggestion.type)}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {formatSuggestionText(suggestion)}
            </div>
            {suggestion.count && (
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                {suggestion.count}
              </span>
            )}
          </div>
          
          {suggestion.description && (
            <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
              {suggestion.description}
            </div>
          )}
          
          {(suggestion.price || suggestion.rating) && (
            <div className="flex items-center space-x-4 mt-1">
              {suggestion.price && (
                <span className="text-xs text-blue-600 font-medium">
                  {suggestion.price.toLocaleString('uz-UZ')} so'm
                </span>
              )}
              {suggestion.rating && (
                <div className="flex items-center space-x-1">
                  <Star className="w-3 h-3 text-yellow-400 fill-current" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {suggestion.rating}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
        
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </div>
    );
  };

  const allSuggestions = showAllSuggestions && !value ? [
    ...(showTrending ? getTrendingSuggestions() : []),
    ...(showHistory ? getRecentSuggestions() : [])
  ] : suggestions;

  return (
    <div className={`relative ${className}`}>
      {/* Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={() => setTimeout(() => setShowAllSuggestions(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-500 w-5 h-5 animate-spin" />
        )}
        
        {value && !isLoading && (
          <button
            onClick={() => {
              onChange('');
              closeSuggestions();
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {(isOpen || showAllSuggestions) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {/* Loading State */}
          {isLoading && (
            <div className="px-4 py-8 text-center" aria-hidden>
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto" />
            </div>
          )}

          {/* No Results */}
          {!isLoading && allSuggestions.length === 0 && value && (
            <div className="px-4 py-8 text-center">
              <Search className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">
                "{value}" bo'yicha hech narsa topilmadi
              </p>
            </div>
          )}

          {/* Suggestions List */}
          {!isLoading && allSuggestions.length > 0 && (
            <>
              {/* Trending Section */}
              {showTrending && showAllSuggestions && !value && (
                <div className="border-b border-gray-200 dark:border-gray-600">
                  <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="w-4 h-4 text-orange-500" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        Trending qidiruvlar
                      </span>
                    </div>
                  </div>
                  {getTrendingSuggestions().slice(0, 3).map((suggestion, index) => 
                    renderSuggestion(suggestion, index)
                  )}
                </div>
              )}

              {/* Recent Section */}
              {showHistory && showAllSuggestions && !value && (
                <div className="border-b border-gray-200 dark:border-gray-600">
                  <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        So'nggi qidiruvlar
                      </span>
                    </div>
                    <button
                      onClick={clearHistory}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      Tozalash
                    </button>
                  </div>
                  {getRecentSuggestions().slice(0, 3).map((suggestion, index) => 
                    renderSuggestion(suggestion, index + (showTrending ? 3 : 0))
                  )}
                </div>
              )}

              {/* Regular Suggestions */}
              {value && (
                <div>
                  {allSuggestions.slice(0, maxSuggestions).map((suggestion, index) =>
                    renderSuggestion(suggestion, index),
                  )}
                </div>
              )}

              {/* Show More */}
              {allSuggestions.length > maxSuggestions && (
                <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-600">
                  <button className="text-sm text-blue-600 hover:text-blue-700">
                    Yana {allSuggestions.length - maxSuggestions} ta taklif
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
