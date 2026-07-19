const fs = require('fs');
let content = fs.readFileSync('app/pos/page.tsx', 'utf8');

// 1. Imports
content = content.replace(
  'import { db } from "../lib/localDb";',
  'import { db, type LocalService } from "../lib/localDb";'
);

// 2. State
content = content.replace(
  '  const [isCajaOpen, setIsCajaOpen] = useState(false);',
  `  const [isCajaOpen, setIsCajaOpen] = useState(false);
  const localServices = useLiveQuery(() => db.services.toArray(), []) || [];
  const quickAccessServices = localServices.filter(s => s.is_quick_access).sort((a, b) => a.name.localeCompare(b.name));
  const otherServices = localServices.filter(s => !s.is_quick_access).sort((a, b) => a.name.localeCompare(b.name));
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [activeService, setActiveService] = useState<LocalService | null>(null);
  const [isOtherServicesModalOpen, setIsOtherServicesModalOpen] = useState(false);
  const [servicePriceInput, setServicePriceInput] = useState("");`
);

// 3. Remove old modals (Confeccion/Taxi) and add handleOpenService
content = content.replace(
  /  const handleOpenConfeccion = \(\) => {[\s\S]*?  };\n\n  const handleOpenTaxi = \(\) => {[\s\S]*?  };\n/g,
  `  const handleOpenService = (service: LocalService) => {
    const existing = cart.find(i => i.id === service.id);
    setActiveService(service);
    setServicePriceInput(existing ? existing.editedPrice.toString() : "");
    setIsOtherServicesModalOpen(false);
    setIsServiceModalOpen(true);
  };

  const handleConfirmService = () => {
    if (!activeService) return;
    const price = parseFloat(servicePriceInput);
    if (!price || price <= 0) return;
    
    setCart(prev => {
      const existing = prev.find(i => i.id === activeService.id);
      if (existing) {
        return prev.map(i => i.id === activeService.id ? { ...i, editedPrice: price } : i);
      } else {
        return [...prev, {
          id: activeService.id,
          familyId: "SERVICE",
          code: "SVC",
          name: activeService.name,
          price: 0,
          editedPrice: price,
          quantity: 1,
          is_service: true
        }];
      }
    });
    setIsServiceModalOpen(false);
    setActiveService(null);
    setServicePriceInput("");
  };

  const handleServiceNumpadKey = (key: string) => {
    setServicePriceInput(prev => {
      if (key === "DEL") return prev.slice(0, -1);
      if (key === "." && prev.includes(".")) return prev;
      if (key === "0" && prev === "0") return prev;
      if (prev === "0" && key !== ".") return key;
      return prev + key;
    });
  };\n`
);

// 4. Update Document number casting
content = content.replace(
  'document_number: payload.new.document_number',
  'document_number: (payload.new as any).document_number'
);

content = content.replace(
  'id: p.local_id || p.document_number',
  'id: p.local_id || (p as any).document_number'
);

// 5. Total Services calculation
content = content.replace(
  'const total = cart.reduce((acc, item) => acc + item.editedPrice * item.quantity, 0);',
  `const total = cart.reduce((acc, item) => acc + item.editedPrice * item.quantity, 0);
  const totalServices = cart.filter(i => i.is_service).reduce((acc, item) => acc + item.editedPrice * item.quantity, 0);`
);

// 6. Update formatItemDetail
content = content.replace(
  /      const formatItemDetail = \(i: CartItem\): string => {[\s\S]*?      };/,
  `      const formatItemDetail = (i: CartItem): string => {
        if (i.is_service) {
          return \`\${i.code}: \${i.name} — S/ \${i.editedPrice.toFixed(2)}\`;
        }
        return \`\${i.code} \${i.name} — \${i.quantity}m × S/ \${i.editedPrice.toFixed(2)}\`;
      };`
);

// 7. Cart Footer
content = content.replace(
  /            \{\/\* Footer Cart \*\/\}[\s\S]*?              \}\)/,
  `            {/* Footer Cart */}
            <div className="p-3 border-t border-border bg-card shadow-[0_-8px_30px_rgba(0,0,0,0.06)] shrink-0">
              {/* Botones de Servicios de Acceso Rápido */}
              {quickAccessServices.length > 0 && (
                <div className="mb-2 flex gap-2">
                  {quickAccessServices.slice(0, 2).map((service) => {
                    const isAdded = cart.some((i) => i.id === service.id);
                    return (
                      <Button
                        key={service.id}
                        onClick={() => handleOpenService(service)}
                        variant="outline"
                        className={\`flex-1 h-11 border-dashed border-2 font-bold text-xs flex items-center justify-center gap-2 transition-colors \${
                          isAdded
                            ? "border-primary/50 text-primary bg-primary/10 hover:bg-primary/20"
                            : "hover:bg-primary/5 hover:text-primary"
                        }\`}
                      >
                        <Scissors className="w-3.5 h-3.5" />
                        {isAdded ? \`EDITAR \${service.name}\` : \`+ \${service.name}\`}
                      </Button>
                    );
                  })}
                </div>
              )}
              {cart.length > 0 && (
                <div className="space-y-1 mb-2">
                  <div className="flex justify-between items-center text-muted-foreground font-bold">
                    <span className="text-xs">SUBTOTAL</span>
                    <span className="text-sm">S/ {total.toFixed(2)}</span>
                  </div>
                  <Separator className="opacity-40" />
                  <div className="flex justify-between items-center text-xl font-black font-mono">
                    <span>TOTAL</span>
                    <div className="flex flex-col items-end">
                      <span className="text-emerald-500">S/ {total.toFixed(2)}</span>
                      {totalServices > 0 && (
                        <span className="text-xs font-sans text-muted-foreground font-normal">
                          Incluye S/ {totalServices.toFixed(2)} en servicios.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}`
);

// 8. OtherServices Button in layout
content = content.replace(
  /                  \{totalFamilyPages > 1 && \(/,
  `                  {otherServices.length > 0 && (
                    <Button 
                      onClick={() => setIsOtherServicesModalOpen(true)}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 gap-2 shadow-sm rounded-xl"
                    >
                      ✨ Servicios
                    </Button>
                  )}
                  {totalFamilyPages > 1 && (`
);

// 9. Replace old modals at bottom
content = content.replace(
  /      \{\/\* Modal: Confección \*\/\}[\s\S]*?      \{\/\* Modal: Taxi \*\/\}[\s\S]*?      \{\/\* Exit guard/,
  `      {/* ════════════════════════════════════════
          MODAL DE SERVICIO — Dinámico
          ════════════════════════════════════════ */}
      {isServiceModalOpen && activeService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="w-full max-w-[400px] bg-card rounded-3xl shadow-2xl border-2 border-primary/30 flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 border-b border-border bg-primary/5 text-center">
              <div className="flex items-center justify-center gap-2">
                <Scissors className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-black uppercase text-primary">{activeService.name}</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Ingresa el precio del servicio</p>
            </div>

            {/* Display del precio */}
            <div className="px-4 pt-3 pb-2">
              <div className="bg-background border-2 border-primary/50 rounded-2xl p-3 text-center">
                <div className="text-xs font-bold text-muted-foreground uppercase mb-1">Precio del Servicio</div>
                <div className="text-4xl font-black text-primary font-mono">
                  S/ {servicePriceInput || "0"}
                </div>
              </div>
            </div>

            {/* Teclado numérico simple */}
            <div className="px-4 pb-2 grid grid-cols-3 gap-1.5">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                <button key={num}
                  onClick={() => handleServiceNumpadKey(num)}
                  className="h-10 text-2xl font-black rounded-xl bg-secondary/50 border-2 border-transparent hover:border-primary active:bg-primary active:text-white transition-colors touch-manipulation">
                  {num}
                </button>
              ))}
              <button
                onClick={() => handleServiceNumpadKey(".")}
                className="h-10 text-2xl font-black rounded-xl bg-secondary/50 border-2 border-transparent hover:border-primary active:bg-primary active:text-white transition-colors touch-manipulation">
                .
              </button>
              <button
                onClick={() => handleServiceNumpadKey("0")}
                className="h-10 text-2xl font-black rounded-xl bg-secondary/50 border-2 border-transparent hover:border-primary active:bg-primary active:text-white transition-colors touch-manipulation">
                0
              </button>
              <button
                onClick={() => handleServiceNumpadKey("DEL")}
                className="h-10 flex items-center justify-center rounded-xl bg-red-500/10 text-red-500 border-2 border-transparent active:bg-red-500 active:text-white transition-colors touch-manipulation">
                <Delete className="w-5 h-5" />
              </button>
            </div>

            {/* Acciones */}
            <div className="px-4 pb-4 pt-1 flex gap-3">
              <Button variant="outline" className="flex-1 h-12 font-bold rounded-2xl"
                onClick={() => { setIsServiceModalOpen(false); setServicePriceInput(""); setActiveService(null); }}>
                Cancelar
              </Button>
              <Button
                className="flex-[2] h-12 text-base font-black rounded-2xl bg-primary hover:bg-primary/90 text-white"
                onClick={handleConfirmService}
                disabled={!servicePriceInput || parseFloat(servicePriceInput) <= 0}>
                {cart.find((i) => i.id === activeService.id) ? "Actualizar" : "Agregar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          MODAL DE OTROS SERVICIOS
          ════════════════════════════════════════ */}
      <Dialog open={isOtherServicesModalOpen} onOpenChange={setIsOtherServicesModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border p-0 overflow-hidden">
          <div className="p-4 bg-secondary/20 border-b border-border">
            <DialogTitle className="text-xl font-black text-center flex items-center justify-center gap-2">
              ✨ Servicios Adicionales
            </DialogTitle>
            <p className="text-center text-sm text-muted-foreground mt-1">Selecciona un servicio para agregarlo al ticket</p>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
            {otherServices.map((service) => {
              const isAdded = cart.some((i) => i.id === service.id);
              return (
                <button
                  key={service.id}
                  onClick={() => handleOpenService(service)}
                  className={\`flex flex-col items-center justify-center p-4 border-2 rounded-xl transition-all cursor-pointer active:scale-95 \${
                    isAdded 
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 shadow-sm"
                      : "border-border bg-background hover:border-primary/50 hover:bg-primary/5"
                  }\`}
                >
                  <Scissors className={\`w-6 h-6 mb-2 \${isAdded ? "text-emerald-500" : "text-muted-foreground"}\`} />
                  <span className="font-bold text-sm text-center line-clamp-2 leading-tight uppercase">
                    {service.name}
                  </span>
                  {isAdded && (
                    <span className="text-[10px] uppercase font-bold mt-1 bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                      Agregado
                    </span>
                  )}
                </button>
              );
            })}
            {otherServices.length === 0 && (
              <div className="col-span-2 text-center py-8 text-muted-foreground">
                No hay otros servicios disponibles.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Exit guard`
);

fs.writeFileSync('app/pos/page.tsx', content);
