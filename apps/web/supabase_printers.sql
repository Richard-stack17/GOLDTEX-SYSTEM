CREATE TYPE printer_type AS ENUM ('bluetooth', 'wifi', 'usb');

CREATE TABLE IF NOT EXISTS printers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id), -- Nullable for backward compatibility or NOT NULL if strict
    name TEXT NOT NULL,
    type printer_type NOT NULL,
    paper_width INTEGER NOT NULL CHECK (paper_width IN (80, 58)),
    mac_address TEXT,
    ip_address TEXT,
    port INTEGER,
    auto_print BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS (Row Level Security)
ALTER TABLE printers ENABLE ROW LEVEL SECURITY;

-- 1. Lectura compartida para empleados (Cajeros y Admins)
-- Permite que cualquier cajero recupere la impresora configurada
CREATE POLICY "Lectura compartida para empleados"
ON printers FOR SELECT
TO authenticated
USING (true);

-- Nota: Para INSERT, UPDATE y DELETE, en la UI de Supabase
-- debes crear políticas que validen el rol de administrador,
-- por ejemplo: USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN' )

