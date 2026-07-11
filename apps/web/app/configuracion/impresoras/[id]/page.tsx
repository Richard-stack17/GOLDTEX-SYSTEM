'use client';

import React from 'react';
import PrinterForm from '../../components/PrinterForm';
import { useParams } from 'next/navigation';

export default function EditarImpresoraPage() {
  const params = useParams();
  const id = params.id as string;

  return <PrinterForm printerId={id} />;
}
