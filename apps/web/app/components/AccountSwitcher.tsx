"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { User, LogOut, ChevronDown, Plus, X, Lock, Loader2 } from "lucide-react";
import { useRole } from "../context/RoleContext";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import bcrypt from "bcryptjs";

export default function AccountSwitcher() {
  const { username, role, setRole, setUsername, setEmployeeId, permissions } = useRole();
  const router = useRouter();
  
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<any[]>([]);
  
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const accountsStr = localStorage.getItem("goltex_saved_accounts");
      if (accountsStr) {
        try {
          setSavedAccounts(JSON.parse(accountsStr));
        } catch (e) {
          setSavedAccounts([]);
        }
      }
      setSelectedUser(null);
      setPassword("");
      setError(null);
    }
  }, [isOpen]);

  const handleLogout = async () => {
    // Clear global session
    localStorage.removeItem("goltex_role");
    localStorage.removeItem("goltex_username");
    localStorage.removeItem("goltex_employee_id");
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleLogoutAll = async () => {
    localStorage.removeItem("goltex_role");
    localStorage.removeItem("goltex_username");
    localStorage.removeItem("goltex_employee_id");
    localStorage.removeItem("goltex_saved_accounts");
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleRemoveSavedAccount = (e: React.MouseEvent, usernameToRemove: string) => {
    e.stopPropagation();
    const updated = savedAccounts.filter(a => a.username !== usernameToRemove);
    setSavedAccounts(updated);
    localStorage.setItem("goltex_saved_accounts", JSON.stringify(updated));
    
    // Si el usuario quita su propia cuenta activa, cerrar sesión automáticamente
    if (usernameToRemove === username) {
      handleLogout();
    }
  };

  const handleAddAccount = () => {
    handleLogout(); // Simply logout and go to standard login to add a new account
  };

  const handleSwitchAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !password) return;

    setError(null);
    setLoading(true);
    setIsSwitching(true);

    try {
      const { data: profileData, error: profileErr } = await supabase
        .from("profiles")
        .select("username, role, password_hash, employee_id")
        .eq("username", selectedUser.username)
        .maybeSingle();

      if (profileErr || !profileData) {
        throw new Error("Usuario no encontrado.");
      }

      if (!bcrypt.compareSync(password, profileData.password_hash)) {
        throw new Error("Contraseña incorrecta.");
      }

      // Purgar estado local (tiendas, permisos, etc.) del usuario anterior
      localStorage.removeItem("goltex_active_store_id");
      localStorage.removeItem("goltex_active_store_name");
      localStorage.removeItem("goltex_permissions");
      localStorage.removeItem("goltex_store_mode");
      localStorage.removeItem("goltex_default_store_id");

      // Guardar credenciales del nuevo usuario
      localStorage.setItem("goltex_role", profileData.role);
      localStorage.setItem("goltex_username", profileData.username);
      if (profileData.employee_id) {
        localStorage.setItem("goltex_employee_id", profileData.employee_id);
      } else {
        localStorage.removeItem("goltex_employee_id");
      }

      
      // Update accounts order (bring to top)
      const newSaved = savedAccounts.filter(a => a.username !== profileData.username);
      newSaved.unshift({ 
        username: profileData.username, 
        role: profileData.role, 
        employee_id: profileData.employee_id 
      });
      localStorage.setItem("goltex_saved_accounts", JSON.stringify(newSaved.slice(0, 10)));
      
      setIsOpen(false);
      window.location.reload(); // Recarga limpia del árbol de React para destruir caché en memoria
    } catch (err: any) {
      setError(err.message || "Error al autenticar");
    } finally {
      setLoading(false);
    }
  };

  const visibleAccounts = permissions?.pos_switch_account
    ? savedAccounts
    : savedAccounts.filter(acc => acc.username === username);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-background border-2 border-border/50 hover:bg-secondary/50 rounded-2xl px-4 py-2 h-12 transition-all cursor-pointer shadow-sm active:scale-95"
      >
        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
          {username.charAt(0).toUpperCase()}
        </div>
        <div className="flex flex-col items-start hidden sm:flex">
          <span className="text-xs font-black truncate max-w-[100px]">{username}</span>
          <span className="text-[10px] text-muted-foreground uppercase">{role}</span>
        </div>
        <ChevronDown className="w-4 h-4 text-muted-foreground ml-1" />
      </button>

      {mounted && isOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-background w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 border border-white/10">
            <div className="flex items-center justify-between p-6 border-b border-border bg-surface">
              <h3 className="font-bold text-lg">Cambiar de Cuenta</h3>
              <button 
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 flex items-center justify-center bg-secondary/50 hover:bg-secondary rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {selectedUser ? (
                <form onSubmit={handleSwitchAccount} className="space-y-6 animate-in slide-in-from-right-4 duration-300 p-2">
                  <div className="flex flex-col items-center gap-3 mb-6">
                    <div className="w-20 h-20 rounded-full bg-primary/20 text-primary flex items-center justify-center text-3xl font-black">
                      {selectedUser.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-xl">{selectedUser.username}</div>
                      <div className="text-sm text-muted-foreground">{selectedUser.role}</div>
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-500/10 text-red-500 p-3 rounded-xl text-sm font-semibold text-center border border-red-500/20">
                      {error}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Contraseña</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <input
                        type="password"
                        autoFocus
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full h-14 bg-secondary/30 rounded-2xl pl-12 pr-4 border-2 border-transparent focus:border-primary outline-none transition-all font-bold text-lg tracking-widest"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => { setSelectedUser(null); setPassword(""); setError(null); }}
                      className="flex-1 h-12 rounded-xl bg-secondary hover:bg-secondary/80 font-bold transition-all"
                    >
                      Atrás
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !password}
                      className="flex-[2] h-12 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-all disabled:opacity-50 disabled:active:scale-100 active:scale-95 flex items-center justify-center"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Iniciar Sesión"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-2 mb-2">Cuentas Recientes</div>
                  {visibleAccounts.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-4">No hay cuentas guardadas</div>
                  ) : (
                    visibleAccounts.map((acc, i) => {
                      const isCurrent = acc.username === username;
                      const canSelect = isCurrent || permissions?.pos_switch_account;
                      return (
                        <button
                          key={i}
                          disabled={!canSelect}
                          onClick={() => canSelect && setSelectedUser(acc)}
                          className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all group ${
                            isCurrent 
                              ? 'border-primary/50 bg-primary/5 shadow-sm' 
                              : 'border-transparent bg-secondary/20 hover:bg-secondary hover:scale-[1.02]'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-black ${
                              acc.username === username ? 'bg-primary text-white shadow-md' : 'bg-background text-foreground group-hover:shadow-md transition-all'
                            }`}>
                              {acc.username.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col items-start">
                              <span className="font-bold text-base">{acc.username}</span>
                              <span className="text-xs text-muted-foreground uppercase">{acc.role}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {acc.username === username && (
                              <div className="w-3 h-3 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)] mr-1" title="Sesión actual"></div>
                            )}
                            {permissions?.pos_remove_saved_account && (
                              <span
                                role="button"
                                onClick={(e) => handleRemoveSavedAccount(e, acc.username)}
                                className="w-7 h-7 flex items-center justify-center rounded-full text-muted-foreground hover:bg-red-500/20 hover:text-red-500 transition-colors"
                                title="Quitar de este dispositivo"
                              >
                                <X className="w-4 h-4" />
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}

                  <div className="pt-4 mt-2 border-t border-border space-y-1">
                    {permissions?.pos_switch_account && (
                      <button
                        onClick={handleAddAccount}
                        className="w-full flex items-center gap-3 p-4 rounded-2xl bg-secondary/10 hover:bg-secondary text-primary transition-all font-bold group"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Plus className="w-5 h-5" />
                        </div>
                        Iniciar sesión con otra cuenta
                      </button>
                    )}
                    {permissions?.pos_logout && (
                      <button
                        onClick={handleLogoutAll}
                        className="w-full flex items-center gap-3 p-4 rounded-2xl hover:bg-red-500/10 text-red-500 transition-all font-bold group"
                      >
                        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <LogOut className="w-5 h-5" />
                        </div>
                        Cerrar todas las Cuentas Guardadas
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {isSwitching && createPortal(
        <div className="fixed inset-0 z-[99999] bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-100">
          <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
          <h2 className="text-xl font-bold text-foreground">Cambiando usuario...</h2>
          <p className="text-sm text-muted-foreground mt-2">Sincronizando entorno de trabajo</p>
        </div>,
        document.body
      )}
    </>
  );
}
