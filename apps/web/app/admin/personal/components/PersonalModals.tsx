import React from 'react';
import {
  UserPlus, ShieldAlert,
  RefreshCw, Plus,
  UserCog, X, Trash2, Check,
  Info, RotateCcw,
  Eye, EyeOff, ShieldCheck, Edit2, KeyRound, Loader2, Save, Unlink
} from 'lucide-react';
import { ConfirmDialog } from '../../../../components/ConfirmDialog';
import { Toast } from './Toast';
import { Employee, Profile, Role, PERMISSION_GROUPS } from '../types';
import { usePersonal } from '../PersonalContext';

export function PersonalModals() {
  const {
    activeProfiles, activeStoreId, activeTab, allProfiles, allRoles, availableStoreIds, availableStores, checkCanManageTarget, checkUsernameState, confirmDeleteEmployee, confirmDeleteRole, confirmGlobalAccess, createAccess, deletingEmployee, deletingRole, deletingUserId, deletingUsername, dni, editRoleDesc, editRoleName, editingEmployee, editingRole, editingUserId, email, empAccessScope, empEmail, empGlobalRole, empPassword, empStoreIds, empStoreRoleIds, empStoreRoles, empUsername, employeeById, employees, formatFriendlyErrorMessage, fullName, getRoleBadgeStyle, getValidStoreRole, globalRoles, handleCancelEdit, handleCreateEmployee, handleCreateRole, handleDeleteEmployeeClick, handleDeleteRole, handleDeleteUser, handleEditClick, handleEditEmployeeClick, handleExecuteRestoration, handleLinkExistingUser, handleLinkNewUser, handleRestoreEmployee, handleRestorePermissions, handleRestoreRole, handleRestoreUser, handleSaveCredentials, handleSaveEditRole, handleSavePermissions, handleTabChange, handleTogglePermission, hasUnsavedRoleChanges, isAdmin, isDeletingRole, isDeletingUser, isEditRoleModalOpen, isEmployeeModalOpen, isGlobalUser, isHydrated, isLinking, isRestoringUser, isRoleConfirmModalOpen, isRoleModalOpen, isRoleWarningModalOpen, isUserGlobalAdmin, isUserModalOpen, linkExistingUserId, linkMode, linkRoleId, linkingEmployee, loadData, loading, modalResetToken, newRoleDesc, newRoleName, newRoleScopeStoreId, originalRoles, password, pendingRestoration, pendingTab, permissions, phone, profileByEmployeeId, renderRoleOptions, renderStoreAndRoleBadges, renderStoreRoleList, role, roleAssignedUsers, roles, router, savingEditRole, savingEmployee, savingPermissions, savingRole, savingUser, selectedEmpId, selectedModalStoreId, selectedStoreIds, setActiveTab, setAllProfiles, setAllRoles, setConfirmGlobalAccess, setCreateAccess, setDeletingEmployee, setDeletingRole, setDeletingUserId, setDeletingUsername, setDni, setEditRoleDesc, setEditRoleName, setEditingEmployee, setEditingRole, setEditingUserId, setEmail, setEmpAccessScope, setEmpEmail, setEmpGlobalRole, setEmpPassword, setEmpStoreIds, setEmpStoreRoleIds, setEmpStoreRoles, setEmpUsername, setEmployees, setFullName, setHasUnsavedRoleChanges, setIsDeletingRole, setIsDeletingUser, setIsEditRoleModalOpen, setIsEmployeeModalOpen, setIsLinking, setIsRestoringUser, setIsRoleConfirmModalOpen, setIsRoleModalOpen, setIsRoleWarningModalOpen, setIsUserModalOpen, setLinkExistingUserId, setLinkMode, setLinkRoleId, setLinkingEmployee, setLoading, setModalResetToken, setNewRoleDesc, setNewRoleName, setNewRoleScopeStoreId, setOriginalRoles, setPassword, setPendingRestoration, setPendingTab, setPhone, setRoleAssignedUsers, setRoles, setSavingEditRole, setSavingEmployee, setSavingPermissions, setSavingRole, setSavingUser, setSelectedEmpId, setSelectedModalStoreId, setSelectedStoreIds, setShowEmpPassword, setShowInactiveEmployees, setShowInactiveRoles, setShowInactiveUsers, setShowRoleExitConfirm, setShowUserPassword, setToast, setUserAccessScope, setUserGlobalRole, setUserStoreRoleIds, setUserStoreRoles, setUsername, showEmpPassword, showInactiveEmployees, showInactiveRoles, showInactiveUsers, showRoleExitConfirm, showToast, showUserPassword, storeMap, syncEmployeeStoreAssignment, targetModalStoreId, toast, unlinkedEmployees, userAccessScope, userGlobalRole, userStoreRoleIds, userStoreRoles, username, visibleEmployees, visibleRoles,
    isManagePermsModalOpen, setIsManagePermsModalOpen, managingPermsRoleId, setManagingPermsRoleId,
    unlinkingEmployee, setUnlinkingEmployee, confirmUnlinkEmployee
  } = usePersonal();

  return (
    <>

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
                  {availableStores.map((s: any) => (
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
                        onToggleStore: (storeId: any, checked: any) => {
                          if (checked) {
                            setEmpStoreIds((prev: any) => [...prev, storeId]);
                            const defaultRoleName = getValidStoreRole(null, storeId);
                            const storeAvailableRoles = roles.filter((r: any) => r.name !== 'ADMIN' && (r.store_id === storeId || !r.store_id));
                            const defaultRoleId = storeAvailableRoles.find((r: any) => r.name === defaultRoleName)?.id || storeAvailableRoles[0]?.id || '';
                            setEmpStoreRoles((prev: any) => ({ ...prev, [storeId]: prev[storeId] || defaultRoleName }));
                            setEmpStoreRoleIds((prev: any) => ({ ...prev, [storeId]: prev[storeId] || defaultRoleId }));
                          } else {
                            setEmpStoreIds((prev: any) => prev.filter((id: any) => id !== storeId));
                            setEmpStoreRoles((prev: any) => {
                              const next = { ...prev };
                              delete next[storeId];
                              return next;
                            });
                            setEmpStoreRoleIds((prev: any) => {
                              const next = { ...prev };
                              delete next[storeId];
                              return next;
                            });
                          }
                        },
                        onRoleChange: (storeId: any, roleName: any, roleId: any) => {
                          setEmpStoreRoles((prev: any) => ({ ...prev, [storeId]: roleName }));
                          setEmpStoreRoleIds((prev: any) => ({ ...prev, [storeId]: roleId }));
                        },
                        isDisabled: false,
                      })
                    ) : (
                      <div className="space-y-2 mt-2">
                        {availableStores.map((store: any) => {
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
                                  onChange={(e: any) => {
                                    if (e.target.checked) {
                                      setEmpStoreIds((prev: any) => [...prev, store.id]);
                                      const defaultRoleName = getValidStoreRole(null, store.id);
                                      const storeAvailableRoles = roles.filter((r: any) => r.name !== 'ADMIN' && (r.store_id === store.id || !r.store_id));
                                      const defaultRoleId = storeAvailableRoles.find((r: any) => r.name === defaultRoleName)?.id || storeAvailableRoles[0]?.id || '';
                                      setEmpStoreRoles((prev: any) => ({ ...prev, [store.id]: prev[store.id] || defaultRoleName }));
                                      setEmpStoreRoleIds((prev: any) => ({ ...prev, [store.id]: prev[store.id] || defaultRoleId }));
                                    } else {
                                      setEmpStoreIds((prev: any) => prev.filter((id: any) => id !== store.id));
                                      setEmpStoreRoles((prev: any) => {
                                        const next = { ...prev };
                                        delete next[store.id];
                                        return next;
                                      });
                                      setEmpStoreRoleIds((prev: any) => {
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
                              onChange={(e: any) => {
                                const newStoreId = e.target.value;
                                setSelectedModalStoreId(newStoreId);
                                const defaultRoleName = getValidStoreRole(null, newStoreId);
                                const storeAvailableRoles = roles.filter((r: any) => r.name !== 'ADMIN' && (r.store_id === newStoreId || !r.store_id));
                                const defaultRoleId = storeAvailableRoles.find((r: any) => r.name === defaultRoleName)?.id || storeAvailableRoles[0]?.id || '';
                                setEmpStoreIds([newStoreId]);
                                setEmpStoreRoles({ [newStoreId]: defaultRoleName });
                                setEmpStoreRoleIds({ [newStoreId]: defaultRoleId });
                              }}
                              className="h-8 px-2 text-xs font-bold rounded-lg border border-border bg-background cursor-pointer text-foreground"
                            >
                              {availableStores.map((s: any) => (
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
                          (r: any) => r.name !== 'ADMIN' && (r.store_id === targetModalStoreId || !r.store_id)
                        );
                        const currentRoleName = empStoreRoles[targetModalStoreId] || (storeAvailableRoles[0]?.name || 'CAJERO');
                        const currentRoleId = empStoreRoleIds[targetModalStoreId] || storeAvailableRoles.find((r: any) => r.name === currentRoleName)?.id || storeAvailableRoles[0]?.id || '';
                        const selectedValue = storeAvailableRoles.some((r: any) => r.id === currentRoleId)
                          ? currentRoleId
                          : (storeAvailableRoles.find((r: any) => r.name === currentRoleName)?.id || storeAvailableRoles[0]?.id || '');
                        return (
                          <select
                            value={selectedValue}
                            onChange={(e: any) => {
                              const selectedRole = storeAvailableRoles.find((r: any) => r.id === e.target.value);
                              if (selectedRole) {
                                setEmpStoreRoles({ [targetModalStoreId]: selectedRole.name });
                                setEmpStoreRoleIds({ [targetModalStoreId]: selectedRole.id });
                              }
                            }}
                            className="h-8 px-2 text-xs font-bold rounded-lg border border-border bg-background cursor-pointer"
                          >
                            {storeAvailableRoles.map((r: any) => {
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
                          onChange={(e: any) => setCreateAccess(e.target.checked)}
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
                      {roles.filter((r: any) => r.name !== 'ADMIN').map((r: any) => {
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
                      {allProfiles.filter((p: any) => p.role !== 'DELETED' && !p.employee_id).length === 0 ? (
                        <option value="" disabled>No hay usuarios libres disponibles</option>
                      ) : (
                        allProfiles.filter((p: any) => p.role !== 'DELETED' && !p.employee_id).map((p: any) => {
                          const isProfileGlobalRole = p.role === 'ADMIN' || roles.some((r: any) => (r.id === p.role_id || r.name === p.role) && (!r.store_id || r.is_system));
                          const pStoreIds = p.employee_stores?.map((es: any) => es.store_id) || (p.default_store_id ? [p.default_store_id] : []);
                          const pStoreNames = pStoreIds.length > 0
                            ? pStoreIds.map((id: any) => storeMap.get(id) || 'Tienda').join(', ')
                            : (isProfileGlobalRole ? 'Global' : 'Sin tienda');
                          const empStoresSorted = (linkingEmployee?.employee_stores || []).map((es: any) => es.store_id).sort().join(',');
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
                  <button type="submit" disabled={isLinking || allProfiles.filter((p: any) => p.role !== 'DELETED' && !p.employee_id).length === 0} className="w-full h-11 mt-2 flex items-center justify-center gap-2 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-md">
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
                    onChange={(e: any) => setUserGlobalRole(e.target.value)}
                    className="w-full h-10 px-3 text-xs font-bold rounded-xl border border-purple-200 bg-white text-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
                  >
                    {globalRoles.map((r: any) => (
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
                      onChange={(e: any) => setConfirmGlobalAccess(e.target.checked)}
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
                      onToggleStore: (storeId: any, checked: any) => {
                        if (!selectedEmpId) {
                          if (checked) {
                            setSelectedStoreIds((prev: any) => [...prev, storeId]);
                            const defaultRoleName = getValidStoreRole(null, storeId);
                            const storeAvailableRoles = roles.filter((r: any) => r.name !== 'ADMIN' && (r.store_id === storeId || !r.store_id));
                            const defaultRoleId = storeAvailableRoles.find((r: any) => r.name === defaultRoleName)?.id || storeAvailableRoles[0]?.id || '';
                            setUserStoreRoles((prev: any) => ({ ...prev, [storeId]: prev[storeId] || defaultRoleName }));
                            setUserStoreRoleIds((prev: any) => ({ ...prev, [storeId]: prev[storeId] || defaultRoleId }));
                          } else {
                            setSelectedStoreIds((prev: any) => prev.filter((id: any) => id !== storeId));
                            setUserStoreRoles((prev: any) => {
                              const next = { ...prev };
                              delete next[storeId];
                              return next;
                            });
                            setUserStoreRoleIds((prev: any) => {
                              const next = { ...prev };
                              delete next[storeId];
                              return next;
                            });
                          }
                        }
                      },
                      onRoleChange: (storeId: any, roleName: any, roleId: any) => {
                        setUserStoreRoles((prev: any) => ({ ...prev, [storeId]: roleName }));
                        setUserStoreRoleIds((prev: any) => ({ ...prev, [storeId]: roleId }));
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
                              onChange={(e: any) => {
                                const newStoreId = e.target.value;
                                setSelectedModalStoreId(newStoreId);
                                const defaultRoleName = getValidStoreRole(null, newStoreId);
                                const storeAvailableRoles = roles.filter((r: any) => r.name !== 'ADMIN' && (r.store_id === newStoreId || !r.store_id));
                                const defaultRoleId = storeAvailableRoles.find((r: any) => r.name === defaultRoleName)?.id || storeAvailableRoles[0]?.id || '';
                                setUserStoreRoles({ [newStoreId]: defaultRoleName });
                                setUserStoreRoleIds({ [newStoreId]: defaultRoleId });
                              }}
                              className="h-8 px-2 text-xs font-bold rounded-lg border border-border bg-background cursor-pointer text-foreground"
                            >
                              {availableStores.map((s: any) => (
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
                          (r: any) => r.name !== 'ADMIN' && (r.store_id === targetModalStoreId || !r.store_id)
                        );
                        const currentRoleName = userStoreRoles[targetModalStoreId] || (storeAvailableRoles[0]?.name || 'CAJERO');
                        const currentRoleId = userStoreRoleIds[targetModalStoreId] || storeAvailableRoles.find((r: any) => r.name === currentRoleName)?.id || storeAvailableRoles[0]?.id || '';
                        const selectedValue = storeAvailableRoles.some((r: any) => r.id === currentRoleId)
                          ? currentRoleId
                          : (storeAvailableRoles.find((r: any) => r.name === currentRoleName)?.id || storeAvailableRoles[0]?.id || '');
                        return (
                          <select
                            value={selectedValue}
                            onChange={(e: any) => {
                              const selectedRole = storeAvailableRoles.find((r: any) => r.id === e.target.value);
                              if (selectedRole) {
                                setUserStoreRoles({ [targetModalStoreId]: selectedRole.name });
                                setUserStoreRoleIds({ [targetModalStoreId]: selectedRole.id });
                              }
                            }}
                            className="h-8 px-2 text-xs font-bold rounded-lg border border-border bg-background cursor-pointer"
                          >
                            {storeAvailableRoles.map((r: any) => {
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
                {roleAssignedUsers.map((u: any) => {
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

      {/* ── Employee Unlink Access Modal ── */}
      {unlinkingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card rounded-2xl shadow-xl border border-border overflow-hidden p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <Unlink className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">Desvincular Acceso</h3>
                <p className="text-xs text-muted-foreground">Revocar permisos del sistema</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Estás a punto de desvincular el acceso al sistema del empleado <strong>"{unlinkingEmployee.name}"</strong>. 
              El usuario actual ya no podrá ingresar usando estas credenciales. ¿Deseas continuar?
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setUnlinkingEmployee(null)}
                className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmUnlinkEmployee}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center gap-2"
              >
                <Unlink className="w-4 h-4" />
                Sí, desvincular
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Manage Permissions Modal ── */}
      {isManagePermsModalOpen && managingPermsRoleId && (() => {
        const currentRole = roles.find(r => r.id === managingPermsRoleId) || originalRoles.find(r => r.id === managingPermsRoleId);
        if (!currentRole) return null;
        
        const isGlobalRole = !currentRole.store_id || currentRole.is_system;
        const isReadOnly = isGlobalRole && role !== 'ADMIN';
        const isLocked = currentRole.is_system || isReadOnly;

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] overflow-y-auto">
            <div className="bg-card w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-border my-8">
              <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/30 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-xl">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Gestionar Permisos: {currentRole.name}</h3>
                    <p className="text-sm text-muted-foreground">Configura los accesos por módulo para este rol</p>
                  </div>
                </div>
                <button
                  onClick={() => { setIsManagePermsModalOpen(false); setManagingPermsRoleId(null); }}
                  className="p-2 hover:bg-secondary rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
                {isLocked && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl flex items-start gap-3">
                    <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      Este es un rol de sistema o global. Sus permisos están protegidos y no pueden ser modificados.
                    </p>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {PERMISSION_GROUPS.map((group) => {
                    const Icon = group.icon;
                    const isMainEnabled = Boolean(currentRole.name === 'ADMIN' || (currentRole.permissions && currentRole.permissions[group.mainKey]));
                    
                    return (
                      <div key={group.mainKey} className="border border-border rounded-xl overflow-hidden flex flex-col bg-card shadow-sm hover:shadow-md transition-shadow duration-200">
                        <div className="p-4 border-b border-border bg-muted/10 flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${group.bgColor} border ${group.borderColor} shrink-0`}>
                              <Icon className={`w-4 h-4 ${group.color}`} />
                            </div>
                            <div>
                              <span className="font-bold text-sm block">{group.app}</span>
                              {group.description && (
                                <span className="text-[11px] text-muted-foreground font-normal leading-tight block mt-0.5">
                                  {group.description}
                                </span>
                              )}
                            </div>
                          </div>
                          <label className={`relative inline-flex items-center shrink-0 cursor-pointer ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={isMainEnabled}
                              disabled={isLocked}
                              onChange={(e) => handleTogglePermission(currentRole.id, currentRole.permissions || {}, group.mainKey, e.target.checked)}
                            />
                            <div className="w-10 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                          </label>
                        </div>
                        
                        {group.subPermissions.length > 0 && (
                          <div className={`p-4 bg-muted/5 flex-1 flex flex-col gap-3 transition-opacity duration-200 ${!isMainEnabled ? 'opacity-40 grayscale-[50%]' : ''}`}>
                            {group.subPermissions.map((sub) => {
                              const isSubEnabled = Boolean(currentRole.name === 'ADMIN' || (currentRole.permissions && currentRole.permissions[sub.key]));
                              const isDisabled = isLocked || !isMainEnabled;
                              return (
                                <div key={sub.key} className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground font-medium">{sub.label}</span>
                                  <label className={`relative inline-flex items-center shrink-0 cursor-pointer ${isDisabled ? 'cursor-not-allowed' : ''}`}>
                                    <input
                                      type="checkbox"
                                      className="sr-only peer"
                                      checked={isMainEnabled && isSubEnabled}
                                      disabled={isDisabled}
                                      onChange={(e) => handleTogglePermission(currentRole.id, currentRole.permissions || {}, sub.key, e.target.checked)}
                                    />
                                    <div className={`w-8 h-4 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-3 after:w-3 after:transition-all ${isMainEnabled ? 'peer-checked:bg-indigo-400' : 'peer-checked:bg-muted-foreground'}`}></div>
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {hasUnsavedRoleChanges ? (
                    <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-800">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                      Tienes cambios sin guardar
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                      <Check className="w-3.5 h-3.5" /> Permisos al día
                    </span>
                  )}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setIsManagePermsModalOpen(false); setManagingPermsRoleId(null); }}
                    className="px-4 py-2 border border-border text-foreground rounded-lg text-sm font-bold shadow-sm hover:bg-secondary transition-colors"
                  >
                    Cerrar
                  </button>
                  <button
                    onClick={() => {
                      handleSavePermissions();
                      setIsManagePermsModalOpen(false);
                      setManagingPermsRoleId(null);
                    }}
                    disabled={!hasUnsavedRoleChanges || savingPermissions}
                    className={`h-9 px-4 flex items-center justify-center gap-2 rounded-lg font-bold text-sm transition-colors shadow-sm ${hasUnsavedRoleChanges ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-secondary/50 text-muted-foreground cursor-not-allowed'
                      }`}
                  >
                    {savingPermissions ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar Cambios
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
