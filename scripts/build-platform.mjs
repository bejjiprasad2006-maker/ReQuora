import { build } from 'esbuild';
import { mkdir, cp } from 'node:fs/promises';
await mkdir('dist/platform',{recursive:true});
await build({entryPoints:['src/platform/server.ts'],outfile:'dist/platform/server.mjs',bundle:true,platform:'node',format:'esm',packages:'external',target:'node24',sourcemap:true});
await cp('src/platform/public','dist/platform/public',{recursive:true});
console.log('Authenticated workspace built: dist/platform/server.mjs');
