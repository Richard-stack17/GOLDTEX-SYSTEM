'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { CheckCircle2, ShieldAlert, ShieldCheck, Mail, ArrowRight, Lock, AlertTriangle } from 'lucide-react';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Procesando autenticación...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [linkedSuccessData, setLinkedSuccessData] = useState<{ email: string } | null>(null);

  useEffect(() => {
    let mounted = true;

    const processSession = async (session: any) => {
      if (!mounted) return;
      
      const email = session?.user?.email;
      if (!email) {
        setErrorMessage('No se pudo obtener el correo electrónico de la cuenta de Google.');
        return;
      }

      const linkProfileId = searchParams.get('link_profile_id');

      if (linkProfileId) {
        // MODO VINCULACIÓN: Asignar este email al perfil del usuario actual
        setStatus('Vinculando cuenta de Google...');
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ email: email })
          .eq('id', linkProfileId);

        if (updateError) {
          console.error('Error al vincular:', updateError);
          setErrorMessage('Error al vincular tu cuenta: ' + updateError.message);
        } else {
          // Mostrar pantalla/modal de éxito con confirmación y advertencias de seguridad
          setLinkedSuccessData({ email });
        }
      } else {
        // MODO LOGIN NORMAL: Buscar si hay un perfil con este email
        setStatus('Verificando acceso...');
        
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, username, role, employee_id, default_store_id')
          .eq('email', email)
          .maybeSingle();

        if (profile) {
          // Guardar credenciales en localStorage para el sistema legacy (RoleContext)
          localStorage.setItem('goltex_username', profile.username);
          localStorage.setItem('goltex_role', profile.role);
          if (profile.employee_id) localStorage.setItem('goltex_employee_id', profile.employee_id);
          localStorage.setItem('goltex_profile_id', profile.id);
          if (profile.default_store_id) localStorage.setItem('goltex_default_store_id', profile.default_store_id);
          
          router.replace('/hub');
        } else {
          // No existe un perfil con ese correo
          await supabase.auth.signOut();
          router.replace('/login?error=Tu cuenta de Google no está vinculada a ningún perfil. Inicia sesión con tu contraseña y vincúlala desde tu Perfil.');
        }
      }
    };

    const initAuth = async () => {
      // Como detectSessionInUrl=false por Capacitor, debemos intercambiar el código manualmente si existe
      const code = searchParams.get('code');
      if (code) {
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          if (data?.session && mounted) {
            processSession(data.session);
            return;
          }
        } catch (e: any) {
          console.error("Error exchanging code:", e);
          if (mounted) {
            setErrorMessage('Error al validar credenciales de Google: ' + e.message);
          }
          return;
        }
      } else {
        // Si no hay código pero el hash tiene access_token (Implicit flow)
        if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
          try {
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            const access_token = hashParams.get('access_token');
            const refresh_token = hashParams.get('refresh_token');
            
            if (access_token && refresh_token) {
              const { data, error } = await supabase.auth.setSession({
                access_token,
                refresh_token
              });
              
              if (error) throw error;
              if (data?.session && mounted) {
                processSession(data.session);
                return;
              }
            }
          } catch (e: any) {
            console.error("Error setting session from hash:", e);
            if (mounted) {
              setErrorMessage('Error al procesar el token de Google: ' + e.message);
            }
            return;
          }
        }
      }

      // 1. Escuchar eventos de autenticación asíncronos por si PKCE se resuelve de otro modo
      const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
          processSession(session);
        }
      });

      // 2. Verificar si la sesión ya existe en caso de que el evento ya haya pasado
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          processSession(session);
        }
      });

      // 3. Fallback de tiempo de espera por si no se resuelve
      const timeout = setTimeout(() => {
        if (mounted) {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
              setErrorMessage('Tiempo de espera agotado o la autenticación fue cancelada.');
            }
          });
        }
      }, 5000);

      return () => {
        authListener.subscription.unsubscribe();
        clearTimeout(timeout);
      };
    };

    let cleanup: any = null;
    initAuth().then(res => { cleanup = res; });

    return () => {
      mounted = false;
      if (cleanup) cleanup();
    };
  }, [router, searchParams]);

  // Pantalla de Error
  if (errorMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">Error de Autenticación</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {errorMessage}
            </p>
          </div>
          <button
            onClick={() => router.replace('/login')}
            className="w-full h-12 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-bold transition-colors flex items-center justify-center gap-2"
          >
            Volver al Inicio de Sesión
          </button>
        </div>
      </div>
    );
  }

  // Pantalla / Popup Modal de Vinculación Exitosa
  if (linkedSuccessData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background/95 backdrop-blur-sm">
        <div className="w-full max-w-lg bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
          
          {/* Header con icono de éxito */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-foreground">
              ¡Cuenta Vinculada con Éxito!
            </h2>
            <p className="text-sm text-muted-foreground">
              Tu usuario ha quedado asociado correctamente a tu cuenta de Google.
            </p>
          </div>

          {/* Tarjeta con el correo asociado */}
          <div className="bg-secondary/40 border border-border/80 rounded-2xl p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                Correo de Acceso Directo
              </span>
              <span className="text-sm font-bold text-foreground truncate block">
                {linkedSuccessData.email}
              </span>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" />
              Activo
            </span>
          </div>

          {/* Avisos de Seguridad y Recomendaciones */}
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 sm:p-5 space-y-3 text-amber-600 dark:text-amber-400">
            <div className="flex items-center gap-2 font-bold text-sm">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Recomendaciones Importantes de Seguridad</span>
            </div>
            <ul className="text-xs leading-relaxed space-y-2 text-foreground/80 list-disc list-inside">
              <li>
                <strong className="text-foreground">Acceso con un clic:</strong> A partir de ahora podrás ingresar al sistema seleccionando <em>Iniciar Sesión con Google</em> sin necesidad de escribir tu contraseña.
              </li>
              <li>
                <strong className="text-foreground">Uso personal e intransferible:</strong> No compartas tu cuenta ni prestes tu correo a otras personas para evitar accesos no autorizados.
              </li>
              <li>
                <strong className="text-foreground">Dispositivos compartidos:</strong> Si utilizas una computadora o tablet de tienda compartida, recuerda siempre <strong>cerrar sesión</strong> al finalizar tu turno.
              </li>
            </ul>
          </div>

          {/* Botón de Acción para continuar */}
          <button
            onClick={() => router.replace('/hub')}
            className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
          >
            <span>Ir al Panel Principal</span>
            <ArrowRight className="w-4 h-4" />
          </button>

        </div>
      </div>
    );
  }

  // Estado de Carga por defecto
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-4 text-center p-8 bg-card rounded-3xl shadow-xl border border-border max-w-sm w-full">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <h2 className="text-base font-bold text-foreground">{status}</h2>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Cargando...</div>}>
      <AuthCallbackContent />
    </Suspense>
  );
}
