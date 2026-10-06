import XLSX from "xlsx";
import mongoose from "mongoose";
import WhatsappCampaign from "./whatsappCampaign.model.js";
import BusinessListing from "../../model/businessListingSchema.js";
import PropertiesListing from "../../model/propertiesListingSchema.js";
import MarketplaceListing from "../../model/marketplaceListingSchema.js";
import JobsListing from "../../model/jobsListingSchema.js";
import User from "../../model/userSchema.js";
import "../../model/CitiesSchema.js"; // ensures 'City' model is registered for populate
import WhatsappAccount from "../whatsapp/whatsappAccount.model.js";
import {
  sendTextMessage,
  sendMediaMessage,
} from "../whatsapp/services/whatsappMessage.js";
import { normalizeToE164 } from "../whatsapp/phoneUtils.js";

// In-memory campaign control states: 'running' | 'pausing' | 'cancelling'
const activeCampaignControllers = new Map();

/**
 * Utility sleep helper
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generates an Excel sample file for download
 */
export function generateSampleExcelBuffer() {
  const sampleData = [
    {
      "Business Name": "Al Barsha Luxury Real Estate",
      "Contact Person Name": "Mohammed Al Hashimi",
      "Country Code": "+971",
      "Mobile Number": "501234567",
      City: "Dubai",
      "Custom Note": "Special 20% discount on Featured Plan",
    },
    {
      "Business Name": "Gulf Car Rental & Leasing",
      "Contact Person Name": "Rashid Khan",
      "Country Code": "+971",
      "Mobile Number": "559876543",
      City: "Abu Dhabi",
      "Custom Note": "Upgrade to Verified Business to get 3x leads",
    },
    {
      "Business Name": "Emirates Tech Solutions",
      "Contact Person Name": "Sarah Jenkins",
      "Country Code": "+971",
      "Mobile Number": "523456789",
      City: "Sharjah",
      "Custom Note": "Explore AddressGuru enterprise packages",
    },
    {
      "Business Name": "Deira Dental Clinic",
      "Contact Person Name": "Dr. Tariq Mahmood",
      "Country Code": "+971",
      "Mobile Number": "581122334",
      City: "Dubai",
      "Custom Note": "Boost patient inquiries this month",
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);

  // Auto-fit column widths
  const columnWidths = [
    { wch: 32 }, // Business Name
    { wch: 24 }, // Contact Person Name
    { wch: 14 }, // Country Code
    { wch: 18 }, // Mobile Number
    { wch: 16 }, // City
    { wch: 45 }, // Custom Note
  ];
  worksheet["!cols"] = columnWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "WhatsApp Contacts");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

/**
 * Parses uploaded Excel / CSV buffer into normalized contact list
 */
export function parseExcelContacts(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("Uploaded spreadsheet contains no sheets");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (!rawRows || rawRows.length === 0) {
    throw new Error("The uploaded sheet is empty");
  }

  const contacts = [];
  const seenPhones = new Set();

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];

    // Fuzzy field matching
    const businessName =
      row["Business Name"] ||
      row["businessName"] ||
      row["Business"] ||
      row["Company"] ||
      row["Company Name"] ||
      "";

    const contactPersonName =
      row["Contact Person Name"] ||
      row["contactPersonName"] ||
      row["Contact Person"] ||
      row["Contact"] ||
      row["Name"] ||
      row["Full Name"] ||
      "";

    let countryCode =
      String(
        row["Country Code"] ||
          row["countryCode"] ||
          row["Code"] ||
          row["Dial Code"] ||
          "+971"
      ).trim();

    if (countryCode && !countryCode.startsWith("+")) {
      countryCode = "+" + countryCode;
    }

    const rawPhone = String(
      row["Mobile Number"] ||
        row["mobileNumber"] ||
        row["Phone"] ||
        row["Mobile"] ||
        row["Phone Number"] ||
        row["WhatsApp Number"] ||
        ""
    ).trim();

    const city =
      row["City"] || row["city"] || row["Emirate"] || row["Location"] || "";

    const email =
      row["Email"] || row["email"] || row["E-mail"] || row["Email Address"] || "";

    if (!rawPhone) continue;

    // Clean phone number
    const cleanedDigits = rawPhone.replace(/[^\d+]/g, "");
    if (!cleanedDigits) continue;

    const normalized = normalizeToE164(countryCode, cleanedDigits);
    const key = normalized || `${countryCode}${cleanedDigits}`;

    if (!seenPhones.has(key)) {
      seenPhones.add(key);
      contacts.push({
        id: `excel_${i}_${cleanedDigits}`,
        name: contactPersonName || businessName || "Valued Partner",
        businessName: String(businessName).trim(),
        contactPersonName: String(contactPersonName).trim(),
        email: String(email).trim(),
        countryCode: countryCode || "+971",
        phone: cleanedDigits,
        city: String(city).trim(),
        sourceModule: "excel",
        status: "pending",
      });
    }
  }

  return contacts;
}

const ROLE_MAP = {
  admin: 1,
  editor: 2,
  agent: 3,
  bde: 4,
  user: 5,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
};

/**
 * Extracts audience contacts from the database matching the criteria
 */
export async function fetchDatabaseAudience({
  modules = ["business", "property", "marketplace", "jobs", "users"],
  role = "all",
  listingStatus = "all",
  city = "all",
  deduplicate = true,
}) {
  const contacts = [];
  const seenPhones = new Set();

  const selectedModules = Array.isArray(modules)
    ? modules
    : [modules].filter(Boolean);

  // Helper to add contact
  const addContact = ({
    name,
    businessName,
    contactPersonName,
    email,
    countryCode,
    phone,
    cityName,
    sourceModule,
    sourceId,
    slug,
    listingUrl,
    claimUrl,
  }) => {
    if (!phone) return;
    const rawDigits = String(phone).replace(/[^\d+]/g, "").trim();
    if (!rawDigits) return;

    let cCode = String(countryCode || "+971").trim();
    if (!cCode.startsWith("+")) cCode = "+" + cCode;

    const normalized = normalizeToE164(cCode, rawDigits);
    const dedupKey = deduplicate ? (normalized || `${cCode}${rawDigits}`) : null;

    if (deduplicate && dedupKey && seenPhones.has(dedupKey)) {
      return;
    }

    if (dedupKey) {
      seenPhones.add(dedupKey);
    }

    const itemSlug = slug || "";
    let itemListingUrl = listingUrl || "";
    let itemClaimUrl = claimUrl || "";

    if (!itemListingUrl && itemSlug) {
      if (sourceModule === "property") {
        itemListingUrl = `https://addressguru.ae/properties/${itemSlug}`;
        itemClaimUrl = `https://addressguru.ae/properties/${itemSlug}?claim=true`;
      } else if (sourceModule === "jobs") {
        itemListingUrl = `https://addressguru.ae/jobs/${itemSlug}`;
        itemClaimUrl = `https://addressguru.ae/jobs/${itemSlug}?claim=true`;
      } else if (sourceModule === "marketplace") {
        itemListingUrl = `https://addressguru.ae/marketplace/${itemSlug}`;
        itemClaimUrl = `https://addressguru.ae/marketplace/${itemSlug}?claim=true`;
      } else {
        itemListingUrl = `https://addressguru.ae/${itemSlug}`;
        itemClaimUrl = `https://addressguru.ae/${itemSlug}?claim=true`;
      }
    } else if (!itemListingUrl) {
      itemListingUrl = "https://addressguru.ae";
      itemClaimUrl = "https://addressguru.ae/dashboard";
    }

    contacts.push({
      id: `${sourceModule}_${sourceId || "item"}_${rawDigits}`,
      name: (contactPersonName || businessName || name || "Valued Partner").trim(),
      businessName: (businessName || "").trim(),
      contactPersonName: (contactPersonName || name || "").trim(),
      email: (email || "").trim(),
      countryCode: cCode,
      phone: rawDigits,
      city: (cityName || "").trim(),
      slug: itemSlug,
      listingUrl: itemListingUrl,
      claimUrl: itemClaimUrl,
      sourceModule,
      sourceId,
      status: "pending",
    });
  };

  // Helper to filter users by role
  const roleFilterMatch = (userDoc) => {
    if (!role || role === "all") return true;
    const targetRole = ROLE_MAP[String(role).toLowerCase()] || Number(role);
    if (!targetRole) return true;
    if (!userDoc || !userDoc.roles) return false;
    const userRoles = Array.isArray(userDoc.roles)
      ? userDoc.roles
      : [userDoc.roles];
    return userRoles.includes(targetRole);
  };

  // Status query helper
  const buildListingQuery = () => {
    const query = { isDeleted: { $ne: true } };
    if (listingStatus === "approved") {
      query.$or = [{ status: "approved" }, { isPublished: true }];
    } else if (listingStatus === "pending") {
      query.status = "pending";
    } else if (listingStatus === "rejected") {
      query.status = "rejected";
    }
    return query;
  };

  // 1. BUSINESS LISTINGS
  if (selectedModules.includes("business")) {
    const query = buildListingQuery();

    const businessDocs = await BusinessListing.find(query)
      .populate("createdBy", "name email roles phone")
      .populate("city", "name")
      .lean();

    for (const doc of businessDocs) {
      if (!roleFilterMatch(doc.createdBy)) continue;

      const cityName = doc.city?.name || doc.cityNameLower || "";
      if (
        city &&
        city !== "all" &&
        !cityName.toLowerCase().includes(city.toLowerCase())
      ) {
        continue;
      }

      const phone =
        doc.mobileNumber || doc.alternateMobileNumber || doc.createdBy?.phone;
      const cCode = doc.countryCode || doc.altCountryCode || "+971";
      const contactEmail = doc.email || doc.createdBy?.email || "";

      addContact({
        name: doc.contactPersonName || doc.businessName,
        businessName: doc.businessName,
        contactPersonName: doc.contactPersonName || doc.createdBy?.name,
        email: contactEmail,
        countryCode: cCode,
        phone,
        cityName,
        slug: doc.slug,
        sourceModule: "business",
        sourceId: doc._id,
      });
    }
  }

  // 2. PROPERTY LISTINGS
  if (selectedModules.includes("property")) {
    const query = buildListingQuery();

    const propertyDocs = await PropertiesListing.find(query)
      .populate("createdBy", "name email roles phone")
      .populate("city", "name")
      .lean();

    for (const doc of propertyDocs) {
      if (!roleFilterMatch(doc.createdBy)) continue;

      const cityName = doc.city?.name || doc.location?.address || "";
      if (
        city &&
        city !== "all" &&
        !cityName.toLowerCase().includes(city.toLowerCase())
      ) {
        continue;
      }

      const phone =
        doc.mobileNumber || doc.alternateMobileNumber || doc.createdBy?.phone;
      const cCode = doc.countryCode || doc.altCountryCode || "+971";
      const contactEmail = doc.email || doc.createdBy?.email || "";

      addContact({
        name: doc.contactPersonName || doc.title,
        businessName: doc.title,
        contactPersonName: doc.contactPersonName || doc.createdBy?.name,
        email: contactEmail,
        countryCode: cCode,
        phone,
        cityName,
        slug: doc.slug,
        sourceModule: "property",
        sourceId: doc._id,
      });
    }
  }

  // 3. MARKETPLACE LISTINGS
  if (selectedModules.includes("marketplace")) {
    const query = buildListingQuery();

    const marketplaceDocs = await MarketplaceListing.find(query)
      .populate("createdBy", "name email roles phone")
      .populate("city", "name")
      .lean();

    for (const doc of marketplaceDocs) {
      if (!roleFilterMatch(doc.createdBy)) continue;

      const cityName = doc.city?.name || doc.locality || doc.address || "";
      if (
        city &&
        city !== "all" &&
        !cityName.toLowerCase().includes(city.toLowerCase())
      ) {
        continue;
      }

      const phone =
        doc.mobileNumber || doc.alternateMobileNumber || doc.createdBy?.phone;
      const cCode = doc.countryCode || doc.altCountryCode || "+971";
      const contactEmail = doc.email || doc.createdBy?.email || "";

      addContact({
        name: doc.contactPersonName || doc.title,
        businessName: doc.title,
        contactPersonName: doc.contactPersonName || doc.createdBy?.name,
        email: contactEmail,
        countryCode: cCode,
        phone,
        cityName,
        slug: doc.slug,
        sourceModule: "marketplace",
        sourceId: doc._id,
      });
    }
  }

  // 4. JOBS LISTINGS
  if (selectedModules.includes("jobs")) {
    const query = buildListingQuery();

    const jobDocs = await JobsListing.find(query)
      .populate("createdBy", "name email roles phone")
      .lean();

    for (const doc of jobDocs) {
      if (!roleFilterMatch(doc.createdBy)) continue;

      const cityName =
        doc.location?.city?.name ||
        doc.company?.city?.name ||
        (doc.localities && doc.localities[0]) ||
        "";
      if (
        city &&
        city !== "all" &&
        !cityName.toLowerCase().includes(city.toLowerCase())
      ) {
        continue;
      }

      const phone =
        doc.mobileNumber ||
        doc.phone ||
        doc.contactPersonNumber ||
        doc.contact?.phone ||
        doc.contact?.whatsapp ||
        doc.createdBy?.phone;
      const cCode =
        doc.countryCode ||
        doc.contactPersonCountryCode ||
        doc.contact?.countryCode ||
        "+971";

      const bName = doc.company?.name || doc.title || "Job Recruiter";
      const contactEmail =
        doc.email ||
        doc.company?.email ||
        doc.contact?.email ||
        doc.createdBy?.email ||
        "";

      addContact({
        name: doc.contactPersonName || doc.contact?.name || bName,
        businessName: bName,
        contactPersonName:
          doc.contactPersonName || doc.contact?.name || doc.createdBy?.name,
        email: contactEmail,
        countryCode: cCode,
        phone,
        cityName,
        slug: doc.slug,
        sourceModule: "jobs",
        sourceId: doc._id,
      });
    }
  }

  // 5. DIRECT USERS
  if (selectedModules.includes("users")) {
    const userQuery = { phone: { $exists: true, $ne: "" } };
    if (role && role !== "all") {
      const targetRole = ROLE_MAP[String(role).toLowerCase()] || Number(role);
      if (targetRole) {
        userQuery.roles = targetRole;
      }
    }

    const userDocs = await User.find(userQuery).lean();

    for (const u of userDocs) {
      const cityName = u.city || "";
      if (
        city &&
        city !== "all" &&
        !cityName.toLowerCase().includes(city.toLowerCase())
      ) {
        continue;
      }

      addContact({
        name: u.name || "AddressGuru Member",
        businessName: "",
        contactPersonName: u.name || "",
        email: u.email || "",
        countryCode: "+971",
        phone: u.phone,
        cityName,
        slug: "",
        sourceModule: "users",
        sourceId: u._id,
      });
    }
  }

  return contacts;
}

/**
 * Replaces dynamic variables in message text
 */
export function renderTemplateVariables(text, recipient) {
  if (!text) return "";
  let rendered = text;

  // Resolve exact URLs for recipient's listing
  const resolvedListingUrl =
    recipient.listingUrl ||
    (recipient.slug
      ? recipient.sourceModule === "property"
        ? `https://addressguru.ae/properties/${recipient.slug}`
        : recipient.sourceModule === "jobs"
        ? `https://addressguru.ae/jobs/${recipient.slug}`
        : recipient.sourceModule === "marketplace"
        ? `https://addressguru.ae/marketplace/${recipient.slug}`
        : `https://addressguru.ae/${recipient.slug}`
      : "https://addressguru.ae");

  const resolvedClaimUrl =
    recipient.claimUrl ||
    (recipient.slug
      ? recipient.sourceModule === "property"
        ? `https://addressguru.ae/properties/${recipient.slug}?claim=true`
        : recipient.sourceModule === "jobs"
        ? `https://addressguru.ae/jobs/${recipient.slug}?claim=true`
        : recipient.sourceModule === "marketplace"
        ? `https://addressguru.ae/marketplace/${recipient.slug}?claim=true`
        : `https://addressguru.ae/${recipient.slug}?claim=true`
      : "https://addressguru.ae/dashboard");

  const replacements = {
    "{{name}}": recipient.name || recipient.contactPersonName || "Valued Partner",
    "{{contactPerson}}": recipient.contactPersonName || recipient.name || "Valued Partner",
    "{{contactPersonName}}": recipient.contactPersonName || recipient.name || "Valued Partner",
    "{{businessName}}": recipient.businessName || recipient.name || "Your Business",
    "{{phone}}": recipient.phone || "",
    "{{city}}": recipient.city || "UAE",
    "{{countryCode}}": recipient.countryCode || "+971",
    "{{listingUrl}}": resolvedListingUrl,
    "{{claimUrl}}": resolvedClaimUrl,
    "{{dashboardUrl}}": "https://addressguru.ae/dashboard",
    "{{plansUrl}}": "https://addressguru.ae/plans",
  };

  for (const [key, val] of Object.entries(replacements)) {
    const regex = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    rendered = rendered.replace(regex, val);
  }

  return rendered;
}

/**
 * Helper: Interruptible sleep that checks abort condition every 100ms
 */
async function interruptibleSleep(ms, isAbortedCheck) {
  const checkInterval = 100;
  const startTime = Date.now();
  while (Date.now() - startTime < ms) {
    if (isAbortedCheck()) return false;
    const remaining = ms - (Date.now() - startTime);
    await sleep(Math.min(checkInterval, remaining));
    if (isAbortedCheck()) return false;
  }
  return !isAbortedCheck();
}

/**
 * Background runner that executes a WhatsApp campaign with Anti-Ban algorithms
 */
export async function executeCampaign(campaignId) {
  const campaign = await WhatsappCampaign.findById(campaignId);
  if (!campaign) {
    throw new Error("Campaign not found");
  }

  // Verify Baileys is connected
  const connectedAccount = await WhatsappAccount.findOne({
    status: "connected",
  });
  if (!connectedAccount) {
    campaign.status = "failed";
    campaign.errorMessage =
      "WhatsApp is not connected on the server. Please scan QR in the header.";
    await campaign.save();
    throw new Error(campaign.errorMessage);
  }

  // Mark campaign as running
  campaign.status = "running";
  if (!campaign.startedAt) {
    campaign.startedAt = new Date();
  }
  campaign.pausedAt = null;
  campaign.errorMessage = null;
  await campaign.save();

  activeCampaignControllers.set(campaignId.toString(), "running");

  // Run in background without blocking API request
  (async () => {
    try {
      const minDelayMs =
        (campaign.antiBanSettings?.minDelaySeconds || 3) * 1000;
      const maxDelayMs =
        (campaign.antiBanSettings?.maxDelaySeconds || 20) * 1000;
      const batchSize = campaign.antiBanSettings?.batchSize || 50;
      const batchCooldownMs =
        (campaign.antiBanSettings?.batchCooldownSeconds || 60) * 1000;

      let processedCountInCurrentRun = 0;

      const isAborted = () => {
        const state = activeCampaignControllers.get(campaignId.toString());
        return state === "pausing" || state === "paused" || state === "cancelled" || state === "cancelling";
      };

      for (let i = 0; i < campaign.recipients.length; i++) {
        // Immediate check before processing
        if (isAborted()) {
          const state = activeCampaignControllers.get(campaignId.toString());
          console.log(`[WhatsAppBulk] ⏸️ Campaign ${campaignId} ${state} by admin. Stopping immediately.`);
          await WhatsappCampaign.findByIdAndUpdate(campaignId, {
            status: state === "cancelled" || state === "cancelling" ? "cancelled" : "paused",
            pausedAt: new Date(),
            lastProcessedIndex: i,
          });
          return;
        }

        // Also check DB status every 3 messages in case of external signal
        if (i % 3 === 0) {
          const freshDoc = await WhatsappCampaign.findById(campaignId, { status: 1 }).lean();
          if (freshDoc && (freshDoc.status === "paused" || freshDoc.status === "cancelled")) {
            console.log(`[WhatsAppBulk] ⏸️ Campaign ${campaignId} found as ${freshDoc.status} in DB. Halting immediately.`);
            activeCampaignControllers.set(campaignId.toString(), freshDoc.status);
            return;
          }
        }

        const recipient = campaign.recipients[i];
        if (recipient.status !== "pending") {
          continue; // skip already sent/failed
        }

        // Prepare personalized message
        const renderedText = renderTemplateVariables(
          campaign.messageText,
          recipient
        );
        recipient.renderedMessage = renderedText;

        try {
          let sentRes;
          if (campaign.messageType !== "text" && campaign.mediaUrl) {
            // Media message with optional caption
            sentRes = await sendMediaMessage({
              to: recipient.phone,
              countryCode: recipient.countryCode,
              text: renderedText,
              mediaUrl: campaign.mediaUrl,
              messageType: campaign.messageType,
            });
          } else {
            // Plain text message
            sentRes = await sendTextMessage({
              to: recipient.phone,
              countryCode: recipient.countryCode,
              text: renderedText,
            });
          }

          recipient.status = "sent";
          recipient.sentAt = new Date();
          recipient.waMessageId = sentRes?.waMessageId || sentRes?._id?.toString() || "sent";
          recipient.errorReason = null;
        } catch (err) {
          console.error(
            `[WhatsAppBulk] Failed to send to ${recipient.phone}:`,
            err.message
          );
          recipient.status = "failed";
          recipient.errorReason = err.message || "Failed to deliver message";
          recipient.retryCount = (recipient.retryCount || 0) + 1;
        }

        processedCountInCurrentRun++;

        // Update DB document after each send
        campaign.updateStats();
        campaign.lastProcessedIndex = i;
        await campaign.save();

        // Check if pause was triggered while message was being sent
        if (isAborted()) {
          const state = activeCampaignControllers.get(campaignId.toString());
          console.log(`[WhatsAppBulk] ⏸️ Campaign ${campaignId} ${state} immediately after sending contact index ${i}.`);
          await WhatsappCampaign.findByIdAndUpdate(campaignId, {
            status: state === "cancelled" || state === "cancelling" ? "cancelled" : "paused",
            pausedAt: new Date(),
            lastProcessedIndex: i + 1,
          });
          return;
        }

        // Check if more recipients are pending
        const hasMorePending = campaign.recipients
          .slice(i + 1)
          .some((r) => r.status === "pending");

        if (!hasMorePending) {
          break;
        }

        // Anti-Ban 1: Batch Cooldown Pause after every batchSize numbers
        if (processedCountInCurrentRun % batchSize === 0) {
          console.log(
            `[WhatsAppBulk] Anti-Ban batch milestone reached (${processedCountInCurrentRun} messages). Cooling down for ${
              batchCooldownMs / 1000
            }s...`
          );
          const survivedCooldown = await interruptibleSleep(batchCooldownMs, isAborted);
          if (!survivedCooldown) {
            console.log(`[WhatsAppBulk] ⏸️ Campaign ${campaignId} interrupted during batch cooldown.`);
            await WhatsappCampaign.findByIdAndUpdate(campaignId, {
              status: "paused",
              pausedAt: new Date(),
              lastProcessedIndex: i + 1,
            });
            return;
          }
        } else {
          // Anti-Ban 2: Random Jitter Delay (3s to 20s) with 100ms interrupt check
          const jitterDelay =
            Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1)) +
            minDelayMs;
          console.log(
            `[WhatsAppBulk] Anti-Ban Jitter: Waiting ${(
              jitterDelay / 1000
            ).toFixed(1)}s before next contact...`
          );
          const survivedJitter = await interruptibleSleep(jitterDelay, isAborted);
          if (!survivedJitter) {
            console.log(`[WhatsAppBulk] ⏸️ Campaign ${campaignId} interrupted during jitter delay.`);
            await WhatsappCampaign.findByIdAndUpdate(campaignId, {
              status: "paused",
              pausedAt: new Date(),
              lastProcessedIndex: i + 1,
            });
            return;
          }
        }
      }

      // Mark campaign completed
      const finalDoc = await WhatsappCampaign.findById(campaignId);
      if (finalDoc && finalDoc.status === "running") {
        finalDoc.status = "completed";
        finalDoc.completedAt = new Date();
        finalDoc.updateStats();
        await finalDoc.save();
        console.log(`[WhatsAppBulk] Campaign ${campaignId} completed successfully!`);
      }
    } catch (fatalErr) {
      console.error(`[WhatsAppBulk] Fatal error in campaign ${campaignId}:`, fatalErr);
      await WhatsappCampaign.findByIdAndUpdate(campaignId, {
        status: "failed",
        errorMessage: fatalErr.message || "Unknown error during campaign execution",
      });
    } finally {
      activeCampaignControllers.delete(campaignId.toString());
    }
  })();

  return campaign;
}

/**
 * Pause a running campaign
 */
export async function pauseCampaign(campaignId) {
  const campaign = await WhatsappCampaign.findById(campaignId);
  if (!campaign) throw new Error("Campaign not found");

  if (campaign.status !== "running") {
    throw new Error(`Cannot pause campaign with status "${campaign.status}"`);
  }

  activeCampaignControllers.set(campaignId.toString(), "paused");
  campaign.status = "paused";
  campaign.pausedAt = new Date();
  await campaign.save();
  return campaign;
}

/**
 * Resume a paused campaign
 */
export async function resumeCampaign(campaignId) {
  const campaign = await WhatsappCampaign.findById(campaignId);
  if (!campaign) throw new Error("Campaign not found");

  if (campaign.status !== "paused" && campaign.status !== "draft") {
    throw new Error(`Cannot resume campaign with status "${campaign.status}"`);
  }

  activeCampaignControllers.set(campaignId.toString(), "running");
  campaign.status = "running";
  campaign.pausedAt = null;
  await campaign.save();

  return executeCampaign(campaignId);
}

/**
 * Cancel/Stop a campaign
 */
export async function cancelCampaign(campaignId) {
  const campaign = await WhatsappCampaign.findById(campaignId);
  if (!campaign) throw new Error("Campaign not found");

  activeCampaignControllers.set(campaignId.toString(), "cancelling");
  campaign.status = "cancelled";
  campaign.completedAt = new Date();
  await campaign.save();
  return campaign;
}

/**
 * Reset failed recipients to pending and restart campaign
 */
export async function retryFailedRecipients(campaignId) {
  const campaign = await WhatsappCampaign.findById(campaignId);
  if (!campaign) throw new Error("Campaign not found");

  let failedCount = 0;
  for (const r of campaign.recipients) {
    if (r.status === "failed") {
      r.status = "pending";
      r.errorReason = null;
      failedCount++;
    }
  }

  if (failedCount === 0) {
    throw new Error("No failed recipients to retry");
  }

  campaign.updateStats();
  campaign.status = "draft";
  await campaign.save();

  return executeCampaign(campaignId);
}
