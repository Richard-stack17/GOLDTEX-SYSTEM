const fs = require('fs');
const content = fs.readFileSync('app/pos/page.tsx', 'utf8');

let text = content.substring(content.indexOf('return ('));

let tags = [];
let regex = /<\/?([A-Za-z0-9]+)[^>]*>/g;
let match;
while ((match = regex.exec(text)) !== null) {
  let fullTag = match[0];
  let tagName = match[1];
  if (fullTag.endsWith('/>') || fullTag.endsWith('/ >')) continue; // Self-closing
  if (fullTag.startsWith('</')) {
    let last = tags.pop();
    if (last && last.name !== tagName) {
      console.log(`Mismatch! Opened ${last.name} but closed ${tagName}`);
    }
  } else {
    tags.push({name: tagName, index: match.index});
  }
}

console.log("Unclosed tags:", tags.map(t => t.name));

