import { startExtensionSupervisor } from './dist/index.js';

const supervisor = await startExtensionSupervisor(process.env.PLENUM_EXTENSION_SOCKET ?? '/run/plenum-extension/host.sock',
  process.env.PLENUM_EXTENSION_STAGING ?? '/var/lib/plenum-extension');
let closing = false;
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, async () => {
  if (closing) return;
  closing = true;
  await supervisor.close();
});
