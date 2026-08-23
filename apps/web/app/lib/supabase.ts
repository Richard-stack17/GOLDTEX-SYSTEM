import { createClient } from '@supabase/supabase-js';

// Forzando credenciales hardcoded para el entorno monorepo local
const supabaseUrl = "https://tfonrkwnnfdpyurccvzl.supabase.co";
const supabaseAnonKey = "sb_publishable_Q0fIbnnePd-ZXZY4ECXpAw_UybzSWki";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Crítico para Capacitor: el esquema capacitor:// no tiene fragmentos de hash de sesión
    // Sin esto, Supabase intenta detectar el token en la URL y puede disparar SIGNED_OUT espurio
    detectSessionInUrl: false,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});
