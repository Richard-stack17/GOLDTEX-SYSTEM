const fs = require('fs');

const transcriptPath = '/Users/jhonramos151/.gemini/antigravity-ide/brain/eeaf9216-ce54-4543-bc03-6d917207441b/.system_generated/logs/transcript_full.jsonl';
const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');
let recovered = "";

for(let i=lines.length-1; i>=0; i--){
  if(!lines[i].trim()) continue;
  try {
    const step = JSON.parse(lines[i]);
    if(step.type === 'ACTION_RESPONSE' && step.content) {
      if(step.content.includes('File Path: `file:///Users/jhonramos151/Downloads/SISTEMA_GOLTEX/goltex-platform/apps/web/app/pos/page.tsx`')) {
        console.log("Found view_file output at step " + step.step_index);
        break;
      }
    }
  } catch(e) {}
}
