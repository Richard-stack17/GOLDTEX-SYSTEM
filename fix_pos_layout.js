const fs = require('fs');
let code = fs.readFileSync('apps/web/app/pos/page.tsx', 'utf8');

// 1. Change line 492: <div className="flex h-screen bg-background">
code = code.replace(
  '<div className="flex h-screen bg-background">',
  '<div className="flex flex-col lg:flex-row h-[100dvh] bg-background text-foreground overflow-hidden">'
);

// 2. Change Right Panel line 688: <div className="w-[460px] flex flex-col h-full bg-surface shadow-xl z-20 shrink-0 border-l border-border">
code = code.replace(
  '<div className="w-[460px] flex flex-col h-full bg-surface shadow-xl z-20 shrink-0 border-l border-border">',
  '<div className="w-full lg:w-[460px] flex flex-col h-[50dvh] lg:h-full bg-surface shadow-xl z-20 shrink-0 border-t lg:border-t-0 lg:border-l border-border">'
);

// 3. Move Numpad block
const numpadStart = code.indexOf('{numpadProduct && (');
const numpadEnd = code.indexOf(')}', numpadStart + 1000) + 2; // Approximate end, wait, better use regex or substring
// Let's find exactly `      {numpadProduct && (\n        <div className="fixed inset-0 ...` up to `      )}\n`
const numpadBlockMatch = code.match(/ {6}\{numpadProduct && \(\n[\s\S]+? {6}\)\}\n/);
if (!numpadBlockMatch) throw new Error("Could not find numpadBlock");
const numpadBlock = numpadBlockMatch[0];

// Remove it from the end
code = code.replace(numpadBlock, '');

// Adapt Numpad Block for inline display
let newNumpadBlock = numpadBlock
  .replace('<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">', '<div className="flex flex-col justify-center items-center p-4 bg-background h-full overflow-auto">')
  .replace('<div className="w-full max-w-[540px] bg-card rounded-3xl shadow-2xl border-2 border-border/50 flex flex-col animate-in zoom-in-95 duration-200">', '<div className="w-full max-w-[540px] bg-card rounded-3xl border-2 border-border/50 flex flex-col animate-in zoom-in-95 duration-200">');

// 4. Wrap Catalog Grid
const catalogStartStr = '{/* Catalog Grid */}\n        <div className="flex-1 overflow-auto bg-secondary/10 flex flex-col">';
const catalogEndStr = '            </div>\n          )}\n        </div>'; // Ends at line 682
const catalogStartIndex = code.indexOf(catalogStartStr);

// We need to replace:
// <div className="flex-1 overflow-auto bg-secondary/10 flex flex-col">
// with:
// <div className={`flex-1 overflow-auto bg-secondary/10 flex ${numpadProduct ? 'flex-col lg:grid lg:grid-cols-2' : 'flex-col'}`}>
//   <div className={`flex flex-col h-full overflow-auto ${numpadProduct ? 'hidden lg:flex border-r border-border' : ''}`}>

code = code.replace(
  '<div className="flex-1 overflow-auto bg-secondary/10 flex flex-col">',
  '<div className={`flex-1 overflow-auto bg-secondary/10 flex ${numpadProduct ? "flex-col lg:grid lg:grid-cols-2" : "flex-col"}`}>\n          <div className={`flex flex-col h-full overflow-auto ${numpadProduct ? "hidden lg:flex border-r border-border" : ""}`}>'
);

// Close the wrapper and add numpadBlock
// Search for the end of the Catalog Grid
// It is right before:
//       </div>
//
//       {/* ════════════════════════════════════════
//           RIGHT PANEL
const rightPanelStartStr = '{/* ════════════════════════════════════════\n          RIGHT PANEL';
const rightPanelIndex = code.indexOf(rightPanelStartStr);

// Find the last </div> before rightPanelIndex
const beforeRightPanel = code.substring(0, rightPanelIndex);
const lastDivIndex = beforeRightPanel.lastIndexOf('</div>');

const insertion = `</div>\n${newNumpadBlock}        </div>\n\n      `;
code = code.substring(0, lastDivIndex) + insertion + code.substring(rightPanelIndex);

fs.writeFileSync('apps/web/app/pos/page.tsx', code);
console.log("POS Layout updated");
