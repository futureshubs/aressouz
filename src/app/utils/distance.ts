// Calculate distance between two coordinates using Haversine formula
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 10) / 10; // Round to 1 decimal
}

// Format distance for display
export function formatDistance(distanceInKm: number): string {
  if (distanceInKm < 1) {
    return `${Math.round(distanceInKm * 1000)} m`;
  }
  return `${distanceInKm.toFixed(1)} km`;
}

// Get user's current location
export async function getUserLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.log('Geolocation is not supported by this browser');
      // Default to Tashkent center
      resolve({ lat: 41.311151, lng: 69.279737 });
      return;
    }

    // Set a timeout in case geolocation takes too long
    const timeout = setTimeout(() => {
      console.log('Geolocation timeout - using default location (Tashkent)');
      resolve({ lat: 41.311151, lng: 69.279737 });
    }, 5000); // 5 seconds timeout

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeout);
        console.log('Location obtained:', position.coords.latitude, position.coords.longitude);
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        clearTimeout(timeout);
        console.log('Geolocation error:', error.message);
        
        // Provide more specific error messages
        switch(error.code) {
          case error.PERMISSION_DENIED:
            console.log('User denied location permission - using default location (Tashkent)');
            break;
          case error.POSITION_UNAVAILABLE:
            console.log('Location information unavailable - using default location (Tashkent)');
            break;
          case error.TIMEOUT:
            console.log('Location request timeout - using default location (Tashkent)');
            break;
          default:
            console.log('Unknown geolocation error - using default location (Tashkent)');
        }
        
        // Default to Tashkent center
        resolve({ lat: 41.311151, lng: 69.279737 });
      },
      {
        enableHighAccuracy: false, // Use false for faster response
        timeout: 4000, // 4 seconds
        maximumAge: 300000 // Accept cached position up to 5 minutes old
      }
    );
  });
}