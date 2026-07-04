"use client";

import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@goltex/ui";
import { Box } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/hub");
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
      
      <Card className="w-full max-w-md z-10 bg-glass backdrop-blur-md border-white/10 shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-2">
            <Box className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">GOLTEX S.A.C.</CardTitle>
          <CardDescription>Sistema Interno Integrado</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="username">
                Usuario
              </label>
              <Input id="username" placeholder="ej: yuriko" required className="bg-background/50 border-white/10" />
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
              <Input id="password" type="password" required className="bg-background/50 border-white/10" />
            </div>
            <Button type="submit" className="w-full h-11 text-base">
              Entrar al Sistema
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
