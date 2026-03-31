// Test backend health
import { useEffect } from 'react';
import ProductionApiService from '../services/productionApi';

export function TestBackend() {
  useEffect(() => {
    const testBackend = async () => {
      try {
        console.log('🧪 Testing Production API health...');
        
        const response = await ProductionApiService.healthCheck();
        
        if (response.success) {
          console.log('✅ Production API is healthy!', response.data);
        } else {
          console.error('❌ Production API health check failed:', response.error);
        }
      } catch (error) {
        console.error('❌ Production API connection error:', error);
      }
    };
    
    testBackend();
  }, []);
  
  return null;
}
