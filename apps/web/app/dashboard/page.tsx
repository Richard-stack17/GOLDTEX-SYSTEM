import Link from "next/link";
import { 
  Button, 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge
} from "@goltex/ui";
import { ArrowLeft, TrendingUp, ShoppingCart, AlertTriangle, ArrowUpRight } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="min-h-screen p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/hub">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard General</h1>
          <p className="text-muted-foreground">Resumen de operaciones del día</p>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="bg-primary text-primary-foreground border-transparent shadow-lg shadow-primary/20 relative overflow-hidden">
          <div className="absolute right-[-10%] top-[-10%] opacity-10">
            <TrendingUp className="w-48 h-48" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-primary-foreground/80 font-medium">Ventas de Hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">S/ 4,280.50</div>
            <p className="text-sm text-primary-foreground/70 mt-1 flex items-center gap-1">
              <ArrowUpRight className="w-4 h-4" />
              +12.5% respecto a ayer
            </p>
          </CardContent>
        </Card>

        <Card className="bg-glass border-white/10 shadow-lg">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-muted-foreground font-medium text-sm">Proformas Pendientes</CardTitle>
            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">7</div>
            <p className="text-sm text-muted-foreground mt-1">
              3 requieren seguimiento hoy
            </p>
          </CardContent>
        </Card>

        <Card className="bg-glass border-white/10 shadow-lg">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-muted-foreground font-medium text-sm">Productos con Stock Bajo</CardTitle>
            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">3</div>
            <p className="text-sm text-muted-foreground mt-1">
              Revisar Lino Italiano y Viscosa
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Simple Static SVG Chart */}
        <Card className="md:col-span-2 bg-glass border-white/10 shadow-lg">
          <CardHeader>
            <CardTitle>Ventas de la Semana</CardTitle>
          </CardHeader>
          <CardContent className="h-72 flex items-end justify-between gap-2 pt-6">
            {[ 
              { dia: "Lun", total: 1200 }, 
              { dia: "Mar", total: 1900 }, 
              { dia: "Mié", total: 3400 }, 
              { dia: "Jue", total: 2100 }, 
              { dia: "Vie", total: 4500 }, 
              { dia: "Sáb", total: 4280 }, 
              { dia: "Dom", total: 0 } 
            ].map((item, i) => {
              const maxTotal = 4500;
              const heightPct = maxTotal > 0 ? (item.total / maxTotal) * 100 : 0;
              return (
                <div key={i} className="w-full flex flex-col items-center gap-2 group cursor-pointer h-full justify-end">
                  <div 
                    className="w-full bg-primary/80 rounded-t-lg relative hover:bg-primary transition-colors"
                    style={{ height: `${heightPct}%` }}
                  >
                    {/* Tooltip on hover */}
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-xs py-1 px-2 rounded shadow-md whitespace-nowrap transition-opacity font-bold">
                      S/ {item.total}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground font-bold uppercase shrink-0">
                    {item.dia}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Mini Table */}
        <Card className="bg-glass border-white/10 shadow-lg">
          <CardHeader>
            <CardTitle>Últimas Ventas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Hora</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { time: '14:32', amount: 450.00, method: 'Yape' },
                  { time: '13:15', amount: 1280.50, method: 'BCP' },
                  { time: '11:45', amount: 85.00, method: 'Efectivo' },
                  { time: '10:30', amount: 320.00, method: 'Yape' },
                  { time: '09:15', amount: 145.00, method: 'Efectivo' },
                ].map((sale, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{sale.time}</TableCell>
                    <TableCell className="text-right">
                      <div className="font-medium">S/ {sale.amount.toFixed(2)}</div>
                      <div className="text-[10px] text-muted-foreground">{sale.method}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
