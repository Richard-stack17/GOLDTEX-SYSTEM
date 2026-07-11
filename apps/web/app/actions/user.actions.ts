'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function updateUserAuth(userId: string, newPassword?: string) {
  if (!supabaseServiceKey) {
    return { success: false, error: 'SUPABASE_SERVICE_ROLE_KEY no está configurado en el servidor.' };
  }

  try {
    const updateData: any = {};
    if (newPassword) {
      updateData.password = newPassword;
    }

    if (Object.keys(updateData).length > 0) {
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, updateData);
      
      if (error) {
        throw error;
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in updateUserAuth:', error);
    return { success: false, error: error.message || 'Error desconocido al actualizar usuario.' };
  }
}
