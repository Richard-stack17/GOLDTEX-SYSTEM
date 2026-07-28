'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Users, UserPlus, ShieldAlert,
  CheckCircle2, RefreshCw, KeyRound, Plus,
  ShieldCheck, UserCog, Edit2, X, Trash2, Check, XCircle,
  ShoppingCart, PackageSearch, BarChart3, Banknote, FileSpreadsheet, Contact, ScrollText, Settings, Shield, Save, Loader2, Lock, Info
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
  created_at: string;
  employee_stores?: { store_id: string; stores: { name: string } }[];
};

type Profile = {
  id: string;
  username: string;
  role: string;
  employee_id: string | null;
  email: string | null;
  default_store_id?: string | null;
  stores?: { name: string }[] | null;
};

type Tab = 'empleados' | 'usuarios' | 'roles';

type Role = {
  id: string;
  name: string;
  description: string;
  permissions: Record<string, boolean>;
  is_system: boolean;
  is_active?: boolean;
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
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-2xl font-bold text-sm opacity-100 animate-in fade-in slide-in-from-bottom-4 ${
      type === 'success'
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
  const { availableStores } = useStore();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>('empleados');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const employeeById = useMemo(() => {
    return Object.fromEntries(employees.map(emp => [emp.id, emp]));
  }, [employees]);
  const storeMap = useMemo(() => {
    return new Map(availableStores.map(s => [s.id, s.name]));
  }, [availableStores]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
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
  const [empRole, setEmpRole] = useState('CAJERA');
  const [empStoreId, setEmpStoreId] = useState('');

  // ── Usuarios form state (Crear / Editar)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState('CAJERA');
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [savingUser, setSavingUser] = useState(false);
  const [modalResetToken, setModalResetToken] = useState(0);

  // ── Soft-delete user state
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deletingUsername, setDeletingUsername] = useState('');
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // ── Link Employee Modal state
  const [linkingEmployee, setLinkingEmployee] = useState<Employee | null>(null);
  const [linkMode, setLinkMode] = useState<'new' | 'existing'>('new');
  const [linkExistingUserId, setLinkExistingUserId] = useState('');
  const [isLinking, setIsLinking] = useState(false);

  // Auto-complete and block selectedStoreId when selectedEmpId changes
  useEffect(() => {
    if (selectedEmpId) {
      const emp = employeeById[selectedEmpId];
      if (emp && emp.employee_stores && emp.employee_stores.length > 0) {
        setSelectedStoreId(emp.employee_stores[0]?.store_id || '');
      }
    }
  }, [selectedEmpId, employeeById]);

  // ── Roles state
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
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
    setIsDeletingUser(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'DELETED' })
        .eq('id', deletingUserId);

      if (error) throw error;

      showToast('Acceso eliminado correctamente', 'success');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Error al eliminar acceso', 'error');
    } finally {
      setIsDeletingUser(false);
      setDeletingUserId(null);
    }
  };

  // ── Load data
  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: empData, error: empErr }, { data: profData, error: profErr }, { data: rolesData, error: rolesErr }] = await Promise.all([
        supabase.from('employees').select('*, employee_stores(store_id, stores(name))').order('full_name', { ascending: true }),
        supabase.from('profiles').select('id, username, role, employee_id, email, default_store_id, stores(name)'),
        supabase.from('roles').select('*').order('created_at', { ascending: true }),
      ]);

      if (empErr) throw empErr;
      if (profErr) throw profErr;
      if (rolesErr) throw rolesErr;

      const activeRoles = (rolesData ?? []).filter((r: any) => r.is_active !== false);
      setRoles(activeRoles);
      setOriginalRoles(activeRoles);
      setHasUnsavedRoleChanges(false);

      setEmployees(empData ?? []);
      setAllProfiles(profData ?? []);

      // Update default selected roles if needed
      if (rolesData && rolesData.length > 0) {
        if (empRole === 'CAJERA' || !empRole) setEmpRole(rolesData[0].name);
        if (selectedRole === 'CAJERA' || !selectedRole) setSelectedRole(rolesData[0].name);
      }
    } catch (err: any) {
      showToast(err.message || 'Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    setSavingRole(true);
    try {
      const name = newRoleName.trim().toUpperCase();
      const { error } = await supabase.from('roles').insert({
        name,
        description: newRoleDesc.trim(),
        permissions: {},
        is_system: false
      });
      if (error) throw error;
      showToast('Rol creado correctamente', 'success');
      setIsRoleModalOpen(false);
      setNewRoleName('');
      setNewRoleDesc('');
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
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
      showToast(err.message || 'Error al actualizar rol', 'error');
    } finally {
      setSavingEditRole(false);
    }
  };

  const handleDeleteRole = (roleToDelete: Role) => {
    if (roleToDelete.name === 'ADMIN') {
      showToast('El rol ADMIN es un rol de sistema protegido y no puede ser eliminado', 'error');
      return;
    }

    // 1. Obtener usuarios asignados
    const assigned = allProfiles.filter(p => p.role === roleToDelete.name);
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

  // ── Create / Edit employee (+ Optional Profile)
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !dni.trim() || !empStoreId) {
      showToast('Nombre completo, DNI y Tienda son obligatorios', 'error');
      return;
    }

    if (!editingEmployee && createAccess && (!empUsername.trim() || !empPassword)) {
      showToast('Usuario y contraseña son obligatorios para crear el acceso', 'error');
      return;
    }

    setSavingEmployee(true);
    try {
      if (editingEmployee) {
        // Update existing employee
        const { error: empErr } = await supabase.from('employees').update({
          full_name: fullName.trim(),
          dni: dni.trim(),
          phone: phone.trim() || null,
        }).eq('id', editingEmployee.id);

        if (empErr) throw empErr;

        if (empStoreId) {
          await supabase.from('employee_stores').delete().eq('employee_id', editingEmployee.id);
          await supabase.from('employee_stores').insert({
            employee_id: editingEmployee.id,
            store_id: empStoreId,
            role: empRole ?? (editingEmployee.employee_stores?.[0] as any)?.role ?? 'CAJERA'
          });
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

        if (empStoreId && newEmp) {
          await supabase.from('employee_stores').insert({
            employee_id: newEmp.id,
            store_id: empStoreId,
            role: createAccess ? empRole : 'CAJERA'
          });
        }

        // 2. Insert Profile (if toggled)
        if (createAccess && newEmp) {
          const hash = bcrypt.hashSync(empPassword, 8);
          const { error: profErr } = await supabase.from('profiles').insert({
            username: empUsername.trim(),
            role: empRole,
            password_hash: hash,
            employee_id: newEmp.id,
            email: empEmail.trim() || null,
            default_store_id: empStoreId || null
          });
          if (profErr) throw profErr;
        }

        showToast(createAccess ? 'Empleado y acceso creados correctamente' : 'Empleado registrado correctamente', 'success');

      }

      // Reset form
      setIsEmployeeModalOpen(false);
      setEditingEmployee(null);
      setFullName(''); setDni(''); setPhone('');
      setCreateAccess(false); setEmpUsername(''); setEmpPassword(''); setEmpEmail(''); setEmpRole('CAJERA'); setEmpStoreId('');

      loadData();
    } catch (err: any) {
      showToast(err.message || 'Error al guardar empleado', 'error');
    } finally {
      setSavingEmployee(false);
    }
  };

  const handleEditEmployeeClick = (emp: Employee) => {
    setEditingEmployee(emp);
    setFullName(emp.full_name);
    setDni(emp.dni);
    setPhone(emp.phone || '');
    if (emp.employee_stores && emp.employee_stores.length > 0) {
      setEmpStoreId(emp.employee_stores[0]?.store_id || '');
      // Preserve the role assigned for this employee-store so edits don't overwrite it
      setEmpRole((emp.employee_stores[0] as any)?.role || 'CAJERA');
    } else {
      setEmpStoreId('');
    }
    setCreateAccess(false);
    setIsEmployeeModalOpen(true);
  };

  const handleDeleteEmployeeClick = (empId: string, empName: string) => {
    setDeletingEmployee({ id: empId, name: empName });
  };

  const confirmDeleteEmployee = async () => {
    if (!deletingEmployee) return;
    try {
      const { error } = await supabase.from('employees').update({ is_active: false }).eq('id', deletingEmployee.id);
      if (error) throw error;
      showToast('Empleado deshabilitado correctamente', 'success');
      setDeletingEmployee(null);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Error al deshabilitar empleado', 'error');
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

    if (!selectedStoreId) {
      showToast('La tienda asignada es obligatoria', 'error');
      return;
    }

    setSavingUser(true);
    try {
      let hash;
      if (password) {
        hash = bcrypt.hashSync(password, 8);
      }

      if (editingUserId) {
        // EDIT
        const updates: any = {
          username: username.trim(),
          role: selectedRole,
          employee_id: selectedEmpId || null,
          email: email.trim() || null,
          default_store_id: selectedStoreId || null
        };
        if (hash) updates.password_hash = hash;

        const { error } = await supabase.from('profiles').update(updates).eq('id', editingUserId);
        if (error) throw error;

        if (selectedEmpId && selectedStoreId) {
          await supabase.from('employee_stores').delete().eq('employee_id', selectedEmpId);
          await supabase.from('employee_stores').insert({
            employee_id: selectedEmpId,
            store_id: selectedStoreId,
            role: selectedRole
          });
        }
        showToast('Acceso actualizado correctamente', 'success');
      } else {
        // CREATE
        const { error } = await supabase.from('profiles').insert({
          username: username.trim(),
          role: selectedRole,
          password_hash: hash,
          employee_id: selectedEmpId || null,
          email: email.trim() || null,
          default_store_id: selectedStoreId || null
        });
        if (error) throw error;

        if (selectedEmpId && selectedStoreId) {
          await supabase.from('employee_stores').delete().eq('employee_id', selectedEmpId);
          await supabase.from('employee_stores').insert({
            employee_id: selectedEmpId,
            store_id: selectedStoreId,
            role: selectedRole
          });
        }
        showToast('Acceso creado correctamente', 'success');
      }

      // Reset form
      setIsUserModalOpen(false);
      setEditingUserId(null);
      setUsername(''); setPassword(''); setEmail(''); setSelectedEmpId(''); setSelectedRole('CAJERA'); setSelectedStoreId('');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Error al guardar acceso', 'error');
    } finally {
      setSavingUser(false);
    }
  };

  // ── Link Employee Modal Handlers
  const handleLinkNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkingEmployee || !empUsername.trim() || !empPassword) return;
    setIsLinking(true);
    try {
      const hash = bcrypt.hashSync(empPassword, 8);
      const { error } = await supabase.from('profiles').insert({
        username: empUsername.trim(),
        role: empRole,
        password_hash: hash,
        employee_id: linkingEmployee.id,
        email: empEmail.trim() || null
      });
      if (error) throw error;
      showToast('Acceso creado y vinculado correctamente', 'success');
      setLinkingEmployee(null);
      setEmpUsername(''); setEmpPassword(''); setEmpEmail(''); setEmpRole('CAJERA');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Error al crear acceso', 'error');
    } finally {
      setIsLinking(false);
    }
  };

  const handleLinkExistingUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkingEmployee || !linkExistingUserId) return;
    setIsLinking(true);
    try {
      const { error } = await supabase.from('profiles').update({
        employee_id: linkingEmployee.id
      }).eq('id', linkExistingUserId);
      if (error) throw error;
      showToast('Usuario vinculado correctamente', 'success');
      setLinkingEmployee(null);
      setLinkExistingUserId('');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Error al vincular usuario', 'error');
    } finally {
      setIsLinking(false);
    }
  };

  const handleEditClick = (profile: Profile) => {
    setEditingUserId(profile.id);
    setUsername(profile.username);
    setEmail(profile.email || '');
    setSelectedRole(profile.role);
    setSelectedEmpId(profile.employee_id || '');
    setSelectedStoreId(profile.default_store_id || '');
    setPassword(''); // Leave empty so it doesn't get updated unless typed
    setIsUserModalOpen(true);
  };

  const handleCancelEdit = () => {
    setUsername(''); setPassword(''); setEmail(''); setSelectedEmpId(''); setSelectedRole('CAJERA'); setSelectedStoreId('');
    setEditingUserId(null);
    setIsUserModalOpen(false);
  };

  if (!isHydrated) return null;
  if (!permissions?.access_personal) {
    return <AccessDeniedView moduleName="Módulo de Personal" />;
  }

  const profileByEmployeeId = Object.fromEntries(
    allProfiles.filter(p => p.employee_id && p.role !== 'DELETED').map(p => [p.employee_id!, p]),
  );
  const activeProfiles = allProfiles.filter(p => p.role !== 'DELETED');
  const unlinkedEmployees = employees.filter(emp => !profileByEmployeeId[emp.id] || profileByEmployeeId[emp.id]?.id === editingUserId);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* ── Header ── */}
      <header className="bg-card border-b border-border px-6 h-16 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-4">
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

        <div className="flex items-center gap-4">
          <StoreSwitcher />
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-muted-foreground hover:bg-secondary text-xs font-bold transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>

          <div className="flex bg-secondary rounded-lg p-1 gap-1">
            {[
              { id: 'empleados' as Tab, label: 'Empleados' },
              { id: 'usuarios' as Tab, label: 'Usuarios (Perfiles)' },
              ...(permissions?.personal_manage_roles !== false ? [{ id: 'roles' as Tab, label: 'Roles y Permisos' }] : [])
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
              <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-bold uppercase tracking-wider">Personal Registrado</h2>
                  <span className="text-xs text-muted-foreground font-mono bg-secondary px-2.5 py-1 rounded-full">
                    {employees.length} empleado{employees.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {permissions?.personal_create_user !== false && (
                  <button
                    onClick={() => {
                      setEditingEmployee(null);
                      setFullName(''); setDni(''); setPhone(''); setCreateAccess(false);
                      setIsEmployeeModalOpen(true);
                    }}
                    className="h-9 px-4 flex items-center justify-center gap-2 rounded-lg font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" /> Nuevo Empleado
                  </button>
                )}
              </div>
              {loading ? (
                <div className="p-10 flex items-center justify-center gap-3 text-muted-foreground">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span className="text-sm font-medium">Cargando...</span>
                </div>
              ) : employees.length === 0 ? (
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
                        <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider">Nombre Completo</th>
                        <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider">DNI</th>
                        <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider">Tienda Asignada</th>
                        <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider">Rol de Acceso</th>
                        <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider">Usuario Vinculado</th>
                        <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {employees.map(emp => {
                        const profile = profileByEmployeeId[emp.id];
                        return (
                          <tr key={emp.id} className="hover:bg-secondary/20 transition-colors">
                            <td className="px-5 py-3.5 font-bold">{emp.full_name}</td>
                            <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground font-bold">{emp.dni}</td>
                            <td className="px-5 py-3.5">
                              {profile && profile.role === 'ADMIN' ? (
                                <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                                  Acceso Global
                                </span>
                              ) : emp.employee_stores && emp.employee_stores.length > 0 ? (
                                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                  {emp.employee_stores[0]?.stores?.name || (emp.employee_stores[0]?.store_id && storeMap.get(emp.employee_stores[0].store_id)) || '—'}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">—</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5">
                              {profile ? (
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${profile.role === 'ADMIN'
                                  ? 'bg-purple-500/10 border-purple-500/30 text-purple-500'
                                  : profile.role === 'CAJERA'
                                    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-500'
                                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                                  }`}>
                                  {profile.role}
                                </span>
                              ) : (
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full border bg-amber-500/10 border-amber-500/30 text-amber-500">
                                  Sin acceso
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3.5">
                              {profile ? (
                                <span className="text-xs text-indigo-500 font-bold font-mono">@{profile.username}</span>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">—</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {!profile && permissions?.personal_create_user !== false && (
                                  <button
                                    onClick={() => setLinkingEmployee(emp)}
                                    className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors inline-flex"
                                    title="Vincular a un Acceso"
                                  >
                                    <KeyRound className="w-4 h-4" />
                                  </button>
                                )}
                                {permissions?.personal_edit_user !== false && (
                                  <button
                                    onClick={() => handleEditEmployeeClick(emp)}
                                    className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors inline-flex"
                                    title="Editar datos de empleado"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                )}
                                {permissions?.personal_delete_user !== false && (
                                  <button
                                    onClick={() => handleDeleteEmployeeClick(emp.id, emp.full_name)}
                                    className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors inline-flex"
                                    title="Eliminar empleado"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
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
              <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-bold uppercase tracking-wider">Usuarios con Acceso</h2>
                  <span className="text-xs text-muted-foreground font-mono bg-secondary px-2.5 py-1 rounded-full">
                    {activeProfiles.length} usuario{activeProfiles.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {permissions?.personal_create_user !== false && (
                  <button
                    onClick={() => {
                      setUsername('');
                      setPassword('');
                      setEmail('');
                      setSelectedEmpId('');
                      setSelectedRole('CAJERA');
                      setSelectedStoreId('');
                      setEditingUserId(null);
                      setModalResetToken(prev => prev + 1);
                      setIsUserModalOpen(true);
                    }}
                    className="h-9 px-4 flex items-center justify-center gap-2 rounded-lg font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" /> Nuevo Acceso
                  </button>
                )}
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
                        <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider">Usuario</th>
                        <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider">Rol</th>
                        <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider">Tienda Asignada</th>
                        <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider">Empleado Vinculado</th>
                        <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider">Gmail</th>
                        <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {activeProfiles.map(profile => {
                        return (
                          <tr key={profile.id} className="hover:bg-secondary/20 transition-colors">
                            <td className="px-5 py-3.5 font-mono text-xs font-bold text-indigo-500">
                              @{profile.username}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${profile.role === 'ADMIN'
                                ? 'bg-purple-500/10 border-purple-500/30 text-purple-500'
                                : profile.role === 'CAJERA'
                                  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-500'
                                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                                }`}>
                                {profile.role}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              {profile.role === 'ADMIN' ? (
                                <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                                  Acceso Global
                                </span>
                              ) : (() => {
                                const linkedEmp = profile.employee_id ? employeeById[profile.employee_id] : null;
                                const empStoreId = linkedEmp?.employee_stores?.[0]?.store_id;
                                const empStoreName = linkedEmp?.employee_stores?.[0]?.stores?.name || (empStoreId ? storeMap.get(empStoreId) : null);
                                const resolvedStoreName = empStoreName || (profile.default_store_id ? storeMap.get(profile.default_store_id) : null) || (profile.stores?.[0]?.name);

                                return resolvedStoreName ? (
                                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                                    {resolvedStoreName}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">—</span>
                                );
                              })()}
                            </td>
                            <td className="px-5 py-3.5 text-xs text-muted-foreground font-medium">
                              {profile.employee_id ? employeeById[profile.employee_id]?.full_name : '—'}
                            </td>
                            <td className="px-5 py-3.5 text-xs text-muted-foreground">
                              {profile.email || '—'}
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              <div className="flex items-center justify-center gap-2">
                                {permissions?.personal_edit_user !== false && (
                                  <button
                                    onClick={() => handleEditClick(profile)}
                                    className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="Editar usuario"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                )}
                                {permissions?.personal_delete_user !== false && (
                                  <button
                                    onClick={() => {
                                      setDeletingUserId(profile.id);
                                      setDeletingUsername(profile.username);
                                    }}
                                    className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Desactivar usuario"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
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
            <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider">Matriz de Roles y Permisos</h2>
              <div className="flex gap-2">
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
                  onClick={() => setIsRoleModalOpen(true)}
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
                    {roles.map(r => (
                      <th key={r.id} title={r.description || r.name} className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        <div className="flex items-center justify-center gap-1.5">
                          <span>{r.name}</span>
                          {r.name === 'ADMIN' ? (
                            <span title="Rol del sistema protegido" className="inline-block align-middle">
                              <Lock className="w-3.5 h-3.5 text-purple-500" />
                            </span>
                          ) : (
                            <div className="flex items-center gap-1 ml-1 opacity-70 hover:opacity-100 transition-opacity">
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
                                title="Eliminar rol"
                                className="p-1 text-muted-foreground hover:text-red-500 transition-colors rounded"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </th>
                    ))}
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
                          {roles.map(r => (
                            <td key={r.id} className="px-6 py-4 text-center">
                              <div className="flex justify-center">
                                <label className={`relative inline-flex items-center cursor-pointer ${r.is_system ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                  <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={Boolean(r.name === 'ADMIN' || (r.permissions && r.permissions[group.mainKey]))}
                                    disabled={r.is_system}
                                    onChange={(e) => handleTogglePermission(r.id, r.permissions || {}, group.mainKey, e.target.checked)}
                                  />
                                  <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                                </label>
                              </div>
                            </td>
                          ))}
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
                            {roles.map(r => {
                              const isMainEnabled = Boolean(r.name === 'ADMIN' || (r.permissions && r.permissions[group.mainKey]));
                              const isSubEnabled = Boolean(r.name === 'ADMIN' || (r.permissions && r.permissions[sub.key]));
                              const isDisabled = r.is_system || !isMainEnabled;
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
            <form onSubmit={handleCreateEmployee} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
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

              <StoreSelector
                label="Tienda Asignada"
                value={empStoreId}
                onChange={setEmpStoreId}
              />

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
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Usuario</label>
                        <input
                          type="text"
                          placeholder="Ej: yuriko"
                          value={empUsername}
                          onChange={e => setEmpUsername(e.target.value)}
                          required
                          className="w-full h-10 bg-secondary/30 border border-border rounded-xl px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors font-mono"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Contraseña/PIN</label>
                          <input
                            type="password"
                            placeholder="Mín. 4 caracteres"
                            value={empPassword}
                            onChange={e => setEmpPassword(e.target.value)}
                            required
                            className="w-full h-10 bg-secondary/30 border border-border rounded-xl px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Rol</label>
                          <select
                            value={empRole}
                            onChange={e => setEmpRole(e.target.value)}
                            className="w-full h-10 bg-secondary/30 border border-border rounded-xl px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors"
                          >
                            {roles.map(r => (
                              <option key={r.id} value={r.name}>{r.name}</option>
                            ))}
                          </select>
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
                className={`w-full h-11 flex items-center justify-center gap-2 rounded-xl font-bold text-sm text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-md mt-4 ${
                  editingEmployee
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
                <form onSubmit={handleLinkNewUser} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Usuario</label>
                    <input type="text" placeholder="Ej: admin1" required value={empUsername} onChange={e => setEmpUsername(e.target.value)} className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Contraseña / PIN</label>
                    <input type="password" required minLength={4} value={empPassword} onChange={e => setEmpPassword(e.target.value)} className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Rol</label>
                      <select required value={empRole} onChange={e => setEmpRole(e.target.value)} className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors">
                        {roles.map(r => (
                          <option key={r.id} value={r.name}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Correo Gmail</label>
                      <input type="email" placeholder="Opcional" value={empEmail} onChange={e => setEmpEmail(e.target.value)} className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors" />
                    </div>
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
                      {activeProfiles.filter(p => !p.employee_id).length === 0 ? (
                        <option value="" disabled>No hay usuarios libres disponibles</option>
                      ) : (
                        activeProfiles.filter(p => !p.employee_id).map(p => (
                          <option key={p.id} value={p.id}>@{p.username} ({p.role})</option>
                        ))
                      )}
                    </select>
                  </div>
                  <button type="submit" disabled={isLinking || activeProfiles.filter(p => !p.employee_id).length === 0} className="w-full h-11 mt-2 flex items-center justify-center gap-2 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-md">
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
                <input
                  type="password"
                  placeholder={editingUserId ? "Dejar vacío para no cambiar" : "Mínimo 4 caracteres"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required={!editingUserId}
                  minLength={4}
                  autoComplete="new-password"
                  className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Rol del Sistema
                  </label>
                  <select
                    value={selectedRole}
                    onChange={e => setSelectedRole(e.target.value)}
                    required
                    className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors"
                  >
                    {roles.map(r => (
                      <option key={r.id} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <StoreSelector
                    label="Tienda Asignada"
                    value={selectedStoreId}
                    onChange={setSelectedStoreId}
                    disabled={!!selectedEmpId}
                  />
                  {selectedEmpId && (
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1 font-medium">
                      <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      Tienda heredada del empleado.
                    </span>
                  )}
                </div>
              </div>
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
                  {unlinkedEmployees.map(emp => (
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
                className={`w-full h-11 mt-2 flex items-center justify-center gap-2 rounded-xl font-bold text-sm text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-md ${
                  editingUserId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'
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
