// brokenlinkscanner.cron.js
import cron from "node-cron";
import runScanner from "./brokenlinkscanner.service.js";

let isScanRunning = false;

// runs every day at 3 AM server time — change the pattern if you want a different schedule
export function startBrokenLinkCron() {
  console.log("✅ Cron scheduler initialized");

  cron.schedule("0 3 * * *", async () => {
    if (isScanRunning) {
      console.log("Skipping cron run: scan already in progress");
      return;
    }

    isScanRunning = true;
    console.log(
      "⏰ Cron: starting broken link scan at",
      new Date().toISOString(),
    );

    try {
      await runScanner();
      console.log("✅ Cron: scan completed");
    } catch (err) {
      console.error("❌ Cron scan failed:", err);
    } finally {
      isScanRunning = false;
    }
  });
}
