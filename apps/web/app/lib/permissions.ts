import { supabase } from './supabase';
import { db } from './localDb';

export async function hasPermission(roleName: string | null | undefined, permissionKey: string) {
  if (!roleName) return false;
  
  // Try to get role from local DB first (Dexie)
  try {
    const localRole = await db.roles.where('name').equals(roleName).first();
    if (localRole && localRole.permissions) {
      // Si el rol tiene el permiso en true, permitir
      return Boolean(localRole.permissions[permissionKey]);
    }
  } catch (e) {
    console.error('Error reading role from localDB, falling back to Supabase', e);
  }

  // Fallback to Supabase if localDB fails or role not found
  const { data, error } = await supabase
    .from('roles')
    .select('permissions')
    .eq('name', roleName)
    .single();

  if (error || !data || !data.permissions) {
    return false;
  }

  return Boolean(data.permissions[permissionKey]);
}

// Keep backwards compatibility for a bit if needed, mapping old module checks to new permission keys
export async function hasModuleAccess(roleName: string | null | undefined, moduleName: string) {
  // Map module to permission key
  const moduleToPerm: Record<string, string> = {
    'pos': 'access_pos',
    'dashboard': 'access_dashboard',
    'personal': 'access_personal',
    'inventory': 'access_inventory',
    'settings': 'access_settings',
    'history': 'access_caja',
    'caja': 'access_caja',
    'contabilidad': 'access_contabilidad',
    'clientes': 'access_clientes',
    'proformas': 'access_proformas'
  };
  
  const permKey = moduleToPerm[moduleName] || `access_${moduleName}`;
  return hasPermission(roleName, permKey);
}
