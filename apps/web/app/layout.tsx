import "@goltex/ui/globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { RoleProvider } from "./context/RoleContext";
import { ThemeProvider } from "./context/ThemeContext";
import { HydrationGate } from "./context/HydrationGate";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GOLTEX S.A.C.",
  description: "Sistema interno de GOLTEX S.A.C.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning en <html> porque ThemeProvider modifica
    // dinámicamente el atributo `class` (dark/light) en el cliente,
    // lo que causa un mismatch con el SSR. Es el uso correcto y acotado.
    <html lang="es" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-background antialiased`} suppressHydrationWarning>
        <ThemeProvider>
          <RoleProvider>
            {/* HydrationGate muestra un spinner mientras localStorage
                no haya sido leído (isHydrated=false). Evita parpadeos
                de UI dependientes del rol y errores de hidratación. */}
            <HydrationGate>
              {children}
            </HydrationGate>
          </RoleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
