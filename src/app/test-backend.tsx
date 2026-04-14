// Test backend health
import { useEffect } from 'react';
import ProductionApiService from '../services/productionApi';

export function TestBackend() {
  useEffect(() => {
    const testBackend = async () => {
      try {
        await ProductionApiService.healthCheck();
      } catch {
        /* health tekshiruvi xatosi — UI da alohida ko‘rsatilmaydi */
      }
    };
    
    testBackend();
  }, []);
  
  return null;
}
