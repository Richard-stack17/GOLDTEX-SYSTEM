import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@goltex/ui";
import { BarChart3 } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export function SalesChart({ chartData, chartInsights, dateFilter, dateRange }: any) {
  return (
    <Card className="bg-card border border-border shadow-sm lg:col-span-3">
      <CardHeader className="border-b border-border/50 bg-secondary/20 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            Evolución de Ventas
            <span className="text-[10px] font-normal lowercase bg-secondary px-2 py-0.5 rounded ml-2">({dateFilter === "TODAY" ? "Por horas" : `${dateRange.start.split('-').reverse().join('-')} al ${dateRange.end.split('-').reverse().join('-')}`})</span>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 h-72">
            {chartData.items.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                <BarChart3 className="w-8 h-8 mb-2" />
                <p className="text-sm font-medium">Sin datos para graficar</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.items} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} dy={10} minTickGap={15} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} tickFormatter={(val) => `S/ ${val}`} dx={-10} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}
                    labelStyle={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}
                    formatter={(value: any) => [`S/ ${value.toFixed(2)}`, 'Total']}
                  />
                  <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" activeDot={{ r: 6, fill: "#4f46e5", stroke: "#fff", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          
          {chartInsights && (
            <div className="w-full lg:w-56 flex flex-col gap-4 justify-center">
              <div className="border-l-4 border-emerald-500 bg-slate-50 rounded-r-lg p-4 shadow-sm">
                <p className="text-xs text-muted-foreground font-bold uppercase mb-1">Día Top: {chartInsights.best.label}</p>
                <p className="text-lg font-black text-emerald-700">S/ {(chartInsights?.best?.total || 0).toFixed(0)}</p>
              </div>
              <div className="border-l-4 border-rose-500 bg-slate-50 rounded-r-lg p-4 shadow-sm">
                <p className="text-xs text-muted-foreground font-bold uppercase mb-1">Día Bajo: {chartInsights.worst.label}</p>
                <p className="text-lg font-black text-rose-700">S/ {(chartInsights?.worst?.total || 0).toFixed(0)}</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
