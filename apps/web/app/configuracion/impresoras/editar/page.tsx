'use client';

import React, { Suspense } from 'react';
import PrinterForm from '../../components/PrinterForm';
import { useSearchParams } from 'next/navigation';

function EditarImpresoraContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  if (!id) {
    return <div className="p-8 text-center text-muted-foreground">ID de impresora no válido.</div>;
  }

  return <PrinterForm printerId={id} />;
}

export default function EditarImpresoraPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Cargando...</div>}>
      <EditarImpresoraContent />
    </Suspense>
  );
}
