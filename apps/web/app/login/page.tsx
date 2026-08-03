"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@goltex/ui";
import { Box, Eye, EyeOff } from "lucide-react";
import { useRole, type Role } from "../context/RoleContext";
import { supabase } from "../lib/supabase";
import bcrypt from "bcryptjs";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUsername, setRole, setEmployeeId, setProfileId, setDefaultStoreId } = useRole();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  useEffect(() => {
    if (searchParams.get("inactive_store") === "true") {
      setError("Acceso Restringido: La sucursal asignada a tu cuenta ha sido desactivada. Contacta al administrador.");
    }
  }, [searchParams]);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = e.target as HTMLFormElement;
    const usernameInput = (form.elements.namedItem("username") as HTMLInputElement).value.trim();
    const passwordInput = (form.elements.namedItem("password") as HTMLInputElement).value;

    try {
      // Query profiles directly by username
      const { data: profileData, error: profileErr } = await supabase
        .from("profiles")
        .select(`
          id,
          username,
          role,
          password_hash,
          employee_id,
          default_store_id,
          employees:employee_id ( full_name )
        `)
        .eq("username", usernameInput)
        .maybeSingle();

      if (profileErr) {
        throw new Error("Error al consultar el sistema. Intente de nuevo.");
      }

      if (!profileData) {
        throw new Error("Usuario no encontrado en el sistema.");
      }

      // Password verification: compare plain text against password_hash column using bcrypt
      if (!bcrypt.compareSync(passwordInput, profileData.password_hash)) {
        throw new Error("Contraseña incorrecta.");
      }

      // 🛡️ AUTH GUARD: Verificar si la cuenta es de Ámbito Global o si sus tiendas asignadas están activas
      if (profileData.role !== "ADMIN" && profileData.employee_id) {
        const { data: roleDefs } = await supabase
          .from("roles")
          .select("store_id, is_system")
          .eq("name", profileData.role)
          .eq("is_active", true);

        const isGlobalTemplateRole = !roleDefs || roleDefs.length === 0 || roleDefs.some((r: any) => r.store_id === null || r.is_system);
        const isNoStoreAssigned = profileData.default_store_id === null;

        // Si NO es una cuenta de Ámbito Global, verificar que las tiendas asignadas estén activas
        if (!isGlobalTemplateRole || !isNoStoreAssigned) {
          const { data: totalEmpStores } = await supabase
            .from("employee_stores")
            .select("store_id")
            .eq("employee_id", profileData.employee_id);

          if (totalEmpStores && totalEmpStores.length > 0) {
            const { data: activeStoresCount, error: countErr } = await supabase
              .from("employee_stores")
              .select("store_id, stores!inner(is_active)")
              .eq("employee_id", profileData.employee_id)
              .eq("stores.is_active", true);

            if (countErr) {
              throw new Error("Error al verificar los permisos de acceso.");
            }

            if (!activeStoresCount || activeStoresCount.length === 0) {
              throw new Error("Acceso Restringido: La sucursal asignada a tu cuenta ha sido desactivada. Contacta al administrador.");
            }
          }
        }
      }

      const userRole = profileData.role as Role;

      setRole(userRole);
      setUsername(profileData.username);
      setEmployeeId(profileData.employee_id ?? null);
      setProfileId(profileData.id);
      setDefaultStoreId(profileData.default_store_id ?? null);

      // Guardar historial de cuentas para selector rápido
      try {
        const savedAccountsStr = localStorage.getItem("goltex_saved_accounts");
        let savedAccounts = savedAccountsStr ? JSON.parse(savedAccountsStr) : [];
        savedAccounts = savedAccounts.filter((acc: any) => acc.username !== profileData.username);
        savedAccounts.unshift({ 
          username: profileData.username, 
          role: userRole, 
          employee_id: profileData.employee_id 
        });
        localStorage.setItem("goltex_saved_accounts", JSON.stringify(savedAccounts.slice(0, 10))); // Max 10 cuentas
      } catch (e) {
        console.error("No se pudo guardar el historial de cuentas", e);
      }

      router.push("/hub");
    } catch (err: any) {
      setError(err.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/pos`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || "Error al iniciar sesión con Google");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
      
      <Card className="w-full max-w-md z-10 bg-glass backdrop-blur-md border-white/10 shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-2">
            <Box className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">G-SYSTEM ERP</CardTitle>
          <CardDescription>Sistema Interno Integrado</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-3 rounded-lg text-sm font-semibold text-center">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="username">
                Usuario
              </label>
              <Input id="username" name="username" placeholder="ej: Admin1550" required className="bg-background/50 border-white/10" disabled={loading} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="password">
                  Contraseña
                </label>
                <a href="#" className="text-xs text-primary hover:underline" onClick={(e) => e.preventDefault()}>
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  className="bg-background/50 border-white/10 pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                  title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
              {loading ? "Iniciando sesión..." : "Entrar al Sistema"}
            </Button>
            
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-muted" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">O continúa con</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-11 bg-white hover:bg-gray-100 text-gray-900 border-gray-200"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continuar con Google
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
