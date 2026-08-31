import { ShoppingCart, ScrollText, Banknote, FileSpreadsheet, Contact, PackageSearch, Users, BarChart3, Settings } from 'lucide-react';
export type Employee = {
  id: string;
  full_name: string;
  dni: string;
  phone?: string;
  is_active?: boolean;
  created_at: string;
  employee_stores?: { store_id: string; role?: string; role_id?: string | null; stores: { name: string } }[];
};

export type Profile = {
  id: string;
  username: string;
  role: string;
  role_id?: string | null;
  employee_id: string | null;
  email: string | null;
  is_owner?: boolean;
  default_store_id?: string | null;
  stores?: { name: string }[] | null;
  employee_stores?: any[];
};

export type Tab = 'empleados' | 'usuarios' | 'roles';

export type Role = {
  id: string;
  name: string;
  description: string | null;
  permissions: any;
  is_system: boolean;
  store_id?: string | null;
  is_active?: boolean;
  stores?: { name: string; is_active: boolean };
};


export const PERMISSION_GROUPS = [
  {
    app: 'Punto de Venta',
    mainKey: 'access_pos',
    icon: ShoppingCart,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    description: 'Acceso base al catálogo, carrito de compras y emisión de proformas.',
    subPermissions: [
      { key: 'view_cashier_name', label: 'Ver quién atendió la proforma' },
      { key: 'pos_open_caja', label: 'Apertura de Caja' },
      { key: 'pos_close_caja', label: 'Cierre de Caja' },
      { key: 'pos_switch_account', label: 'Ver Cuentas Guardadas en este Equipo' },
      { key: 'pos_remove_saved_account', label: 'Quitar Cuentas Guardadas' },
      { key: 'pos_logout', label: 'Cerrar todas las Cuentas Guardadas' }
    ]
  },
  {
    app: 'Historial de Proformas',
    mainKey: 'access_proformas',
    icon: ScrollText,
    color: 'text-teal-500',
    bgColor: 'bg-teal-500/10',
    borderColor: 'border-teal-500/20',
    description: 'Consulta e impresión de proformas emitidas.',
    subPermissions: [
      { key: 'history_cancel_proforma', label: 'Anular / Eliminar Proformas' }
    ]
  },
  {
    app: 'Caja',
    mainKey: 'access_caja',
    icon: Banknote,
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
    description: 'Módulo de cobros, liquidaciones y control de ingresos.',
    subPermissions: [
      { key: 'delete_sales', label: 'Anular/Eliminar Ventas reales' },
      { key: 'caja_cobro_consolidado', label: 'Cobrar múltiples proformas (Consolidado)' },
    ]
  },
  {
    app: 'Contabilidad',
    mainKey: 'access_contabilidad',
    icon: FileSpreadsheet,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    description: 'Acceso a reporteadores e importaciones contables.',
    subPermissions: []
  },
  {
    app: 'Clientes Frecuentes',
    mainKey: 'access_clientes',
    icon: Contact,
    color: 'text-pink-500',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/20',
    description: 'Consulta de directorio de clientes caseros.',
    subPermissions: [
      { key: 'customers_create', label: 'Crear Clientes Frecuentes' },
      { key: 'customers_edit', label: 'Editar Datos de Clientes' },
      { key: 'customers_delete', label: 'Eliminar Clientes Frecuentes' }
    ]
  },
  {
    app: 'Catálogo / Inventario',
    mainKey: 'access_inventory',
    icon: PackageSearch,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    description: 'Consulta de stock de productos y servicios registrados.',
    subPermissions: [
      { key: 'inventory_create', label: 'Crear Productos, Familias y Servicios' },
      { key: 'inventory_edit', label: 'Editar Productos, Precios, Familias y Servicios' },
      { key: 'inventory_delete', label: 'Eliminar Productos, Familias y Servicios' }
    ]
  },
  {
    app: 'Personal',
    mainKey: 'access_personal',
    icon: Users,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/20',
    description: 'Acceso al directorio de empleados y personal.',
    subPermissions: [
      { key: 'personal_create_user', label: 'Crear y Vincular Empleados o Cuentas de Usuario' },
      { key: 'personal_edit_user', label: 'Editar Empleados, Usuarios, Contraseñas y Roles' },
      { key: 'personal_delete_user', label: 'Dar de Baja o Eliminar Empleados y Usuarios' },
      { key: 'personal_manage_roles', label: 'Gestionar Matriz de Roles y Permisos' }
    ]
  },
  {
    app: 'Dashboard',
    mainKey: 'access_dashboard',
    icon: BarChart3,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    description: 'Visualización de métricas de ventas y KPIs.',
    subPermissions: []
  },
  {
    app: 'Configuración',
    mainKey: 'access_settings',
    icon: Settings,
    color: 'text-slate-500',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/20',
    description: 'Acceso base al módulo e impresoras registradas.',
    subPermissions: [
      { key: 'settings_printers_manage', label: 'Crear y Editar Impresoras y Ticketeras' },
      { key: 'settings_printers_set_default', label: 'Asignar Impresora Predeterminada de Tienda (Web / Móvil)' },
      { key: 'settings_printers_delete', label: 'Eliminar Impresoras Registradas' },
      { key: 'settings_finance', label: 'Modificar Tarifas y Comisiones Izipay' }
    ]
  }
];
