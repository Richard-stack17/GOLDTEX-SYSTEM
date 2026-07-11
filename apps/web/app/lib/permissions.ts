import { supabase } from './supabase';

export async function hasModuleAccess(role: string | null | undefined, moduleName: string) {
  if (!role) return false;
  if (role === 'ADMIN') return true;

  const { data, error } = await supabase
    .from('roles_permissions')
    .select('can_access')
    .eq('role', role)
    .eq('module', moduleName)
    .single();

  if (error) {
    return false;
  }

  return Boolean(data?.can_access);
}
