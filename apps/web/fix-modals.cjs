const fs = require('fs');
let content = fs.readFileSync('app/pos/page.tsx', 'utf8');

// The regex will find from "{/* Modal: Confección */}" to just before "{/* Exit guard"
content = content.replace(
  /      \{\/\* Modal: Confección \*\/\}[\s\S]*?      \{\/\* Exit guard/,
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
