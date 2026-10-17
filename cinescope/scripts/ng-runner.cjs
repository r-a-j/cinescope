const { spawnSync } = require('child_process');

// Strip standalone '--' arguments forwarded by pnpm when invoked via VS Code WebNative extension
const forwardedArgs = process.argv.slice(2).filter((arg) => arg !== '--');

const result = spawnSync('npx', ['ng', ...forwardedArgs], {
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 0);
