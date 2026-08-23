'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { AccessDeniedView } from '../../components/AccessDeniedView';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import StoreSelector from '../../components/StoreSelector';
import StoreSwitcher from '../../components/StoreSwitcher';
import bcrypt from 'bcryptjs';

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
const PERMISSION_GROUPS = [
  {
    app: 'Punto de Venta',
    mainKey: 'access_pos',
    icon: ShoppingCart,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    description: 'Acceso base al catálogo, carrito de compras y emisión de proformas.',
    subPermissions: [
      { key: 'view_cashier_name', label: 'Ver quién atendió la proforma' },
      { key: 'pos_open_caja', label: 'Apertura de Caja' },
      { key: 'pos_close_caja', label: 'Cierre de Caja' },
      { key: 'pos_switch_account', label: 'Ver Cuentas Guardadas en este Equipo' },
      { key: 'pos_remove_saved_account', label: 'Quitar Cuentas Guardadas' },
      { key: 'pos_logout', label: 'Cerrar todas las Cuentas Guardadas' }
    ]
  },
  {
    app: 'Historial de Proformas',
    mainKey: 'access_proformas',
    icon: ScrollText,
    color: 'text-teal-500',
    bgColor: 'bg-teal-500/10',
    borderColor: 'border-teal-500/20',
    description: 'Consulta e impresión de proformas emitidas.',
    subPermissions: [
      { key: 'history_cancel_proforma', label: 'Anular / Eliminar Proformas' }
    ]
  },
  {
    app: 'Caja',
    mainKey: 'access_caja',
    icon: Banknote,
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
    description: 'Módulo de cobros, liquidaciones y control de ingresos.',
    subPermissions: [
      { key: 'delete_sales', label: 'Anular/Eliminar Ventas reales' },
    ]
  },
  {
    app: 'Contabilidad',
    mainKey: 'access_contabilidad',
    icon: FileSpreadsheet,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    description: 'Acceso a reporteadores e importaciones contables.',
    subPermissions: []
  },
  {
    app: 'Clientes Frecuentes',
    mainKey: 'access_clientes',
    icon: Contact,
    color: 'text-pink-500',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/20',
    description: 'Consulta de directorio de clientes caseros.',
    subPermissions: [
      { key: 'customers_create', label: 'Crear Clientes Frecuentes' },
      { key: 'customers_edit', label: 'Editar Datos de Clientes' },
      { key: 'customers_delete', label: 'Eliminar Clientes Frecuentes' }
    ]
  },
  {
    app: 'Catálogo / Inventario',
    mainKey: 'access_inventory',
    icon: PackageSearch,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    description: 'Consulta de stock de productos y servicios registrados.',
    subPermissions: [
      { key: 'inventory_create', label: 'Crear Productos, Familias y Servicios' },
      { key: 'inventory_edit', label: 'Editar Productos, Precios, Familias y Servicios' },
      { key: 'inventory_delete', label: 'Eliminar Productos, Familias y Servicios' }
    ]
  },
  {
    app: 'Personal',
    mainKey: 'access_personal',
    icon: Users,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/20',
    description: 'Acceso al directorio de empleados y personal.',
    subPermissions: [
      { key: 'personal_create_user', label: 'Crear y Vincular Empleados o Cuentas de Usuario' },
      { key: 'personal_edit_user', label: 'Editar Empleados, Usuarios, Contraseñas y Roles' },
      { key: 'personal_delete_user', label: 'Dar de Baja o Eliminar Empleados y Usuarios' },
      { key: 'personal_manage_roles', label: 'Gestionar Matriz de Roles y Permisos' }
    ]
  },
  {
    app: 'Dashboard',
    mainKey: 'access_dashboard',
    icon: BarChart3,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    description: 'Visualización de métricas de ventas y KPIs.',
    subPermissions: []
  },
  {
    app: 'Configuración',
    mainKey: 'access_settings',
    icon: Settings,
    color: 'text-slate-500',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/20',
    description: 'Acceso base al módulo e impresoras registradas.',
    subPermissions: [
      { key: 'settings_manage_stores', label: 'Gestionar Tiendas (Crear, Editar y Desactivar Sucursales)' },
      { key: 'settings_printers_manage', label: 'Crear y Editar Impresoras y Ticketeras' },
      { key: 'settings_printers_delete', label: 'Eliminar Impresoras Registradas' },
      { key: 'settings_finance', label: 'Modificar Tarifas y Comisiones Izipay' }
    ]
  }
];

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
export default function PersonalPage() {
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

  // ── Role Deletion & Warning Modal state
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);
  const [roleAssignedUsers, setRoleAssignedUsers] = useState<Profile[]>([]);
  const [isRoleWarningModalOpen, setIsRoleWarningModalOpen] = useState(false);
  const [isRoleConfirmModalOpen, setIsRoleConfirmModalOpen] = useState(false);
  const [isDeletingRole, setIsDeletingRole] = useState(false);

  // ── Employee Deletion Modal state
  const [deletingEmployee, setDeletingEmployee] = useState<{ id: string; name: string } | null>(null);

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
      const group = PERMISSION_GROUPS.find(g => g.mainKey === permKey);
      if (group && group.subPermissions) {
        group.subPermissions.forEach(sub => {
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

      // Desvincular perfiles asociados para que no queden referencias fantasma
      await supabase.from('profiles').update({ employee_id: null }).eq('employee_id', deletingEmployee.id);

      showToast('Empleado deshabilitado correctamente', 'success');
      setDeletingEmployee(null);
      loadData();
    } catch (err: any) {
      showToast(formatFriendlyErrorMessage(err, 'Error al deshabilitar empleado'), 'error');
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
                  <div className="flex items-center gap-2 pl-7 sm:pl-0">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Rol:</span>
                    <select
                      value={selectedValue}
                      disabled={isDisabled}
                      onChange={(e) => {
                        const selectedRole = storeAvailableRoles.find(r => r.id === e.target.value);
                        if (selectedRole) {
                          onRoleChange(store.id, selectedRole.name, selectedRole.id);
                        }
                      }}
                      className="h-9 px-3 text-xs font-bold rounded-xl border border-indigo-200 bg-white text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm cursor-pointer"
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

  if (!isHydrated) return null;
  if (!permissions?.access_personal) {
    return <AccessDeniedView moduleName="Módulo de Personal" />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* ── Header ── */}
      <header className="bg-card border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 sm:p-6 shadow-sm shrink-0">
        <div className="flex items-center gap-4 pt-2 sm:pt-0">
          <Link href="/hub" className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-secondary">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
              <UserCog className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-none">Módulo de Personal</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Gestión de Empleados y Accesos</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
          <StoreSwitcher />
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-muted-foreground hover:bg-secondary text-xs font-bold transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>

          <div className="flex overflow-x-auto whitespace-nowrap scrollbar-hide bg-secondary rounded-lg p-1 gap-1 w-full sm:w-auto border-b sm:border-0 border-border pb-1 sm:pb-1">
            {[
              { id: 'empleados' as Tab, label: 'Empleados' },
              { id: 'usuarios' as Tab, label: 'Usuarios (Perfiles)' },
              ...(role === 'ADMIN' || Boolean(permissions?.personal_manage_roles) ? [{ id: 'roles' as Tab, label: 'Roles y Permisos' }] : [])
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => handleTabChange(id)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${activeTab === id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>



      {/* ── Tab Content ── */}
      <main className="flex-1 p-6 max-w-screen-xl w-full mx-auto">

        {/* ════ TAB 1: EMPLEADOS ════ */}
        {activeTab === 'empleados' && (
          <div className="w-full">
            {/* List */}
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-sm font-bold uppercase tracking-wider">Personal Registrado</h2>
                  <span className="text-xs text-muted-foreground font-mono bg-secondary px-2.5 py-1 rounded-full">
                    {visibleEmployees.length} empleado{visibleEmployees.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                  <label className="flex items-center gap-2 cursor-pointer select-none border border-border bg-background px-3 py-1.5 rounded-xl hover:bg-secondary/40 transition-colors shrink-0">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={showInactiveEmployees}
                      onChange={(e) => setShowInactiveEmployees(e.target.checked)}
                    />
                    <div className={`h-5 w-9 rounded-full transition-colors relative ${showInactiveEmployees ? 'bg-amber-500' : 'bg-muted'}`}>
                      <div className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform shadow ${showInactiveEmployees ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                    <span className="text-xs font-bold text-muted-foreground">Ver Inactivos</span>
                  </label>

                  {Boolean(permissions?.personal_create_user) && (
                    <button
                      onClick={() => {
                        setEditingEmployee(null);
                        setFullName(''); setDni(''); setPhone(''); setCreateAccess(false);
                        const initialStoreId = activeStoreId || availableStores[0]?.id || '';
                        setSelectedModalStoreId(initialStoreId);
                        if (initialStoreId) {
                          setEmpStoreIds([initialStoreId]);
                          const defaultRoleName = getValidStoreRole(null, initialStoreId);
                          const storeAvailableRoles = roles.filter(r => r.name !== 'ADMIN' && (r.store_id === initialStoreId || !r.store_id));
                          const defaultRoleId = storeAvailableRoles.find(r => r.name === defaultRoleName)?.id || storeAvailableRoles[0]?.id || '';
                          setEmpStoreRoles({ [initialStoreId]: defaultRoleName });
                          setEmpStoreRoleIds({ [initialStoreId]: defaultRoleId });
                        }
                        setIsEmployeeModalOpen(true);
                      }}
                      className="h-9 px-4 flex items-center justify-center gap-2 rounded-lg font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" /> Nuevo Empleado
                    </button>
                  )}
                </div>
              </div>
              {loading ? (
                <div className="p-10 flex items-center justify-center gap-3 text-muted-foreground">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span className="text-sm font-medium">Cargando...</span>
                </div>
              ) : visibleEmployees.length === 0 ? (
                <div className="p-10 text-center">
                  <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground font-medium">No hay empleados registrados</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Usa el formulario de la izquierda para añadir personal</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 border-b border-border text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider">
                          <div className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors">Nombre Completo <ArrowUpDown className="w-3.5 h-3.5" /></div>
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider">
                          <div className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors">DNI <ArrowUpDown className="w-3.5 h-3.5" /></div>
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider">
                          <div className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors">Tienda Asignada <ArrowUpDown className="w-3.5 h-3.5" /></div>
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider">
                          <div className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors">Rol de Acceso <ArrowUpDown className="w-3.5 h-3.5" /></div>
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider">
                          <div className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors">Usuario Vinculado <ArrowUpDown className="w-3.5 h-3.5" /></div>
                        </th>
                        <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {visibleEmployees.map(emp => {
                        const profile = profileByEmployeeId[emp.id];
                        const isInactive = emp.is_active === false;
                        const canManageEmp = checkCanManageTarget(profile, emp);
                        const { storeElement, roleElement } = renderStoreAndRoleBadges(
                          emp.employee_stores || [],
                          profile?.role,
                          !profile
                        );

                        return (
                          <tr key={emp.id} className={isInactive ? "bg-muted/40 opacity-60 hover:opacity-100 transition-all" : "hover:bg-secondary/20 transition-colors"}>
                            <td className="px-5 py-3.5 font-bold flex items-center gap-2">
                              <span>{emp.full_name}</span>
                              {isInactive && (
                                <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                                  Inactivo
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground font-bold">{emp.dni}</td>
                            <td className="px-5 py-3.5">{storeElement}</td>
                            <td className="px-5 py-3.5">{roleElement}</td>
                            <td className="px-5 py-3.5">
                              {profile ? (
                                <span className="text-xs text-indigo-500 font-bold font-mono">@{profile.username}</span>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">—</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {isInactive ? (
                                  !canManageEmp ? null : (
                                    <button
                                      onClick={() => handleRestoreEmployee(emp.id)}
                                      className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-bold"
                                      title="Reactivar empleado"
                                    >
                                      <RotateCcw className="w-4 h-4" />
                                      <span>Reactivar</span>
                                    </button>
                                  )
                                ) : (
                                  <>
                                    {!profile && Boolean(permissions?.personal_create_user) && (!canManageEmp ? null : (
                                      <button
                                        onClick={() => {
                                          if (!checkCanManageTarget(null, emp)) {
                                            showToast('Solo puedes gestionar personal asignado a tu misma sucursal local', 'error');
                                            return;
                                          }
                                          setLinkingEmployee(emp);
                                          const defaultRole = roles.find(r => r.name === 'MOSTRADOR') || roles.find(r => r.name !== 'ADMIN') || roles[0];
                                          setLinkRoleId(defaultRole?.id || '');
                                        }}
                                        className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors inline-flex"
                                        title="Vincular a un Acceso"
                                      >
                                        <KeyRound className="w-4 h-4" />
                                      </button>
                                    ))}
                                    {Boolean(permissions?.personal_edit_user) && (!canManageEmp ? null : (
                                      <button
                                        onClick={() => handleEditEmployeeClick(emp)}
                                        className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors inline-flex"
                                        title="Editar datos de empleado"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                    ))}
                                    {Boolean(permissions?.personal_delete_user) && (!canManageEmp ? null : (
                                      <button
                                        onClick={() => handleDeleteEmployeeClick(emp.id, emp.full_name)}
                                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors inline-flex"
                                        title="Deshabilitar empleado"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    ))}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════ TAB 2: USUARIOS Y ACCESOS ════ */}
        {activeTab === 'usuarios' && (
          <div className="w-full">
            {/* Credentials list */}
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-sm font-bold uppercase tracking-wider">Usuarios con Acceso</h2>
                  <span className="text-xs text-muted-foreground font-mono bg-secondary px-2.5 py-1 rounded-full">
                    {activeProfiles.length} usuario{activeProfiles.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                  <label className="flex items-center gap-2 cursor-pointer select-none border border-border bg-background px-3 py-1.5 rounded-xl hover:bg-secondary/40 transition-colors shrink-0">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={showInactiveUsers}
                      onChange={(e) => setShowInactiveUsers(e.target.checked)}
                    />
                    <div className={`h-5 w-9 rounded-full transition-colors relative ${showInactiveUsers ? 'bg-amber-500' : 'bg-muted'}`}>
                      <div className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform shadow ${showInactiveUsers ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                    <span className="text-xs font-bold text-muted-foreground">Ver Inactivos</span>
                  </label>

                  {Boolean(permissions?.personal_create_user) && (
                    <button
                      onClick={() => {
                        setUsername('');
                        setPassword('');
                        setEmail('');
                        setSelectedEmpId('');
                        setUserStoreRoles({});
                        setUserStoreRoleIds({});
                        setSelectedStoreIds([]);
                        setEditingUserId(null);
                        setConfirmGlobalAccess(false);
                        setModalResetToken(prev => prev + 1);
                        const initialStoreId = activeStoreId || availableStores[0]?.id || '';
                        setSelectedModalStoreId(initialStoreId);
                        if (initialStoreId) {
                          const defaultRoleName = getValidStoreRole(null, initialStoreId);
                          const storeAvailableRoles = roles.filter(r => r.name !== 'ADMIN' && (r.store_id === initialStoreId || !r.store_id));
                          const defaultRoleId = storeAvailableRoles.find(r => r.name === defaultRoleName)?.id || storeAvailableRoles[0]?.id || '';
                          setUserStoreRoles({ [initialStoreId]: defaultRoleName });
                          setUserStoreRoleIds({ [initialStoreId]: defaultRoleId });
                        }
                        setIsUserModalOpen(true);
                      }}
                      className="h-9 px-4 flex items-center justify-center gap-2 rounded-lg font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" /> Nuevo Acceso
                    </button>
                  )}
                </div>
              </div>
              {loading ? (
                <div className="p-10 flex items-center justify-center gap-3 text-muted-foreground">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span className="text-sm font-medium">Cargando...</span>
                </div>
              ) : activeProfiles.length === 0 ? (
                <div className="p-10 text-center">
                  <ShieldCheck className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground font-medium">No hay usuarios registrados</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Usa el formulario para crear accesos al sistema</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 border-b border-border text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider">
                          <div className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors">Usuario <ArrowUpDown className="w-3.5 h-3.5" /></div>
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider">
                          <div className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors">Rol <ArrowUpDown className="w-3.5 h-3.5" /></div>
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider">
                          <div className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors">Tienda Asignada <ArrowUpDown className="w-3.5 h-3.5" /></div>
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider">
                          <div className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors">Empleado Vinculado <ArrowUpDown className="w-3.5 h-3.5" /></div>
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider">
                          <div className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors">Gmail <ArrowUpDown className="w-3.5 h-3.5" /></div>
                        </th>
                        <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {activeProfiles.map(profile => {
                        const isDeleted = profile.role === 'DELETED';
                        const linkedEmp = profile.employee_id ? employeeById[profile.employee_id] : null;

                        let empStores = profile.employee_stores && profile.employee_stores.length > 0
                          ? profile.employee_stores
                          : (linkedEmp?.employee_stores || []);

                        if (empStores.length === 0 && profile.default_store_id) {
                          const fallbackStoreName = storeMap.get(profile.default_store_id) || profile.stores?.[0]?.name || 'Tienda';
                          empStores = [{ store_id: profile.default_store_id, role: profile.role, stores: { name: fallbackStoreName } }];
                        }

                        const { storeElement, roleElement } = renderStoreAndRoleBadges(
                          empStores,
                          profile.role,
                          false
                        );

                        const canManageUser = checkCanManageTarget(profile, linkedEmp);

                        return (
                          <tr key={profile.id} className={isDeleted ? "bg-muted/40 opacity-60 hover:opacity-100 transition-all" : "hover:bg-secondary/20 transition-colors"}>
                            <td className="px-5 py-3.5 font-mono text-xs font-bold text-indigo-500 flex items-center gap-2">
                              <span>@{profile.username}</span>
                              {isDeleted && (
                                <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                                  Inactivo
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3.5">{roleElement}</td>
                            <td className="px-5 py-3.5">{storeElement}</td>
                            <td className="px-5 py-3.5 text-xs text-muted-foreground font-medium">
                              {profile.employee_id ? employeeById[profile.employee_id]?.full_name : '—'}
                            </td>
                            <td className="px-5 py-3.5 text-xs text-muted-foreground">
                              {profile.email || '—'}
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              <div className="flex items-center justify-center gap-2">
                                {isDeleted ? (
                                  !canManageUser ? null : (
                                    <button
                                      onClick={() => handleRestoreUser(profile.id)}
                                      className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-bold"
                                      title="Reactivar acceso de usuario"
                                    >
                                      <RotateCcw className="w-4 h-4" />
                                      <span>Reactivar</span>
                                    </button>
                                  )
                                ) : (
                                  <>
                                    {Boolean(permissions?.personal_edit_user) && (!canManageUser ? null : (
                                      <button
                                        onClick={() => handleEditClick(profile)}
                                        className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors inline-flex"
                                        title="Editar usuario"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                    ))}
                                    {Boolean(permissions?.personal_delete_user) && (!canManageUser ? null : (
                                      <button
                                        onClick={() => {
                                          setDeletingUserId(profile.id);
                                          setDeletingUsername(profile.username);
                                        }}
                                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors inline-flex"
                                        title="Desactivar usuario"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    ))}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════ TAB 3: ROLES Y PERMISOS ════ */}
        {activeTab === 'roles' && (
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
              <h2 className="text-sm font-bold uppercase tracking-wider">Matriz de Roles y Permisos</h2>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                {/* Toggle Mostrar Inactivos */}
                <label className="flex items-center gap-2 cursor-pointer select-none pr-3 border-r border-border">
                  <div className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={showInactiveRoles}
                      onChange={(e) => setShowInactiveRoles(e.target.checked)}
                    />
                    <div className={`h-5 w-9 rounded-full transition-colors ${showInactiveRoles ? 'bg-amber-500' : 'bg-muted'}`} />
                    <div className={`absolute left-0.5 h-4 w-4 rounded-full bg-white transition-transform shadow ${showInactiveRoles ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                  <span className="text-xs font-bold text-muted-foreground">Mostrar Inactivos</span>
                </label>
                <button
                  onClick={handleRestorePermissions}
                  disabled={!hasUnsavedRoleChanges || savingPermissions}
                  className={`h-9 px-4 flex items-center justify-center gap-2 rounded-lg font-bold text-xs transition-colors shadow-sm ${hasUnsavedRoleChanges ? 'bg-red-500/10 hover:bg-red-600 text-red-600 hover:text-white border border-red-500/20' : 'bg-secondary/50 text-muted-foreground cursor-not-allowed opacity-60'
                    }`}
                >
                  {hasUnsavedRoleChanges ? 'Descartar Cambios' : 'Sin cambios'}
                </button>
                <button
                  onClick={handleSavePermissions}
                  disabled={!hasUnsavedRoleChanges || savingPermissions}
                  className={`h-9 px-4 flex items-center justify-center gap-2 rounded-lg font-bold text-xs transition-colors shadow-sm ${hasUnsavedRoleChanges ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-secondary/50 text-muted-foreground cursor-not-allowed'
                    }`}
                >
                  {savingPermissions ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Guardar Cambios
                </button>
                <button
                  onClick={() => {
                    setNewRoleName('');
                    setNewRoleDesc('');
                    setNewRoleScopeStoreId(isUserGlobalAdmin ? '' : (activeStoreId || ''));
                    setIsRoleModalOpen(true);
                  }}
                  className="h-9 px-4 flex items-center justify-center gap-2 rounded-lg font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm ml-2"
                >
                  <Plus className="w-3.5 h-3.5" /> Nuevo Rol
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/10 border-b border-border">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase text-muted-foreground tracking-wider w-1/4">Permiso / Módulo</th>
                    {visibleRoles.map(r => {
                      const isInactive = r.is_active === false;
                      const isGlobalRole = !r.store_id || r.is_system;
                      const isReadOnly = isGlobalRole && role !== 'ADMIN';
                      return (
                        <th
                          key={r.id}
                          title={r.description || r.name}
                          className={`px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground transition-opacity ${isInactive ? 'opacity-60' : ''}`}
                        >
                          <div className="flex flex-col items-center justify-center gap-1.5">
                            <div className="flex items-center gap-1.5">
                              <span>{r.name}</span>
                              {r.name === 'ADMIN' ? (
                                <span title="Rol del sistema protegido" className="inline-block align-middle">
                                  <Lock className="w-3.5 h-3.5 text-purple-500" />
                                </span>
                              ) : isReadOnly ? (
                                <span title="Rol global protegido" className="inline-block align-middle">
                                  <Lock className="w-3.5 h-3.5 text-purple-400" />
                                </span>
                              ) : null}
                            </div>
                            {isInactive ? (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                                Inactivo
                              </span>
                            ) : !r.store_id || r.name === 'ADMIN' ? (
                              <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                                Acceso Global
                              </span>
                            ) : r.store_id ? (
                              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                {r.stores?.name || storeMap.get(r.store_id) || 'Tienda'}
                              </span>
                            ) : null}

                            {r.name !== 'ADMIN' && !isReadOnly && (
                              <div className="flex items-center gap-1 ml-1 opacity-70 hover:opacity-100 transition-opacity">
                                {isInactive ? (
                                  <button
                                    type="button"
                                    onClick={() => handleRestoreRole(r.id, r.name)}
                                    title="Reactivar rol"
                                    className="p-1 text-muted-foreground hover:text-emerald-500 transition-colors rounded"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingRole(r);
                                        setEditRoleName(r.name);
                                        setEditRoleDesc(r.description || '');
                                        setIsEditRoleModalOpen(true);
                                      }}
                                      title="Renombrar / Editar rol"
                                      className="p-1 text-muted-foreground hover:text-amber-500 transition-colors rounded"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteRole(r)}
                                      title="Desactivar rol"
                                      className="p-1 text-muted-foreground hover:text-red-500 transition-colors rounded"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {PERMISSION_GROUPS.map((group) => {
                    const Icon = group.icon;
                    return (
                      <React.Fragment key={group.mainKey}>
                        {/* Fila del Permiso Principal (Módulo) */}
                        <tr className="bg-muted/5">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${group.bgColor} border ${group.borderColor} shrink-0`}>
                                <Icon className={`w-4 h-4 ${group.color}`} />
                              </div>
                              <div>
                                <span className="font-bold text-sm block">{group.app}</span>
                                {group.description && (
                                  <span className="text-[11px] text-muted-foreground font-normal leading-tight block mt-0.5 max-w-sm">
                                    {group.description}
                                  </span>
                                )}
                                {group.subPermissions.length > 0 && (
                                  <span className="inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40">
                                    <Info className="w-3 h-3 text-blue-500 shrink-0" />
                                    Posee sub-permisos en las filas inferiores
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          {visibleRoles.map(r => {
                            const isGlobalRole = !r.store_id || r.is_system;
                            const isReadOnly = isGlobalRole && role !== 'ADMIN';
                            return (
                              <td key={r.id} className="px-6 py-4 text-center">
                                <div className="flex justify-center">
                                  <label className={`relative inline-flex items-center cursor-pointer ${r.is_system || isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    <input
                                      type="checkbox"
                                      className="sr-only peer"
                                      checked={Boolean(r.name === 'ADMIN' || (r.permissions && r.permissions[group.mainKey]))}
                                      disabled={r.is_system || isReadOnly}
                                      onChange={(e) => handleTogglePermission(r.id, r.permissions || {}, group.mainKey, e.target.checked)}
                                    />
                                    <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                                  </label>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                        {/* Filas de Sub-permisos */}
                        {group.subPermissions.map(sub => (
                          <tr key={sub.key} className="hover:bg-secondary/10 transition-colors">
                            <td className="px-6 py-3 pl-16">
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30"></div>
                                <span className="text-sm text-muted-foreground">{sub.label}</span>
                              </div>
                            </td>
                            {visibleRoles.map(r => {
                              const isGlobalRole = !r.store_id || r.is_system;
                              const isReadOnly = isGlobalRole && role !== 'ADMIN';
                              const isMainEnabled = Boolean(r.name === 'ADMIN' || (r.permissions && r.permissions[group.mainKey]));
                              const isSubEnabled = Boolean(r.name === 'ADMIN' || (r.permissions && r.permissions[sub.key]));
                              const isDisabled = r.is_system || isReadOnly || !isMainEnabled;
                              return (
                                <td key={r.id} className="px-6 py-3 text-center">
                                  <div className={`flex justify-center transition-opacity ${!isMainEnabled ? 'opacity-30' : ''}`}>
                                    <label className={`relative inline-flex items-center cursor-pointer ${isDisabled ? 'cursor-not-allowed' : ''}`}>
                                      <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={isMainEnabled && isSubEnabled}
                                        disabled={isDisabled}
                                        onChange={(e) => handleTogglePermission(r.id, r.permissions || {}, sub.key, e.target.checked)}
                                      />
                                      <div className={`w-8 h-4 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-3 after:w-3 after:transition-all ${isMainEnabled ? 'peer-checked:bg-indigo-400' : 'peer-checked:bg-muted-foreground'}`}></div>
                                    </label>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-5 bg-muted/20 border-t border-border flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-medium">
                Nota: Los roles marcados con el escudo azul son roles de sistema y sus permisos no pueden ser modificados.
              </p>
            </div>
          </div>
        )}

      </main>

      {/* ── Confirm Delete User Dialog ── */}
      <ConfirmDialog
        isOpen={!!deletingUserId}
        title="¿Desactivar Acceso de Usuario?"
        description={`¿Estás seguro de que deseas desactivar el acceso para el usuario @${deletingUsername}? Esta acción mantendrá el historial intacto pero le impedirá iniciar sesión.`}
        confirmText="Sí, desactivar"
        cancelText="Cancelar"
        onConfirm={handleDeleteUser}
        onCancel={() => setDeletingUserId(null)}
        isLoading={isDeletingUser}
        isDestructive={true}
      />

      {/* ── Pending Restoration Warning Modal ── */}
      {pendingRestoration && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card rounded-2xl shadow-xl border border-border overflow-hidden p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-amber-500">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <ShieldAlert className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">Cuenta Inactiva Detectada</h3>
                <p className="text-xs text-muted-foreground font-mono">@{pendingRestoration.username}</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              El nombre de usuario <strong className="text-foreground font-mono">@{pendingRestoration.username}</strong> pertenecía a una cuenta anteriormente deshabilitada en el sistema.
            </p>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-900 font-medium">
              Al confirmar, <strong className="font-bold">se reactivará la cuenta antigua y se reemplazará su configuración</strong> asignándole la nueva contraseña, rol, sucursales y vinculaciones que acabas de definir.
            </div>

            <p className="text-xs font-bold text-foreground">
              ¿Deseas restaurar y reactivar este usuario?
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isRestoringUser}
                onClick={() => setPendingRestoration(null)}
                className="px-4 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground rounded-xl text-xs font-bold transition-colors disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isRestoringUser}
                onClick={handleExecuteRestoration}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-md disabled:opacity-60"
              >
                {isRestoringUser ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                <span>Restaurar y Reemplazar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Unsaved Changes Exit Warning Modal ── */}
      {showRoleExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card rounded-2xl shadow-xl border border-border overflow-hidden p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-amber-500">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <ShieldAlert className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">Cambios sin guardar</h3>
                <p className="text-xs text-muted-foreground">Advertencia de pérdida de datos</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Tienes modificaciones en los permisos que no han sido guardadas. Si cambias de pestaña, estos cambios se perderán.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setRoles(originalRoles);
                  setHasUnsavedRoleChanges(false);
                  setShowRoleExitConfirm(false);
                  if (pendingTab) setActiveTab(pendingTab);
                  setPendingTab(null);
                }}
                className="px-4 py-2 bg-red-500/10 hover:bg-red-600 text-red-600 hover:text-white border border-red-500/20 rounded-xl text-xs font-bold transition-colors"
              >
                Descartar y Salir
              </button>
              <button
                onClick={() => {
                  setShowRoleExitConfirm(false);
                  setPendingTab(null);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
              >
                Quedarme a Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Role Modal ── */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-card rounded-2xl shadow-xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b flex items-center justify-between bg-muted/20 border-border text-foreground">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-500" />
                <h2 className="text-sm font-bold uppercase tracking-wider">Nuevo Rol</h2>
              </div>
              <button
                onClick={() => setIsRoleModalOpen(false)}
                className="transition-colors p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateRole} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Nombre del Rol
                </label>
                <input
                  type="text"
                  placeholder="Ej: SUPERVISOR"
                  value={newRoleName}
                  onChange={e => setNewRoleName(e.target.value)}
                  required
                  className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors uppercase"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Alcance / Sucursal
                </label>
                <select
                  value={newRoleScopeStoreId}
                  disabled={!isUserGlobalAdmin}
                  onChange={e => setNewRoleScopeStoreId(e.target.value)}
                  className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors disabled:opacity-80 disabled:cursor-not-allowed"
                >
                  {isUserGlobalAdmin && (
                    <option value="">Acceso Global (Todas las tiendas)</option>
                  )}
                  {availableStores.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Descripción <span className="normal-case font-normal">(Opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej: Acceso total a ventas e inventario"
                  value={newRoleDesc}
                  onChange={e => setNewRoleDesc(e.target.value)}
                  className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors"
                />
              </div>

              <div className="pt-2 text-xs text-muted-foreground text-center">
                Una vez creado, podrás configurar sus permisos en la Matriz.
              </div>

              <button
                type="submit"
                disabled={savingRole || !newRoleName.trim()}
                className="w-full h-11 flex items-center justify-center gap-2 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-md mt-4"
              >
                {savingRole
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Creando...</>
                  : <><Plus className="w-4 h-4" /> Crear Rol</>
                }
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Employee Modal ── */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card rounded-2xl shadow-xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b flex items-center justify-between bg-muted/20 border-border text-foreground">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-500" />
                <h2 className="text-sm font-bold uppercase tracking-wider">{editingEmployee ? 'EDITAR EMPLEADO' : 'NUEVO EMPLEADO'}</h2>
              </div>
              <button
                onClick={() => {
                  setIsEmployeeModalOpen(false);
                  setEditingEmployee(null);
                }}
                className="transition-colors p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateEmployee} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto" autoComplete="off">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  placeholder="Ej: Yuriko Martínez"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                  className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    DNI
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: 71234567"
                    value={dni}
                    onChange={e => setDni(e.target.value)}
                    required
                    maxLength={8}
                    className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    placeholder="Opcional"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors"
                  />
                </div>
              </div>
              {/* Ámbito de Trabajo Toggle */}
              {isAdmin && (
                <div className="space-y-1.5 mt-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Ámbito de Trabajo
                  </label>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-xl">
                    <button
                      type="button"
                      onClick={() => setEmpAccessScope('stores')}
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all ${empAccessScope === 'stores'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      Por Sucursales
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmpAccessScope('global');
                        setEmpStoreIds([]);
                        setEmpStoreRoles({});
                        setEmpStoreRoleIds({});
                      }}
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all ${empAccessScope === 'global'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      Acceso Global (Admin)
                    </button>
                  </div>
                </div>
              )}

              {/* Asignación de Sucursales y Roles de Trabajo */}
              {empAccessScope === 'global' ? (
                <div className="space-y-1.5 mt-3 p-3.5 bg-purple-500/10 border border-purple-500/20 rounded-2xl">
                  <label className="text-xs font-bold text-purple-600 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-purple-500" />
                    Ámbito de Trabajo Global (Todas las tiendas)
                  </label>
                  <span className="text-[11px] text-purple-600/80 font-medium block mt-1">
                    Este empleado labora a nivel corporativo en todas las tiendas y es compatible para vinculación con cuentas de Acceso Global.
                  </span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {(editingEmployee && profileByEmployeeId[editingEmployee.id]) || createAccess
                      ? 'Sucursales de Trabajo y Roles Asignados'
                      : 'Sucursales de Trabajo Asignadas'}
                  </label>
                  {isAdmin ? (
                    (editingEmployee && profileByEmployeeId[editingEmployee.id]) || createAccess ? (
                      renderStoreRoleList({
                        storeIds: empStoreIds,
                        storeRoles: empStoreRoles,
                        storeRoleIds: empStoreRoleIds,
                        onToggleStore: (storeId, checked) => {
                          if (checked) {
                            setEmpStoreIds(prev => [...prev, storeId]);
                            const defaultRoleName = getValidStoreRole(null, storeId);
                            const storeAvailableRoles = roles.filter(r => r.name !== 'ADMIN' && (r.store_id === storeId || !r.store_id));
                            const defaultRoleId = storeAvailableRoles.find(r => r.name === defaultRoleName)?.id || storeAvailableRoles[0]?.id || '';
                            setEmpStoreRoles(prev => ({ ...prev, [storeId]: prev[storeId] || defaultRoleName }));
                            setEmpStoreRoleIds(prev => ({ ...prev, [storeId]: prev[storeId] || defaultRoleId }));
                          } else {
                            setEmpStoreIds(prev => prev.filter(id => id !== storeId));
                            setEmpStoreRoles(prev => {
                              const next = { ...prev };
                              delete next[storeId];
                              return next;
                            });
                            setEmpStoreRoleIds(prev => {
                              const next = { ...prev };
                              delete next[storeId];
                              return next;
                            });
                          }
                        },
                        onRoleChange: (storeId, roleName, roleId) => {
                          setEmpStoreRoles(prev => ({ ...prev, [storeId]: roleName }));
                          setEmpStoreRoleIds(prev => ({ ...prev, [storeId]: roleId }));
                        },
                        isDisabled: false,
                      })
                    ) : (
                      <div className="space-y-2 mt-2">
                        {availableStores.map(store => {
                          const isChecked = empStoreIds.includes(store.id);
                          return (
                            <div
                              key={store.id}
                              className={`p-3 rounded-2xl border transition-all ${isChecked
                                ? 'bg-indigo-50/80 border-indigo-200 shadow-sm'
                                : 'bg-background border-border hover:bg-secondary/40'
                                }`}
                            >
                              <label className="flex items-center gap-3 cursor-pointer select-none font-semibold text-sm text-foreground">
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setEmpStoreIds(prev => [...prev, store.id]);
                                      const defaultRoleName = getValidStoreRole(null, store.id);
                                      const storeAvailableRoles = roles.filter(r => r.name !== 'ADMIN' && (r.store_id === store.id || !r.store_id));
                                      const defaultRoleId = storeAvailableRoles.find(r => r.name === defaultRoleName)?.id || storeAvailableRoles[0]?.id || '';
                                      setEmpStoreRoles(prev => ({ ...prev, [store.id]: prev[store.id] || defaultRoleName }));
                                      setEmpStoreRoleIds(prev => ({ ...prev, [store.id]: prev[store.id] || defaultRoleId }));
                                    } else {
                                      setEmpStoreIds(prev => prev.filter(id => id !== store.id));
                                      setEmpStoreRoles(prev => {
                                        const next = { ...prev };
                                        delete next[store.id];
                                        return next;
                                      });
                                      setEmpStoreRoleIds(prev => {
                                        const next = { ...prev };
                                        delete next[store.id];
                                        return next;
                                      });
                                    }
                                  }}
                                />
                                <span>{store.name}</span>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : (
                    <div className="bg-secondary/50 border border-border rounded-xl p-3 flex items-center justify-between text-sm font-medium text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Info className="w-4 h-4 text-indigo-500 shrink-0" />
                        {activeStoreId ? (
                          <span>Sucursal asignada automáticamente: <span className="font-bold text-foreground">{storeMap.get(activeStoreId) || '—'}</span></span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span>Sucursal asignada:</span>
                            <select
                              value={targetModalStoreId}
                              onChange={(e) => {
                                const newStoreId = e.target.value;
                                setSelectedModalStoreId(newStoreId);
                                const defaultRoleName = getValidStoreRole(null, newStoreId);
                                const storeAvailableRoles = roles.filter(r => r.name !== 'ADMIN' && (r.store_id === newStoreId || !r.store_id));
                                const defaultRoleId = storeAvailableRoles.find(r => r.name === defaultRoleName)?.id || storeAvailableRoles[0]?.id || '';
                                setEmpStoreIds([newStoreId]);
                                setEmpStoreRoles({ [newStoreId]: defaultRoleName });
                                setEmpStoreRoleIds({ [newStoreId]: defaultRoleId });
                              }}
                              className="h-8 px-2 text-xs font-bold rounded-lg border border-border bg-background cursor-pointer text-foreground"
                            >
                              {availableStores.map(s => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                      {((editingEmployee && profileByEmployeeId[editingEmployee.id]) || createAccess) && targetModalStoreId && (() => {
                        const storeAvailableRoles = roles.filter(
                          r => r.name !== 'ADMIN' && (r.store_id === targetModalStoreId || !r.store_id)
                        );
                        const currentRoleName = empStoreRoles[targetModalStoreId] || (storeAvailableRoles[0]?.name || 'CAJERO');
                        const currentRoleId = empStoreRoleIds[targetModalStoreId] || storeAvailableRoles.find(r => r.name === currentRoleName)?.id || storeAvailableRoles[0]?.id || '';
                        const selectedValue = storeAvailableRoles.some(r => r.id === currentRoleId)
                          ? currentRoleId
                          : (storeAvailableRoles.find(r => r.name === currentRoleName)?.id || storeAvailableRoles[0]?.id || '');
                        return (
                          <select
                            value={selectedValue}
                            onChange={(e) => {
                              const selectedRole = storeAvailableRoles.find(r => r.id === e.target.value);
                              if (selectedRole) {
                                setEmpStoreRoles({ [targetModalStoreId]: selectedRole.name });
                                setEmpStoreRoleIds({ [targetModalStoreId]: selectedRole.id });
                              }
                            }}
                            className="h-8 px-2 text-xs font-bold rounded-lg border border-border bg-background cursor-pointer"
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
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Estado de Cuenta de Usuario al Editar Empleado */}
              {editingEmployee && (
                <div className="pt-2 border-t border-border mt-3">
                  {profileByEmployeeId[editingEmployee.id] ? (
                    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3.5 flex items-center justify-between text-xs text-foreground font-medium">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span>Cuenta de acceso: <strong className="font-mono text-indigo-600">@{profileByEmployeeId[editingEmployee.id]?.username}</strong></span>
                      </div>
                      <span className="text-[11px] text-muted-foreground font-medium italic">Permisos en 'Cuentas de Usuario'</span>
                    </div>
                  ) : (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 flex items-center gap-2 text-xs text-amber-900 font-medium">
                      <Info className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Sin cuenta de usuario (Puedes otorgarle acceso desde la lista de empleados usando la llave).</span>
                    </div>
                  )}
                </div>
              )}

              {/* Toggle Acceso Rápido (solo para nuevo empleado) */}
              {!editingEmployee && (
                <>
                  <div className="pt-2 border-t border-border mt-4">
                    <label className="flex items-center gap-3 cursor-pointer p-2 -mx-2 rounded-xl hover:bg-secondary/50 transition-colors">
                      <div className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-border transition-colors group">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={createAccess}
                          onChange={(e) => setCreateAccess(e.target.checked)}
                        />
                        <div className={`h-5 w-9 rounded-full transition-colors ${createAccess ? 'bg-indigo-500' : 'bg-muted'}`} />
                        <div className={`absolute left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${createAccess ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                      <span className="text-sm font-bold select-none text-foreground">¿Crear acceso al sistema?</span>
                    </label>
                  </div>

                  {/* Campos de Acceso Ocultos */}
                  {createAccess && (
                    <div className="space-y-4 pt-2 animate-in slide-in-from-top-2 fade-in duration-200">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Usuario</label>
                          <input
                            type="text"
                            placeholder="Ej: yuriko"
                            value={empUsername}
                            onChange={e => setEmpUsername(e.target.value)}
                            autoComplete="off"
                            required
                            className="w-full h-10 bg-secondary/30 border border-border rounded-xl px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors font-mono"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Contraseña/PIN</label>
                          <div className="relative">
                            <input
                              type={showEmpPassword ? "text" : "password"}
                              placeholder="Mín. 4 caracteres"
                              value={empPassword}
                              onChange={e => setEmpPassword(e.target.value)}
                              autoComplete="new-password"
                              required
                              className="w-full h-10 bg-secondary/30 border border-border rounded-xl pl-3 pr-10 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors"
                            />
                            <button
                              type="button"
                              onClick={() => setShowEmpPassword(!showEmpPassword)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                              title={showEmpPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                            >
                              {showEmpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Correo Gmail <span className="normal-case font-normal">(Opcional)</span></label>
                        <input
                          type="email"
                          placeholder="Para login con Google"
                          value={empEmail}
                          onChange={e => setEmpEmail(e.target.value)}
                          className="w-full h-10 bg-secondary/30 border border-border rounded-xl px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              <button
                type="submit"
                disabled={savingEmployee}
                className={`w-full h-11 flex items-center justify-center gap-2 rounded-xl font-bold text-sm text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-md mt-4 ${editingEmployee
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
              >
                {savingEmployee ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Guardando...</>
                ) : editingEmployee ? (
                  <><Edit2 className="w-4 h-4" /> Actualizar Empleado</>
                ) : (
                  <><Plus className="w-4 h-4" /> Registrar Empleado</>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Link Employee Modal ── */}
      {linkingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card rounded-2xl shadow-xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-500" />
                <h2 className="text-sm font-bold uppercase tracking-wider">Otorgar Acceso</h2>
              </div>
              <button
                onClick={() => setLinkingEmployee(null)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="bg-secondary/50 px-4 py-3 rounded-xl border border-border/50 text-center">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Empleado Seleccionado</p>
                <p className="text-sm font-bold text-foreground">{linkingEmployee.full_name}</p>
                <p className="text-xs font-mono text-muted-foreground mt-0.5">DNI: {linkingEmployee.dni}</p>
              </div>

              <div className="flex bg-muted/50 p-1 rounded-xl border border-border/50">
                <button
                  onClick={() => setLinkMode('new')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${linkMode === 'new' ? 'bg-background shadow-sm text-foreground border border-border/50' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Crear Nuevo
                </button>
                <button
                  onClick={() => setLinkMode('existing')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${linkMode === 'existing' ? 'bg-background shadow-sm text-foreground border border-border/50' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Vincular Existente
                </button>
              </div>

              {linkMode === 'new' ? (
                <form onSubmit={handleLinkNewUser} className="space-y-4" autoComplete="off">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Usuario</label>
                    <input type="text" placeholder="Ej: admin1" required autoComplete="off" value={empUsername} onChange={e => setEmpUsername(e.target.value)} className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Contraseña / PIN</label>
                    <div className="relative">
                      <input
                        type={showEmpPassword ? "text" : "password"}
                        required
                        minLength={4}
                        autoComplete="new-password"
                        value={empPassword}
                        onChange={e => setEmpPassword(e.target.value)}
                        className="w-full h-10 bg-background border border-border rounded-xl pl-3 pr-10 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEmpPassword(!showEmpPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                        title={showEmpPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      >
                        {showEmpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Rol de Acceso al Sistema</label>
                    <select
                      required
                      value={linkRoleId}
                      onChange={e => setLinkRoleId(e.target.value)}
                      className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors"
                    >
                      <option value="">— Seleccionar Rol de Acceso —</option>
                      {roles.filter(r => r.name !== 'ADMIN').map(r => {
                        const scopeLabel = r.store_id ? ` (${storeMap.get(r.store_id) || r.stores?.name || 'Sucursal'})` : ' (Global)';
                        return (
                          <option key={r.id} value={r.id}>
                            {r.name}{scopeLabel}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Correo Gmail <span className="normal-case font-normal">(Opcional)</span></label>
                    <input type="email" placeholder="Opcional" value={empEmail} onChange={e => setEmpEmail(e.target.value)} className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors" />
                  </div>
                  <button type="submit" disabled={isLinking} className="w-full h-11 mt-2 flex items-center justify-center gap-2 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-md">
                    {isLinking ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Crear y Vincular
                  </button>
                </form>
              ) : (
                <form onSubmit={handleLinkExistingUser} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Seleccionar Usuario Libre</label>
                    <select required value={linkExistingUserId} onChange={e => setLinkExistingUserId(e.target.value)} className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors">
                      <option value="">— Ninguno seleccionado —</option>
                      {allProfiles.filter(p => p.role !== 'DELETED' && !p.employee_id).length === 0 ? (
                        <option value="" disabled>No hay usuarios libres disponibles</option>
                      ) : (
                        allProfiles.filter(p => p.role !== 'DELETED' && !p.employee_id).map(p => {
                          const isProfileGlobalRole = p.role === 'ADMIN' || roles.some(r => (r.id === p.role_id || r.name === p.role) && (!r.store_id || r.is_system));
                          const pStoreIds = p.employee_stores?.map(es => es.store_id) || (p.default_store_id ? [p.default_store_id] : []);
                          const pStoreNames = pStoreIds.length > 0
                            ? pStoreIds.map(id => storeMap.get(id) || 'Tienda').join(', ')
                            : (isProfileGlobalRole ? 'Global' : 'Sin tienda');
                          const empStoresSorted = (linkingEmployee?.employee_stores || []).map(es => es.store_id).sort().join(',');
                          const pStoresSorted = [...pStoreIds].sort().join(',');
                          const isMismatch = !isProfileGlobalRole && empStoresSorted !== pStoresSorted;

                          return (
                            <option key={p.id} value={p.id}>
                              @{p.username} ({p.role}) — Tiendas: {pStoreNames}{isMismatch ? ' [Tiendas distintas]' : ''}
                            </option>
                          );
                        })
                      )}
                    </select>
                  </div>
                  <button type="submit" disabled={isLinking || allProfiles.filter(p => p.role !== 'DELETED' && !p.employee_id).length === 0} className="w-full h-11 mt-2 flex items-center justify-center gap-2 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-md">
                    {isLinking ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                    Vincular Usuario
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── User (Create/Edit) Modal ── */}
      {isUserModalOpen && (
        <div key={editingUserId ? editingUserId : 'new-access-' + modalResetToken} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card rounded-2xl shadow-xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
            <div className={`px-5 py-4 border-b flex items-center justify-between ${editingUserId ? 'bg-amber-500/10 border-amber-500/20 text-amber-600' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-600'}`}>
              <div className="flex items-center gap-2">
                {editingUserId ? <Edit2 className="w-4 h-4" /> : <KeyRound className="w-4 h-4 text-indigo-500" />}
                <h2 className="text-sm font-bold uppercase tracking-wider">
                  {editingUserId ? 'EDITAR ACCESO' : 'NUEVO ACCESO'}
                </h2>
              </div>
              <button
                onClick={handleCancelEdit}
                className={`transition-colors p-1 rounded-lg ${editingUserId ? 'hover:bg-amber-500/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveCredentials} className="p-5 space-y-4" autoComplete="off">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Usuario
                </label>
                <input
                  type="text"
                  placeholder="Ej: yuriko, admin1"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  autoComplete="off"
                  className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                  {editingUserId ? 'Nueva Contraseña / PIN' : 'Contraseña / PIN'}
                  {editingUserId && <span className="text-[10px] text-amber-600 normal-case bg-amber-500/10 px-1.5 rounded">Opcional si no cambia</span>}
                </label>
                <div className="relative">
                  <input
                    type={showUserPassword ? "text" : "password"}
                    placeholder={editingUserId ? "Dejar vacío para no cambiar" : "Mínimo 4 caracteres"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required={!editingUserId}
                    minLength={4}
                    autoComplete="new-password"
                    className="w-full h-10 bg-background border border-border rounded-xl pl-3 pr-10 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUserPassword(!showUserPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    title={showUserPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showUserPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Modo de Acceso Toggle */}
              {isAdmin && (
                <div className="space-y-1.5 mt-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Modo de Acceso
                  </label>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-xl">
                    <button
                      type="button"
                      onClick={() => setUserAccessScope('stores')}
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all ${userAccessScope === 'stores'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      Por Sucursales
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserAccessScope('global')}
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all ${userAccessScope === 'global'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      Acceso Global (Admin)
                    </button>
                  </div>
                </div>
              )}

              {userAccessScope === 'global' ? (
                <div className="space-y-1.5 mt-3 p-3.5 bg-purple-500/10 border border-purple-500/20 rounded-2xl">
                  <label className="text-xs font-bold text-purple-600 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-purple-500" />
                    Rol Global de Sistema
                  </label>
                  <select
                    value={userGlobalRole}
                    onChange={(e) => setUserGlobalRole(e.target.value)}
                    className="w-full h-10 px-3 text-xs font-bold rounded-xl border border-purple-200 bg-white text-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
                  >
                    {globalRoles.map(r => (
                      <option key={r.id} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                  <span className="text-[11px] text-purple-600/80 font-medium block mt-1">
                    {userGlobalRole === 'ADMIN'
                      ? 'Este usuario tendrá acceso total e irrestricto a todos los módulos y sucursales de la empresa.'
                      : `Este usuario tendrá acceso a todas las sucursales del sistema, aplicando únicamente los permisos definidos para el rol "${userGlobalRole}".`}
                  </span>
                  <label className="flex items-center gap-2.5 mt-3 pt-3 border-t border-purple-200/60 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={confirmGlobalAccess}
                      onChange={(e) => setConfirmGlobalAccess(e.target.checked)}
                      className="w-4 h-4 text-purple-600 rounded border-purple-300 focus:ring-purple-500"
                    />
                    <span className="text-xs font-bold text-purple-900">
                      Confirmar otorgar permisos administrativos globales sobre todas las sucursales
                    </span>
                  </label>
                </div>
              ) : (
                <div className="space-y-1.5 mt-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tiendas y Roles Asignados</label>
                  {isAdmin ? (
                    renderStoreRoleList({
                      storeIds: selectedStoreIds,
                      storeRoles: userStoreRoles,
                      storeRoleIds: userStoreRoleIds,
                      onToggleStore: (storeId, checked) => {
                        if (!selectedEmpId) {
                          if (checked) {
                            setSelectedStoreIds(prev => [...prev, storeId]);
                            const defaultRoleName = getValidStoreRole(null, storeId);
                            const storeAvailableRoles = roles.filter(r => r.name !== 'ADMIN' && (r.store_id === storeId || !r.store_id));
                            const defaultRoleId = storeAvailableRoles.find(r => r.name === defaultRoleName)?.id || storeAvailableRoles[0]?.id || '';
                            setUserStoreRoles(prev => ({ ...prev, [storeId]: prev[storeId] || defaultRoleName }));
                            setUserStoreRoleIds(prev => ({ ...prev, [storeId]: prev[storeId] || defaultRoleId }));
                          } else {
                            setSelectedStoreIds(prev => prev.filter(id => id !== storeId));
                            setUserStoreRoles(prev => {
                              const next = { ...prev };
                              delete next[storeId];
                              return next;
                            });
                            setUserStoreRoleIds(prev => {
                              const next = { ...prev };
                              delete next[storeId];
                              return next;
                            });
                          }
                        }
                      },
                      onRoleChange: (storeId, roleName, roleId) => {
                        setUserStoreRoles(prev => ({ ...prev, [storeId]: roleName }));
                        setUserStoreRoleIds(prev => ({ ...prev, [storeId]: roleId }));
                      },
                      isDisabled: false,
                      isStoreToggleDisabled: !!selectedEmpId,
                    })
                  ) : (
                    <div className="bg-secondary/50 border border-border rounded-xl p-3 flex items-center justify-between text-sm font-medium text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Info className="w-4 h-4 text-indigo-500 shrink-0" />
                        {activeStoreId ? (
                          <span>Tienda asignada automáticamente: <span className="font-bold text-foreground">{storeMap.get(activeStoreId) || '—'}</span></span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span>Tienda asignada:</span>
                            <select
                              value={targetModalStoreId}
                              onChange={(e) => {
                                const newStoreId = e.target.value;
                                setSelectedModalStoreId(newStoreId);
                                const defaultRoleName = getValidStoreRole(null, newStoreId);
                                const storeAvailableRoles = roles.filter(r => r.name !== 'ADMIN' && (r.store_id === newStoreId || !r.store_id));
                                const defaultRoleId = storeAvailableRoles.find(r => r.name === defaultRoleName)?.id || storeAvailableRoles[0]?.id || '';
                                setUserStoreRoles({ [newStoreId]: defaultRoleName });
                                setUserStoreRoleIds({ [newStoreId]: defaultRoleId });
                              }}
                              className="h-8 px-2 text-xs font-bold rounded-lg border border-border bg-background cursor-pointer text-foreground"
                            >
                              {availableStores.map(s => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                      {targetModalStoreId && (() => {
                        const storeAvailableRoles = roles.filter(
                          r => r.name !== 'ADMIN' && (r.store_id === targetModalStoreId || !r.store_id)
                        );
                        const currentRoleName = userStoreRoles[targetModalStoreId] || (storeAvailableRoles[0]?.name || 'CAJERO');
                        const currentRoleId = userStoreRoleIds[targetModalStoreId] || storeAvailableRoles.find(r => r.name === currentRoleName)?.id || storeAvailableRoles[0]?.id || '';
                        const selectedValue = storeAvailableRoles.some(r => r.id === currentRoleId)
                          ? currentRoleId
                          : (storeAvailableRoles.find(r => r.name === currentRoleName)?.id || storeAvailableRoles[0]?.id || '');
                        return (
                          <select
                            value={selectedValue}
                            onChange={(e) => {
                              const selectedRole = storeAvailableRoles.find(r => r.id === e.target.value);
                              if (selectedRole) {
                                setUserStoreRoles({ [targetModalStoreId]: selectedRole.name });
                                setUserStoreRoleIds({ [targetModalStoreId]: selectedRole.id });
                              }
                            }}
                            className="h-8 px-2 text-xs font-bold rounded-lg border border-border bg-background cursor-pointer"
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
                        );
                      })()}
                    </div>
                  )}
                  {selectedEmpId && (
                    <div className="flex items-start gap-2 mt-2.5 p-2.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-[11px] text-muted-foreground font-medium leading-tight">
                      <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-foreground font-bold">Sucursales heredadas del empleado.</strong> Puedes modificar los roles de acceso para las tiendas vinculadas. Para agregar o quitar sucursales, edita al perfil en la pestaña <strong className="text-indigo-600 dark:text-indigo-400">Empleados</strong>.
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Correo Gmail
                </label>
                <input
                  type="email"
                  placeholder="Opcional"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="off"
                  className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Empleado <span className="text-muted-foreground/50 normal-case font-normal">(Opcional)</span>
                </label>
                <select
                  value={selectedEmpId}
                  onChange={e => setSelectedEmpId(e.target.value)}
                  className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors"
                >
                  <option value="">— Sin vincular —</option>
                  {unlinkedEmployees.map((emp: Employee) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} · {emp.dni}
                    </option>
                  ))}
                  {/* Si el usuario actual ya tiene un empleado vinculado, lo agregamos para que se pueda mantener o cambiar */}
                  {editingUserId && selectedEmpId && employeeById[selectedEmpId] && (
                    <option value={selectedEmpId} className="bg-amber-500/10">
                      (Actual) {employeeById[selectedEmpId].full_name}
                    </option>
                  )}
                </select>
              </div>

              <button
                type="submit"
                disabled={savingUser}
                className={`w-full h-11 mt-2 flex items-center justify-center gap-2 rounded-xl font-bold text-sm text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-md ${editingUserId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
              >
                {savingUser ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Guardando...</>
                ) : editingUserId ? (
                  <><Edit2 className="w-4 h-4" /> Actualizar Acceso</>
                ) : (
                  <><Plus className="w-4 h-4" /> Crear Acceso</>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* ── Edit Role Modal ── */}
      {isEditRoleModalOpen && editingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card rounded-2xl shadow-xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-amber-500/20 bg-amber-500/10 flex items-center justify-between text-amber-600">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4" />
                <h2 className="text-sm font-bold uppercase tracking-wider">Editar Rol</h2>
              </div>
              <button
                onClick={() => { setIsEditRoleModalOpen(false); setEditingRole(null); }}
                className="transition-colors p-1 rounded-lg hover:bg-amber-500/20 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEditRole} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Nombre del Rol</label>
                <input
                  type="text"
                  placeholder="Ej: MOSTRADOR, TESORERA"
                  value={editRoleName}
                  onChange={e => setEditRoleName(e.target.value)}
                  required
                  className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors uppercase font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Descripción <span className="normal-case font-normal">(Opcional)</span></label>
                <input
                  type="text"
                  placeholder="Ej: Atención en mostrador y ventas rápidas"
                  value={editRoleDesc}
                  onChange={e => setEditRoleDesc(e.target.value)}
                  className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsEditRoleModalOpen(false); setEditingRole(null); }}
                  className="px-4 py-2 border border-border rounded-xl text-sm font-bold text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEditRole || !editRoleName.trim()}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold shadow-md transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {savingEditRole ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit2 className="w-4 h-4" />}
                  Actualizar Rol
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── Role Warning Modal (Has assigned users) ── */}
      {isRoleWarningModalOpen && deletingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card rounded-2xl shadow-xl border border-border overflow-hidden p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <ShieldAlert className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">No se puede eliminar el rol "{deletingRole.name}"</h3>
                <p className="text-xs text-muted-foreground">Tiene usuarios vinculados en el sistema</p>
              </div>
            </div>

            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-red-700 dark:text-red-300">
                Este rol está actualmente asignado a los siguientes usuarios:
              </p>
              <div className="max-h-36 overflow-y-auto space-y-1.5 pt-1">
                {roleAssignedUsers.map(u => {
                  const emp = u.employee_id ? employeeById[u.employee_id] : null;
                  return (
                    <div key={u.id} className="flex items-center justify-between bg-card px-3 py-1.5 rounded-lg border border-border text-xs font-medium">
                      <span className="font-bold font-mono text-indigo-600">@{u.username}</span>
                      {emp && <span className="text-muted-foreground font-medium">{emp.full_name}</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Por favor, ve a la pestaña <strong>"Usuarios"</strong>, reasígnalos a otro rol e inténtalo de nuevo.
            </p>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => { setIsRoleWarningModalOpen(false); setDeletingRole(null); }}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Role Confirm Deletion Modal (0 assigned users) ── */}
      {isRoleConfirmModalOpen && deletingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card rounded-2xl shadow-xl border border-border overflow-hidden p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">Eliminar Rol</h3>
                <p className="text-xs text-muted-foreground">Confirmación de eliminación física</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Estás a punto de eliminar el rol <strong>"{deletingRole.name}"</strong>. Esta acción no se puede deshacer.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                disabled={isDeletingRole}
                onClick={() => { setIsRoleConfirmModalOpen(false); setDeletingRole(null); }}
                className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                disabled={isDeletingRole}
                onClick={confirmDeleteRole}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isDeletingRole ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Sí, eliminar rol
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Employee Confirm Deletion Modal ── */}
      {deletingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card rounded-2xl shadow-xl border border-border overflow-hidden p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">Eliminar Empleado</h3>
                <p className="text-xs text-muted-foreground">Confirmación de eliminación</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Estás a punto de eliminar el empleado <strong>"{deletingEmployee.name}"</strong>. ¿Deseas continuar?
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeletingEmployee(null)}
                className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteEmployee}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Sí, eliminar empleado
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
