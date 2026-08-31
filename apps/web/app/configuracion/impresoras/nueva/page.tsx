'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PrinterForm from '../../components/PrinterForm';
import { useRole } from '../../../context/RoleContext';

export default function NuevaImpresoraPage() {
  const { permissions, isHydrated } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (isHydrated && !permissions?.settings_printers_manage) {
      router.replace('/configuracion');
    }
  }, [permissions, isHydrated, router]);

  if (!isHydrated) {
    return <div className="p-8 text-center text-muted-foreground">Cargando...</div>;
  }

  if (!permissions?.settings_printers_manage) {
    return null;
  }

  return <PrinterForm />;
}
