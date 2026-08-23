import React from 'react';
import {
  Users, UserPlus, ShieldAlert,
  RefreshCw, Plus,
  UserCog, X, Trash2, Check,
  Info, RotateCcw,
  Eye, EyeOff, ShieldCheck, Edit2, Loader2, Save, Lock,
  Search, Shield, AlertCircle
} from 'lucide-react';
import { Employee, Profile, Role, PERMISSION_GROUPS } from '../types';

import { usePersonal } from '../PersonalContext';

export function PersonalRolesTab() {
  const {
    activeProfiles, activeStoreId, activeTab, allProfiles, allRoles, availableStoreIds, availableStores, checkCanManageTarget, checkUsernameState, confirmDeleteEmployee, confirmDeleteRole, confirmGlobalAccess, createAccess, deletingEmployee, deletingRole, deletingUserId, deletingUsername, dni, editRoleDesc, editRoleName, editingEmployee, editingRole, editingUserId, email, empAccessScope, empEmail, empGlobalRole, empPassword, empStoreIds, empStoreRoleIds, empStoreRoles, empUsername, employeeById, employees, formatFriendlyErrorMessage, fullName, getRoleBadgeStyle, getValidStoreRole, globalRoles, handleCancelEdit, handleCreateEmployee, handleCreateRole, handleDeleteEmployeeClick, handleDeleteRole, handleDeleteUser, handleEditClick, handleEditEmployeeClick, handleExecuteRestoration, handleLinkExistingUser, handleLinkNewUser, handleRestoreEmployee, handleRestorePermissions, handleRestoreRole, handleRestoreUser, handleSaveCredentials, handleSaveEditRole, handleSavePermissions, handleTabChange, handleTogglePermission, hasUnsavedRoleChanges, isAdmin, isDeletingRole, isDeletingUser, isEditRoleModalOpen, isEmployeeModalOpen, isGlobalUser, isHydrated, isLinking, isRestoringUser, isRoleConfirmModalOpen, isRoleModalOpen, isRoleWarningModalOpen, isUserGlobalAdmin, isUserModalOpen, linkExistingUserId, linkMode, linkRoleId, linkingEmployee, loadData, loading, modalResetToken, newRoleDesc, newRoleName, newRoleScopeStoreId, originalRoles, password, pendingRestoration, pendingTab, permissions, phone, profileByEmployeeId, renderRoleOptions, renderStoreAndRoleBadges, renderStoreRoleList, role, roleAssignedUsers, roles, router, savingEditRole, savingEmployee, savingPermissions, savingRole, savingUser, selectedEmpId, selectedModalStoreId, selectedStoreIds, setActiveTab, setAllProfiles, setAllRoles, setConfirmGlobalAccess, setCreateAccess, setDeletingEmployee, setDeletingRole, setDeletingUserId, setDeletingUsername, setDni, setEditRoleDesc, setEditRoleName, setEditingEmployee, setEditingRole, setEditingUserId, setEmail, setEmpAccessScope, setEmpEmail, setEmpGlobalRole, setEmpPassword, setEmpStoreIds, setEmpStoreRoleIds, setEmpStoreRoles, setEmpUsername, setEmployees, setFullName, setHasUnsavedRoleChanges, setIsDeletingRole, setIsDeletingUser, setIsEditRoleModalOpen, setIsEmployeeModalOpen, setIsLinking, setIsRestoringUser, setIsRoleConfirmModalOpen, setIsRoleModalOpen, setIsRoleWarningModalOpen, setIsUserModalOpen, setLinkExistingUserId, setLinkMode, setLinkRoleId, setLinkingEmployee, setLoading, setModalResetToken, setNewRoleDesc, setNewRoleName, setNewRoleScopeStoreId, setOriginalRoles, setPassword, setPendingRestoration, setPendingTab, setPhone, setRoleAssignedUsers, setRoles, setSavingEditRole, setSavingEmployee, setSavingPermissions, setSavingRole, setSavingUser, setSelectedEmpId, setSelectedModalStoreId, setSelectedStoreIds, setShowEmpPassword, setShowInactiveEmployees, setShowInactiveRoles, setShowInactiveUsers, setShowRoleExitConfirm, setShowUserPassword, setToast, setUserAccessScope, setUserGlobalRole, setUserStoreRoleIds, setUserStoreRoles, setUsername, showEmpPassword, showInactiveEmployees, showInactiveRoles, showInactiveUsers, showRoleExitConfirm, showToast, showUserPassword, storeMap, syncEmployeeStoreAssignment, targetModalStoreId, toast, unlinkedEmployees, userAccessScope, userGlobalRole, userStoreRoleIds, userStoreRoles, username, visibleEmployees, visibleRoles
  , sortedRoles, sortConfig, requestSort } = usePersonal();

  return (
    <>
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
                    {sortedRoles.map((r: any) => {
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
                          {sortedRoles.map((r: any) => {
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
                        {group.subPermissions.map((sub: any) => (
                          <tr key={sub.key} className="hover:bg-secondary/10 transition-colors">
                            <td className="px-6 py-3 pl-16">
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30"></div>
                                <span className="text-sm text-muted-foreground">{sub.label}</span>
                              </div>
                            </td>
                            {sortedRoles.map((r: any) => {
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

    </>
  );
}
