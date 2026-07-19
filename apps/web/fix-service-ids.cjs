const fs = require('fs');
let content = fs.readFileSync('app/pos/page.tsx', 'utf8');

// 1. Remove SERVICE_IDS declaration
content = content.replace(
  '// IDs de servicios reservados (no son telas, no tienen MTS)\nconst SERVICE_IDS = ["confeccion-item", "taxi-item"] as const;',
  ''
);

// 2. formatItemDetail
content = content.replace(
  '        if (SERVICE_IDS.includes(i.id as any)) {',
  '        if (i.is_service) {'
);

// 3. Render items list
content = content.replace(
  '                          {SERVICE_IDS.includes(item.id as any) && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase font-bold tracking-wider shrink-0">Svc</span>}',
  '                          {item.is_service && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase font-bold tracking-wider shrink-0">Svc</span>}'
);

content = content.replace(
  '                          {SERVICE_IDS.includes(item.id as any) ? (',
  '                          {item.is_service ? ('
);

content = content.replace(
  /                            const isService = SERVICE_IDS\.includes\(item\.id as any\);\n                            if \(isService\) \{\n                              if \(item\.id === "confeccion-item"\) handleOpenConfeccion\(\);\n                              if \(item\.id === "taxi-item"\) handleOpenTaxi\(\);\n                            \} else \{/,
  `                            if (item.is_service) {
                              const svc = localServices.find(s => s.id === item.id);
                              if (svc) handleOpenService(svc);
                            } else {`
);

content = content.replace(
  '  const total = cart.reduce((acc, item) => acc + item.editedPrice * item.quantity, 0);',
  '  const total = cart.reduce((acc, item) => acc + item.editedPrice * item.quantity, 0);\n  const totalServices = cart.filter(i => i.is_service).reduce((acc, item) => acc + item.editedPrice * item.quantity, 0);'
);

// also fix handleOpenService and handleConfirmService syntax if not already done, but we did that!

fs.writeFileSync('app/pos/page.tsx', content);
