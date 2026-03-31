/**
 * User ID Management System
 * - Authenticated users: use their Supabase user ID
 * - Anonymous users: use device ID stored in localStorage
 * - Data migration: when user logs in, migrate anonymous data to their account
 */

/**
 * Get or create device ID for anonymous users
 */
export function getDeviceId(): string {
  let deviceId = localStorage.getItem('device_id');
  
  if (!deviceId) {
    // Generate unique device ID
    deviceId = `device-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('device_id', deviceId);
    console.log('📱 New device ID created:', deviceId);
  }
  
  return deviceId;
}

/**
 * Get current user ID (authenticated or anonymous)
 */
export function getUserId(authenticatedUserId?: string | null): string {
  if (authenticatedUserId) {
    console.log('👤 Using authenticated user ID:', authenticatedUserId);
    return authenticatedUserId;
  }
  
  const deviceId = getDeviceId();
  console.log('📱 Using device ID:', deviceId);
  return deviceId;
}

/**
 * Check if user is anonymous
 */
export function isAnonymousUser(userId: string): boolean {
  return userId.startsWith('device-');
}
