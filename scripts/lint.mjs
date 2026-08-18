import { spawn } from 'node:child_process';

const folders = ['app', 'components', 'lib', 'types'];
const eslint = 'node_modules/eslint/bin/eslint.js';

for (const folder of folders) {
  const result = await new Promise((resolve) => {
    const child = spawn(process.execPath, ['--max-old-space-size=4096', eslint, folder, '--no-cache'], {
      stdio: 'inherit',
      shell: false,
    });
    child.on('close', (code) => resolve(code ?? 1));
  });
  if (result !== 0) process.exit(result);
}
