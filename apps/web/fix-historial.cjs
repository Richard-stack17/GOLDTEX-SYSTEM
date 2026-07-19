const fs = require('fs');
let content = fs.readFileSync('app/historial-proformas/page.tsx', 'utf8');

content = content.replace(
  '  transactions?: any[];\n  total?: number;\n};',
  '  transactions?: any[];\n};'
);

fs.writeFileSync('app/historial-proformas/page.tsx', content);
