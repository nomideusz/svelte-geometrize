import { chmodSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const cli = join(import.meta.dirname, '..', 'dist', 'cli.js');
if (existsSync(cli)) chmodSync(cli, 0o755);
