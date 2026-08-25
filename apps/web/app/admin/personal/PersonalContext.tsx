'use client';

import React, { useState, useEffect, useMemo, useCallback, createContext, useContext, ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Users, UserPlus, ShieldAlert,
  CheckCircle2, RefreshCw, KeyRound, Plus,
  ShieldCheck, UserCog, Edit2, X, Trash2, Check, XCircle,
  ShoppingCart, PackageSearch, BarChart3, Banknote, FileSpreadsheet, Contact, ScrollText, Settings, Shield, Save, Loader2, Lock, Info, RotateCcw,
  Eye, EyeOff, ArrowUpDown
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useRole } from '../../context/RoleContext';
import { useStore } from '../../context/StoreContext';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import bcrypt from 'bcryptjs';
import { PERMISSION_GROUPS } from './types';

// ─── Types ────────────────────────────────────────────────────────────────────
type Employee = {
  id: string;
  full_name: string;
  dni: string;
  phone?: string;
  is_active?: boolean;
  created_at: string;
  employee_stores?: { store_id: string; role?: string; role_id?: string | null; stores: { name: string } }[];
};

type Profile = {
  id: string;
  username: string;
  role: string;
  role_id?: string | null;
  employee_id: string | null;
  email: string | null;
  default_store_id?: string | null;
  stores?: { name: string }[] | null;
  employee_stores?: any[];
};

type Tab = 'empleados' | 'usuarios' | 'roles';

type Role = {
  id: string;
  name: string;
  description: string | null;
  permissions: any;
  is_system: boolean;
  store_id?: string | null;
  is_active?: boolean;
  stores?: { name: string; is_active: boolean };
};

// ─── Constants ────────────────────────────────────────────────────────────────


// ─── Toast helper ─────────────────────────────────────────────────────────────
function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-2xl font-bold text-sm opacity-100 animate-in fade-in slide-in-from-bottom-4 ${type === 'success'
      ? 'bg-emerald-600 text-white border-emerald-700'
      : 'bg-red-600 text-white border-red-700'
      }`}>
      {type === 'success'
        ? <CheckCircle2 className="w-5 h-5 shrink-0 text-white" />
        : <ShieldAlert className="w-5 h-5 shrink-0 text-white" />}
      <span>{message}</span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────


const PersonalContext = createContext<any>(null);

export function PersonalProvider({ children }: { children: ReactNode }) {
  const { role, isHydrated, permissions } = useRole();
  const { availableStores, activeStoreId, isGlobalUser, availableStoreIds } = useStore();
  const router = useRouter();

  const isAdmin = role === 'ADMIN';
  const isUserGlobalAdmin = isAdmin || isGlobalUser;

  const [activeTab, setActiveTab] = useState<Tab>('empleados');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const employeeById = useMemo(() => {
    return Object.fromEntries(employees.map(emp => [emp.id, emp]));
  }, [employees]);
  const storeMap = useMemo(() => {
    return new Map(availableStores.map(s => [s.id, s.name]));
  }, [availableStores]);

  const checkCanManageTarget = useCallback((targetProfile?: Profile | null, targetEmp?: Employee | null): boolean => {
    if (isAdmin) return true;

    const isTargetAdmin = targetProfile?.role === 'ADMIN';
    const targetStoreCount = (targetProfile?.employee_stores?.length || 0) + (targetEmp?.employee_stores?.length || 0);
    const hasSpecificStore = Boolean(targetProfile?.default_store_id || targetStoreCount > 0);
    const isTargetGlobalScope = !hasSpecificStore;
    const isTargetProtected = isTargetAdmin || isTargetGlobalScope;

    if (isTargetProtected) return false;

    const isSameStoreTarget = activeStoreId
      ? (targetProfile?.default_store_id === activeStoreId || 
         targetProfile?.employee_stores?.some((es: any) => es.store_id === activeStoreId) ||
         targetEmp?.employee_stores?.some(es => es.store_id === activeStoreId))
      : Boolean(
          (targetProfile?.default_store_id && availableStoreIds.includes(targetProfile.default_store_id)) ||
          targetProfile?.employee_stores?.some((es: any) => availableStoreIds.includes(es.store_id)) ||
          targetEmp?.employee_stores?.some(es => availableStoreIds.includes(es.store_id))
        );

    return Boolean(isSameStoreTarget);
  }, [isAdmin, activeStoreId, availableStoreIds]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);  // includes inactive
  const [showInactiveRoles, setShowInactiveRoles] = useState(false);
  const [showInactiveEmployees, setShowInactiveEmployees] = useState(false);
  const [showInactiveUsers, setShowInactiveUsers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ── Empleados form state
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [dni, setDni] = useState('');
  const [phone, setPhone] = useState('');
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [createAccess, setCreateAccess] = useState(false);

  // Campos extra si createAccess es true:
  const [empUsername, setEmpUsername] = useState('');
  const [empPassword, setEmpPassword] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empStoreIds, setEmpStoreIds] = useState<string[]>([]);
  const [empStoreRoles, setEmpStoreRoles] = useState<Record<string, string>>({});
  const [empStoreRoleIds, setEmpStoreRoleIds] = useState<Record<string, string>>({});
  const [showEmpPassword, setShowEmpPassword] = useState(false);
  const [showUserPassword, setShowUserPassword] = useState(false);
  const [selectedModalStoreId, setSelectedModalStoreId] = useState<string>('');

  const targetModalStoreId = activeStoreId || selectedModalStoreId || availableStores[0]?.id || '';

  // ── Usuarios form state (Crear / Editar)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [userStoreRoles, setUserStoreRoles] = useState<Record<string, string>>({});
  const [userStoreRoleIds, setUserStoreRoleIds] = useState<Record<string, string>>({});
  const [savingUser, setSavingUser] = useState(false);
  const [modalResetToken, setModalResetToken] = useState(0);

  // ── Access Scope states (Sucursales vs Global)
  const [empAccessScope, setEmpAccessScope] = useState<'stores' | 'global'>('stores');
  const [empGlobalRole, setEmpGlobalRole] = useState('ADMIN');
  const [userAccessScope, setUserAccessScope] = useState<'stores' | 'global'>('stores');
  const [userGlobalRole, setUserGlobalRole] = useState('ADMIN');
  const [confirmGlobalAccess, setConfirmGlobalAccess] = useState(false);

  const globalRoles = useMemo(() => {
    const list = roles.filter(r => r.store_id === null || r.is_system || r.name === 'ADMIN');
    if (!list.some(r => r.name === 'ADMIN')) {
      return [{ id: 'admin-fallback', name: 'ADMIN' }, ...list];
    }
    return list;
  }, [roles]);

  // Helper to ensure local store roles never default or remain 'ADMIN'
  const getValidStoreRole = (roleName: string | null | undefined, storeId: string) => {
    if (roleName && roleName !== 'ADMIN') return roleName;
    const storeAvailableRoles = roles.filter(r => r.name !== 'ADMIN' && (r.store_id === storeId || !r.store_id));
    const mostradorOrCajero = storeAvailableRoles.find(r => r.name === 'MOSTRADOR') || storeAvailableRoles.find(r => r.name === 'CAJERO');
    return mostradorOrCajero?.name || storeAvailableRoles[0]?.name || 'MOSTRADOR';
  };

  // ── Soft-delete user state
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deletingUsername, setDeletingUsername] = useState('');
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // ── Link Employee Modal state
  const [linkingEmployee, setLinkingEmployee] = useState<Employee | null>(null);
  const [linkMode, setLinkMode] = useState<'new' | 'existing'>('new');
  const [linkExistingUserId, setLinkExistingUserId] = useState('');
  const [linkRoleId, setLinkRoleId] = useState<string>('');
  const [isLinking, setIsLinking] = useState(false);

  // Auto-complete and block selectedStoreIds and userStoreRoles when selectedEmpId changes
  useEffect(() => {
    if (selectedEmpId) {
      const emp = employeeById[selectedEmpId];
      const prof = allProfiles.find(p => p.employee_id === selectedEmpId && p.role !== 'DELETED');
      if (prof?.role === 'ADMIN' || (prof && !prof.default_store_id && (!emp?.employee_stores || emp.employee_stores.length === 0))) {
        setUserAccessScope('global');
        setUserGlobalRole(prof.role || 'ADMIN');
      } else if (emp && emp.employee_stores && emp.employee_stores.length > 0) {
        setUserAccessScope('stores');
        const ids = emp.employee_stores.map(es => es.store_id);
        const rolesMap: Record<string, string> = {};
        const roleIdsMap: Record<string, string> = {};
        emp.employee_stores.forEach(es => {
          const rawRole = (es as any).role;
          rolesMap[es.store_id] = getValidStoreRole(rawRole, es.store_id);
          if ((es as any).role_id) {
            roleIdsMap[es.store_id] = (es as any).role_id;
          } else {
            const matchedRole = roles.find(r => r.name === rawRole && r.store_id === es.store_id)
              || roles.find(r => r.name === rawRole && !r.store_id);
            if (matchedRole) roleIdsMap[es.store_id] = matchedRole.id;
          }
        });
        setSelectedStoreIds(ids);
        setUserStoreRoles(rolesMap);
        setUserStoreRoleIds(roleIdsMap);
      }
    }
  }, [selectedEmpId, employeeById, allProfiles, roles]);

  // ── Roles state
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRoleScopeStoreId, setNewRoleScopeStoreId] = useState('');
  const [savingRole, setSavingRole] = useState(false);

  // ── Edit Role state
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editRoleName, setEditRoleName] = useState('');
  const [editRoleDesc, setEditRoleDesc] = useState('');
  const [isEditRoleModalOpen, setIsEditRoleModalOpen] = useState(false);
  const [savingEditRole, setSavingEditRole] = useState(false);

  // ── Manage Perms state
  const [isManagePermsModalOpen, setIsManagePermsModalOpen] = useState(false);
  const [managingPermsRoleId, setManagingPermsRoleId] = useState<string | null>(null);

  // ── Role Deletion & Warning Modal state
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);
  const [roleAssignedUsers, setRoleAssignedUsers] = useState<Profile[]>([]);
  const [isRoleWarningModalOpen, setIsRoleWarningModalOpen] = useState(false);
  const [isRoleConfirmModalOpen, setIsRoleConfirmModalOpen] = useState(false);
  const [isDeletingRole, setIsDeletingRole] = useState(false);

  // ── Employee Deletion Modal state
  const [deletingEmployee, setDeletingEmployee] = useState<{ id: string; name: string } | null>(null);

  // ── Employee Unlink Modal state
  const [unlinkingEmployee, setUnlinkingEmployee] = useState<{ empId: string; name: string; profileId: string } | null>(null);

  // ── Draft Permissions State
  const [originalRoles, setOriginalRoles] = useState<Role[]>([]);
  const [hasUnsavedRoleChanges, setHasUnsavedRoleChanges] = useState(false);
  const [showRoleExitConfirm, setShowRoleExitConfirm] = useState(false);
  const [pendingTab, setPendingTab] = useState<Tab | null>(null);
  const [savingPermissions, setSavingPermissions] = useState(false);

  const handleDeleteUser = async () => {
    if (!deletingUserId) return;
    const targetProfile = allProfiles.find(p => p.id === deletingUserId);
    const targetEmp = targetProfile?.employee_id ? employeeById[targetProfile.employee_id] : null;
    if (!checkCanManageTarget(targetProfile, targetEmp)) {
      showToast('Solo puedes modificar personal asignado a tu misma sucursal local', 'error');
      return;
    }
    setIsDeletingUser(true);
    try {
      // 1. Marcar como DELETED y desvincular del empleado atómicamente
      const { error } = await supabase
        .from('profiles')
        .update({
          role: 'DELETED',
          role_id: null,
          employee_id: null,
          default_store_id: null
        })
        .eq('id', deletingUserId);

      if (error) throw error;

      // 2. Eliminar tiendas asignadas del perfil eliminado
      await supabase.from('employee_stores').delete().eq('profile_id', deletingUserId);

      showToast('Acceso deshabilitado correctamente', 'success');
      loadData();
    } catch (err: any) {
      showToast(formatFriendlyErrorMessage(err, 'Error al deshabilitar acceso'), 'error');
    } finally {
      setIsDeletingUser(false);
      setDeletingUserId(null);
    }
  };

  const handleRestoreUser = async (profileId: string) => {
    const targetProfile = allProfiles.find(p => p.id === profileId);
    const targetEmp = targetProfile?.employee_id ? employeeById[targetProfile.employee_id] : null;
    if (!checkCanManageTarget(targetProfile, targetEmp)) {
      showToast('Solo puedes modificar personal asignado a tu misma sucursal local', 'error');
      return;
    }
    try {
      const { error } = await supabase.from('profiles').update({ role: 'CAJERO' }).eq('id', profileId);
      if (error) throw error;
      showToast('Acceso reactivado correctamente. Puedes asignarle un rol específico desde Editar.', 'success');
      loadData();
    } catch (err: any) {
      showToast(formatFriendlyErrorMessage(err, 'Error al reactivar el usuario'), 'error');
    }
  };

  const handleRestoreEmployee = async (empId: string) => {
    const targetEmp = employeeById[empId] || employees.find(e => e.id === empId);
    const targetProfile = allProfiles.find(p => p.employee_id === empId);
    if (!checkCanManageTarget(targetProfile, targetEmp)) {
      showToast('Solo puedes modificar personal asignado a tu misma sucursal local', 'error');
      return;
    }
    try {
      const { error } = await supabase.from('employees').update({ is_active: true }).eq('id', empId);
      if (error) throw error;
      showToast('Empleado reactivado correctamente', 'success');
      loadData();
    } catch (err: any) {
      showToast(formatFriendlyErrorMessage(err, 'Error al reactivar el empleado'), 'error');
    }
  };

  // ── Load data
  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: empData, error: empErr }, { data: profData, error: profErr }, { data: rolesData, error: rolesErr }] = await Promise.all([
        supabase.from('employees').select('*, employee_stores(store_id, role, stores(name))').order('full_name', { ascending: true }),
        supabase.from('profiles').select('id, username, role, employee_id, email, default_store_id, stores(name), employee_stores(store_id, role, stores(name))'),
        supabase.from('roles').select('*, stores(name, is_active)').order('created_at', { ascending: true }),
      ]);

      if (empErr) throw empErr;
      if (profErr) throw profErr;
      if (rolesErr) throw rolesErr;

      const allFetchedRoles = (rolesData ?? []).filter((r: any) =>
        r.store_id === null || r.stores?.is_active === true
      );
      const activeRoles = allFetchedRoles.filter((r: any) => r.is_active !== false);
      setAllRoles(allFetchedRoles);
      setRoles(activeRoles);
      setOriginalRoles(activeRoles);
      setHasUnsavedRoleChanges(false);

      setEmployees(empData ?? []);
      setAllProfiles(profData ?? []);
    } catch (err: any) {
      showToast(err.message || 'Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatFriendlyErrorMessage = (err: any, defaultMsg: string = 'Ocurrió un error en el sistema'): string => {
    if (!err) return defaultMsg;
    const msg = typeof err === 'string' ? err : (err.message || '');
    const code = err.code || '';
    if (
      code === '23505' ||
      msg.includes('23505') ||
      msg.includes('unique constraint') ||
      msg.includes('roles_name_store_id_key') ||
      msg.includes('duplicate key value')
    ) {
      if (msg.includes('roles') || msg.includes('roles_name_store_id_key') || msg.includes('rol')) {
        return 'Ya existe un rol activo con este nombre en el ámbito seleccionado.';
      }
      if (msg.includes('profiles') || msg.includes('username')) {
        return 'El nombre de usuario ya está registrado en el sistema.';
      }
      return 'Ya existe un registro activo con este nombre en el ámbito seleccionado.';
    }
    return msg || defaultMsg;
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    setSavingRole(true);
    try {
      const name = newRoleName.trim().toUpperCase();
      let scopeId = newRoleScopeStoreId ? newRoleScopeStoreId : null;
      if (!isUserGlobalAdmin) {
        if (!scopeId) scopeId = activeStoreId || null;
        if (scopeId === null) {
          throw new Error("No tienes permisos para crear roles globales.");
        }
      }
      const duplicate = roles.find(r => r.name === name && r.store_id === scopeId && r.is_active !== false);
      if (duplicate) {
        throw new Error(`Ya existe un rol activo con el nombre "${name}" en este ámbito.`);
      }
      const { error } = await supabase.from('roles').insert({
        name,
        description: newRoleDesc.trim(),
        permissions: {},
        is_system: false,
        store_id: scopeId
      });
      if (error) throw error;
      showToast('Rol creado correctamente', 'success');
      setIsRoleModalOpen(false);
      setNewRoleName('');
      setNewRoleDesc('');
      setNewRoleScopeStoreId('');
      loadData();
    } catch (err: any) {
      showToast(formatFriendlyErrorMessage(err, 'Error al crear el rol'), 'error');
    } finally {
      setSavingRole(false);
    }
  };

  const handleSaveEditRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole || !editRoleName.trim()) return;
    if (editingRole.name === 'ADMIN') {
      showToast('El rol ADMIN es un rol protegido y no se puede editar', 'error');
      return;
    }
    setSavingEditRole(true);
    try {
      const newName = editRoleName.trim().toUpperCase();
      const oldName = editingRole.name;
      const newDesc = editRoleDesc.trim();

      if (newName !== oldName) {
        const duplicate = roles.find(r => r.name === newName && r.store_id === editingRole.store_id && r.is_active !== false);
        if (duplicate) {
          throw new Error(`Ya existe un rol activo con el nombre "${newName}" en este ámbito.`);
        }
      }

      // 1. Actualizar en Supabase la tabla roles
      const { error: roleErr } = await supabase
        .from('roles')
        .update({ name: newName, description: newDesc })
        .eq('id', editingRole.id);
      if (roleErr) throw roleErr;

      // 2. Si se cambió el nombre, actualizar en cascada todos los perfiles asociados
      if (newName !== oldName) {
        const { error: profErr } = await supabase
          .from('profiles')
          .update({ role: newName })
          .eq('role', oldName);
        if (profErr) throw profErr;
      }

      showToast(`Rol "${oldName}" actualizado a "${newName}" correctamente`, 'success');
      setIsEditRoleModalOpen(false);
      setEditingRole(null);
      loadData();
    } catch (err: any) {
      showToast(formatFriendlyErrorMessage(err, 'Error al actualizar el rol'), 'error');
    } finally {
      setSavingEditRole(false);
    }
  };

  const handleDeleteRole = (roleToDelete: Role) => {
    if (roleToDelete.name === 'ADMIN') {
      showToast('El rol ADMIN es un rol de sistema protegido y no puede ser eliminado', 'error');
      return;
    }

    // 1. Obtener usuarios asignados por role_id (UUID) o por nombre/tienda
    const assigned = allProfiles.filter(p => {
      const profileMatchesId = p.role_id === roleToDelete.id;
      const empStoresMatchId = p.employee_stores?.some(es => es.role_id === roleToDelete.id);

      if (profileMatchesId || empStoresMatchId) return true;

      if (roleToDelete.store_id) {
        // Rol Local por coincidencia de texto
        const hasAsDefault = p.role === roleToDelete.name && p.default_store_id === roleToDelete.store_id;
        const hasInStores = p.employee_stores?.some(es =>
          es.store_id === roleToDelete.store_id &&
          (es.role === roleToDelete.name || (!es.role && p.role === roleToDelete.name))
        );
        return hasAsDefault || hasInStores;
      } else {
        // Rol Global por coincidencia de texto
        return p.role === roleToDelete.name || p.employee_stores?.some(es => es.role === roleToDelete.name);
      }
    });
    setDeletingRole(roleToDelete);

    // 2. Si tiene usuarios asignados, abrir modal de advertencia detallado
    if (assigned.length > 0) {
      setRoleAssignedUsers(assigned);
      setIsRoleWarningModalOpen(true);
    } else {
      // 3. Si tiene 0 usuarios, abrir modal de confirmación
      setIsRoleConfirmModalOpen(true);
    }
  };

  const confirmDeleteRole = async () => {
    if (!deletingRole) return;
    setIsDeletingRole(true);
    try {
      const { error } = await supabase.from('roles').update({ is_active: false }).eq('id', deletingRole.id);
      if (error) throw error;
      showToast(`Rol "${deletingRole.name}" eliminado correctamente`, 'success');
      setIsRoleConfirmModalOpen(false);
      setDeletingRole(null);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Error al eliminar el rol', 'error');
    } finally {
      setIsDeletingRole(false);
    }
  };

  const handleRestoreRole = async (roleId: string, roleName: string) => {
    try {
      const roleToRestore = roles.find(r => r.id === roleId);
      if (roleToRestore) {
        const duplicate = roles.find(r => r.name === roleName && r.store_id === roleToRestore.store_id && r.is_active !== false && r.id !== roleId);
        if (duplicate) {
          throw new Error(`No se puede reactivar. Ya existe otro rol activo con el nombre "${roleName}" en este ámbito.`);
        }
      }

      const { error } = await supabase.from('roles').update({ is_active: true }).eq('id', roleId);
      if (error) throw error;
      showToast(`Rol "${roleName}" reactivado correctamente`, 'success');
      loadData();
    } catch (err: any) {
      showToast(formatFriendlyErrorMessage(err, 'Error al reactivar el rol'), 'error');
    }
  };

  const handleTogglePermission = (roleId: string, currentPerms: Record<string, boolean>, permKey: string, newValue: boolean) => {
    let updatedPerms = { ...currentPerms, [permKey]: newValue };

    // Si se está APAGANDO un permiso principal, apagar también sus sub-permisos
    if (!newValue) {
      const group = PERMISSION_GROUPS.find((g: any) => g.mainKey === permKey);
      if (group && group.subPermissions) {
        group.subPermissions.forEach((sub: any) => {
          updatedPerms[sub.key] = false;
        });
      }
    }

    setRoles(prev => prev.map(r => r.id === roleId ? { ...r, permissions: updatedPerms } : r));
    setHasUnsavedRoleChanges(true);
  };

  const handleSavePermissions = async () => {
    setSavingPermissions(true);
    try {
      // Guardar todos los roles que hayan cambiado
      for (const role of roles) {
        const orig = originalRoles.find(r => r.id === role.id);
        if (orig && JSON.stringify(orig.permissions) !== JSON.stringify(role.permissions)) {
          const { error } = await supabase.from('roles').update({ permissions: role.permissions }).eq('id', role.id);
          if (error) throw error;
        }
      }
      setOriginalRoles(roles);
      setHasUnsavedRoleChanges(false);
      showToast('Permisos guardados correctamente', 'success');
    } catch (err: any) {
      showToast(err.message || 'Error al guardar permisos', 'error');
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleRestorePermissions = () => {
    setRoles(originalRoles);
    setHasUnsavedRoleChanges(false);
    showToast('Valores predeterminados restaurados', 'success');
  };

  const handleTabChange = (tab: Tab) => {
    if (activeTab === 'roles' && hasUnsavedRoleChanges) {
      setPendingTab(tab);
      setShowRoleExitConfirm(true);
    } else {
      setActiveTab(tab);
    }
  };

  useEffect(() => {
    if (!isHydrated || !permissions?.access_personal) return;
    loadData();
  }, [isHydrated, permissions]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const syncEmployeeStoreAssignment = async (
    employeeId: string,
    storeAssignments: { store_id: string; role: string; role_id?: string | null }[]
  ) => {
    const linkedProfile = allProfiles.find(p => p.employee_id === employeeId && p.role !== 'DELETED');
    const profileId = linkedProfile?.id || null;

    const defaultStoreId = storeAssignments.length > 0 ? storeAssignments[0]?.store_id || null : null;
    const primaryRole = storeAssignments.length > 0 ? storeAssignments[0]?.role || 'CAJERO' : 'CAJERO';
    const primaryRoleId = storeAssignments.length > 0 ? storeAssignments[0]?.role_id || null : null;

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        default_store_id: defaultStoreId,
        role: primaryRole,
        role_id: primaryRoleId
      })
      .eq('employee_id', employeeId);

    if (profileError) throw profileError;

    const { error: storeDelError } = await supabase.from('employee_stores').delete().eq('employee_id', employeeId);
    if (storeDelError) throw storeDelError;

    if (storeAssignments.length > 0) {
      const inserts = storeAssignments.map(sa => ({
        employee_id: employeeId,
        profile_id: profileId,
        store_id: sa.store_id,
        role: sa.role,
        role_id: sa.role_id || null
      }));
      const { error: storeError } = await supabase.from('employee_stores').insert(inserts);
      if (storeError) throw storeError;
    }
  };

  // ── Username restoration & conflict helpers
  const [pendingRestoration, setPendingRestoration] = useState<{
    existingProfileId: string;
    username: string;
    payload: any;
    storeAssignments: any[];
    onSuccess: () => void;
  } | null>(null);
  const [isRestoringUser, setIsRestoringUser] = useState(false);

  const checkUsernameState = (targetUsername: string) => {
    const cleanUsername = targetUsername.trim();
    const existing = allProfiles.find(
      p => p.username.toLowerCase() === cleanUsername.toLowerCase()
    );
    if (!existing) return { exists: false, isDeleted: false, profile: null };
    if (existing.role === 'DELETED') return { exists: true, isDeleted: true, profile: existing };
    return { exists: true, isDeleted: false, profile: existing };
  };

  const handleExecuteRestoration = async () => {
    if (!pendingRestoration) return;
    setIsRestoringUser(true);
    try {
      const { existingProfileId, username, payload, storeAssignments, onSuccess } = pendingRestoration;
      const cleanUsername = username.trim();

      const updates: any = {
        username: cleanUsername,
        role: payload.role,
        role_id: payload.role_id,
        employee_id: payload.employee_id,
        email: payload.email,
        default_store_id: payload.default_store_id,
      };
      if (payload.password_hash) {
        updates.password_hash = payload.password_hash;
      }

      const { error: updateErr } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', existingProfileId);

      if (updateErr) throw updateErr;

      await supabase.from('employee_stores').delete().eq('profile_id', existingProfileId);
      if (storeAssignments.length > 0) {
        const inserts = storeAssignments.map(sa => ({
          profile_id: existingProfileId,
          employee_id: payload.employee_id,
          store_id: sa.store_id,
          role: sa.role,
          role_id: sa.role_id || null
        }));
        const { error: insErr } = await supabase.from('employee_stores').insert(inserts);
        if (insErr) throw insErr;
      }

      showToast(`El usuario '@${cleanUsername}' ha sido restaurado y actualizado correctamente con la nueva configuración.`, 'success');
      onSuccess();
      setPendingRestoration(null);
      loadData();
    } catch (err: any) {
      showToast(formatFriendlyErrorMessage(err, 'Error al restaurar cuenta'), 'error');
    } finally {
      setIsRestoringUser(false);
    }
  };

  // ── Create / Edit employee (+ Optional Profile)
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !dni.trim()) {
      showToast('Nombre completo y DNI son obligatorios', 'error');
      return;
    }

    if (empAccessScope === 'stores') {
      const assignedStoreIds = isAdmin ? empStoreIds : (activeStoreId ? [activeStoreId] : []);
      if (assignedStoreIds.length === 0) {
        showToast('Debes seleccionar al menos una tienda para el empleado', 'error');
        return;
      }
    }

    if (!editingEmployee && createAccess && (!empUsername.trim() || !empPassword)) {
      showToast('Usuario y contraseña son obligatorios para crear el acceso', 'error');
      return;
    }

    setSavingEmployee(true);
    try {
      const assignedStoreIds = isAdmin ? empStoreIds : (targetModalStoreId ? [targetModalStoreId] : []);
      const storeAssignments = assignedStoreIds.map(sId => ({
        store_id: sId,
        role: empStoreRoles[sId] || getValidStoreRole(null, sId),
        role_id: empStoreRoleIds[sId] || null
      }));

      if (editingEmployee) {
        // Update existing employee
        const { error: empErr } = await supabase.from('employees').update({
          full_name: fullName.trim(),
          dni: dni.trim(),
          phone: phone.trim() || null,
        }).eq('id', editingEmployee.id);

        if (empErr) throw empErr;

        if (empAccessScope === 'global') {
          await syncEmployeeStoreAssignment(editingEmployee.id, []);
          const existingProf = profileByEmployeeId[editingEmployee.id];
          if (existingProf) {
            await supabase.from('profiles').update({ role: empGlobalRole, role_id: null, default_store_id: null }).eq('id', existingProf.id);
          }
        } else {
          await syncEmployeeStoreAssignment(editingEmployee.id, storeAssignments);
          const existingProf = profileByEmployeeId[editingEmployee.id];
          if (existingProf && storeAssignments.length > 0) {
            await supabase.from('profiles').update({ role: storeAssignments[0]?.role || 'CAJERO', role_id: storeAssignments[0]?.role_id || null, default_store_id: storeAssignments[0]?.store_id || null }).eq('id', existingProf.id);
          }
        }

        showToast('Empleado actualizado correctamente', 'success');
      } else {
        // 1. Insert Employee
        const { data: newEmp, error: empErr } = await supabase.from('employees').insert({
          full_name: fullName.trim(),
          dni: dni.trim(),
          phone: phone.trim() || null,
        }).select('id').single();

        if (empErr) throw empErr;

        if (newEmp) {
          if (empAccessScope === 'global') {
            await syncEmployeeStoreAssignment(newEmp.id, []);
          } else {
            await syncEmployeeStoreAssignment(newEmp.id, storeAssignments);
          }
        }

        // 2. Insert Profile (if toggled)
        if (createAccess && newEmp) {
          const hash = bcrypt.hashSync(empPassword, 8);
          const isGlobalScope = empAccessScope === 'global';
          const primaryRole = isGlobalScope ? empGlobalRole : (storeAssignments[0]?.role || 'CAJERO');
          const primaryRoleId = isGlobalScope ? null : (storeAssignments[0]?.role_id || null);

          const targetPayload = {
            role: primaryRole,
            role_id: primaryRoleId,
            password_hash: hash,
            employee_id: newEmp.id,
            email: empEmail.trim() || null,
            default_store_id: isGlobalScope ? null : (storeAssignments[0]?.store_id || null)
          };

          const check = checkUsernameState(empUsername);
          if (check.exists) {
            if (!check.isDeleted || !check.profile) {
              showToast(`Ya existe una cuenta activa con el nombre de usuario '@${empUsername.trim()}'. Por favor elige un nombre diferente.`, 'error');
              setSavingEmployee(false);
              return;
            } else {
              setPendingRestoration({
                existingProfileId: check.profile.id,
                username: empUsername.trim(),
                payload: targetPayload,
                storeAssignments: isGlobalScope ? [] : storeAssignments,
                onSuccess: () => {
                  setIsEmployeeModalOpen(false);
                  setEditingEmployee(null);
                  setFullName(''); setDni(''); setPhone('');
                  setCreateAccess(false); setEmpUsername(''); setEmpPassword(''); setEmpEmail(''); setEmpStoreIds([]); setEmpStoreRoles({}); setEmpStoreRoleIds({});
                  setEmpAccessScope('stores'); setEmpGlobalRole('ADMIN');
                }
              });
              setSavingEmployee(false);
              return;
            }
          }

          const { error: profErr } = await supabase.from('profiles').insert({
            username: empUsername.trim(),
            ...targetPayload
          });
          if (profErr) throw profErr;
        }

        showToast(createAccess ? 'Empleado y acceso creados correctamente' : 'Empleado registrado correctamente', 'success');
      }

      // Reset form
      setIsEmployeeModalOpen(false);
      setEditingEmployee(null);
      setFullName(''); setDni(''); setPhone('');
      setCreateAccess(false); setEmpUsername(''); setEmpPassword(''); setEmpEmail(''); setEmpStoreIds([]); setEmpStoreRoles({}); setEmpStoreRoleIds({});
      setEmpAccessScope('stores'); setEmpGlobalRole('ADMIN');

      loadData();
    } catch (err: any) {
      showToast(formatFriendlyErrorMessage(err, 'Error al guardar empleado'), 'error');
    } finally {
      setSavingEmployee(false);
    }
  };

  const handleEditEmployeeClick = (emp: Employee) => {
    const targetProfile = profileByEmployeeId[emp.id];
    if (!checkCanManageTarget(targetProfile, emp)) {
      showToast('Solo puedes modificar personal asignado a tu misma sucursal local', 'error');
      return;
    }
    const initialStoreId = activeStoreId || (emp.employee_stores && emp.employee_stores.length > 0 ? emp.employee_stores[0]?.store_id : availableStores[0]?.id) || '';
    setSelectedModalStoreId(initialStoreId);
    setEditingEmployee(emp);
    setFullName(emp.full_name);
    setDni(emp.dni);
    setPhone(emp.phone || '');
    if (emp.employee_stores && emp.employee_stores.length > 0) {
      const ids = emp.employee_stores.map(es => es.store_id);
      const rolesMap: Record<string, string> = {};
      const roleIdsMap: Record<string, string> = {};
      emp.employee_stores.forEach(es => {
        const rawRole = (es as any).role;
        rolesMap[es.store_id] = rawRole || getValidStoreRole(null, es.store_id);
        if ((es as any).role_id) {
          roleIdsMap[es.store_id] = (es as any).role_id;
        } else {
          const matchedRole = roles.find(r => r.name === rawRole && r.store_id === es.store_id)
            || roles.find(r => r.name === rawRole && !r.store_id);
          if (matchedRole) roleIdsMap[es.store_id] = matchedRole.id;
        }
      });
      setEmpStoreIds(ids);
      setEmpStoreRoles(rolesMap);
      setEmpStoreRoleIds(roleIdsMap);
    } else {
      setEmpStoreIds([]);
      setEmpStoreRoles({});
      setEmpStoreRoleIds({});
    }
    if (targetProfile?.role === 'ADMIN' || (targetProfile && !targetProfile.default_store_id && (!emp.employee_stores || emp.employee_stores.length === 0))) {
      setEmpAccessScope('global');
      setEmpGlobalRole(targetProfile.role || 'ADMIN');
    } else {
      setEmpAccessScope('stores');
      setEmpGlobalRole('ADMIN');
    }
    setCreateAccess(false);
    setIsEmployeeModalOpen(true);
  };

  const handleDeleteEmployeeClick = (empId: string, empName: string) => {
    const targetEmp = employeeById[empId] || employees.find(e => e.id === empId);
    const targetProfile = profileByEmployeeId[empId];
    if (!checkCanManageTarget(targetProfile, targetEmp)) {
      showToast('Solo puedes modificar personal asignado a tu misma sucursal local', 'error');
      return;
    }
    setDeletingEmployee({ id: empId, name: empName });
  };

  const confirmDeleteEmployee = async () => {
    if (!deletingEmployee) return;
    try {
      const { error } = await supabase.from('employees').update({ is_active: false }).eq('id', deletingEmployee.id);
      if (error) throw error;

      // Desvincular perfiles asociados para que no queden referencias fantasma y desactivarlos
      await supabase.from('profiles').update({ employee_id: null, role: 'DELETED', role_id: null, default_store_id: null }).eq('employee_id', deletingEmployee.id);

      showToast('Empleado deshabilitado correctamente', 'success');
      setDeletingEmployee(null);
      loadData();
    } catch (err: any) {
      showToast(formatFriendlyErrorMessage(err, 'Error al deshabilitar empleado'), 'error');
    }
  };

  const handleUnlinkEmployeeClick = (empId: string, empName: string, profileId: string) => {
    setUnlinkingEmployee({ empId, name: empName, profileId });
  };

  const confirmUnlinkEmployee = async () => {
    if (!unlinkingEmployee) return;
    try {
      // Desvincular perfil del empleado y desactivarlo (soft delete) usando role = 'DELETED'
      const { error } = await supabase.from('profiles').update({ employee_id: null, role: 'DELETED', role_id: null, default_store_id: null }).eq('id', unlinkingEmployee.profileId);
      if (error) throw error;

      showToast('Acceso desvinculado correctamente', 'success');
      setUnlinkingEmployee(null);
      loadData();
    } catch (err: any) {
      showToast(formatFriendlyErrorMessage(err, 'Error al desvincular acceso'), 'error');
    }
  };

  // ── Save Credentials (Create / Edit)
  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      showToast('El usuario es obligatorio', 'error');
      return;
    }
    if (!editingUserId && !password) {
      showToast('La contraseña es obligatoria para nuevos usuarios', 'error');
      return;
    }

    setSavingUser(true);
    try {
      let hash;
      if (password) {
        hash = bcrypt.hashSync(password, 8);
      }

      const existingProfile = editingUserId ? allProfiles.find(p => p.id === editingUserId) : null;
      const oldEmpId = existingProfile?.employee_id;
      const targetEmpId = selectedEmpId || oldEmpId;

      if (userAccessScope === 'global') {
        if (!confirmGlobalAccess) {
          showToast('Debes confirmar la casilla de seguridad para otorgar Acceso Global', 'error');
          setSavingUser(false);
          return;
        }

        const updates: any = {
          username: username.trim(),
          role: userGlobalRole || 'ADMIN',
          role_id: null,
          employee_id: selectedEmpId || null,
          email: email.trim() || null,
          default_store_id: null
        };
        if (hash) updates.password_hash = hash;

        if (editingUserId) {
          const { data: profileResult, error: profileErr } = await supabase.from('profiles').update(updates).eq('id', editingUserId).select('*');
          if (profileErr) throw profileErr;

          await supabase.from('employee_stores').delete().eq('profile_id', editingUserId);

          showToast('Acceso actualizado a Global correctamente', 'success');
        } else {
          const check = checkUsernameState(username);
          if (check.exists) {
            if (!check.isDeleted || !check.profile) {
              showToast(`Ya existe una cuenta activa con el nombre de usuario '@${username.trim()}'. Por favor elige un nombre diferente.`, 'error');
              setSavingUser(false);
              return;
            } else {
              setPendingRestoration({
                existingProfileId: check.profile.id,
                username: username.trim(),
                payload: updates,
                storeAssignments: [],
                onSuccess: () => {
                  setIsUserModalOpen(false);
                  setEditingUserId(null);
                  setUserAccessScope('stores');
                  setUserGlobalRole('ADMIN');
                  setUsername(''); setPassword(''); setEmail(''); setSelectedEmpId(''); setSelectedStoreIds([]); setUserStoreRoles({}); setUserStoreRoleIds({});
                }
              });
              setSavingUser(false);
              return;
            }
          }

          const { data: profileResult, error: profileErr } = await supabase.from('profiles').insert(updates).select('*');
          if (profileErr) throw profileErr;
          showToast('Acceso creado correctamente', 'success');
        }
      } else {
        const assignedStoreIds = isAdmin ? selectedStoreIds : (targetModalStoreId ? [targetModalStoreId] : []);
        if (assignedStoreIds.length === 0) {
          showToast('Debes seleccionar al menos una tienda', 'error');
          setSavingUser(false);
          return;
        }

        const storeAssignments = assignedStoreIds.map(sId => ({
          store_id: sId,
          role: userStoreRoles[sId] || getValidStoreRole(null, sId),
          role_id: userStoreRoleIds[sId] || null
        }));

        const defaultStoreId = storeAssignments.length > 0 ? storeAssignments[0]?.store_id || null : null;
        const primaryRole = storeAssignments[0]?.role || 'CAJERO';

        if (editingUserId) {
          const updates: any = {
            username: username.trim(),
            role: primaryRole,
            role_id: storeAssignments[0]?.role_id || null,
            employee_id: selectedEmpId || null,
            email: email.trim() || null,
            default_store_id: defaultStoreId
          };
          if (hash) updates.password_hash = hash;

          const { data: profileResult, error: profileErr } = await supabase.from('profiles').update(updates).eq('id', editingUserId).select('*');
          if (profileErr) throw profileErr;

          await supabase.from('employee_stores').delete().eq('profile_id', editingUserId);
          if (storeAssignments.length > 0) {
            const inserts = storeAssignments.map(sa => ({
              profile_id: editingUserId,
              employee_id: selectedEmpId || null,
              store_id: sa.store_id,
              role: sa.role,
              role_id: sa.role_id || null
            }));
            const { data: empStoreRes, error: empStoreErr } = await supabase.from('employee_stores').insert(inserts).select('*');
            if (empStoreErr) throw empStoreErr;
          }

          showToast('Acceso actualizado a Por Sucursales correctamente', 'success');
        } else {
          // CREATE
          const payload = {
            role: primaryRole,
            role_id: storeAssignments[0]?.role_id || null,
            password_hash: hash,
            employee_id: selectedEmpId || null,
            email: email.trim() || null,
            default_store_id: defaultStoreId
          };

          const check = checkUsernameState(username);
          if (check.exists) {
            if (!check.isDeleted || !check.profile) {
              showToast(`Ya existe una cuenta activa con el nombre de usuario '@${username.trim()}'. Por favor elige un nombre diferente.`, 'error');
              setSavingUser(false);
              return;
            } else {
              setPendingRestoration({
                existingProfileId: check.profile.id,
                username: username.trim(),
                payload,
                storeAssignments,
                onSuccess: () => {
                  setIsUserModalOpen(false);
                  setEditingUserId(null);
                  setUserAccessScope('stores');
                  setUserGlobalRole('ADMIN');
                  setUsername(''); setPassword(''); setEmail(''); setSelectedEmpId(''); setSelectedStoreIds([]); setUserStoreRoles({}); setUserStoreRoleIds({});
                }
              });
              setSavingUser(false);
              return;
            }
          }

          const { data: newProfile, error: profileErr } = await supabase.from('profiles').insert({
            username: username.trim(),
            ...payload
          }).select('*').single();
          if (profileErr) throw profileErr;

          if (storeAssignments.length > 0 && newProfile) {
            const inserts = storeAssignments.map(sa => ({
              profile_id: newProfile.id,
              employee_id: selectedEmpId || null,
              store_id: sa.store_id,
              role: sa.role,
              role_id: sa.role_id || null
            }));
            await supabase.from('employee_stores').insert(inserts);
          }
          showToast('Acceso creado correctamente', 'success');
        }
      }

      // Reset form & reload fresh data
      setIsUserModalOpen(false);
      setEditingUserId(null);
      setUserAccessScope('stores');
      setUserGlobalRole('ADMIN');
      setUsername(''); setPassword(''); setEmail(''); setSelectedEmpId(''); setSelectedStoreIds([]); setUserStoreRoles({});
      await loadData();
    } catch (err: any) {
      showToast(formatFriendlyErrorMessage(err, 'Error al guardar acceso'), 'error');
    } finally {
      setSavingUser(false);
    }
  };

  // ── Link Employee Modal Handlers
  const handleLinkNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkingEmployee || !empUsername.trim() || !empPassword) return;
    if (!checkCanManageTarget(null, linkingEmployee)) {
      showToast('Solo puedes gestionar personal asignado a tu misma sucursal local', 'error');
      return;
    }
    if (!linkRoleId) {
      showToast('Por favor selecciona un rol de acceso para el usuario', 'error');
      return;
    }
    setIsLinking(true);
    try {
      const selectedRoleObj = roles.find(r => r.id === linkRoleId);
      const selectedRoleName = selectedRoleObj?.name || 'MOSTRADOR';
      const selectedRoleId = selectedRoleObj?.id || null;

      const storeAssignments = (linkingEmployee.employee_stores || []).map(es => ({
        store_id: es.store_id,
        role: selectedRoleName,
        role_id: selectedRoleId
      }));

      const primaryRole = selectedRoleName;
      const primaryRoleId = selectedRoleId;
      const defaultStoreId = storeAssignments[0]?.store_id || selectedRoleObj?.store_id || null;

      const hash = bcrypt.hashSync(empPassword, 8);
      const { error } = await supabase.from('profiles').insert({
        username: empUsername.trim(),
        role: primaryRole,
        role_id: primaryRoleId,
        password_hash: hash,
        employee_id: linkingEmployee.id,
        email: empEmail.trim() || null,
        default_store_id: defaultStoreId
      });
      if (error) throw error;

      // Si el empleado tiene tiendas físicas asignadas, actualizar los roles en employee_stores también
      if (storeAssignments.length > 0) {
        await supabase.from('employee_stores').delete().eq('employee_id', linkingEmployee.id);
        await supabase.from('employee_stores').insert(
          storeAssignments.map(sa => ({
            employee_id: linkingEmployee.id,
            store_id: sa.store_id,
            role: sa.role,
            role_id: sa.role_id
          }))
        );
      }

      showToast('Acceso creado y vinculado correctamente', 'success');
      setLinkingEmployee(null);
      setEmpUsername(''); setEmpPassword(''); setEmpEmail(''); setLinkRoleId('');
      loadData();
    } catch (err: any) {
      showToast(formatFriendlyErrorMessage(err, 'Error al crear acceso'), 'error');
    } finally {
      setIsLinking(false);
    }
  };

  const handleLinkExistingUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkingEmployee || !linkExistingUserId) return;
    const selectedUser = allProfiles.find(p => p.id === linkExistingUserId);
    if (!checkCanManageTarget(selectedUser, linkingEmployee)) {
      showToast('Solo puedes gestionar personal asignado a tu misma sucursal local', 'error');
      return;
    }
    setIsLinking(true);
    try {
      const selectedUser = allProfiles.find(p => p.id === linkExistingUserId);
      if (selectedUser) {
        const empStoreIds = (linkingEmployee.employee_stores || []).map(es => es.store_id);

        let userStoreIds: string[] = [];
        if (selectedUser.employee_stores && selectedUser.employee_stores.length > 0) {
          userStoreIds = selectedUser.employee_stores.map(es => es.store_id);
        } else if (selectedUser.default_store_id) {
          userStoreIds = [selectedUser.default_store_id];
        }

        const isUserGlobalAdmin = selectedUser.role === 'ADMIN' || selectedUser.role_id === null;

        const empStoresSorted = [...empStoreIds].sort().join(',');
        const userStoresSorted = [...userStoreIds].sort().join(',');
        const isStrictMatch = empStoresSorted === userStoresSorted;

        if (!isUserGlobalAdmin && !isStrictMatch) {
          showToast('El empleado está asignado a unas tiendas, pero el usuario pertenece a otra distinta. Por favor, asegúrate de que el empleado y el usuario pertenezcan a las mismas tiendas antes de vincularlos.', 'error');
          setIsLinking(false);
          return;
        }
      }

      const defaultStoreId = linkingEmployee.employee_stores?.[0]?.store_id || null;
      const updates: any = { employee_id: linkingEmployee.id };
      if (defaultStoreId) updates.default_store_id = defaultStoreId;

      const { error } = await supabase.from('profiles').update(updates).eq('id', linkExistingUserId);
      if (error) throw error;

      // Sincronizar tiendas del empleado con employee_stores del perfil vinculado
      if (linkingEmployee.employee_stores && linkingEmployee.employee_stores.length > 0) {
        const existingProf = allProfiles.find(p => p.id === linkExistingUserId);
        const roleName = existingProf?.role || 'CAJERO';
        const roleId = existingProf?.role_id || null;

        await supabase.from('employee_stores').delete().eq('profile_id', linkExistingUserId);
        await supabase.from('employee_stores').insert(
          linkingEmployee.employee_stores.map(es => ({
            profile_id: linkExistingUserId,
            employee_id: linkingEmployee.id,
            store_id: es.store_id,
            role: roleName,
            role_id: roleId
          }))
        );
      }

      showToast('Usuario vinculado correctamente', 'success');
      setLinkingEmployee(null);
      setLinkExistingUserId('');
      loadData();
    } catch (err: any) {
      showToast(formatFriendlyErrorMessage(err, 'Error al vincular usuario'), 'error');
    } finally {
      setIsLinking(false);
    }
  };

  const handleEditClick = (profile: Profile) => {
    const targetEmp = profile.employee_id ? employeeById[profile.employee_id] : null;
    if (!checkCanManageTarget(profile, targetEmp)) {
      showToast('Solo puedes modificar personal asignado a tu misma sucursal local', 'error');
      return;
    }
    const initialStoreId = activeStoreId || (profile.default_store_id ? profile.default_store_id : availableStores[0]?.id) || '';
    setSelectedModalStoreId(initialStoreId);
    setEditingUserId(profile.id);
    setUsername(profile.username);
    setEmail(profile.email || '');
    setSelectedEmpId(profile.employee_id || '');

    const linkedEmp = profile.employee_id ? employeeById[profile.employee_id] : null;
    if (profile.role === 'ADMIN' || (!profile.default_store_id && (!linkedEmp?.employee_stores || linkedEmp.employee_stores.length === 0))) {
      setUserAccessScope('global');
      setUserGlobalRole(profile.role || 'ADMIN');
    } else {
      setUserAccessScope('stores');
      setUserGlobalRole('ADMIN');
    }

    const profileStores = profile.employee_stores && profile.employee_stores.length > 0
      ? profile.employee_stores
      : (linkedEmp?.employee_stores || []);

    if (profileStores && profileStores.length > 0) {
      const ids = profileStores.map((es: any) => es.store_id);
      const rolesMap: Record<string, string> = {};
      const roleIdsMap: Record<string, string> = {};
      profileStores.forEach((es: any) => {
        const rawRole = es.role || profile.role;
        rolesMap[es.store_id] = getValidStoreRole(rawRole, es.store_id);
        if (es.role_id) {
          roleIdsMap[es.store_id] = es.role_id;
        } else {
          const matchedRole = roles.find(r => r.name === rawRole && r.store_id === es.store_id)
            || roles.find(r => r.name === rawRole && !r.store_id);
          if (matchedRole) roleIdsMap[es.store_id] = matchedRole.id;
        }
      });
      setSelectedStoreIds(ids);
      setUserStoreRoles(rolesMap);
      setUserStoreRoleIds(roleIdsMap);
    } else if (profile.default_store_id) {
      setSelectedStoreIds([profile.default_store_id]);
      setUserStoreRoles({ [profile.default_store_id]: getValidStoreRole(profile.role, profile.default_store_id) });
      const matchedRole = profile.role_id
        ? roles.find(r => r.id === profile.role_id)
        : (roles.find(r => r.name === profile.role && r.store_id === profile.default_store_id) || roles.find(r => r.name === profile.role && !r.store_id));
      setUserStoreRoleIds(matchedRole ? { [profile.default_store_id]: matchedRole.id } : {});
    } else {
      setSelectedStoreIds([]);
      setUserStoreRoles({});
      setUserStoreRoleIds({});
    }

    setPassword(''); // Leave empty so it doesn't get updated unless typed
    setConfirmGlobalAccess(false);
    setIsUserModalOpen(true);
  };

  const handleCancelEdit = () => {
    setUsername(''); setPassword(''); setEmail(''); setSelectedEmpId(''); setSelectedStoreIds([]); setUserStoreRoles({}); setUserStoreRoleIds({});
    setUserAccessScope('stores'); setUserGlobalRole('ADMIN'); setConfirmGlobalAccess(false);
    setEditingUserId(null);
    setIsUserModalOpen(false);
  };

  const renderStoreRoleList = ({
    storeIds,
    storeRoles,
    storeRoleIds,
    onToggleStore,
    onRoleChange,
    isDisabled = false,
    isStoreToggleDisabled = false,
  }: {
    storeIds: string[];
    storeRoles: Record<string, string>;
    storeRoleIds?: Record<string, string>;
    onToggleStore: (storeId: string, checked: boolean) => void;
    onRoleChange: (storeId: string, roleName: string, roleId: string) => void;
    isDisabled?: boolean;
    isStoreToggleDisabled?: boolean;
  }) => {
    return (
      <div className="space-y-2 mt-2">
        {availableStores.map(store => {
          const isChecked = storeIds.includes(store.id);
          const storeAvailableRoles = roles.filter(
            (r) => r.name !== 'ADMIN' && (r.store_id === store.id || !r.store_id)
          );
          const currentRoleName = getValidStoreRole(storeRoles[store.id], store.id);
          const currentRoleId = storeRoleIds?.[store.id] || storeAvailableRoles.find(r => r.name === currentRoleName)?.id || storeAvailableRoles[0]?.id || '';
          const selectedValue = storeAvailableRoles.some(r => r.id === currentRoleId)
            ? currentRoleId
            : (storeAvailableRoles.find(r => r.name === currentRoleName)?.id || storeAvailableRoles[0]?.id || '');

          return (
            <div
              key={store.id}
              className={`p-3 rounded-2xl border transition-all ${isChecked
                ? 'bg-indigo-50/80 border-indigo-200 shadow-sm'
                : 'bg-background border-border hover:bg-secondary/40'
                } ${isDisabled ? 'opacity-80' : ''}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <label className="flex items-center gap-3 cursor-pointer select-none font-semibold text-sm text-foreground">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                    checked={isChecked}
                    disabled={isDisabled || isStoreToggleDisabled}
                    onChange={(e) => onToggleStore(store.id, e.target.checked)}
                  />
                  <span>{store.name}</span>
                </label>

                {isChecked && (
                  <div className="flex items-center gap-2 pl-7 sm:pl-0 mt-2 sm:mt-0 flex-1 sm:flex-initial sm:justify-end min-w-0">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider shrink-0">Rol:</span>
                    <select
                      value={selectedValue}
                      disabled={isDisabled}
                      onChange={(e) => {
                        const selectedRole = storeAvailableRoles.find(r => r.id === e.target.value);
                        if (selectedRole) {
                          onRoleChange(store.id, selectedRole.name, selectedRole.id);
                        }
                      }}
                      className="h-9 px-3 text-xs font-bold rounded-xl border border-indigo-200 bg-white text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm cursor-pointer w-full max-w-[200px] sm:max-w-[240px] truncate"
                    >
                      {storeAvailableRoles.map(r => {
                        const scopeLabel = r.store_id ? ` (${storeMap.get(r.store_id) || r.stores?.name || 'Sucursal'})` : ' (Global)';
                        return (
                          <option key={r.id} value={r.id}>
                            {r.name}{scopeLabel}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const getRoleBadgeStyle = (roleName: string) => {
    if (roleName === 'ADMIN' || roles.some(r => r.name === roleName && (!r.store_id || r.is_system))) {
      return 'bg-purple-500/10 border-purple-500/30 text-purple-500';
    }
    if (roleName === 'CAJERA' || roleName === 'CAJERO') return 'bg-cyan-500/10 border-cyan-500/30 text-cyan-500';
    if (roleName === 'MOSTRADOR') return 'bg-amber-500/10 border-amber-500/30 text-amber-600';
    return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500';
  };

  const renderStoreAndRoleBadges = (
    empStores: { store_id: string; role?: string; stores?: { name: string } }[],
    profileRole?: string | null,
    isNoProfile: boolean = false
  ) => {
    const isGlobalRole = profileRole === 'ADMIN' || (!!profileRole && roles.some(r => r.name === profileRole && (!r.store_id || r.is_system)));
    const hasNoSpecificStores = !empStores || empStores.length === 0;

    // Caso 1: Acceso Global (Rol Global sin tiendas específicas asignadas)
    if (isGlobalRole && hasNoSpecificStores && !isNoProfile) {
      return {
        storeElement: (
          <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200 whitespace-nowrap shrink-0 inline-flex items-center">
            Acceso Global
          </span>
        ),
        roleElement: (
          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getRoleBadgeStyle(profileRole || 'ADMIN')} whitespace-nowrap shrink-0 inline-flex items-center`}>
            {profileRole || 'ADMIN'}
          </span>
        )
      };
    }

    // Caso 2: Empleado Físico Sin Usuario / Cuenta de Sistema
    if (isNoProfile) {
      const storeElement = empStores && empStores.length > 0 ? (
        <div className="flex flex-wrap gap-1 items-center">
          {empStores.map((es) => {
            const storeName = es.stores?.name || storeMap.get(es.store_id) || 'Tienda';
            return (
              <span key={es.store_id} className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 whitespace-nowrap shrink-0 inline-flex items-center">
                {storeName}
              </span>
            );
          })}
        </div>
      ) : (
        <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200 whitespace-nowrap shrink-0 inline-flex items-center">
          Acceso Global
        </span>
      );

      const roleElement = (
        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full border bg-amber-500/10 border-amber-500/30 text-amber-600 whitespace-nowrap shrink-0 inline-flex items-center">
          Sin acceso
        </span>
      );

      return { storeElement, roleElement };
    }

    // Caso 3: Usuario Sin Tiendas Asignadas
    if (hasNoSpecificStores) {
      return {
        storeElement: <span className="text-xs text-muted-foreground italic">—</span>,
        roleElement: profileRole ? (
          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getRoleBadgeStyle(profileRole)} whitespace-nowrap shrink-0 inline-flex items-center`}>
            {profileRole}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground italic">—</span>
        )
      };
    }

    // Caso 4: Con Tiendas Asignadas
    const storeElement = (
      <div className="flex flex-wrap gap-1 items-center">
        {empStores.map((es) => {
          const storeName = es.stores?.name || storeMap.get(es.store_id) || 'Tienda';
          return (
            <span key={es.store_id} className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 whitespace-nowrap shrink-0 inline-flex items-center">
              {storeName}
            </span>
          );
        })}
      </div>
    );

    const roleElement = empStores.length > 1 ? (
      <div className="flex flex-wrap gap-1 items-center">
        {empStores.map((es) => {
          const storeName = es.stores?.name || storeMap.get(es.store_id) || 'Tienda';
          const roleName = es.role || profileRole || 'CAJERO';
          return (
            <span key={es.store_id} className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getRoleBadgeStyle(roleName)} whitespace-nowrap shrink-0 inline-flex items-center`}>
              {storeName}: {roleName}
            </span>
          );
        })}
      </div>
    ) : (
      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getRoleBadgeStyle(empStores[0]?.role || profileRole || 'CAJERO')} whitespace-nowrap shrink-0 inline-flex items-center`}>
        {empStores[0]?.role || profileRole || 'CAJERO'}
      </span>
    );

    return { storeElement, roleElement };
  };

  const profileByEmployeeId = Object.fromEntries(
    allProfiles.filter(p => p.employee_id && p.role !== 'DELETED').map(p => [p.employee_id!, p]),
  );

  const visibleEmployees = useMemo(() => {
    const baseEmployees = showInactiveEmployees
      ? employees
      : employees.filter(e => e.is_active !== false);

    if (isGlobalUser) {
      if (!activeStoreId) return baseEmployees;
      return baseEmployees.filter(emp => {
        const profile = profileByEmployeeId[emp.id];
        const isGlobalAccount = profile?.role === 'ADMIN' || 
          (!profile?.default_store_id && (!profile?.employee_stores || profile.employee_stores.length === 0) && (!emp.employee_stores || emp.employee_stores.length === 0));
        if (isGlobalAccount) return true;
        return emp.employee_stores?.some(es => es.store_id === activeStoreId);
      });
    } else {
      const targetStoreIds = activeStoreId ? [activeStoreId] : availableStoreIds;
      return baseEmployees.filter(emp => {
        const profile = profileByEmployeeId[emp.id];
        const isGlobalAccount = profile?.role === 'ADMIN' || 
          (!profile?.default_store_id && (!profile?.employee_stores || profile.employee_stores.length === 0) && (!emp.employee_stores || emp.employee_stores.length === 0));
        if (isGlobalAccount) return false;

        return emp.employee_stores?.some(es => targetStoreIds.includes(es.store_id));
      });
    }
  }, [employees, showInactiveEmployees, activeStoreId, profileByEmployeeId, isGlobalUser, availableStoreIds]);

  const activeProfiles = useMemo(() => {
    const baseProfiles = showInactiveUsers ? allProfiles : allProfiles.filter(p => p.role !== 'DELETED');

    if (isGlobalUser) {
      if (!activeStoreId) return baseProfiles;
      return baseProfiles.filter(p => {
        const linkedEmp = p.employee_id ? employeeById[p.employee_id] : null;
        const isGlobalAccount = p.role === 'ADMIN' || 
          (!p.default_store_id && (!p.employee_stores || p.employee_stores.length === 0) && (!linkedEmp?.employee_stores || linkedEmp.employee_stores.length === 0));
        if (isGlobalAccount) return true;
        if (p.default_store_id === activeStoreId) return true;
        if (p.employee_stores?.some(es => es.store_id === activeStoreId)) return true;
        if (linkedEmp?.employee_stores?.some(es => es.store_id === activeStoreId)) return true;
        return false;
      });
    } else {
      const targetStoreIds = activeStoreId ? [activeStoreId] : availableStoreIds;
      return baseProfiles.filter(p => {
        const linkedEmp = p.employee_id ? employeeById[p.employee_id] : null;
        const isGlobalAccount = p.role === 'ADMIN' || 
          (!p.default_store_id && (!p.employee_stores || p.employee_stores.length === 0) && (!linkedEmp?.employee_stores || linkedEmp.employee_stores.length === 0));
        if (isGlobalAccount) return false;

        if (p.default_store_id && targetStoreIds.includes(p.default_store_id)) return true;
        if (p.employee_stores?.some(es => targetStoreIds.includes(es.store_id))) return true;
        if (linkedEmp?.employee_stores?.some(es => targetStoreIds.includes(es.store_id))) return true;
        return false;
      });
    }
  }, [allProfiles, showInactiveUsers, activeStoreId, employeeById, isGlobalUser, availableStoreIds]);

  const unlinkedEmployees = (isGlobalUser ? employees : visibleEmployees).filter((emp: Employee) => 
    emp.is_active !== false && 
    (!profileByEmployeeId[emp.id] || profileByEmployeeId[emp.id]?.id === editingUserId)
  );

  const visibleRoles = useMemo(() => {
    const baseRoles = showInactiveRoles ? allRoles : roles;
    let currentRoles = baseRoles;
    if (activeStoreId) {
      currentRoles = currentRoles.filter(r => !r.store_id || r.store_id === activeStoreId);
    } else if (!isGlobalUser) {
      currentRoles = currentRoles.filter(r => !r.store_id || availableStoreIds.includes(r.store_id));
    }
    if (role !== 'ADMIN') {
      currentRoles = currentRoles.filter(r => r.name !== 'ADMIN');
    }

    // Sort roles: ADMIN first, then group by store_id, then alphabetical by name
    currentRoles.sort((a, b) => {
      if (a.name === 'ADMIN') return -1;
      if (b.name === 'ADMIN') return 1;

      const storeA = a.store_id ? storeMap.get(a.store_id) || '' : '';
      const storeB = b.store_id ? storeMap.get(b.store_id) || '' : '';

      if (storeA !== storeB) {
        return storeA.localeCompare(storeB);
      }
      return a.name.localeCompare(b.name);
    });

    return currentRoles;
  }, [roles, allRoles, showInactiveRoles, activeStoreId, role, storeMap, isGlobalUser, availableStoreIds]);

  const renderRoleOptions = () => {
    const adminRoles = visibleRoles.filter(r => r.name === 'ADMIN');
    const storeRoles = visibleRoles.filter(r => r.name !== 'ADMIN');

    const grouped = storeRoles.reduce((acc, role) => {
      const storeName = role.store_id ? storeMap.get(role.store_id) || 'Otras Tiendas' : 'Global';
      if (!acc[storeName]) acc[storeName] = [];
      acc[storeName].push(role);
      return acc;
    }, {} as Record<string, typeof roles>);

    return (
      <>
        {adminRoles.length > 0 && (
          <optgroup label="Administración Global">
            {adminRoles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
          </optgroup>
        )}
        {Object.entries(grouped).map(([storeName, groupRoles]) => (
          <optgroup key={storeName} label={`Tienda: ${storeName}`}>
            {groupRoles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
          </optgroup>
        ))}
      </>
    );
  };




    
  // --- Sorting Logic ---
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedData = <T extends any>(data: T[], config: { key: string; direction: 'asc' | 'desc' } | null) => {
    if (!config) return data;
    return [...data].sort((a, b) => {
      const aValue = (a as any)[config.key];
      const bValue = (b as any)[config.key];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (aValue < bValue) {
        return config.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return config.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  const sortedEmployees = useMemo(() => getSortedData(visibleEmployees, sortConfig), [visibleEmployees, sortConfig]);
  const sortedProfiles = useMemo(() => getSortedData(activeProfiles, sortConfig), [activeProfiles, sortConfig]);
  const sortedRoles = useMemo(() => getSortedData(visibleRoles, sortConfig), [visibleRoles, sortConfig]);


  const value = {
    activeProfiles, activeStoreId, activeTab, allProfiles, allRoles, availableStoreIds, availableStores, checkCanManageTarget, checkUsernameState, confirmDeleteEmployee, confirmDeleteRole, confirmGlobalAccess, createAccess, deletingEmployee, deletingRole, deletingUserId, deletingUsername, dni, editRoleDesc, editRoleName, editingEmployee, editingRole, editingUserId, email, empAccessScope, empEmail, empGlobalRole, empPassword, empStoreIds, empStoreRoleIds, empStoreRoles, empUsername, employeeById, employees, formatFriendlyErrorMessage, fullName, getRoleBadgeStyle, getValidStoreRole, globalRoles, handleCancelEdit, handleCreateEmployee, handleCreateRole, handleDeleteEmployeeClick, handleDeleteRole, handleDeleteUser, handleEditClick, handleEditEmployeeClick, handleExecuteRestoration, handleLinkExistingUser, handleLinkNewUser, handleRestoreEmployee, handleRestorePermissions, handleRestoreRole, handleRestoreUser, handleSaveCredentials, handleSaveEditRole, handleSavePermissions, handleTabChange, handleTogglePermission, hasUnsavedRoleChanges, isAdmin, isDeletingRole, isDeletingUser, isEditRoleModalOpen, isEmployeeModalOpen, isGlobalUser, isHydrated, isLinking, isRestoringUser, isRoleConfirmModalOpen, isRoleModalOpen, isRoleWarningModalOpen, isUserGlobalAdmin, isUserModalOpen, linkExistingUserId, linkMode, linkRoleId, linkingEmployee, loadData, loading, modalResetToken, newRoleDesc, newRoleName, newRoleScopeStoreId, originalRoles, password, pendingRestoration, pendingTab, permissions, phone, profileByEmployeeId, renderRoleOptions, renderStoreAndRoleBadges, renderStoreRoleList, role, roleAssignedUsers, roles, router, savingEditRole, savingEmployee, savingPermissions, savingRole, savingUser, selectedEmpId, selectedModalStoreId, selectedStoreIds, setActiveTab, setAllProfiles, setAllRoles, setConfirmGlobalAccess, setCreateAccess, setDeletingEmployee, setDeletingRole, setDeletingUserId, setDeletingUsername, setDni, setEditRoleDesc, setEditRoleName, setEditingEmployee, setEditingRole, setEditingUserId, setEmail, setEmpAccessScope, setEmpEmail, setEmpGlobalRole, setEmpPassword, setEmpStoreIds, setEmpStoreRoleIds, setEmpStoreRoles, setEmpUsername, setEmployees, setFullName, setHasUnsavedRoleChanges, setIsDeletingRole, setIsDeletingUser, setIsEditRoleModalOpen, setIsEmployeeModalOpen, setIsLinking, setIsRestoringUser, setIsRoleConfirmModalOpen, setIsRoleModalOpen, setIsRoleWarningModalOpen, setIsUserModalOpen, setLinkExistingUserId, setLinkMode, setLinkRoleId, setLinkingEmployee, setLoading, setModalResetToken, setNewRoleDesc, setNewRoleName, setNewRoleScopeStoreId, setOriginalRoles, setPassword, setPendingRestoration, setPendingTab, setPhone, setRoleAssignedUsers, setRoles, setSavingEditRole, setSavingEmployee, setSavingPermissions, setSavingRole, setSavingUser, setSelectedEmpId, setSelectedModalStoreId, setSelectedStoreIds, setShowEmpPassword, setShowInactiveEmployees, setShowInactiveRoles, setShowInactiveUsers, setShowRoleExitConfirm, setShowUserPassword, setToast, setUserAccessScope, setUserGlobalRole, setUserStoreRoleIds, setUserStoreRoles, setUsername, showEmpPassword, showInactiveEmployees, showInactiveRoles, showInactiveUsers, showRoleExitConfirm, showToast, showUserPassword, storeMap, syncEmployeeStoreAssignment, targetModalStoreId, toast, unlinkedEmployees, userAccessScope, userGlobalRole, userStoreRoleIds, userStoreRoles, username, visibleEmployees, visibleRoles,
    isManagePermsModalOpen, setIsManagePermsModalOpen, managingPermsRoleId, setManagingPermsRoleId,
    sortConfig, requestSort, sortedEmployees, sortedProfiles, sortedRoles,
    unlinkingEmployee, setUnlinkingEmployee, handleUnlinkEmployeeClick, confirmUnlinkEmployee
  };

  return (
    <PersonalContext.Provider value={value}>
      {children}
    </PersonalContext.Provider>
  );
}

export function usePersonal() {
  const context = useContext(PersonalContext);
  if (!context) {
    throw new Error('usePersonal must be used within a PersonalProvider');
  }

  return context;
}