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
  store_id?: string | null;
}

export interface LocalSale {
  parent_sale_id?: string | null;
  source_type?: string | null;
  id: string;
  internal_ticket_number: string | null;
  proforma_number: string | null;
  invoice_number: string | null;
  issue_date: string;
  total: number;
  status: string;
  seller_id?: string | null;
  cashier_id?: string | null;
  created_at?: string;
  store_id?: string | null;
  items?: any[] | null;
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
  dni: string | null;
}

export interface PendingSale {
  local_id?: number; // Auto-incremented por Dexie
  offline_uuid: string; // UUID v4 generado localmente — NUNCA cambia
  id?: string | null; // ID real de Supabase (se llena tras la sync exitosa)
  store_id: string | null;
  seller_id: string | null;
  cashier_id: string | null;
  customer_id: string | null;
  total: number;
  status: string;
  created_at: string;
  items: any[]; // Detalles de la venta
  sync_status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'ERROR';
  sync_error?: string | null;
  retry_count: number;
  synced_at?: string | null;
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
    this.version(10).stores({ // v8: added sales, transactions, employees. v9: updated pending_sales
      products: 'id, family_id, name, sku, price, stock',
      families: 'id, name, code',
      services: 'id, name, is_quick_access',
      pending_sales: '++local_id, offline_uuid, sync_status, created_at, id, customer_id, total, status',
      profiles: 'id, username, employee_id, password_hash, role, email',
      roles: 'id, name',
      sales: 'id, issue_date, status, parent_sale_id, source_type',
      transactions: 'id, sale_id, payment_method',
      employees: 'id, full_name, dni'
    });
  }
}

export const db = new GoltexPosDB();

if (typeof window !== 'undefined') {
  db.open().catch(async (err) => {
    if (err.name === 'VersionError') {
      if (process.env.NODE_ENV === 'development') console.warn("Schema mismatch detectado. Purgando BD local...");
      await db.delete();
      await db.open();
    }
  });
}


/**
 * Función de utilidad para sincronizar el catálogo desde Supabase hacia Dexie.
 * Debe ser llamada cuando la aplicación detecte que hay conexión a internet.
 */
export async function syncCatalog(targetStoreId?: string) {
  if (typeof window === 'undefined' || !navigator.onLine) {
    if (process.env.NODE_ENV === 'development') console.warn("No hay conexión a internet, saltando sincronización del catálogo.");
    return;
  }

  const storeId = targetStoreId || localStorage.getItem("goltex_active_store_id");

  try {
    if (process.env.NODE_ENV === 'development') console.log(`Iniciando sincronización del catálogo limpio para la tienda: ${storeId || 'todas'}`);

    // Limpieza total preventiva de tablas locales antes de refrescar
    await db.families.clear();
    await db.products.clear();
    await db.services.clear();
    await db.sales.clear();
    await db.transactions.clear();

    // 1. Sincronizar familias
    let famQuery = supabase.from('families').select('id, name, code').eq('is_active', true);
    if (storeId) {
      famQuery = famQuery.eq('store_id', storeId);
    }
    const { data: familiesData, error: famError } = await famQuery;

    if (!famError && familiesData) {
      await db.families.bulkPut(familiesData);
      if (process.env.NODE_ENV === 'development') console.log(`✅ ${familiesData.length} familias sincronizadas.`);
    }

    // 2. Sincronizar productos
    let prodQuery = supabase.from('products').select('id, family_id, name, sku, price, stock').eq('is_active', true);
    if (storeId) {
      prodQuery = prodQuery.eq('store_id', storeId);
    }
    const { data: productsData, error: prodError } = await prodQuery;

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

      await db.products.bulkPut(localProducts);
      if (process.env.NODE_ENV === 'development') console.log(`✅ ${localProducts.length} productos sincronizados.`);
    }

    // 3. Sincronizar perfiles
    const { data: profilesData, error: profError } = await supabase
      .from('profiles')
      .select('id, username, password_hash, role, employee_id, email')
      .neq('role', 'DELETED');

    if (!profError && profilesData) {
      await db.profiles.bulkPut(profilesData);
      if (process.env.NODE_ENV === 'development') console.log(`✅ ${profilesData.length} perfiles sincronizados.`);
    }

    // 4. Sincronizar roles y permisos
    let rolesQuery = supabase
      .from('roles')
      .select('id, name, description, permissions, is_system, store_id')
      .eq('is_active', true);

    if (storeId) {
      rolesQuery = rolesQuery.or(`store_id.is.null,store_id.eq.${storeId}`);
    }

    const { data: rolesData, error: rolesError } = await rolesQuery;

    if (!rolesError && rolesData) {
      await db.roles.bulkPut(rolesData);
      if (process.env.NODE_ENV === 'development') console.log(`✅ ${rolesData.length} roles sincronizados.`);
    }

    // 5. Sincronizar servicios
    let servicesQuery = supabase
      .from('services')
      .select('id, name, is_quick_access')
      .eq('is_active', true);
    if (storeId) {
      servicesQuery = servicesQuery.eq('store_id', storeId);
    }
    const { data: servicesData, error: servicesError } = await servicesQuery;

    if (!servicesError && servicesData) {
      await db.services.clear();
      await db.services.bulkPut(servicesData);
      if (process.env.NODE_ENV === 'development') console.log(`✅ ${servicesData.length} servicios sincronizados.`);
    }

    // 6. Sincronizar empleados
    const { data: employeesData, error: empError } = await supabase
      .from('employees')
      .select('id, full_name, dni');

    if (!empError && employeesData) {
      await db.employees.bulkPut(employeesData);
      if (process.env.NODE_ENV === 'development') console.log(`✅ ${employeesData.length} empleados sincronizados.`);
    }

    // Sincronizar Ventas (Últimos 2 años para analítica)
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    
    let salesQuery = supabase
      .from('sales')
      .select('id, internal_ticket_number, proforma_number, invoice_number, issue_date, created_at, total, status, items, seller_id, cashier_id, store_id, parent_sale_id, source_type')
      .gte('issue_date', twoYearsAgo.toISOString());
      
    if (storeId) {
      salesQuery = salesQuery.eq('store_id', storeId);
    }
    
    const { data: salesData, error: salesError } = await salesQuery;

    if (!salesError && salesData) {
      const formattedSales: LocalSale[] = salesData.map(s => ({
        ...s,
        // Estandarización de Fechas: Mantener el string YYYY-MM-DD tal cual viene de Supabase para evitar desfases UTC
        issue_date: s.issue_date,
        created_at: s.created_at
      }));
      await db.sales.bulkPut(formattedSales);
      if (process.env.NODE_ENV === 'development') console.log(`✅ ${formattedSales.length} ventas sincronizadas.`);

      // Sincronizar transacciones asociadas a estas ventas
      // Obtenemos solo transacciones de ventas descargadas (optimización: hacerlo en lotes o descargar todo del último año si no excede límites postgrest)
      const { data: transactionsData, error: txError } = await supabase
        .from('transactions')
        .select('id, sale_id, payment_method, amount, sequence')
        .gte('created_at', twoYearsAgo.toISOString());

      if (!txError && transactionsData) {
        await db.transactions.bulkPut(transactionsData);
        if (process.env.NODE_ENV === 'development') console.log(`✅ ${transactionsData.length} transacciones sincronizadas.`);
      }
    }

  } catch (err) {
    console.error("Error sincronizando catálogo:", err);
  }
}

/**
 * Función para sincronizar proformas pendientes de forma robusta.
 * Solo se llamará en modo APK.
 */
export async function syncPendingSales() {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return 0;
  }

  let syncedCount = 0;
  try {
    const pendingSales = await db.pending_sales
      .filter(sale => sale.sync_status === 'PENDING' || sale.sync_status === 'ERROR')
      .toArray();

    if (pendingSales.length === 0) return 0;

    for (const sale of pendingSales) {
      if (!sale.local_id) continue;
      
      // Marcar como sincronizando
      await db.pending_sales.update(sale.local_id, {
        sync_status: 'SYNCING'
      });

      // Extraer datos para Supabase
      const saleData = {
        store_id: sale.store_id,
        seller_id: sale.seller_id,
        cashier_id: sale.cashier_id,
        customer_id: sale.customer_id,
        total: sale.total,
        status: sale.status,
        created_at: sale.created_at,
        issue_date: sale.created_at.split('T')[0], // assuming created_at is ISO string
        items: sale.items,
        internal_ticket_number: null,
        proforma_number: null, // Supabase triggers/functions should generate this
      };

      const { data, error } = await supabase.from('sales').insert(saleData).select('id').single();

      if (error) {
        await db.pending_sales.update(sale.local_id, {
          sync_status: 'ERROR',
          sync_error: error.message,
          retry_count: (sale.retry_count || 0) + 1
        });
      } else if (data) {
        await db.pending_sales.update(sale.local_id, {
          sync_status: 'SYNCED',
          id: data.id, // Guardar el ID real asignado por Supabase
          sync_error: null,
          synced_at: new Date().toISOString()
        });
        syncedCount++;
      }
    }
  } catch (err: any) {
    console.error("Error en syncPendingSales:", err);
  }

  return syncedCount;
}

