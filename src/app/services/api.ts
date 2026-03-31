import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c`;

// Get auth token from localStorage
const getAuthToken = (): string | null => {
  return localStorage.getItem('auth_token');
};

// Set auth token to localStorage
export const setAuthToken = (token: string) => {
  localStorage.setItem('auth_token', token);
};

// Clear auth token from localStorage
export const clearAuthToken = () => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user');
};

// Get current user from localStorage
export const getCurrentUser = () => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

// Set current user to localStorage
export const setCurrentUser = (user: any) => {
  localStorage.setItem('user', JSON.stringify(user));
};

// Generic fetch helper
const apiFetch = async (
  endpoint: string,
  options: RequestInit = {},
  requireAuth: boolean = false
) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };

  // Add auth token or public anon key
  if (requireAuth) {
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      throw new Error('Avtorizatsiya talab qilinadi');
    }
  } else {
    headers['Authorization'] = `Bearer ${publicAnonKey}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Serverda xatolik yuz berdi');
  }

  return data;
};

// ==================== AUTH API ====================

export const authAPI = {
  signup: async (email: string, password: string, name: string) => {
    const data = await apiFetch('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    return data;
  },

  signin: async (email: string, password: string) => {
    const data = await apiFetch('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (data.session?.access_token) {
      setAuthToken(data.session.access_token);
      setCurrentUser(data.user);
    }
    
    return data;
  },

  getUser: async () => {
    const data = await apiFetch('/auth/user', {}, true);
    return data;
  },

  signout: () => {
    clearAuthToken();
  },
};

// ==================== PRODUCTS API ====================

export const productsAPI = {
  getAll: async (category?: string) => {
    const query = category ? `?category=${category}` : '';
    const data = await apiFetch(`/products${query}`);
    return data.products;
  },

  getById: async (id: string) => {
    const data = await apiFetch(`/products/${id}`);
    return data.product;
  },

  create: async (productData: any) => {
    const data = await apiFetch('/products', {
      method: 'POST',
      body: JSON.stringify(productData),
    }, true);
    return data.product;
  },
};

// Helper function for creating products with token
export const createProduct = async (productData: any, token: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const response = await fetch(`${API_BASE_URL}/products`, {
    method: 'POST',
    headers,
    body: JSON.stringify(productData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Mahsulot qo\'shishda xatolik');
  }

  return data.product;
};

// ==================== FOODS API ====================

export const foodsAPI = {
  getAll: async (category?: string) => {
    const query = category ? `?category=${category}` : '';
    const data = await apiFetch(`/foods${query}`);
    return data.foods;
  },

  getById: async (id: string) => {
    const data = await apiFetch(`/foods/${id}`);
    return data.food;
  },
};

// ==================== RESTAURANTS API ====================

export const restaurantsAPI = {
  getAll: async () => {
    const data = await apiFetch('/restaurants');
    return data.restaurants;
  },
};

// ==================== FAVORITES API ====================

export const favoritesAPI = {
  getAll: async () => {
    const data = await apiFetch('/favorites', {}, true);
    return data.favorites;
  },

  add: async (itemId: string, itemType: string, itemData: any) => {
    const data = await apiFetch('/favorites', {
      method: 'POST',
      body: JSON.stringify({ itemId, itemType, itemData }),
    }, true);
    return data.favorite;
  },

  remove: async (itemId: string) => {
    await apiFetch(`/favorites/${itemId}`, {
      method: 'DELETE',
    }, true);
  },
};

// ==================== CART API ====================

export const cartAPI = {
  getAll: async () => {
    const data = await apiFetch('/cart', {}, true);
    return data.cart;
  },

  add: async (itemId: string, itemType: string, itemData: any, quantity: number = 1) => {
    const data = await apiFetch('/cart', {
      method: 'POST',
      body: JSON.stringify({ itemId, itemType, itemData, quantity }),
    }, true);
    return data.cartItem;
  },

  updateQuantity: async (itemId: string, quantity: number) => {
    const data = await apiFetch(`/cart/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity }),
    }, true);
    return data.cartItem;
  },

  remove: async (itemId: string) => {
    await apiFetch(`/cart/${itemId}`, {
      method: 'DELETE',
    }, true);
  },

  clear: async () => {
    await apiFetch('/cart', {
      method: 'DELETE',
    }, true);
  },
};

// ==================== ORDERS API ====================

export const ordersAPI = {
  getAll: async () => {
    const data = await apiFetch('/orders', {}, true);
    return data.orders;
  },

  getById: async (id: string) => {
    const data = await apiFetch(`/orders/${id}`, {}, true);
    return data.order;
  },

  create: async (orderData: any) => {
    const data = await apiFetch('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    }, true);
    return data.order;
  },

  updateStatus: async (id: string, status: string, orderStatus: string) => {
    const data = await apiFetch(`/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status, orderStatus }),
    }, true);
    return data.order;
  },
};

// ==================== STORES API ====================

export const storesAPI = {
  getAll: async () => {
    const data = await apiFetch('/stores');
    return data.stores;
  },

  getById: async (id: string) => {
    const data = await apiFetch(`/stores/${id}`);
    return data.store;
  },
};

// ==================== HEALTH CHECK ====================

export const healthCheck = async () => {
  const data = await apiFetch('/health');
  return data;
};

// ==================== IMAGE UPLOAD API ====================

export const uploadAPI = {
  // Upload image
  uploadImage: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const authToken = getAuthToken();
    if (!authToken) {
      throw new Error('Avtorizatsiya talab qilinadi');
    }

    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Rasm yuklashda xatolik');
    }

    return data;
  },

  // Delete image
  deleteImage: async (fileName: string) => {
    await apiFetch(`/upload/${fileName}`, {
      method: 'DELETE',
    }, true);
  },

  // Get signed URL
  getSignedUrl: async (fileName: string, expiresIn: number = 3600) => {
    const data = await apiFetch(`/upload/signed/${fileName}?expiresIn=${expiresIn}`, {}, true);
    return data.url;
  },
};