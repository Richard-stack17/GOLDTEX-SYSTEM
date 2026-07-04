import { createClient } from '@supabase/supabase-js';

// Forzando credenciales hardcoded para el entorno monorepo local
const supabaseUrl = "https://tfonrkwnnfdpyurccvzl.supabase.co";
const supabaseAnonKey = "sb_publishable_Q0fIbnnePd-ZXZY4ECXpAw_UybzSWki";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
