import runScanner, { cancelScanner } from "./brokenlinkscanner.service.js";
import BrokenLinkScanner from "./brokernlinkscanner.model.js";

let isScanRunning = false;

// POST /api/broken-links/scan - trigger a scan manually
export const triggerScan = async (req, res) => {
  if (isScanRunning) {
    return res
      .status(409)
      .json({ success: false, message: "A scan is already running" });
  }

  isScanRunning = true;

  // respond immediately, run scan in background
  res.status(202).json({ success: true, message: "Scan started" });

  try {
    await runScanner();
  } catch (err) {
    console.log("Scan failed:", err.message);
  } finally {
    isScanRunning = false;
  }
};

// POST /api/broken-links/stop - stop scanning
export const stopScan = (req, res) => {
  cancelScanner();
  isScanRunning = false;
  res.status(200).json({ success: true, message: "Scan stop requested" });
};

// GET /api/broken-links - list all broken links found in the last run
export const getBrokenLinks = async (req, res) => {
  try {
    const brokenLinks = await BrokenLinkScanner.find().sort({ createdAt: -1 });
    res
      .status(200)
      .json({ success: true, count: brokenLinks.length, data: brokenLinks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/broken-links/status - is a scan currently running
export const getScanStatus = (req, res) => {
  res.status(200).json({ success: true, isScanRunning });
};
