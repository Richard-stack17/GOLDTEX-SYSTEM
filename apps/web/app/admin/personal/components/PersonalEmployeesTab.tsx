import React from 'react';
import {
  Users, UserPlus, ShieldAlert,
  RefreshCw, Plus,
  UserCog, X, Trash2, Check,
  Info, RotateCcw,
  Eye, EyeOff, ShieldCheck, ArrowUpDown, KeyRound, Edit2,
  Search, Shield, AlertCircle, Unlink, Crown
} from 'lucide-react';
import { Employee, Profile, Role } from '../types';

import { usePersonal } from '../PersonalContext';

export function PersonalEmployeesTab() {
  const {
    activeProfiles, activeStoreId, activeTab, allProfiles, allRoles, availableStoreIds, availableStores, checkCanManageTarget, checkUsernameState, confirmDeleteEmployee, confirmDeleteRole, confirmGlobalAccess, createAccess, deletingEmployee, deletingRole, deletingUserId, deletingUsername, dni, editRoleDesc, editRoleName, editingEmployee, editingRole, editingUserId, email, empAccessScope, empEmail, empGlobalRole, empPassword, empStoreIds, empStoreRoleIds, empStoreRoles, empUsername, employeeById, employees, formatFriendlyErrorMessage, fullName, getRoleBadgeStyle, getValidStoreRole, globalRoles, handleCancelEdit, handleCreateEmployee, handleCreateRole, handleDeleteEmployeeClick, handleDeleteRole, handleDeleteUser, handleEditClick, handleEditEmployeeClick, handleUnlinkEmployeeClick, handleExecuteRestoration, handleLinkExistingUser, handleLinkNewUser, handleRestoreEmployee, handleRestorePermissions, handleRestoreRole, handleRestoreUser, handleSaveCredentials, handleSaveEditRole, handleSavePermissions, handleTabChange, handleTogglePermission, hasUnsavedRoleChanges, isAdmin, isDeletingRole, isDeletingUser, isEditRoleModalOpen, isEmployeeModalOpen, isGlobalUser, isHydrated, isLinking, isRestoringUser, isRoleConfirmModalOpen, isRoleModalOpen, isRoleWarningModalOpen, isUserGlobalAdmin, isUserModalOpen, linkExistingUserId, linkMode, linkRoleId, linkingEmployee, loadData, loading, modalResetToken, newRoleDesc, newRoleName, newRoleScopeStoreId, originalRoles, password, pendingRestoration, pendingTab, permissions, phone, profileByEmployeeId, renderRoleOptions, renderStoreAndRoleBadges, renderStoreRoleList, role, roleAssignedUsers, roles, router, savingEditRole, savingEmployee, savingPermissions, savingRole, savingUser, selectedEmpId, selectedModalStoreId, selectedStoreIds, setActiveTab, setAllProfiles, setAllRoles, setConfirmGlobalAccess, setCreateAccess, setDeletingEmployee, setDeletingRole, setDeletingUserId, setDeletingUsername, setDni, setEditRoleDesc, setEditRoleName, setEditingEmployee, setEditingRole, setEditingUserId, setEmail, setEmpAccessScope, setEmpEmail, setEmpGlobalRole, setEmpPassword, setEmpStoreIds, setEmpStoreRoleIds, setEmpStoreRoles, setEmpUsername, setEmployees, setFullName, setHasUnsavedRoleChanges, setIsDeletingRole, setIsDeletingUser, setIsEditRoleModalOpen, setIsEmployeeModalOpen, setIsLinking, setIsRestoringUser, setIsRoleConfirmModalOpen, setIsRoleModalOpen, setIsRoleWarningModalOpen, setIsUserModalOpen, setLinkExistingUserId, setLinkMode, setLinkRoleId, setLinkingEmployee, setLoading, setModalResetToken, setNewRoleDesc, setNewRoleName, setNewRoleScopeStoreId, setOriginalRoles, setPassword, setPendingRestoration, setPendingTab, setPhone, setRoleAssignedUsers, setRoles, setSavingEditRole, setSavingEmployee, setSavingPermissions, setSavingRole, setSavingUser, setSelectedEmpId, setSelectedModalStoreId, setSelectedStoreIds, setShowEmpPassword, setShowInactiveEmployees, setShowInactiveRoles, setShowInactiveUsers, setShowRoleExitConfirm, setShowUserPassword, setToast, setUserAccessScope, setUserGlobalRole, setUserStoreRoleIds, setUserStoreRoles, setUsername, showEmpPassword, showInactiveEmployees, showInactiveRoles, showInactiveUsers, showRoleExitConfirm, showToast, showUserPassword, storeMap, syncEmployeeStoreAssignment, targetModalStoreId, toast, unlinkedEmployees, userAccessScope, userGlobalRole, userStoreRoleIds, userStoreRoles, username, visibleEmployees, visibleRoles,
    empConfirmGlobalAdmin, setEmpConfirmGlobalAdmin,
    currentProfileId, currentEmployeeId, currentUsername,
    isOwner
  , sortedEmployees, sortConfig, requestSort } = usePersonal();

  return (
    <>
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
                        setEmpStoreIds(initialStoreId ? [initialStoreId] : []);
                        setEmpStoreRoles({});
                        setEmpStoreRoleIds({});
                        setEmpAccessScope('stores');
                        setEmpGlobalRole('');
                        setEmpConfirmGlobalAdmin(false);
                        setIsEmployeeModalOpen(true);
                      }}
                      className="h-9 px-4 flex items-center justify-center gap-2 rounded-lg font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" /> Nuevo Empleado
                    </button>
                  )}
                </div>
              </div>

              <div className="px-5 py-3 bg-muted/10 border-b border-border flex flex-col gap-2.5 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <span className="font-bold text-foreground">Guía de iconos:</span>
                  <div className="flex items-center gap-1.5">
                    <div className="p-1 bg-indigo-50 dark:bg-indigo-900/30 rounded">
                      <KeyRound className="w-3.5 h-3.5 text-indigo-500" />
                    </div>
                    <span className="font-medium">Vincular Acceso</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="p-1 bg-amber-50 dark:bg-amber-900/30 rounded">
                      <Unlink className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    <span className="font-medium">Desvincular Acceso</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="p-1 bg-indigo-50 dark:bg-indigo-900/30 rounded">
                      <Edit2 className="w-3.5 h-3.5 text-indigo-500" />
                    </div>
                    <span className="font-medium">Editar Empleado</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="p-1 bg-red-50 dark:bg-red-900/30 rounded">
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </div>
                    <span className="font-medium">Deshabilitar</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="p-1 bg-emerald-50 dark:bg-emerald-900/30 rounded">
                      <RotateCcw className="w-3.5 h-3.5 text-emerald-500" />
                    </div>
                    <span className="font-medium">Reactivar</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/50 flex flex-wrap items-center gap-x-6 gap-y-2">
                  <span className="font-bold text-foreground">Ámbito de Trabajo:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                      Ámbito Global
                    </span>
                    <span className="font-medium text-muted-foreground">Aplica a todas las sucursales (según los permisos de su rol)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                      Por Sucursal
                    </span>
                    <span className="font-medium text-muted-foreground">Aplica únicamente en las sucursales asignadas</span>
                  </div>
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
                      {sortedEmployees.map((emp: any) => {
                        const profile = profileByEmployeeId[emp.id];
                        const isInactive = emp.is_active === false;
                        const isOwnerEmp = Boolean(profile?.is_owner);
                        const isSelfEmp = (currentEmployeeId && emp.id === currentEmployeeId) || (currentProfileId && profile?.id === currentProfileId);
                        const canEditEmp = isOwnerEmp ? Boolean(isOwner) : checkCanManageTarget(profile, emp);
                        const canDeleteEmp = !isOwnerEmp && !isSelfEmp && (profile?.role === 'ADMIN' ? isOwner : checkCanManageTarget(profile, emp, { requireFullCoverage: true }));
                        const { storeElement, roleElement } = renderStoreAndRoleBadges(
                          emp.employee_stores || [],
                          profile?.role,
                          !profile
                        );

                        return (
                          <tr key={emp.id} className={isInactive ? "bg-muted/40 opacity-60 hover:opacity-100 transition-all" : "hover:bg-secondary/20 transition-colors"}>
                            <td className="px-5 py-3.5 font-bold flex items-center gap-2">
                              <span>{emp.full_name}</span>
                              {isOwnerEmp && (
                                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                                  <Crown className="w-3 h-3 text-amber-500 shrink-0" />
                                  Propietario
                                </span>
                              )}
                              {isSelfEmp && !isOwnerEmp && (
                                <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 px-1.5 py-0.5 rounded-md">
                                  Tú
                                </span>
                              )}
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
                                  !canDeleteEmp ? null : (
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
                                    {!profile && Boolean(permissions?.personal_create_user) && (!canEditEmp ? null : (
                                      <button
                                        onClick={() => {
                                          if (!checkCanManageTarget(null, emp)) {
                                            showToast('Solo puedes gestionar personal asignado a tu misma sucursal local', 'error');
                                            return;
                                          }
                                          setLinkingEmployee(emp);
                                          setLinkRoleId('');
                                        }}
                                        className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors inline-flex"
                                        title="Vincular a un Acceso"
                                      >
                                        <KeyRound className="w-4 h-4" />
                                      </button>
                                    ))}
                                    {profile && !isOwnerEmp && !isSelfEmp && Boolean(permissions?.personal_delete_user) && (!canDeleteEmp ? null : (
                                      <button
                                        onClick={() => handleUnlinkEmployeeClick(emp.id, emp.full_name, profile.id)}
                                        className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors inline-flex"
                                        title="Desvincular Acceso"
                                      >
                                        <Unlink className="w-4 h-4" />
                                      </button>
                                    ))}
                                    {Boolean(permissions?.personal_edit_user) && (!canEditEmp ? null : (
                                      <button
                                        onClick={() => handleEditEmployeeClick(emp)}
                                        className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors inline-flex"
                                        title="Editar datos de empleado"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                    ))}
                                    {Boolean(permissions?.personal_delete_user) && (!canDeleteEmp ? null : (
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

    </>
  );
}
