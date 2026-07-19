const fs = require('fs');
let content = fs.readFileSync('app/pos/page.tsx', 'utf8');

content = content.replace(
  '              )}()}\n                      <div className="flex gap-2 mt-2">',
  '              })()}\n                      <div className="flex gap-2 mt-2">'
);

fs.writeFileSync('app/pos/page.tsx', content);
