

import { createApp } from './server.js';
const PORT = process.env.PORT || 3000;
const { app, server } = await createApp();
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
const { ACCESS_SECRET, REFRESH_SECRET } = process.env
console.log({ ACCESS_SECRET, REFRESH_SECRET, port: process.env.PORT, dburi: process.env.MONGO_URI });
process.on('SIGINT', async () => {
  console.log('\n🛑 Gracefully shutting down...');
  try {
    server.close(() => {
      console.log('✅ Shutdown complete.');
      process.exit(0);
    });
  } catch (err) {
    console.error('❌ Error during shutdown:', err);
    process.exit(1);
  }
});