import "@goltex/ui/globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

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
    <html lang="es" className="dark">
      <body className={`${inter.className} min-h-screen bg-background antialiased`}>
        {children}
      </body>
    </html>
  );
}
