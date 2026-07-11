'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Users, UserPlus, ShieldAlert,
  CheckCircle2, RefreshCw, KeyRound, Plus,
  ShieldCheck, UserCog, Edit2, X, Trash2
} from 'lucide-react';
import { updateUserAuth } from '../../actions/user.actions';
import { supabase } from '../../lib/supabase';
import { useRole } from '../../context/RoleContext';
import { ConfirmDialog } from '../../../components/ConfirmDialog';

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
  employee_id: string | null;
};

type Tab = 'empleados' | 'usuarios';

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
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ── Empleados form state
  const [fullName, setFullName] = useState('');
  const [dni, setDni] = useState('');
  const [phone, setPhone] = useState('');
  const [savingEmployee, setSavingEmployee] = useState(false);

  // ── Usuarios form state
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('CAJERA');
  const [savingUser, setSavingUser] = useState(false);

  // ── Edit user password state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

  // ── Soft-delete user state
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deletingUsername, setDeletingUsername] = useState('');
  const [isDeletingUser, setIsDeletingUser] = useState(false);

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
      const [{ data: empData, error: empErr }, { data: profData, error: profErr }] = await Promise.all([
        supabase.from('employees').select('*').order('full_name', { ascending: true }),
        supabase.from('profiles').select('*'),
      ]);

      if (empErr) throw empErr;
      if (profErr) throw profErr;

      setEmployees(empData ?? []);
      setAllProfiles(profData ?? []);
    } catch (err: any) {
      showToast(err.message || 'Error al cargar datos', 'error');
    } finally {
      setLoading(false);
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

  // ── Create employee
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !dni.trim()) {
      showToast('Nombre completo y DNI son obligatorios', 'error');
      return;
    }
    setSavingEmployee(true);
    try {
      const { error } = await supabase.from('employees').insert({
        full_name: fullName.trim(),
        dni: dni.trim(),
        phone: phone.trim() || null,
      });
      if (error) throw error;
      showToast('Empleado registrado correctamente', 'success');
      setFullName(''); setDni(''); setPhone('');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Error al registrar empleado', 'error');
    } finally {
      setSavingEmployee(false);
    }
  };

  // ── Create credentials
  const handleCreateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      showToast('Usuario y contraseña son obligatorios', 'error');
      return;
    }
    setSavingUser(true);
    try {
      const { error: profileErr } = await supabase.from('profiles').insert({
        username: username.trim(),
        role: selectedRole,
        password_hash: password,
        employee_id: selectedEmpId || null,
      });
      if (profileErr) throw profileErr;

      showToast('Acceso creado correctamente', 'success');
      setUsername(''); setPassword(''); setSelectedEmpId(''); setSelectedRole('CAJERA');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Error al crear acceso', 'error');
    } finally {
      setSavingUser(false);
    }
  };

  // ── Edit user password
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserId || !newPassword) return;
    setIsUpdatingUser(true);
    
    try {
      const { success, error } = await updateUserAuth(editingUserId, newPassword);
      if (!success) throw new Error(error);
      
      showToast('Contraseña actualizada correctamente', 'success');
      setEditingUserId(null);
      setNewPassword('');
    } catch (err: any) {
      showToast(err.message || 'Error al actualizar contraseña', 'error');
    } finally {
      setIsUpdatingUser(false);
    }
  };

  if (!isHydrated || role !== 'ADMIN') return null;

  const profileByEmployeeId = Object.fromEntries(
    allProfiles.filter(p => p.employee_id && p.role !== 'DELETED').map(p => [p.employee_id!, p]),
  );
  const activeProfiles = allProfiles.filter(p => p.role !== 'DELETED');
  const unlinkedEmployees = employees.filter(emp => !profileByEmployeeId[emp.id]);
  const employeeById = Object.fromEntries(employees.map(emp => [emp.id, emp]));

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* ── Header ── */}
      <header className="bg-card border-b border-border px-6 h-16 flex items-center gap-4 shadow-sm shrink-0">
        <Link
          href="/hub"
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
            <UserCog className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-none">Gestión de Personal</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Empleados · Roles · Accesos del sistema</p>
          </div>
        </div>
        <div className="ml-auto">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary hover:bg-muted text-muted-foreground text-xs font-bold transition-colors border border-border"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div className="border-b border-border bg-card px-6 shrink-0">
        <div className="flex gap-1">
          {([
            { id: 'empleados', label: 'Empleados', Icon: Users },
            { id: 'usuarios', label: 'Usuarios y Accesos', Icon: ShieldCheck },
          ] as { id: Tab; label: string; Icon: React.ElementType }[]).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-bold border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <main className="flex-1 p-6 max-w-screen-xl w-full mx-auto">

        {/* ════ TAB 1: EMPLEADOS ════ */}
        {activeTab === 'empleados' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Form */}
            <div className="lg:col-span-1">
              <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-indigo-500" />
                  <h2 className="text-sm font-bold uppercase tracking-wider">Nuevo Empleado</h2>
                </div>
                <form onSubmit={handleCreateEmployee} className="p-5 space-y-4">
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
                      Teléfono <span className="text-muted-foreground/50 normal-case font-normal">(Opcional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 987654321"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingEmployee}
                    className="w-full h-11 flex items-center justify-center gap-2 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-md"
                  >
                    {savingEmployee
                      ? <><RefreshCw className="w-4 h-4 animate-spin" /> Guardando...</>
                      : <><Plus className="w-4 h-4" /> Registrar Empleado</>
                    }
                  </button>
                </form>
              </div>
            </div>

            {/* List */}
            <div className="lg:col-span-2">
              <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-wider">Personal Registrado</h2>
                  <span className="text-xs text-muted-foreground font-mono bg-secondary px-2.5 py-1 rounded-full">
                    {employees.length} empleado{employees.length !== 1 ? 's' : ''}
                  </span>
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
                          <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider">Teléfono</th>
                          <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider">Estado Acceso</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {employees.map(emp => {
                          const profile = profileByEmployeeId[emp.id];
                          return (
                            <tr key={emp.id} className="hover:bg-secondary/20 transition-colors">
                              <td className="px-5 py-3.5 font-bold">{emp.full_name}</td>
                              <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground font-bold">{emp.dni}</td>
                              <td className="px-5 py-3.5 text-xs text-muted-foreground">{emp.phone || '—'}</td>
                              <td className="px-5 py-3.5">
                                {profile ? (
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                                      profile.role === 'ADMIN'
                                        ? 'bg-purple-500/10 border-purple-500/30 text-purple-500'
                                        : profile.role === 'CAJERA'
                                        ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-500'
                                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                                    }`}>
                                      {profile.role}
                                    </span>
                                    <span className="text-xs text-muted-foreground font-mono">@{profile.username}</span>
                                  </div>
                                ) : (
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-full border bg-amber-500/10 border-amber-500/30 text-amber-500">
                                    Sin acceso
                                  </span>
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
          </div>
        )}

        {/* ════ TAB 2: USUARIOS Y ACCESOS ════ */}
        {activeTab === 'usuarios' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Form */}
            <div className="lg:col-span-1">
              <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-indigo-500" />
                  <h2 className="text-sm font-bold uppercase tracking-wider">Crear Acceso</h2>
                </div>
                <form onSubmit={handleCreateCredentials} className="p-5 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Usuario
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: yuriko, admin1, 1550"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      required
                      className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Contraseña
                    </label>
                    <input
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors"
                    />
                  </div>

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
                      <option value="ADMIN">ADMIN — Acceso completo</option>
                      <option value="CAJERA">CAJERA — Caja y Contabilidad</option>
                      <option value="MOSTRADOR">MOSTRADOR — Punto de Venta</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Empleado <span className="text-muted-foreground/50 normal-case font-normal">(Opcional)</span>
                    </label>
                    {unlinkedEmployees.length === 0 ? (
                      <div className="h-10 flex items-center px-3 bg-muted/30 rounded-xl border border-border text-sm text-muted-foreground italic">
                        Sin empleados disponibles para vincular
                      </div>
                    ) : (
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
                      </select>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={savingUser}
                    className="w-full h-11 flex items-center justify-center gap-2 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-md"
                  >
                    {savingUser
                      ? <><RefreshCw className="w-4 h-4 animate-spin" /> Creando acceso...</>
                      : <><KeyRound className="w-4 h-4" /> Crear Acceso</>
                    }
                  </button>
                </form>
              </div>
            </div>

            {/* Credentials list */}
            <div className="lg:col-span-2">
              <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-wider">Usuarios con Acceso</h2>
                  <span className="text-xs text-muted-foreground font-mono bg-secondary px-2.5 py-1 rounded-full">
                    {activeProfiles.length} usuario{activeProfiles.length !== 1 ? 's' : ''}
                  </span>
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
                          <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider">Empleado vinculado</th>
                          <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-wider">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {activeProfiles.map(profile => {
                          const linkedEmployee = profile.employee_id
                            ? employeeById[profile.employee_id]
                            : null;
                          return (
                            <tr key={profile.id} className="hover:bg-secondary/20 transition-colors">
                              <td className="px-5 py-3.5 font-mono text-xs font-bold text-indigo-500">
                                {profile.username}
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
                              <td className="px-5 py-3.5 text-xs text-muted-foreground">
                                {linkedEmployee ? linkedEmployee.full_name : '—'}
                              </td>
                              <td className="px-5 py-3.5 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => {
                                      setEditingUserId(profile.id);
                                      setEditUsername(profile.username);
                                      setNewPassword('');
                                    }}
                                    className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="Cambiar contraseña"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setDeletingUserId(profile.id);
                                      setDeletingUsername(profile.username);
                                    }}
                                    className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Eliminar usuario"
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
          </div>
        )}
      </main>

      {/* ── Edit User Modal ── */}
      {editingUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-500" />
                <h2 className="text-sm font-bold uppercase tracking-wider">Cambiar Contraseña</h2>
              </div>
              <button
                onClick={() => setEditingUserId(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleUpdatePassword} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Usuario
                </label>
                <div className="h-10 bg-secondary/50 border border-border rounded-xl px-3 flex items-center text-sm font-semibold font-mono text-muted-foreground">
                  {editUsername}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Nueva Contraseña
                </label>
                <input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  autoFocus
                  className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 transition-colors"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingUserId(null)}
                  className="flex-1 h-10 rounded-xl font-bold text-sm bg-secondary hover:bg-muted text-muted-foreground transition-colors border border-border"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingUser || !newPassword}
                  className="flex-1 h-10 flex items-center justify-center gap-2 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-md"
                >
                  {isUpdatingUser
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Guardando...</>
                    : 'Actualizar'
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* ── Toast ── */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
