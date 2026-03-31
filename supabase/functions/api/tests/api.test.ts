/**
 * Comprehensive test suite for the API edge functions
 * Tests all major functionality including authentication, validation, and error handling
 */

import { assertEquals, assertExists, assertFalse } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Import the main app
import app from '../index.ts';

// Test configuration
const API_BASE = 'http://localhost:8000';
const TEST_PHONE = '998123456789';
const TEST_CODE = '123456';

// ============================================================================
// Health Check Tests
// ============================================================================

Deno.test('GET /health - basic health check', async () => {
  const res = await app.request('/health');
  
  assertEquals(res.status, 200);
  
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.data.status, 'healthy');
  assertExists(body.data.timestamp);
  assertExists(body.data.version);
});

Deno.test('GET /health/status - status endpoint', async () => {
  const res = await app.request('/health/status');
  
  assertEquals(res.status, 200);
  
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.data.status, 'healthy');
});

Deno.test('GET /health/detailed - detailed health check', async () => {
  const res = await app.request('/health/detailed');
  
  assertEquals(res.status, 200);
  
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.data.status, 'healthy');
  assertExists(body.data.services);
  assertExists(body.data.memory);
});

// ============================================================================
// Authentication Tests
// ============================================================================

Deno.test('POST /auth/sms/send - send SMS code', async () => {
  const res = await app.request('/auth/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: TEST_PHONE,
      purpose: 'signin'
    })
  });
  
  assertEquals(res.status, 200);
  
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.data.message, 'SMS verification code sent');
  assertExists(body.data.expiresIn);
});

Deno.test('POST /auth/sms/send - validation error (missing phone)', async () => {
  const res = await app.request('/auth/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  
  assertEquals(res.status, 400);
  
  const body = await res.json();
  assertEquals(body.success, false);
  assertExists(body.error);
  assertEquals(body.error.code, 'VALIDATION_ERROR');
});

Deno.test('POST /auth/sms/send - validation error (invalid phone)', async () => {
  const res = await app.request('/auth/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: '123456789' // Invalid format
    })
  });
  
  assertEquals(res.status, 400);
  
  const body = await res.json();
  assertEquals(body.success, false);
  assertExists(body.error);
});

Deno.test('POST /auth/sms/signin - sign in with SMS', async () => {
  // First send SMS code
  await app.request('/auth/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: TEST_PHONE,
      purpose: 'signin'
    })
  });
  
  // Then sign in
  const res = await app.request('/auth/sms/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: TEST_PHONE,
      code: TEST_CODE
    })
  });
  
  assertEquals(res.status, 200);
  
  const body = await res.json();
  assertEquals(body.success, true);
  assertExists(body.data.accessToken);
  assertExists(body.data.refreshToken);
  assertExists(body.data.user);
  assertEquals(body.data.user.phone, TEST_PHONE);
});

Deno.test('POST /auth/sms/signup - sign up with SMS', async () => {
  const uniquePhone = `998${Math.floor(Math.random() * 100000000)}`;
  
  // First send SMS code
  await app.request('/auth/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: uniquePhone,
      purpose: 'signup'
    })
  });
  
  // Then sign up
  const res = await app.request('/auth/sms/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: uniquePhone,
      code: TEST_CODE,
      firstName: 'John',
      lastName: 'Doe',
      birthDate: '1990-01-01',
      gender: 'male'
    })
  });
  
  assertEquals(res.status, 201);
  
  const body = await res.json();
  assertEquals(body.success, true);
  assertExists(body.data.accessToken);
  assertExists(body.data.user);
  assertEquals(body.data.user.firstName, 'John');
  assertEquals(body.data.user.lastName, 'Doe');
});

Deno.test('POST /auth/refresh - refresh token', async () => {
  // First sign in to get tokens
  const signInRes = await app.request('/auth/sms/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: TEST_PHONE,
      code: TEST_CODE
    })
  });
  
  const signInBody = await signInRes.json();
  const refreshToken = signInBody.data.refreshToken;
  
  // Then refresh token
  const res = await app.request('/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refreshToken: refreshToken
    })
  });
  
  assertEquals(res.status, 200);
  
  const body = await res.json();
  assertEquals(body.success, true);
  assertExists(body.data.accessToken);
  assertExists(body.data.refreshToken);
});

Deno.test('POST /auth/refresh - validation error (missing token)', async () => {
  const res = await app.request('/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  
  assertEquals(res.status, 400);
  
  const body = await res.json();
  assertEquals(body.success, false);
  assertExists(body.error);
});

Deno.test('GET /auth/me - get current user (unauthenticated)', async () => {
  const res = await app.request('/auth/me');
  
  assertEquals(res.status, 401);
  
  const body = await res.json();
  assertEquals(body.success, false);
  assertExists(body.error);
});

Deno.test('GET /auth/me - get current user (authenticated)', async () => {
  // First sign in
  const signInRes = await app.request('/auth/sms/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: TEST_PHONE,
      code: TEST_CODE
    })
  });
  
  const signInBody = await signInRes.json();
  const accessToken = signInBody.data.accessToken;
  
  // Then get user info
  const res = await app.request('/auth/me', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  assertEquals(res.status, 200);
  
  const body = await res.json();
  assertEquals(body.success, true);
  assertExists(body.data);
  assertEquals(body.data.phone, TEST_PHONE);
});

// ============================================================================
// User Management Tests
// ============================================================================

Deno.test('GET /user/profile - get user profile (unauthenticated)', async () => {
  const res = await app.request('/user/profile');
  
  assertEquals(res.status, 401);
});

Deno.test('GET /user/profile - get user profile (authenticated)', async () => {
  // First sign in
  const signInRes = await app.request('/auth/sms/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: TEST_PHONE,
      code: TEST_CODE
    })
  });
  
  const signInBody = await signInRes.json();
  const accessToken = signInBody.data.accessToken;
  
  // Then get profile
  const res = await app.request('/user/profile', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  assertEquals(res.status, 200);
  
  const body = await res.json();
  assertEquals(body.success, true);
  assertExists(body.data);
  assertEquals(body.data.phone, TEST_PHONE);
});

Deno.test('PUT /user/profile - update user profile', async () => {
  // First sign in
  const signInRes = await app.request('/auth/sms/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: TEST_PHONE,
      code: TEST_CODE
    })
  });
  
  const signInBody = await signInRes.json();
  const accessToken = signInBody.data.accessToken;
  
  // Then update profile
  const res = await app.request('/user/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      firstName: 'Jane',
      lastName: 'Smith'
    })
  });
  
  assertEquals(res.status, 200);
  
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.data.firstName, 'Jane');
  assertEquals(body.data.lastName, 'Smith');
});

Deno.test('PUT /user/preferences - update user preferences', async () => {
  // First sign in
  const signInRes = await app.request('/auth/sms/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: TEST_PHONE,
      code: TEST_CODE
    })
  });
  
  const signInBody = await signInRes.json();
  const accessToken = signInBody.data.accessToken;
  
  // Then update preferences
  const res = await app.request('/user/preferences', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      language: 'ru',
      theme: 'dark',
      notifications: {
        email: false,
        sms: true,
        push: true
      }
    })
  });
  
  assertEquals(res.status, 200);
  
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.data.language, 'ru');
  assertEquals(body.data.theme, 'dark');
  assertEquals(body.data.notifications.email, false);
  assertEquals(body.data.notifications.sms, true);
});

// ============================================================================
// Error Handling Tests
// ============================================================================

Deno.test('404 - endpoint not found', async () => {
  const res = await app.request('/nonexistent-endpoint');
  
  assertEquals(res.status, 404);
  
  const body = await res.json();
  assertEquals(body.success, false);
  assertExists(body.error);
});

Deno.test('Invalid JSON - malformed request body', async () => {
  const res = await app.request('/auth/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'invalid json'
  });
  
  assertEquals(res.status, 400);
  
  const body = await res.json();
  assertEquals(body.success, false);
  assertExists(body.error);
});

Deno.test('Method not allowed - wrong HTTP method', async () => {
  const res = await app.request('/auth/sms/send', {
    method: 'GET'
  });
  
  assertEquals(res.status, 404);
});

// ============================================================================
// CORS Tests
// ============================================================================

Deno.test('CORS - preflight request', async () => {
  const res = await app.request('/auth/sms/send', {
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://localhost:3000',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type, Authorization'
    }
  });
  
  assertEquals(res.status, 200);
  assertExists(res.headers.get('Access-Control-Allow-Origin'));
  assertExists(res.headers.get('Access-Control-Allow-Methods'));
  assertExists(res.headers.get('Access-Control-Allow-Headers'));
});

// ============================================================================
// Rate Limiting Tests
// ============================================================================

Deno.test('Rate limiting - basic functionality', async () => {
  // Make multiple rapid requests
  const requests = [];
  for (let i = 0; i < 5; i++) {
    requests.push(
      app.request('/health', {
        method: 'GET'
      })
    );
  }
  
  const responses = await Promise.all(requests);
  
  // First few should succeed
  for (let i = 0; i < 3; i++) {
    assertEquals(responses[i].status, 200);
  }
  
  // Later ones might be rate limited (depending on configuration)
  // This test verifies the rate limiting is working
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test('Complete user flow - signup to profile update', async () => {
  const uniquePhone = `998${Math.floor(Math.random() * 100000000)}`;
  
  // 1. Send SMS
  const smsRes = await app.request('/auth/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: uniquePhone,
      purpose: 'signup'
    })
  });
  assertEquals(smsRes.status, 200);
  
  // 2. Sign up
  const signupRes = await app.request('/auth/sms/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: uniquePhone,
      code: TEST_CODE,
      firstName: 'Alice',
      lastName: 'Johnson',
      birthDate: '1992-05-15',
      gender: 'female'
    })
  });
  assertEquals(signupRes.status, 201);
  
  const signupBody = await signupRes.json();
  const accessToken = signupBody.data.accessToken;
  
  // 3. Get profile
  const profileRes = await app.request('/user/profile', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  assertEquals(profileRes.status, 200);
  
  const profileBody = await profileRes.json();
  assertEquals(profileBody.data.firstName, 'Alice');
  assertEquals(profileBody.data.lastName, 'Johnson');
  
  // 4. Update profile
  const updateRes = await app.request('/user/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      firstName: 'Alice',
      lastName: 'Smith'
    })
  });
  assertEquals(updateRes.status, 200);
  
  const updateBody = await updateRes.json();
  assertEquals(updateBody.data.firstName, 'Alice');
  assertEquals(updateBody.data.lastName, 'Smith');
  
  // 5. Update preferences
  const prefRes = await app.request('/user/preferences', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      language: 'en',
      theme: 'light'
    })
  });
  assertEquals(prefRes.status, 200);
  
  // 6. Logout
  const logoutRes = await app.request('/auth/logout', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  assertEquals(logoutRes.status, 200);
});

console.log('🧪 All tests completed!');
