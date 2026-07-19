const fs = require('fs');
const content = fs.readFileSync('app/pos/page.tsx', 'utf8');
let depth = 0;
const lines = content.split('\n');
for(let i=0; i<lines.length; i++) {
  const line = lines[i];
  const openDivs = (line.match(/<div/g) || []).length;
  const closeDivs = (line.match(/<\/div>/g) || []).length;
  depth += openDivs - closeDivs;
  if (i > 650 && i < 1100 && (openDivs > 0 || closeDivs > 0)) {
    console.log(`${i+1}: depth=${depth} | ${line.trim()}`);
  }
}
