import connectDB from "./config/connectDB.js";
import { startConnection, getStatus, getQr } from "./modules/whatsapp/services/whatsappClient.js";

async function testBaileys() {
  await connectDB();
  console.log("DB connected, checking WhatsApp status...");
  const status = await getStatus();
  console.log("Current status:", status);

  try {
    console.log("Calling startConnection()...");
    await startConnection();
    console.log("startConnection returned!");
  } catch (err) {
    console.error("startConnection ERROR:", err);
  }
}

testBaileys();
