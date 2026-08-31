'use client';

import React, { useState, useEffect, useMemo, useCallback, createContext, useContext, ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Users, UserPlus, ShieldAlert,
  CheckCircle2, RefreshCw, KeyRound, Plus,
  ShieldCheck, UserCog, Edit2, X, Trash2, Check, XCircle,
  ShoppingCart, PackageSearch, BarChart3, Banknote, FileSpreadsheet, Contact, ScrollText, Settings, Shield, Save, Loader2, Lock, Info, RotateCcw,
  Eye, EyeOff, ArrowUpDown, ChevronDown
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useRole } from '../../context/RoleContext';
import { useStore } from '../../context/StoreContext';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import bcrypt from 'bcryptjs';
import { PERMISSION_GROUPS, Employee, Profile, Tab, Role } from './types';
import { StoreRoleDropdown } from './components/StoreRoleDropdown';

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
  const { role, isHydrated, permissions, profileId: currentProfileId, employeeId: currentEmployeeId, username: currentUsername, isOwner } = useRole();
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

  const checkCanManageTarget = useCallback((
    targetProfile?: Profile | null,
    targetEmp?: Employee | null,
    options?: { requireFullCoverage?: boolean }
  ): boolean => {
    // 👑 La Cuenta Propietario (is_owner) es 100% inmune; solo el dueño mismo puede gestionarse
    if (targetProfile?.is_owner) {
      return Boolean(isOwner);
    }

    // 🛡️ Si el objetivo es un ADMIN (y no es el dueño):
    if (targetProfile?.role === 'ADMIN') {
      if (isOwner) return true; // Solo el dueño puede eliminar o dar de baja a otros administradores
      if (options?.requireFullCoverage) return false; // Los administradores secundarios no pueden eliminar a otros administradores
      return Boolean(isAdmin);
    }

    if (isAdmin || isGlobalUser) return true;

    const profileStores = (targetProfile?.employee_stores || []).map((es: any) => es.store_id).filter(Boolean);
    const empStores = (targetEmp?.employee_stores || []).map((es: any) => es.store_id).filter(Boolean);
    const defaultStore = targetProfile?.default_store_id ? [targetProfile.default_store_id] : [];

    const allTargetStores = [...new Set([...profileStores, ...empStores, ...defaultStore])];

    const isTargetGlobalScope = allTargetStores.length === 0;
    const isTargetProtected = isTargetGlobalScope;

    if (isTargetProtected) return false;

    const userStores = activeStoreId ? [activeStoreId] : availableStoreIds;

    if (options?.requireFullCoverage) {
      return allTargetStores.length > 0 && allTargetStores.every(storeId => userStores.includes(storeId));
    }

    return allTargetStores.some(storeId => userStores.includes(storeId));
  }, [isAdmin, isGlobalUser, isOwner, activeStoreId, availableStoreIds]);
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
  const [empConfirmGlobalAdmin, setEmpConfirmGlobalAdmin] = useState(false);

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

    if (targetProfile?.is_owner) {
      showToast('La Cuenta Principal / Propietaria del sistema es intocable y no puede ser desactivada', 'error');
      setDeletingUserId(null);
      return;
    }

    if (deletingUserId === currentProfileId || (targetProfile?.username && targetProfile.username === currentUsername)) {
      showToast('No puedes desactivar tu propia cuenta de usuario en sesión activa', 'error');
      setDeletingUserId(null);
      return;
    }

    if (targetProfile?.role === 'ADMIN' && !isOwner) {
      showToast('Solo la Cuenta Propietaria tiene autorización para dar de baja a usuarios con rol Administrador', 'error');
      setDeletingUserId(null);
      return;
    }

    const activeAdmins = allProfiles.filter(p => p.role === 'ADMIN');
    if (targetProfile?.role === 'ADMIN' && activeAdmins.length <= 1) {
      showToast('No se puede dar de baja al único Administrador Global activo del sistema', 'error');
      setDeletingUserId(null);
      return;
    }

    if (!checkCanManageTarget(targetProfile, targetEmp, { requireFullCoverage: true })) {
      showToast('Solo puedes dar de baja a usuarios que pertenezcan exclusivamente a tus sucursales autorizadas', 'error');
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
    if (!checkCanManageTarget(targetProfile, targetEmp, { requireFullCoverage: true })) {
      showToast('Solo puedes reactivar usuarios asignados exclusivamente a tus sucursales autorizadas', 'error');
      return;
    }
    try {
      const userStores = targetProfile?.employee_stores || [];
      const restoredRole = userStores[0]?.role
        || (targetProfile?.default_store_id ? getValidStoreRole(null, targetProfile.default_store_id) : 'MOSTRADOR');
      const matchedRole = roles.find(r => r.name === restoredRole && (r.store_id === userStores[0]?.store_id || !r.store_id));
      const roleId = matchedRole?.id || null;

      const { error } = await supabase.from('profiles').update({
        role: restoredRole,
        role_id: roleId
      }).eq('id', profileId);
      if (error) throw error;
      showToast('Acceso reactivado correctamente', 'success');
      loadData();
    } catch (err: any) {
      showToast(formatFriendlyErrorMessage(err, 'Error al reactivar el usuario'), 'error');
    }
  };

  const handleRestoreEmployee = async (empId: string) => {
    const targetEmp = employeeById[empId] || employees.find(e => e.id === empId);
    const targetProfile = allProfiles.find(p => p.employee_id === empId);
    if (!checkCanManageTarget(targetProfile, targetEmp, { requireFullCoverage: true })) {
      showToast('Solo puedes reactivar empleados asignados exclusivamente a tus sucursales autorizadas', 'error');
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
        supabase.from('profiles').select('id, username, role, employee_id, email, is_owner, default_store_id, stores(name), employee_stores(store_id, role, stores(name))'),
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
      if (msg.includes('roles') || msg.includes('roles_name_store_id_key')) {
        return 'Ya existe un rol activo con este nombre en el ámbito seleccionado.';
      }
      if (msg.includes('profiles_username_key') || msg.includes('username')) {
        return 'El nombre de usuario ya está registrado en el sistema.';
      }
      if (msg.includes('profiles_employee_id_key') || msg.includes('employee_id')) {
        return 'Este empleado ya tiene una cuenta de usuario vinculada.';
      }
      if (msg.includes('employees_dni_key') || msg.includes('dni')) {
        return 'Ya existe un empleado registrado con este número de DNI.';
      }
      return 'Ya existe un registro activo con estos datos en el sistema.';
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

      showToast('Rol actualizado correctamente', 'success');
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
    storeAssignments: { store_id: string; role: string; role_id?: string | null }[],
    globalRoleOverride?: string
  ) => {
    const linkedProfile = allProfiles.find(p => p.employee_id === employeeId && p.role !== 'DELETED');
    const profileId = linkedProfile?.id || null;

    const defaultStoreId = storeAssignments.length > 0 ? storeAssignments[0]?.store_id || null : null;
    const primaryRole = globalRoleOverride
      || (storeAssignments.length > 0 ? storeAssignments[0]?.role || 'MOSTRADOR' : linkedProfile?.role || 'MOSTRADOR');
    const primaryRoleId = globalRoleOverride ? null : (storeAssignments.length > 0 ? storeAssignments[0]?.role_id || null : null);

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

    const isAccessRequired = Boolean(createAccess || (editingEmployee && profileByEmployeeId[editingEmployee.id]));

    if (empAccessScope === 'global') {
      if (isAccessRequired) {
        if (!empGlobalRole) {
          showToast('Debes seleccionar un rol global para el empleado', 'error');
          return;
        }
        const existingLinkedProf = editingEmployee ? profileByEmployeeId[editingEmployee.id] : null;
        const isPromotingEmpToAdmin = empGlobalRole === 'ADMIN' && (createAccess || !existingLinkedProf || existingLinkedProf.role !== 'ADMIN');
        if (isPromotingEmpToAdmin && !isOwner) {
          showToast('Solo la Cuenta Propietaria tiene autorización para otorgar el rol Administrador Global', 'error');
          return;
        }
        if (isPromotingEmpToAdmin && !empConfirmGlobalAdmin) {
          showToast('Debes confirmar la casilla de seguridad para otorgar el rol ADMIN global', 'error');
          return;
        }
      }
    } else {
      if (isAdmin && empStoreIds.length === 0) {
        showToast('Debes asignar al menos una sucursal de trabajo', 'error');
        return;
      }
      if (isAccessRequired) {
        if (isAdmin) {
          const unassignedStoreId = empStoreIds.find(sId => !empStoreRoleIds[sId] && !empStoreRoles[sId]);
          if (unassignedStoreId) {
            const storeName = storeMap.get(unassignedStoreId) || 'la sucursal asignada';
            showToast(`Debes seleccionar un rol para ${storeName}`, 'error');
            return;
          }
        } else if (targetModalStoreId && !empStoreRoleIds[targetModalStoreId] && !empStoreRoles[targetModalStoreId]) {
          const storeName = storeMap.get(targetModalStoreId) || 'la sucursal asignada';
          showToast(`Debes seleccionar un rol para ${storeName}`, 'error');
          return;
        }
      }
    }

    if (!editingEmployee && createAccess) {
      if (!empUsername.trim() || !empPassword || empPassword.trim().length < 4) {
        showToast('Usuario y contraseña (mínimo 4 caracteres) son obligatorios para crear el acceso', 'error');
        return;
      }
    }

    setSavingEmployee(true);
    try {
      let storeAssignments: { store_id: string; role: string; role_id?: string | null }[] = [];
      if (isAdmin) {
        storeAssignments = empStoreIds.map(sId => {
          const selectedRoleObj = roles.find(r => r.id === empStoreRoleIds[sId]) || roles.find(r => r.name === empStoreRoles[sId] && (r.store_id === sId || !r.store_id));
          const roleName = selectedRoleObj?.name || empStoreRoles[sId] || getValidStoreRole(null, sId);
          return {
            store_id: sId,
            role: roleName,
            role_id: selectedRoleObj?.id || empStoreRoleIds[sId] || null
          };
        });
      } else if (editingEmployee) {
        // Preservar asignaciones de tiendas que el usuario actual no administra
        const unmanagedStores = (editingEmployee.employee_stores || [])
          .filter(es => es.store_id !== targetModalStoreId)
          .map(es => ({
            store_id: es.store_id,
            role: es.role || getValidStoreRole(null, es.store_id),
            role_id: (es as any).role_id || null
          }));

        const selectedRoleObj = targetModalStoreId ? (roles.find(r => r.id === empStoreRoleIds[targetModalStoreId]) || roles.find(r => r.name === empStoreRoles[targetModalStoreId] && (r.store_id === targetModalStoreId || !r.store_id))) : null;
        const currentStoreAssignment = targetModalStoreId ? [{
          store_id: targetModalStoreId,
          role: selectedRoleObj?.name || empStoreRoles[targetModalStoreId] || getValidStoreRole(null, targetModalStoreId),
          role_id: selectedRoleObj?.id || empStoreRoleIds[targetModalStoreId] || null
        }] : [];

        storeAssignments = [...unmanagedStores, ...currentStoreAssignment];
      } else {
        storeAssignments = targetModalStoreId ? [{
          store_id: targetModalStoreId,
          role: empStoreRoles[targetModalStoreId] || getValidStoreRole(null, targetModalStoreId),
          role_id: empStoreRoleIds[targetModalStoreId] || null
        }] : [];
      }

      if (editingEmployee) {
        // Actualizar datos de identidad del empleado solo si tiene cobertura total
        const linkedProf = profileByEmployeeId[editingEmployee.id];
        const canEditIdentity = checkCanManageTarget(linkedProf, editingEmployee, { requireFullCoverage: true });

        if (canEditIdentity) {
          const { error: empErr } = await supabase.from('employees').update({
            full_name: fullName.trim(),
            dni: dni.trim(),
            phone: phone.trim() || null,
          }).eq('id', editingEmployee.id);

          if (empErr) throw empErr;
        }

        if (empAccessScope === 'global') {
          await syncEmployeeStoreAssignment(editingEmployee.id, [], empGlobalRole);
        } else {
          await syncEmployeeStoreAssignment(editingEmployee.id, storeAssignments);
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
            await syncEmployeeStoreAssignment(newEmp.id, [], empGlobalRole);
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
                  setEmpAccessScope('stores'); setEmpGlobalRole('ADMIN'); setEmpConfirmGlobalAdmin(false);
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
      setEmpAccessScope('stores'); setEmpGlobalRole('ADMIN'); setEmpConfirmGlobalAdmin(false);

      loadData();
    } catch (err: any) {
      showToast(formatFriendlyErrorMessage(err, 'Error al guardar empleado'), 'error');
    } finally {
      setSavingEmployee(false);
    }
  };

  const handleEditEmployeeClick = (emp: Employee) => {
    const targetProfile = profileByEmployeeId[emp.id];
    if (targetProfile?.is_owner && !isOwner) {
      showToast('El registro del Propietario está blindado y solo puede ser administrado por el dueño principal', 'error');
      return;
    }
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
    setEmpConfirmGlobalAdmin(targetProfile?.role === 'ADMIN');
    setIsEmployeeModalOpen(true);
  };

  const handleDeleteEmployeeClick = (empId: string, empName: string) => {
    const targetEmp = employeeById[empId] || employees.find(e => e.id === empId);
    const targetProfile = profileByEmployeeId[empId];

    if (targetProfile?.is_owner) {
      showToast('El registro del Propietario del sistema es intocable y no puede ser dado de baja', 'error');
      return;
    }

    if ((currentEmployeeId && empId === currentEmployeeId) || (currentProfileId && targetProfile?.id === currentProfileId)) {
      showToast('No puedes dar de baja tu propio registro de empleado en sesión activa', 'error');
      return;
    }

    if (targetProfile?.role === 'ADMIN' && !isOwner) {
      showToast('Solo la Cuenta Propietaria tiene autorización para dar de baja a empleados con rol Administrador', 'error');
      return;
    }

    const activeAdmins = allProfiles.filter(p => p.role === 'ADMIN');
    if (targetProfile?.role === 'ADMIN' && activeAdmins.length <= 1) {
      showToast('No se puede dar de baja al único Administrador Global activo del sistema', 'error');
      return;
    }

    if (!checkCanManageTarget(targetProfile, targetEmp, { requireFullCoverage: true })) {
      showToast('Solo puedes dar de baja a empleados que pertenezcan exclusivamente a tus sucursales autorizadas', 'error');
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
    const targetEmp = employeeById[empId] || employees.find(e => e.id === empId);
    const targetProfile = profileByEmployeeId[empId] || allProfiles.find(p => p.id === profileId);

    if (targetProfile?.is_owner) {
      showToast('No se puede desvincular la cuenta del Propietario del sistema', 'error');
      return;
    }

    if (profileId === currentProfileId || (currentEmployeeId && empId === currentEmployeeId)) {
      showToast('No puedes desvincular tu propia cuenta en sesión activa', 'error');
      return;
    }

    if (!checkCanManageTarget(targetProfile, targetEmp, { requireFullCoverage: true })) {
      showToast('Solo puedes desvincular cuentas de empleados que pertenezcan exclusivamente a tus sucursales autorizadas', 'error');
      return;
    }
    setUnlinkingEmployee({ empId, name: empName, profileId });
  };

  const confirmUnlinkEmployee = async () => {
    if (!unlinkingEmployee) return;
    try {
      const empId = unlinkingEmployee.empId;
      const profId = unlinkingEmployee.profileId;

      // 1. Desvincular perfil del empleado dejándolo activo como usuario libre
      const { error: profError } = await supabase
        .from('profiles')
        .update({ employee_id: null })
        .eq('id', profId);

      if (profError) throw profError;

      // 2. Obtener las asignaciones actuales de tiendas vinculadas a esta relación
      const { data: currentStores } = await supabase
        .from('employee_stores')
        .select('*')
        .or(`employee_id.eq.${empId},profile_id.eq.${profId}`);

      // 3. Eliminar las filas compartidas actuales
      await supabase.from('employee_stores').delete().or(`employee_id.eq.${empId},profile_id.eq.${profId}`);

      // 4. Crear copias separadas para que AMBOS (empleado y usuario) conserven sus tiendas
      const empInserts = (currentStores || []).map((s: any) => ({
        employee_id: empId,
        profile_id: null,
        store_id: s.store_id,
        role: s.role,
        role_id: s.role_id || null
      }));

      const profInserts = (currentStores || []).map((s: any) => ({
        employee_id: null,
        profile_id: profId,
        store_id: s.store_id,
        role: s.role,
        role_id: s.role_id || null
      }));

      // Deduplicar por store_id
      const uniqueEmp = Array.from(new Map(empInserts.map((i: any) => [i.store_id, i])).values());
      const uniqueProf = Array.from(new Map(profInserts.map((i: any) => [i.store_id, i])).values());

      const allInserts = [...uniqueEmp, ...uniqueProf];
      if (allInserts.length > 0) {
        const { error: insError } = await supabase.from('employee_stores').insert(allInserts);
        if (insError) throw insError;
      }

      showToast('Acceso desvinculado correctamente. El usuario queda como cuenta libre.', 'success');
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

      if (editingUserId) {
        const isSelf = editingUserId === currentProfileId || (existingProfile?.username && existingProfile.username === currentUsername);
        if (isSelf && role === 'ADMIN') {
          if (userAccessScope !== 'global' || userGlobalRole !== 'ADMIN') {
            showToast('No puedes removerte tus propios privilegios de Administrador Global mientras estás en sesión activa', 'error');
            setSavingUser(false);
            return;
          }
        }

        const activeAdmins = allProfiles.filter(p => p.role === 'ADMIN');
        const isTargetDemoted = existingProfile?.role === 'ADMIN' && (userAccessScope !== 'global' || userGlobalRole !== 'ADMIN');
        if (isTargetDemoted && activeAdmins.length <= 1) {
          showToast('No se puede cambiar el rol al único Administrador Global activo del sistema', 'error');
          setSavingUser(false);
          return;
        }
      }

      if (userAccessScope === 'global') {
        if (!userGlobalRole) {
          showToast('Debes seleccionar un rol global para el usuario', 'error');
          setSavingUser(false);
          return;
        }
        const isPromotingToAdmin = userGlobalRole === 'ADMIN' && (!existingProfile || existingProfile.role !== 'ADMIN');
        if (isPromotingToAdmin && !isOwner) {
          showToast('Solo la Cuenta Propietaria tiene autorización para otorgar o promover usuarios al rol Administrador Global', 'error');
          setSavingUser(false);
          return;
        }
        if (isPromotingToAdmin && !confirmGlobalAccess) {
          showToast('Debes confirmar la casilla de seguridad para otorgar permisos administrativos globales (ADMIN)', 'error');
          setSavingUser(false);
          return;
        }

        const updates: any = {
          username: username.trim(),
          role: userGlobalRole,
          role_id: null,
          employee_id: targetEmpId || null,
          email: email.trim() || null,
          default_store_id: null
        };
        if (hash) updates.password_hash = hash;

        if (editingUserId) {
          const { data: profileResult, error: profileErr } = await supabase.from('profiles').update(updates).eq('id', editingUserId).select('*');
          if (profileErr) throw profileErr;

          await supabase.from('employee_stores').delete().eq('profile_id', editingUserId);
          if (targetEmpId) {
            await supabase.from('employee_stores').delete().eq('employee_id', targetEmpId);
          }

          showToast('Usuario actualizado correctamente', 'success');
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
                  setUserGlobalRole('');
                  setUsername(''); setPassword(''); setEmail(''); setSelectedEmpId(''); setSelectedStoreIds([]); setUserStoreRoles({}); setUserStoreRoleIds({});
                }
              });
              setSavingUser(false);
              return;
            }
          }

          if (selectedEmpId) {
            await supabase.from('employee_stores').delete().eq('employee_id', selectedEmpId);
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

        const unassignedStoreId = assignedStoreIds.find(sId => !userStoreRoleIds[sId] && !userStoreRoles[sId]);
        if (unassignedStoreId) {
          const storeName = storeMap.get(unassignedStoreId) || 'la sucursal seleccionada';
          showToast(`Debes seleccionar un rol para ${storeName}`, 'error');
          setSavingUser(false);
          return;
        }

        const storeAssignments = assignedStoreIds.map(sId => {
          const selectedRoleObj = roles.find(r => r.id === userStoreRoleIds[sId]) || roles.find(r => r.name === userStoreRoles[sId] && (r.store_id === sId || !r.store_id));
          const roleName = selectedRoleObj?.name || userStoreRoles[sId] || getValidStoreRole(null, sId);
          return {
            store_id: sId,
            role: roleName,
            role_id: selectedRoleObj?.id || userStoreRoleIds[sId] || null
          };
        });

        const userStores = activeStoreId ? [activeStoreId] : availableStoreIds;
        const profileStores = (existingProfile?.employee_stores || []).map((es: any) => es.store_id).filter(Boolean);
        const empStores = (targetEmpId && employeeById[targetEmpId]?.employee_stores || []).map((es: any) => es.store_id).filter(Boolean);
        const defaultStore = existingProfile?.default_store_id ? [existingProfile.default_store_id] : [];
        const allTargetStores = [...new Set([...profileStores, ...empStores, ...defaultStore])];
        const canEditUserIdentity = isUserGlobalAdmin || allTargetStores.length === 0 || allTargetStores.every((storeId: any) => userStores.includes(storeId));

        let finalStoreAssignments = storeAssignments;
        if (editingUserId && !canEditUserIdentity && existingProfile) {
          const unmanagedStores = (existingProfile.employee_stores || [])
            .filter(es => !userStores.includes(es.store_id))
            .map(es => ({
              store_id: es.store_id,
              role: es.role || getValidStoreRole(null, es.store_id),
              role_id: (es as any).role_id || null
            }));
          const managedStoreAssignments = storeAssignments.filter(sa => userStores.includes(sa.store_id));
          finalStoreAssignments = [...unmanagedStores, ...managedStoreAssignments];
        }

        const defaultStoreId = finalStoreAssignments.length > 0 ? finalStoreAssignments[0]?.store_id || null : null;
        const primaryRole = finalStoreAssignments[0]?.role || existingProfile?.role || 'CAJERO';
        const primaryRoleId = finalStoreAssignments[0]?.role_id || existingProfile?.role_id || null;

        if (editingUserId) {
          const updates: any = canEditUserIdentity ? {
            username: username.trim(),
            role: primaryRole,
            role_id: primaryRoleId,
            employee_id: targetEmpId || null,
            email: email.trim() || null,
            default_store_id: defaultStoreId
          } : {
            role: primaryRole,
            role_id: primaryRoleId
          };
          if (canEditUserIdentity && hash) updates.password_hash = hash;

          const { data: profileResult, error: profileErr } = await supabase.from('profiles').update(updates).eq('id', editingUserId).select('*');
          if (profileErr) throw profileErr;

          await supabase.from('employee_stores').delete().eq('profile_id', editingUserId);
          if (targetEmpId) {
            await supabase.from('employee_stores').delete().eq('employee_id', targetEmpId);
          }
          if (finalStoreAssignments.length > 0) {
            const inserts = finalStoreAssignments.map(sa => ({
              profile_id: editingUserId,
              employee_id: targetEmpId || null,
              store_id: sa.store_id,
              role: sa.role,
              role_id: sa.role_id || null
            }));
            const { data: empStoreRes, error: empStoreErr } = await supabase.from('employee_stores').insert(inserts).select('*');
            if (empStoreErr) throw empStoreErr;
          }

          showToast('Usuario actualizado correctamente', 'success');
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
                  setUserGlobalRole('');
                  setUsername(''); setPassword(''); setEmail(''); setSelectedEmpId(''); setSelectedStoreIds([]); setUserStoreRoles({}); setUserStoreRoleIds({});
                }
              });
              setSavingUser(false);
              return;
            }
          }

          if (selectedEmpId) {
            await supabase.from('employee_stores').delete().eq('employee_id', selectedEmpId);
          }

          const { data: newProfile, error: profileErr } = await supabase.from('profiles').insert({
            username: username.trim(),
            ...payload
          }).select('*').single();
          if (profileErr) throw profileErr;

          if (storeAssignments.length > 0) {
            const inserts = storeAssignments.map(sa => ({
              profile_id: newProfile.id,
              employee_id: selectedEmpId || null,
              store_id: sa.store_id,
              role: sa.role,
              role_id: sa.role_id || null
            }));
            await supabase.from('employee_stores').insert(inserts);
          }
          showToast('Usuario creado correctamente', 'success');
        }
      }

      // Reset form & reload fresh data
      setIsUserModalOpen(false);
      setEditingUserId(null);
      setUserAccessScope('stores');
      setUserGlobalRole('');
      setUsername(''); setPassword(''); setEmail(''); setSelectedEmpId(''); setSelectedStoreIds([]); setUserStoreRoles({}); setUserStoreRoleIds({});
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
      const { data: newProfile, error } = await supabase.from('profiles').insert({
        username: empUsername.trim(),
        role: primaryRole,
        role_id: primaryRoleId,
        password_hash: hash,
        employee_id: linkingEmployee.id,
        email: empEmail.trim() || null,
        default_store_id: defaultStoreId
      }).select('id').single();
      if (error) throw error;

      // Si el empleado tiene tiendas físicas asignadas, actualizar los roles en employee_stores también
      if (storeAssignments.length > 0) {
        await supabase.from('employee_stores').delete().or(`employee_id.eq.${linkingEmployee.id},profile_id.eq.${newProfile.id}`);
        await supabase.from('employee_stores').insert(
          storeAssignments.map(sa => ({
            profile_id: newProfile.id,
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
      const empStoreIds = (linkingEmployee.employee_stores || []).map(es => es.store_id);

      let userStoreIds: string[] = [];
      if (selectedUser?.employee_stores && selectedUser.employee_stores.length > 0) {
        userStoreIds = selectedUser.employee_stores.map(es => es.store_id);
      } else if (selectedUser?.default_store_id) {
        userStoreIds = [selectedUser.default_store_id];
      }

      const isUserGlobalAdmin = selectedUser?.role === 'ADMIN' || selectedUser?.role_id === null;

      const empStoresSorted = [...empStoreIds].sort().join(',');
      const userStoresSorted = [...userStoreIds].sort().join(',');
      const hasConflict = empStoreIds.length > 0 && userStoreIds.length > 0 && empStoresSorted !== userStoresSorted;

      if (!isUserGlobalAdmin && hasConflict) {
        showToast('El empleado está asignado a unas tiendas, pero el usuario pertenece a otra distinta. Por favor, asegúrate de que pertenezcan a las mismas tiendas antes de vincularlos.', 'error');
        setIsLinking(false);
        return;
      }

      const targetStoreIds = empStoreIds.length > 0 ? empStoreIds : userStoreIds;
      const defaultStoreId = targetStoreIds[0] || linkingEmployee.employee_stores?.[0]?.store_id || selectedUser?.default_store_id || null;
      const updates: any = { employee_id: linkingEmployee.id };
      if (defaultStoreId) updates.default_store_id = defaultStoreId;

      const { error } = await supabase.from('profiles').update(updates).eq('id', linkExistingUserId);
      if (error) throw error;

      // Sincronizar tiendas del empleado con employee_stores del perfil vinculado
      if (targetStoreIds.length > 0) {
        const existingProf = allProfiles.find(p => p.id === linkExistingUserId);
        const userStores = existingProf?.employee_stores || [];
        const empStores = linkingEmployee.employee_stores || [];

        const inserts = targetStoreIds.map(storeId => {
          const empStoreMatch = empStores.find((es: any) => es.store_id === storeId);
          const userStoreMatch = userStores.find((ues: any) => ues.store_id === storeId);
          const rawRole = empStoreMatch?.role || userStoreMatch?.role || (existingProf?.role && existingProf.role !== 'DELETED' ? existingProf.role : null);
          const finalRole = getValidStoreRole(rawRole, storeId);

          let roleId = (empStoreMatch as any)?.role_id || (userStoreMatch as any)?.role_id || null;
          if (!roleId) {
            const matched = roles.find(r => r.name === finalRole && (r.store_id === storeId || !r.store_id));
            roleId = matched?.id || null;
          }

          return {
            profile_id: linkExistingUserId,
            employee_id: linkingEmployee.id,
            store_id: storeId,
            role: finalRole,
            role_id: roleId
          };
        });

        const primaryRole = inserts[0]?.role || 'CAJERO';
        const primaryRoleId = inserts[0]?.role_id || null;

        await supabase.from('profiles').update({
          role: primaryRole,
          role_id: primaryRoleId
        }).eq('id', linkExistingUserId);

        await supabase.from('employee_stores').delete().or(`profile_id.eq.${linkExistingUserId},employee_id.eq.${linkingEmployee.id}`);
        await supabase.from('employee_stores').insert(inserts);
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
    if (profile.is_owner && !isOwner) {
      showToast('La Cuenta Propietaria está blindada y solo puede ser administrada por el dueño principal', 'error');
      return;
    }
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

    const isGlobal = profile.role === 'ADMIN' ||
      (!profile.default_store_id && (!profile.employee_stores || profile.employee_stores.length === 0) && (!targetEmp?.employee_stores || targetEmp.employee_stores.length === 0));

    if (isGlobal) {
      setUserAccessScope('global');
      setUserGlobalRole(profile.role || '');
    } else {
      setUserAccessScope('stores');
      setUserGlobalRole('');
    }

    const profileStores = profile.employee_stores && profile.employee_stores.length > 0
      ? profile.employee_stores
      : (targetEmp?.employee_stores || []);

    if (profileStores && profileStores.length > 0) {
      const ids = profileStores.map((es: any) => es.store_id);
      const rolesMap: Record<string, string> = {};
      const roleIdsMap: Record<string, string> = {};
      profileStores.forEach((es: any) => {
        const rawRole = es.role || profile.role;
        rolesMap[es.store_id] = rawRole;
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
      setUserStoreRoles({ [profile.default_store_id]: profile.role });
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
    setConfirmGlobalAccess(profile.role === 'ADMIN');
    setIsUserModalOpen(true);
  };

  const handleCancelEdit = () => {
    setUsername(''); setPassword(''); setEmail(''); setSelectedEmpId(''); setSelectedStoreIds([]); setUserStoreRoles({}); setUserStoreRoleIds({});
    setUserAccessScope('stores'); setUserGlobalRole(''); setConfirmGlobalAccess(false);
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
          const rawRoleName = storeRoles[store.id];
          const matchedByRoleId = storeRoleIds?.[store.id] ? storeAvailableRoles.find(r => r.id === storeRoleIds[store.id]) : null;
          const matchedByName = rawRoleName ? storeAvailableRoles.find(r => r.name === rawRoleName) : null;
          const selectedValue = matchedByRoleId?.id || matchedByName?.id || '';

          const isStoreAllowedToEditRole = isUserGlobalAdmin || (activeStoreId ? store.id === activeStoreId : availableStoreIds.includes(store.id));

          return (
            <div
              key={store.id}
              className={`p-3 rounded-2xl border transition-all ${isChecked
                ? 'bg-indigo-50/80 border-indigo-200 shadow-sm'
                : 'bg-background border-border hover:bg-secondary/40'
                } ${isDisabled ? 'opacity-80' : ''}`}
            >
              <div className="flex items-center justify-between gap-2.5">
                <label className="flex items-center gap-2.5 cursor-pointer select-none font-semibold text-sm text-foreground shrink-0 min-w-0">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer shrink-0"
                    checked={isChecked}
                    disabled={isDisabled || isStoreToggleDisabled || !isStoreAllowedToEditRole}
                    onChange={(e) => onToggleStore(store.id, e.target.checked)}
                  />
                  <span className="whitespace-nowrap font-bold text-foreground">{store.name}</span>
                </label>

                {isChecked && (
                  <div className="flex items-center gap-2 shrink-0 min-w-0">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 hidden xs:inline">Rol:</span>
                    <StoreRoleDropdown
                      roles={storeAvailableRoles}
                      selectedRoleId={selectedValue}
                      disabled={isDisabled || !isStoreAllowedToEditRole}
                      getRoleBadgeStyle={getRoleBadgeStyle}
                      onSelect={(selectedRole) => {
                        onRoleChange(store.id, selectedRole.name, selectedRole.id);
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const ROLE_PALETTE = [
    'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
    'bg-teal-500/10 border-teal-500/30 text-teal-600 dark:text-teal-400',
    'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400',
    'bg-cyan-500/10 border-cyan-500/30 text-cyan-600 dark:text-cyan-400',
    'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400',
    'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400',
    'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400',
    'bg-violet-500/10 border-violet-500/30 text-violet-600 dark:text-violet-400',
  ];

  const getRoleBadgeStyle = (roleName?: string | null): string => {
    if (!roleName) return 'bg-muted border-border text-muted-foreground';
    const normalized = roleName.trim().toUpperCase();

    // 1. ADMIN es único y exclusivo con morado imperial
    if (normalized === 'ADMIN') {
      return 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400';
    }

    // 2. Roles estándar clave
    if (normalized.includes('JEFE')) {
      return 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400';
    }
    if (normalized === 'CAJERA' || normalized === 'CAJERO') {
      return 'bg-cyan-500/10 border-cyan-500/30 text-cyan-600 dark:text-cyan-400';
    }
    if (normalized === 'MOSTRADOR') {
      return 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400';
    }
    if (normalized.includes('CONTADOR') || normalized.includes('CONTABILIDAD')) {
      return 'bg-teal-500/10 border-teal-500/30 text-teal-600 dark:text-teal-400';
    }
    if (normalized.includes('MULTIFUNCIÓN') || normalized.includes('MULTIFUNCION')) {
      return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400';
    }

    // 3. Hash determinista para cualquier rol nuevo o personalizado
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      hash = (hash + normalized.charCodeAt(i) * (i + 1)) % ROLE_PALETTE.length;
    }
    const idx = Math.abs(hash) % ROLE_PALETTE.length;
    return ROLE_PALETTE[idx] || (ROLE_PALETTE[0] as string);
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
        <span className="text-xs text-muted-foreground italic">—</span>
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
    unlinkingEmployee, setUnlinkingEmployee, handleUnlinkEmployeeClick, confirmUnlinkEmployee,
    empConfirmGlobalAdmin, setEmpConfirmGlobalAdmin,
    currentProfileId, currentEmployeeId, currentUsername,
    isOwner
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