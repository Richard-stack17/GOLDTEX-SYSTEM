'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Users, UserPlus, ShieldAlert,
  CheckCircle2, RefreshCw, KeyRound, Plus,
  ShieldCheck, UserCog, Edit2, X, Trash2, Check, XCircle,
  ShoppingCart, PackageSearch, BarChart3, Banknote, FileSpreadsheet, Contact, ScrollText, Settings, Shield, Save, Loader2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useRole } from '../../context/RoleContext';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import bcrypt from 'bcryptjs';

// ─── Types ────────────────────────────────────────────────────────────────────
type Employee = {
  id: string;
  full_name: string;
  dni: string;
  phone?: string;
  created_at: string;
};

type Profile = {
  id: string;
  username: string;
  role: string;
  email: string | null;
  employee_id: string | null;
};

type Tab = 'empleados' | 'usuarios' | 'roles';

type Role = {
  id: string;
  name: string;
  description: string;
  permissions: Record<string, boolean>;
  is_system: boolean;
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
    subPermissions: []
  },
  {
    app: 'Historial de Proformas',
    mainKey: 'access_proformas',
    icon: ScrollText,
    color: 'text-teal-500',
    bgColor: 'bg-teal-500/10',
    borderColor: 'border-teal-500/20',
    subPermissions: []
  },
  {
    app: 'Caja',
    mainKey: 'access_caja',
    icon: Banknote,
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
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
    subPermissions: []
  },
  {
    app: 'Clientes Frecuentes',
    mainKey: 'access_clientes',
    icon: Contact,
    color: 'text-pink-500',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/20',
    subPermissions: []
  },
  {
    app: 'Catálogo / Inventario',
    mainKey: 'access_inventory',
    icon: PackageSearch,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    subPermissions: []
  },
  {
    app: 'Personal',
    mainKey: 'access_personal',
    icon: Users,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/20',
    subPermissions: []
  },
  {
    app: 'Dashboard',
    mainKey: 'access_dashboard',
    icon: BarChart3,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    subPermissions: []
  },
  {
    app: 'Configuración',
    mainKey: 'access_settings',
    icon: Settings,
    color: 'text-slate-500',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/20',
    subPermissions: []
  }
];

// ─── Toast helper ─────────────────────────────────────────────────────────────
function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-2xl font-bold text-sm animate-in fade-in slide-in-from-bottom-4 ${
      type === 'success'
        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
        : 'bg-red-500/10 border-red-500/30 text-red-500'
    }`}>
      {type === 'success'
        ? <CheckCircle2 className="w-4 h-4 shrink-0" />
        : <ShieldAlert className="w-4 h-4 shrink-0" />}
      <span>{message}</span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PersonalPage() {
  const { role, isHydrated } = useRole();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>('empleados');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ── Empleados form state
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

  // ── Usuarios form state (Crear / Editar)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState('CAJERA');
  const [savingUser, setSavingUser] = useState(false);

  // ── Soft-delete user state
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deletingUsername, setDeletingUsername] = useState('');
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // ── Link Employee Modal state
  const [linkingEmployee, setLinkingEmployee] = useState<Employee | null>(null);
  const [linkMode, setLinkMode] = useState<'new' | 'existing'>('new');
  const [linkExistingUserId, setLinkExistingUserId] = useState('');
  const [isLinking, setIsLinking] = useState(false);

  // ── Roles state
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [savingRole, setSavingRole] = useState(false);
  
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
        supabase.from('employees').select('*').order('full_name', { ascending: true }),
        supabase.from('profiles').select('id, username, role, employee_id, email'),
        supabase.from('roles').select('*').order('created_at', { ascending: true }),
      ]);

      if (empErr) throw empErr;
      if (profErr) throw profErr;
      if (rolesErr) throw rolesErr;

      setEmployees(empData ?? []);
      setAllProfiles(profData ?? []);
      setRoles(rolesData ?? []);
      setOriginalRoles(rolesData ?? []);
      setHasUnsavedRoleChanges(false);
      
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
    if (!isHydrated) return;
    if (role !== 'ADMIN') { router.push('/hub'); return; }
    loadData();
  }, [isHydrated, role]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Create employee (+ Optional Profile)
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !dni.trim()) {
      showToast('Nombre completo y DNI son obligatorios', 'error');
      return;
    }
    
    if (createAccess && (!empUsername.trim() || !empPassword)) {
      showToast('Usuario y contraseña son obligatorios para crear el acceso', 'error');
      return;
    }

    setSavingEmployee(true);
    try {
      // 1. Insert Employee
      const { data: newEmp, error: empErr } = await supabase.from('employees').insert({
        full_name: fullName.trim(),
        dni: dni.trim(),
        phone: phone.trim() || null,
      }).select('id').single();

      if (empErr) throw empErr;

      // 2. Insert Profile (if toggled)
      if (createAccess && newEmp) {
        const hash = bcrypt.hashSync(empPassword, 8);
        const { error: profErr } = await supabase.from('profiles').insert({
          username: empUsername.trim(),
          role: empRole,
          password_hash: hash,
          employee_id: newEmp.id,
          email: empEmail.trim() || null
        });
        if (profErr) throw profErr;
      }

      showToast(createAccess ? 'Empleado y acceso creados correctamente' : 'Empleado registrado correctamente', 'success');
      
      // Reset form
      setIsEmployeeModalOpen(false);
      setFullName(''); setDni(''); setPhone('');
      setCreateAccess(false); setEmpUsername(''); setEmpPassword(''); setEmpEmail(''); setEmpRole('CAJERA');
      
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Error al registrar empleado', 'error');
    } finally {
      setSavingEmployee(false);
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

      if (editingUserId) {
        // EDIT
        const updates: any = {
          username: username.trim(),
          role: selectedRole,
          employee_id: selectedEmpId || null,
          email: email.trim() || null
        };
        if (hash) updates.password_hash = hash;

        const { error } = await supabase.from('profiles').update(updates).eq('id', editingUserId);
        if (error) throw error;
        showToast('Acceso actualizado correctamente', 'success');
      } else {
        // CREATE
        const { error } = await supabase.from('profiles').insert({
          username: username.trim(),
          role: selectedRole,
          password_hash: hash,
          employee_id: selectedEmpId || null,
          email: email.trim() || null
        });
        if (error) throw error;
        showToast('Acceso creado correctamente', 'success');
      }

      // Reset form
      setIsUserModalOpen(false);
      setEditingUserId(null);
      setUsername(''); setPassword(''); setEmail(''); setSelectedEmpId(''); setSelectedRole('CAJERA');
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
    setPassword(''); // Leave empty so it doesn't get updated unless typed
    setIsUserModalOpen(true);
  };

  const handleCancelEdit = () => {
    setUsername(''); setPassword(''); setEmail(''); setSelectedEmpId(''); setSelectedRole('CAJERA');
    setIsUserModalOpen(false);
  };

  if (!isHydrated || role !== 'ADMIN') return null;

  const profileByEmployeeId = Object.fromEntries(
    allProfiles.filter(p => p.employee_id && p.role !== 'DELETED').map(p => [p.employee_id!, p]),
  );
  const activeProfiles = allProfiles.filter(p => p.role !== 'DELETED');
  const unlinkedEmployees = employees.filter(emp => !profileByEmployeeId[emp.id] || profileByEmployeeId[emp.id].id === editingUserId);
  const employeeById = Object.fromEntries(employees.map(emp => [emp.id, emp]));

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
              { id: 'roles' as Tab, label: 'Roles y Permisos' }
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                  activeTab === id
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
                <button
                  onClick={() => {
                    setFullName(''); setDni(''); setPhone(''); setCreateAccess(false);
                    setIsEmployeeModalOpen(true);
                  }}
                  className="h-9 px-4 flex items-center justify-center gap-2 rounded-lg font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> Nuevo Empleado
                </button>
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
                                {profile ? (
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                                    profile.role === 'ADMIN'
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
                                {!profile && (
                                  <button
                                    onClick={() => setLinkingEmployee(emp)}
                                    className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors inline-flex"
                                    title="Vincular a un Acceso"
                                  >
                                    <KeyRound className="w-4 h-4 mx-auto" />
                                  </button>
                                )}
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
                <button
                  onClick={() => {
                    handleCancelEdit();
                    setIsUserModalOpen(true);
                  }}
                  className="h-9 px-4 flex items-center justify-center gap-2 rounded-lg font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> Nuevo Acceso
                </button>
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
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                                  profile.role === 'ADMIN'
                                    ? 'bg-purple-500/10 border-purple-500/30 text-purple-500'
                                    : profile.role === 'CAJERA'
                                    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-500'
                                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                                }`}>
                                  {profile.role}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-xs text-muted-foreground font-medium">
                                {profile.employee_id && employeeById[profile.employee_id] ? employeeById[profile.employee_id].full_name : '—'}
                              </td>
                              <td className="px-5 py-3.5 text-xs text-muted-foreground">
                                {profile.email || '—'}
                              </td>
                              <td className="px-5 py-3.5 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => handleEditClick(profile)}
                                    className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="Editar usuario"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
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
                  className={`h-9 px-4 flex items-center justify-center gap-2 rounded-lg font-bold text-xs transition-colors shadow-sm ${
                    hasUnsavedRoleChanges ? 'bg-secondary hover:bg-secondary/80 text-foreground' : 'bg-secondary/50 text-muted-foreground cursor-not-allowed'
                  }`}
                >
                  Restaurar
                </button>
                <button
                  onClick={handleSavePermissions}
                  disabled={!hasUnsavedRoleChanges || savingPermissions}
                  className={`h-9 px-4 flex items-center justify-center gap-2 rounded-lg font-bold text-xs transition-colors shadow-sm ${
                    hasUnsavedRoleChanges ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-secondary/50 text-muted-foreground cursor-not-allowed'
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
                      <th key={r.id} className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {r.name}
                        {r.is_system && <ShieldCheck className="w-3.5 h-3.5 inline ml-1.5 text-indigo-500" title="Rol del sistema" />}
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
                              <div className={`p-2 rounded-lg ${group.bgColor} border ${group.borderColor}`}>
                                <Icon className={`w-4 h-4 ${group.color}`} />
                              </div>
                              <span className="font-bold text-sm">{group.app}</span>
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

      {/* ── Unsaved Changes Exit Dialog ── */}
      <ConfirmDialog
        isOpen={showRoleExitConfirm}
        title="Cambios sin Guardar"
        description="Tienes cambios pendientes en la matriz de roles y permisos. ¿Estás seguro que deseas salir? Los cambios se perderán."
        confirmText="Salir y perder cambios"
        cancelText="Cancelar"
        isDestructive={true}
        onConfirm={() => {
          setRoles(originalRoles);
          setHasUnsavedRoleChanges(false);
          setShowRoleExitConfirm(false);
          if (pendingTab) setActiveTab(pendingTab);
          setPendingTab(null);
        }}
        onCancel={() => {
          setShowRoleExitConfirm(false);
          setPendingTab(null);
        }}
      />

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
                <h2 className="text-sm font-bold uppercase tracking-wider">Nuevo Empleado</h2>
              </div>
              <button
                onClick={() => setIsEmployeeModalOpen(false)}
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

              {/* Toggle Acceso Rápido */}
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

              <button
                type="submit"
                disabled={savingEmployee}
                className="w-full h-11 flex items-center justify-center gap-2 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-md mt-4"
              >
                {savingEmployee
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Guardando...</>
                  : <><Plus className="w-4 h-4" /> Registrar Empleado</>
                }
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card rounded-2xl shadow-xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
            <div className={`px-5 py-4 border-b flex items-center justify-between ${editingUserId ? 'bg-amber-500/10 border-amber-500/20 text-amber-600' : 'bg-muted/20 border-border text-foreground'}`}>
              <div className="flex items-center gap-2">
                {editingUserId ? <Edit2 className="w-4 h-4" /> : <KeyRound className="w-4 h-4 text-indigo-500" />}
                <h2 className="text-sm font-bold uppercase tracking-wider">
                  {editingUserId ? 'Editar Acceso / Contraseña' : 'Crear Acceso'}
                </h2>
              </div>
              <button
                onClick={handleCancelEdit}
                className={`transition-colors p-1 rounded-lg ${editingUserId ? 'hover:bg-amber-500/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveCredentials} className="p-5 space-y-4">
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
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Correo Gmail
                  </label>
                  <input
                    type="email"
                    placeholder="Opcional"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors"
                  />
                </div>
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
                {savingUser
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Guardando...</>
                  : editingUserId
                    ? <><Edit2 className="w-4 h-4" /> Actualizar Acceso</>
                    : <><KeyRound className="w-4 h-4" /> Crear Acceso</>
                }
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
