export type Platform = 'ios' | 'android';

export function detectPlatform(): Platform {
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (userAgent.includes('iphone') || userAgent.includes('ipad') || userAgent.includes('mac')) {
    return 'ios';
  }
  
  return 'android';
}
