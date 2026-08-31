import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Lock, CheckCircle2, UserCircle, KeyRound, Mail, AlertTriangle, Contact, Eye, EyeOff } from 'lucide-react';
import { useRole } from '../../context/RoleContext';
import { isNativeAndroidApp } from '../../lib/platform';
import bcrypt from 'bcryptjs';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { username, profileId } = useRole();
  const [profile, setProfile] = useState<any>(null);
  const [authEmail, setAuthEmail] = useState<string>('');
  const [isGoogleLinked, setIsGoogleLinked] = useState(false);
  const [loading, setLoading] = useState(true);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passMessage, setPassMessage] = useState({ type: '', text: '' });

  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadProfileData();
    } else {
      setPassMessage({ type: '', text: '' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrentPass(false);
      setShowNewPass(false);
      setLinkError(null);
    }
  }, [isOpen]);

  const loadProfileData = async () => {
    setLoading(true);
    setLinkError(null);
    try {
      let currentProf = null;

      if (profileId) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', profileId).maybeSingle();
        if (prof) currentProf = prof;
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (!currentProf && user) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
        if (prof) currentProf = prof;
      }

      // La única fuente de verdad para la vinculación en el sistema es la tabla profiles
      const linkedEmail = currentProf?.email || '';
      setAuthEmail(linkedEmail);

      // Si no hay correo guardado en el perfil, no está vinculado (ignorando la sesión residual de auth)
      const hasGoogle = Boolean(currentProf?.email && currentProf.email.includes('@'));
      setIsGoogleLinked(hasGoogle);

      if (currentProf) {
        setProfile(currentProf);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkGoogle = async () => {
    setLinkError(null);
    try {
      const isMobile = isNativeAndroidApp();
      if (profileId) {
        localStorage.setItem('goltex_linking_profile_id', profileId);
      }

      const redirectBase = isMobile ? 'com.goltex.pos://auth/callback' : `${window.location.origin}/auth/callback?link_profile_id=${profileId}`;

      if (isMobile) {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectBase,
            skipBrowserRedirect: true,
            queryParams: {
              access_type: 'offline',
              prompt: 'select_account',
            }
          }
        });
        if (error) throw error;
        if (data?.url) {
          try {
            const { Browser } = await import('@capacitor/browser');
            await Browser.open({ url: data.url, windowName: '_system' });
          } catch (_) {
            window.open(data.url, '_system') || (window.location.href = data.url);
          }
        }
      } else {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectBase,
            queryParams: {
              access_type: 'offline',
              prompt: 'select_account',
            }
          }
        });
        if (error) throw error;
      }
    } catch (e: any) {
      setLinkError("Error al iniciar vinculación: " + (e.message || "Error desconocido"));
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMessage({ type: '', text: '' });

    if (!currentPassword) {
      setPassMessage({ type: 'error', text: 'Debes ingresar tu contraseña actual.' });
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setPassMessage({ type: 'error', text: 'La nueva contraseña debe tener al menos 6 caracteres.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassMessage({ type: 'error', text: 'La confirmación de contraseña no coincide.' });
      return;
    }

    const targetId = profile?.id || profileId;
    if (!targetId) {
      setPassMessage({ type: 'error', text: 'No se pudo identificar el perfil del usuario.' });
      return;
    }

    try {
      setPassLoading(true);

      // 1. Obtener el hash de contraseña actual de la base de datos
      const { data: profData, error: profErr } = await supabase
        .from('profiles')
        .select('id, password_hash')
        .eq('id', targetId)
        .single();

      if (profErr || !profData) {
        throw new Error('Error al verificar tus credenciales en el sistema.');
      }

      // 2. Validar que la contraseña actual sea correcta mediante bcrypt
      if (!profData.password_hash || !bcrypt.compareSync(currentPassword, profData.password_hash)) {
        setPassMessage({ type: 'error', text: 'La contraseña actual ingresada es incorrecta.' });
        return;
      }

      // 3. Generar nuevo hash bcrypt
      const newHash = bcrypt.hashSync(newPassword, 8);

      // 4. Actualizar tabla profiles
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ password_hash: newHash })
        .eq('id', targetId);

      if (updateErr) {
        throw new Error('Error al guardar la nueva contraseña: ' + updateErr.message);
      }

      // 5. Opcional: Actualizar también en Supabase Auth si hay sesión activa
      try {
        await supabase.auth.updateUser({ password: newPassword });
      } catch (_) {}

      setPassMessage({ type: 'success', text: '¡Contraseña actualizada correctamente!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      setPassMessage({ type: 'error', text: e.message || 'Error al actualizar contraseña' });
    } finally {
      setPassLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card w-full max-w-lg rounded-3xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-secondary/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
              <UserCircle className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Mi Perfil</h2>
              <p className="text-xs text-muted-foreground">Información y Seguridad</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-8">
          
          {loading ? (
            <div className="py-8 text-center text-muted-foreground animate-pulse">Cargando datos del perfil...</div>
          ) : (
            <>
              {/* Datos Personales (Solo Lectura) */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Contact className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Datos Personales</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground ml-1">Nombres y Apellidos</label>
                    <input 
                      type="text" 
                      value={profile?.full_name || username || 'No registrado'}
                      disabled 
                      className="w-full bg-secondary/30 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-foreground opacity-70 cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground ml-1">Correo Electrónico (Acceso)</label>
                    <input 
                      type="email" 
                      value={authEmail || 'Sin correo asociado'}
                      disabled 
                      className="w-full bg-secondary/30 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-foreground opacity-70 cursor-not-allowed"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-amber-500/80 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Los datos personales solo pueden ser modificados por un Administrador del sistema.</span>
                </div>
              </section>

              {/* Vinculación de Cuenta */}
              <section className="space-y-4 pt-4 border-t border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Vinculación Rápida</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Vincula tu cuenta de Google para iniciar sesión con un solo clic en el futuro sin usar contraseña.
                </p>
                
                <button
                  onClick={handleLinkGoogle}
                  disabled={isGoogleLinked}
                  className={`w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${
                    isGoogleLinked
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 cursor-not-allowed'
                    : 'bg-white text-black hover:bg-gray-100'
                  }`}
                >
                  {isGoogleLinked ? (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Gmail Vinculado Correctamente
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      Vincular con Google
                    </>
                  )}
                </button>

                {linkError && (
                  <div className="p-3 rounded-xl text-xs font-medium border bg-red-500/10 border-red-500/20 text-red-500 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{linkError}</span>
                  </div>
                )}
              </section>

              {/* Seguridad / Contraseña */}
              <section className="space-y-4 pt-4 border-t border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-red-400" />
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Seguridad y Contraseña</h3>
                </div>
                
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  {/* Contraseña Actual */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground ml-1">Contraseña Actual *</label>
                    <div className="relative">
                      <input 
                        type={showCurrentPass ? "text" : "password"} 
                        placeholder="Ingresa tu contraseña actual"
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        className="w-full bg-secondary/50 border border-white/10 focus:border-indigo-500/50 rounded-xl px-4 py-2.5 pr-10 text-sm text-foreground outline-none transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPass(!showCurrentPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Nueva Contraseña */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground ml-1">Nueva Contraseña *</label>
                    <div className="relative">
                      <input 
                        type={showNewPass ? "text" : "password"} 
                        placeholder="Mínimo 6 caracteres"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className="w-full bg-secondary/50 border border-white/10 focus:border-indigo-500/50 rounded-xl px-4 py-2.5 pr-10 text-sm text-foreground outline-none transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirmar Nueva Contraseña */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground ml-1">Confirmar Nueva Contraseña *</label>
                    <input 
                      type={showNewPass ? "text" : "password"} 
                      placeholder="Repite la nueva contraseña"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full bg-secondary/50 border border-white/10 focus:border-indigo-500/50 rounded-xl px-4 py-2.5 text-sm text-foreground outline-none transition-colors"
                    />
                  </div>
                  
                  {passMessage.text && (
                    <div className={`p-3 rounded-xl text-xs font-medium border ${
                      passMessage.type === 'success' 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                      : 'bg-red-500/10 border-red-500/20 text-red-500'
                    }`}>
                      {passMessage.text}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={passLoading || !currentPassword || !newPassword || !confirmPassword}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl text-sm font-bold transition-colors"
                  >
                    {passLoading ? 'Verificando y actualizando...' : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        Actualizar Contraseña
                      </>
                    )}
                  </button>
                </form>
              </section>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
