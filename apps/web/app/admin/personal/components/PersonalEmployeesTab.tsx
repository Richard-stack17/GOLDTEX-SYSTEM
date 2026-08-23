import React from 'react';
import {
  Users, UserPlus, ShieldAlert,
  RefreshCw, Plus,
  UserCog, X, Trash2, Check,
  Info, RotateCcw,
  Eye, EyeOff, ShieldCheck, ArrowUpDown, KeyRound, Edit2,
  Search, Shield, AlertCircle
} from 'lucide-react';
import { Employee, Profile, Role } from '../types';

import { usePersonal } from '../PersonalContext';

export function PersonalEmployeesTab() {
  const {
    activeProfiles, activeStoreId, activeTab, allProfiles, allRoles, availableStoreIds, availableStores, checkCanManageTarget, checkUsernameState, confirmDeleteEmployee, confirmDeleteRole, confirmGlobalAccess, createAccess, deletingEmployee, deletingRole, deletingUserId, deletingUsername, dni, editRoleDesc, editRoleName, editingEmployee, editingRole, editingUserId, email, empAccessScope, empEmail, empGlobalRole, empPassword, empStoreIds, empStoreRoleIds, empStoreRoles, empUsername, employeeById, employees, formatFriendlyErrorMessage, fullName, getRoleBadgeStyle, getValidStoreRole, globalRoles, handleCancelEdit, handleCreateEmployee, handleCreateRole, handleDeleteEmployeeClick, handleDeleteRole, handleDeleteUser, handleEditClick, handleEditEmployeeClick, handleExecuteRestoration, handleLinkExistingUser, handleLinkNewUser, handleRestoreEmployee, handleRestorePermissions, handleRestoreRole, handleRestoreUser, handleSaveCredentials, handleSaveEditRole, handleSavePermissions, handleTabChange, handleTogglePermission, hasUnsavedRoleChanges, isAdmin, isDeletingRole, isDeletingUser, isEditRoleModalOpen, isEmployeeModalOpen, isGlobalUser, isHydrated, isLinking, isRestoringUser, isRoleConfirmModalOpen, isRoleModalOpen, isRoleWarningModalOpen, isUserGlobalAdmin, isUserModalOpen, linkExistingUserId, linkMode, linkRoleId, linkingEmployee, loadData, loading, modalResetToken, newRoleDesc, newRoleName, newRoleScopeStoreId, originalRoles, password, pendingRestoration, pendingTab, permissions, phone, profileByEmployeeId, renderRoleOptions, renderStoreAndRoleBadges, renderStoreRoleList, role, roleAssignedUsers, roles, router, savingEditRole, savingEmployee, savingPermissions, savingRole, savingUser, selectedEmpId, selectedModalStoreId, selectedStoreIds, setActiveTab, setAllProfiles, setAllRoles, setConfirmGlobalAccess, setCreateAccess, setDeletingEmployee, setDeletingRole, setDeletingUserId, setDeletingUsername, setDni, setEditRoleDesc, setEditRoleName, setEditingEmployee, setEditingRole, setEditingUserId, setEmail, setEmpAccessScope, setEmpEmail, setEmpGlobalRole, setEmpPassword, setEmpStoreIds, setEmpStoreRoleIds, setEmpStoreRoles, setEmpUsername, setEmployees, setFullName, setHasUnsavedRoleChanges, setIsDeletingRole, setIsDeletingUser, setIsEditRoleModalOpen, setIsEmployeeModalOpen, setIsLinking, setIsRestoringUser, setIsRoleConfirmModalOpen, setIsRoleModalOpen, setIsRoleWarningModalOpen, setIsUserModalOpen, setLinkExistingUserId, setLinkMode, setLinkRoleId, setLinkingEmployee, setLoading, setModalResetToken, setNewRoleDesc, setNewRoleName, setNewRoleScopeStoreId, setOriginalRoles, setPassword, setPendingRestoration, setPendingTab, setPhone, setRoleAssignedUsers, setRoles, setSavingEditRole, setSavingEmployee, setSavingPermissions, setSavingRole, setSavingUser, setSelectedEmpId, setSelectedModalStoreId, setSelectedStoreIds, setShowEmpPassword, setShowInactiveEmployees, setShowInactiveRoles, setShowInactiveUsers, setShowRoleExitConfirm, setShowUserPassword, setToast, setUserAccessScope, setUserGlobalRole, setUserStoreRoleIds, setUserStoreRoles, setUsername, showEmpPassword, showInactiveEmployees, showInactiveRoles, showInactiveUsers, showRoleExitConfirm, showToast, showUserPassword, storeMap, syncEmployeeStoreAssignment, targetModalStoreId, toast, unlinkedEmployees, userAccessScope, userGlobalRole, userStoreRoleIds, userStoreRoles, username, visibleEmployees, visibleRoles
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
                        if (initialStoreId) {
                          setEmpStoreIds([initialStoreId]);
                          const defaultRoleName = getValidStoreRole(null, initialStoreId);
                          const storeAvailableRoles = roles.filter((r: any) => r.name !== 'ADMIN' && (r.store_id === initialStoreId || !r.store_id));
                          const defaultRoleId = storeAvailableRoles.find((r: any) => r.name === defaultRoleName)?.id || storeAvailableRoles[0]?.id || '';
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
                      {sortedEmployees.map((emp: any) => {
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
                                          const defaultRole = roles.find((r: any) => r.name === 'MOSTRADOR') || roles.find((r: any) => r.name !== 'ADMIN') || roles[0];
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

    </>
  );
}
