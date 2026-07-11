"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@goltex/ui";
import { Box } from "lucide-react";
import { useRole, type Role } from "../context/RoleContext";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const { setUsername, setRole, setEmployeeId } = useRole();
  const [error, setError] = useState<string | null>(null);
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

      // Password verification: compare plain text against password_hash column
      // (In production this should use bcrypt via an RPC or Edge Function)
      if (profileData.password_hash !== passwordInput) {
        throw new Error("Contraseña incorrecta.");
      }

      const userRole = profileData.role as Role;

      setRole(userRole);
      setUsername(profileData.username);
      setEmployeeId(profileData.employee_id ?? null);

      router.push("/hub");
    } catch (err: any) {
      setError(err.message || "Error al iniciar sesión");
    } finally {
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
              <Input id="password" name="password" type="password" required className="bg-background/50 border-white/10" disabled={loading} />
            </div>
            <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
              {loading ? "Iniciando sesión..." : "Entrar al Sistema"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
