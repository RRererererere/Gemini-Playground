const fs = require('fs');
const code = fs.readFileSync('app/page.tsx', 'utf8');
const lines = code.split('\n');

let depth = 0;
let inString = false;
let inComment = false;

for (let i = 1098; i <= 1640; i++) {
  const line = lines[i-1];
  let lineDepth = 0;
  
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    const prev = j > 0 ? line[j-1] : '';
    
    // Skip strings and comments (simplified)
    if (char === '/' && line[j+1] === '/') break;
    if (char === '/' && line[j+1] === '*') { inComment = true; continue; }
    if (inComment && char === '*' && line[j+1] === '/') { inComment = false; j++; continue; }
    if (inComment) continue;
    
    if (char === '{') { depth++; lineDepth++; }
    if (char === '}') { depth--; lineDepth--; }
  }
  
  if (lineDepth !== 0 || i === 1099 || i === 1639) {
    console.log(`Line ${i}: depth=${depth} change=${lineDepth} - ${line.trim().substring(0, 80)}`);
  }
}

console.log(`\nFinal depth: ${depth}`);
