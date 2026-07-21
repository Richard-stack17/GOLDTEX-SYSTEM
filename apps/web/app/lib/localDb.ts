import Dexie, { type Table } from 'dexie';
import { supabase } from './supabase';

export interface LocalProduct {
  id: string;
  family_id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  code?: string;
}

export interface LocalFamily {
  id: string;
  name: string;
  code?: string;
}

export interface LocalService {
  id: string;
  name: string;
  is_quick_access: boolean;
}

export interface LocalProfile {
  id: string;
  username: string;
  password_hash: string;
  role: string;
  employee_id: string | null;
  email: string | null;
}

export interface LocalRole {
  id: string;
  name: string;
  description: string;
  permissions: any;
  is_system: boolean;
}

export interface LocalSale {
  id: string;
  internal_ticket_number: string | null;
  document_number: string | null;
  issue_date: string;
  total: number;
  status: string;
  items: any[];
  source_sheet: string | null; // For tracking who made the sale (e.g. VENDEDOR:jhon)
  created_at?: string;
}

export interface LocalTransaction {
  id: string;
  sale_id: string;
  payment_method: string;
  amount: number;
  sequence: number;
}

export interface LocalEmployee {
  id: string;
  full_name: string;
  document_number: string | null;
}

export interface PendingSale {
  local_id?: number; // Auto-incremented por Dexie
  id?: string; // ID real si se generó, o nulo si es 100% local
  customer_id: string | null;
  total: number;
  status: string;
  created_at: string;
  items: any[]; // Detalles de la venta
}

export class GoltexPosDB extends Dexie {
  products!: Table<LocalProduct>;
  families!: Table<LocalFamily>;
  services!: Table<LocalService>;
  pending_sales!: Table<PendingSale>;
  profiles!: Table<LocalProfile>;
  roles!: Table<LocalRole>;
  sales!: Table<LocalSale>;
  transactions!: Table<LocalTransaction>;
  employees!: Table<LocalEmployee>;

  constructor() {
    super('GoltexPosDB');
    this.version(8).stores({ // v8: added sales, transactions, employees
      products: 'id, family_id, name, sku, price, stock',
      families: 'id, name, code',
      services: 'id, name, is_quick_access',
      pending_sales: '++local_id, id, customer_id, total, status, created_at',
      profiles: 'id, username, password_hash, role, email',
      roles: 'id, name',
      sales: 'id, issue_date, status, source_sheet',
      transactions: 'id, sale_id, payment_method',
      employees: 'id, full_name, document_number'
    });
  }
}

export const db = new GoltexPosDB();

/**
 * Función de utilidad para sincronizar el catálogo desde Supabase hacia Dexie.
 * Debe ser llamada cuando la aplicación detecte que hay conexión a internet.
 */
export async function syncCatalog() {
  if (typeof window === 'undefined' || !navigator.onLine) {
    console.warn("No hay conexión a internet, saltando sincronización del catálogo.");
    return;
  }

  try {
    console.log("Iniciando sincronización del catálogo...");

    // 1. Sincronizar familias
    const { data: familiesData, error: famError } = await supabase
      .from('families')
      .select('id, name, code')
      .eq('is_active', true);

    if (!famError && familiesData) {
      await db.families.clear();
      await db.families.bulkPut(familiesData);
      console.log(`✅ ${familiesData.length} familias sincronizadas.`);
    }

    // 2. Sincronizar productos
    const { data: productsData, error: prodError } = await supabase
      .from('products')
      .select('id, family_id, name, sku, price, stock')
      .eq('is_active', true);

    if (!prodError && productsData) {
      const localProducts: LocalProduct[] = productsData.map(p => ({
        id: p.id,
        family_id: p.family_id,
        name: p.name,
        sku: p.sku || '',
        code: p.sku,
        price: p.price || 0,
        stock: p.stock || 0,
      }));

      await db.products.clear();
      await db.products.bulkPut(localProducts);
      console.log(`✅ ${localProducts.length} productos sincronizados.`);
    }

    // 3. Sincronizar perfiles
    const { data: profilesData, error: profError } = await supabase
      .from('profiles')
      .select('id, username, password_hash, role, employee_id, email')
      .neq('role', 'DELETED');

    if (!profError && profilesData) {
      await db.profiles.bulkPut(profilesData);
      console.log(`✅ ${profilesData.length} perfiles sincronizados.`);
    }

    // 4. Sincronizar roles y permisos
    const { data: rolesData, error: rolesError } = await supabase
      .from('roles')
      .select('id, name, description, permissions, is_system');

    if (!rolesError && rolesData) {
      await db.roles.bulkPut(rolesData);
      console.log(`✅ ${rolesData.length} roles sincronizados.`);
    }

    // 5. Sincronizar servicios
    const { data: servicesData, error: servicesError } = await supabase
      .from('services')
      .select('id, name, is_quick_access')
      .eq('is_active', true);

    if (!servicesError && servicesData) {
      await db.services.clear();
      await db.services.bulkPut(servicesData);
      console.log(`✅ ${servicesData.length} servicios sincronizados.`);
    }

    // 6. Sincronizar empleados
    const { data: employeesData, error: employeesError } = await supabase
      .from('employees')
      .select('id, full_name, document_number');

    if (!employeesError && employeesData) {
      await db.employees.bulkPut(employeesData);
      console.log(`✅ ${employeesData.length} empleados sincronizados.`);
    }

    // Sincronizar Ventas (Últimos 2 años para analítica)
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    
    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select('id, internal_ticket_number, document_number, issue_date, created_at, total, status, items, source_sheet')
      .gte('issue_date', twoYearsAgo.toISOString());

    if (!salesError && salesData) {
      const formattedSales: LocalSale[] = salesData.map(s => ({
        ...s,
        // Estandarización de Fechas: Mantener el string YYYY-MM-DD tal cual viene de Supabase para evitar desfases UTC
        issue_date: s.issue_date,
        created_at: s.created_at
      }));
      await db.sales.bulkPut(formattedSales);
      console.log(`✅ ${formattedSales.length} ventas sincronizadas.`);

      // Sincronizar transacciones asociadas a estas ventas
      // Obtenemos solo transacciones de ventas descargadas (optimización: hacerlo en lotes o descargar todo del último año si no excede límites postgrest)
      const { data: transactionsData, error: txError } = await supabase
        .from('transactions')
        .select('id, sale_id, payment_method, amount, sequence')
        .gte('created_at', twoYearsAgo.toISOString());

      if (!txError && transactionsData) {
        await db.transactions.bulkPut(transactionsData);
        console.log(`✅ ${transactionsData.length} transacciones sincronizadas.`);
      }
    }

  } catch (err) {
    console.error("Error sincronizando catálogo:", err);
  }
}

