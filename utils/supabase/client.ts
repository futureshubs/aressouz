import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './info';

console.log('🔧 Supabase Client Initialization:');
console.log('  Project ID:', projectId);
console.log('  Supabase URL:', `https://${projectId}.supabase.co`);
console.log('  Anon Key (length):', publicAnonKey.length);
console.log('  Anon Key (first 60):', publicAnonKey.substring(0, 60));

// Singleton Supabase client with unique storage key to avoid multiple instances
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!supabaseInstance) {
    const supabaseUrl = `https://${projectId}.supabase.co`;
    
    supabaseInstance = createClient(
      supabaseUrl,
      publicAnonKey,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          // Use unique storage key to avoid multiple instance warnings
          storageKey: `sb-${projectId}-auth-token`,
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        }
      }
    );
    console.log('✅ Supabase client created successfully');
    console.log('   URL:', supabaseUrl);
    console.log('   Storage key:', `sb-${projectId}-auth-token`);
  }
  return supabaseInstance;
}

export const supabase = getSupabaseClient();