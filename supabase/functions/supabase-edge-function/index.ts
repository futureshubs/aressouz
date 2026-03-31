import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// CORS configuration
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

// Health check response
const healthResponse = (): Response => {
  return new Response(
    JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.1',
      endpoints: {
        public: ['/health', '/test-deployment', '/public/branches'],
        auth: ['/auth/sms/send', '/auth/sms/signup', '/auth/sms/signin'],
        user: ['/user/profile']
      }
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    }
  )
}

// Test deployment response
const testDeploymentResponse = (): Response => {
  return new Response(
    JSON.stringify({
      success: true,
      message: '✅ Edge Functions are working!',
      timestamp: new Date().toISOString(),
      endpoints: {
        public: ['/health', '/test-deployment', '/public/branches'],
        auth: ['/auth/sms/send', '/auth/sms/signup', '/auth/sms/signin'],
        user: ['/user/profile']
      }
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    }
  )
}

// Mock branches data
const mockBranches = [
  {
    id: 'branch_1',
    name: 'Test Branch 1',
    branchName: 'Test Branch 1',
    login: 'test1',
    regionId: 'region_1',
    districtId: 'district_1',
    phone: '+998123456789',
    managerName: 'Test Manager',
    coordinates: { lat: 41.2995, lng: 69.2401 },
    createdAt: new Date().toISOString()
  },
  {
    id: 'branch_2',
    name: 'Test Branch 2',
    branchName: 'Test Branch 2',
    login: 'test2',
    regionId: 'region_2',
    districtId: 'district_2',
    phone: '+998987654321',
    managerName: 'Test Manager 2',
    coordinates: { lat: 41.3111, lng: 69.2797 },
    createdAt: new Date().toISOString()
  }
]

// Public branches response
const publicBranchesResponse = (): Response => {
  return new Response(
    JSON.stringify({ branches: mockBranches }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    }
  )
}

// SMS send handler (PUBLIC - no auth required)
const handleSmsSend = async (req: Request): Promise<Response> => {
  try {
    const { phone } = await req.json()

    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Telefon raqam majburiy' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    const phoneRegex = /^998\d{9}$/
    if (!phoneRegex.test(phone)) {
      return new Response(
        JSON.stringify({ error: 'Telefon raqam noto\'g\'ri formatda. 998XXXXXXXXX ko\'rinishida kiriting.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    console.log(`SMS yuborish so'rovi: ${phone}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'SMS yuborildi (mock)',
        expiresIn: 300,
        mock: true
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('SMS send error:', error)
    return new Response(
      JSON.stringify({ error: 'SMS yuborishda xatolik' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
}

// SMS signin handler
const handleSmsSignin = async (req: Request): Promise<Response> => {
  try {
    const { phone, code } = await req.json()

    if (!phone || !code) {
      return new Response(
        JSON.stringify({ error: 'Telefon va kod majburiy' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      return new Response(
        JSON.stringify({ error: 'Kod 6 xonali raqam bo\'lishi kerak' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    const mockUser = {
      id: `user_${phone}`,
      phone: phone,
      created_at: new Date().toISOString()
    }

    const mockSession = {
      access_token: `token_${phone}_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      refresh_token: `refresh_${phone}_${Date.now()}`,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      user: mockUser
    }

    console.log(`User signed in: ${phone}`)

    return new Response(
      JSON.stringify({
        success: true,
        user: mockUser,
        session: mockSession,
        message: 'Muvaffaqiyatli kirdingiz!'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('SMS signin error:', error)
    return new Response(
      JSON.stringify({ error: 'Kirishda xatolik' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
}

// SMS signup handler
const handleSmsSignup = async (req: Request): Promise<Response> => {
  try {
    const { phone, code, firstName, lastName, birthDate, gender } = await req.json()

    if (!phone || !code || !firstName || !lastName) {
      return new Response(
        JSON.stringify({ error: 'Barcha maydonlar majburiy' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      return new Response(
        JSON.stringify({ error: 'Kod 6 xonali raqam bo\'lishi kerak' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    const mockUser = {
      id: `user_${phone}`,
      phone: phone,
      first_name: firstName,
      last_name: lastName,
      birth_date: birthDate || null,
      gender: gender || null,
      created_at: new Date().toISOString()
    }

    const mockSession = {
      access_token: `token_${phone}_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      refresh_token: `refresh_${phone}_${Date.now()}`,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      user: mockUser
    }

    console.log(`User signed up: ${phone} - ${firstName} ${lastName}`)

    return new Response(
      JSON.stringify({
        success: true,
        user: mockUser,
        session: mockSession,
        message: 'Ro\'yxatdan muvaffaqiyatli o\'tdingiz!'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('SMS signup error:', error)
    return new Response(
      JSON.stringify({ error: 'Ro\'yxatdan o\'tishda xatolik' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
}

// User profile handler
const handleUserProfile = async (req: Request): Promise<Response> => {
  try {
    const authHeader = req.headers.get('authorization')
    const tokenHeader = req.headers.get('x-access-token')
    const token = tokenHeader || authHeader?.replace('Bearer ', '')

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token majburiy' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401
        }
      )
    }

    const mockProfile = {
      id: 'user_demo',
      phone: '998123456789',
      first_name: 'Demo',
      last_name: 'User',
      birth_date: '1990-01-01',
      gender: 'male',
      avatar: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    return new Response(
      JSON.stringify(mockProfile),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Profile error:', error)
    return new Response(
      JSON.stringify({ error: 'Profil ma\'lumotlarini olishda xatolik' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
}

// Favorites handler (PUBLIC)
const handleFavorites = async (req: Request): Promise<Response> => {
  try {
    console.log('📚 Favorites request (public)')
    
    // Mock favorites data
    const mockFavorites = [
      {
        id: 'fav_1',
        type: 'product',
        itemId: 'product_1',
        name: 'Mock Product 1',
        price: 299000,
        image: '/mock-images/product1.jpg',
        createdAt: new Date().toISOString()
      },
      {
        id: 'fav_2',
        type: 'branch',
        itemId: 'branch_1',
        name: 'Test Branch 1',
        location: 'Tashkent',
        createdAt: new Date().toISOString()
      }
    ]

    return new Response(
      JSON.stringify({
        success: true,
        favorites: mockFavorites,
        message: 'Favorites loaded (mock)'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Favorites error:', error)
    return new Response(
      JSON.stringify({ error: 'Favorites olishda xatolik' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
}

// Anonymous settings handler
const handleAnonymousSettings = async (req: Request): Promise<Response> => {
  try {
    const body = await req.json()
    
    console.log('👤 Anonymous settings request:', body)

    // Validate required fields
    if (!body || typeof body !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Return success response with received data
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Anonymous settings saved',
        data: body
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Anonymous settings error:', error)
    return new Response(
      JSON.stringify({ error: 'Settings saqlashda xatolik' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
}

// Default error response
const defaultErrorResponse = (): Response => {
  return new Response(
    JSON.stringify({
      error: 'Endpoint topilmadi',
      available_endpoints: [
        '/health',
        '/test-deployment',
        '/public/branches',
        '/auth/sms/send',
        '/auth/sms/signin',
        '/auth/sms/signup',
        '/user/profile',
        '/favorites',
        '/user/anonymous/settings'
      ]
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 404
    }
  )
}

// Main request handler
serve(async (req: Request): Promise<Response> => {
  try {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    const url = new URL(req.url)
    const path = url.pathname.replace('/supabase-edge-function', '')

    console.log(`📍 Request: ${req.method} ${path}`)

    // Route handling
    switch (path) {
      case '/health':
        return healthResponse()

      case '/test-deployment':
        return testDeploymentResponse()

      case '/public/branches':
        return publicBranchesResponse()

      case '/auth/sms/send':
        if (req.method === 'POST') {
          return await handleSmsSend(req)
        }
        break

      case '/auth/sms/signin':
        if (req.method === 'POST') {
          return await handleSmsSignin(req)
        }
        break

      case '/auth/sms/signup':
        if (req.method === 'POST') {
          return await handleSmsSignup(req)
        }
        break

      case '/user/profile':
        if (req.method === 'GET') {
          return await handleUserProfile(req)
        }
        break

      case '/favorites':
        if (req.method === 'GET') {
          return await handleFavorites(req)
        }
        break

      case '/user/anonymous/settings':
        if (req.method === 'POST') {
          return await handleAnonymousSettings(req)
        }
        break

      default:
        return defaultErrorResponse()
    }

    // Handle invalid method for valid routes
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405
      }
    )

  } catch (error) {
    console.error('Server error:', error)
    return new Response(
      JSON.stringify({ error: 'Server xatoligi' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
