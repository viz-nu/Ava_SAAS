// import cron from "node-cron";
// // import { syncWithDB } from "./JobsQueue.js";
// import { connectDB } from "./dbConnect.js";


// export let isSyncRunning = false;

// export const safeSync = async ()=> {
//     if (isSyncRunning) {
//         console.log("⚠️ Sync already in progress, skipping this run");
//         return;
//     }
//     isSyncRunning = true;
//     await connectDB()
//     try {
//         console.log("🔄 Running DB sync...");
//         await syncWithDB();
//         console.log("✅ DB sync completed");
//     } catch (err) {
//         console.error("❌ Sync error:", err);
//     } finally {
//         isSyncRunning = false;
//     }
// }

// // Run at startup
// await safeSync();

// // Schedule every 6 hours
// cron.schedule("0 */6 * * *", safeSync);
