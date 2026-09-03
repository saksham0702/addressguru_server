// modules/whatsapp/services/whatsappIdentityService.js
import mongoose from "mongoose";
import BusinessListing from "../../../model/businessListingSchema.js";
import PropertyListing from "../../../model/propertiesListingSchema.js";
import MarketplaceListing from "../../../model/marketplaceListingSchema.js";
import Job from "../../../model/jobsListingSchema.js";
import { tail } from "../phoneUtils.js";

// Adjust these import paths above if your models folder is located elsewhere.

/**
 * Given a normalized phone number, tries to match it against existing
 * User + Listing/Job records using THEIR existing mobile number fields.
 * Never creates or duplicates phone data — read-only lookups.
 *
 * Matching is done on the last 9 digits to tolerate inconsistent country-code
 * formatting (e.g. "00971..." vs "971..." vs "+971...") between records.
 */
export async function identifyByPhone(phone) {
  const result = {
    user: null,
    businessListing: null,
    propertyListing: null,
    marketplaceListing: null,
    job: null,
  };

  if (!phone) return result;
  const last9 = tail(phone, 9);
  if (!last9) return result;
  const suffix = new RegExp(`${last9}$`);

  // ── User — best effort. Adjust field names to match your actual User schema. ──
  try {
    const User = mongoose.model("User");
    result.user = await User.findOne({
      $or: [
        { mobileNumber: suffix },
        { phone: suffix },
        { "contact.phone": suffix },
      ],
    }).select("_id name email mobileNumber");
  } catch (e) {
    // "User" model not registered under this name in this project — skip silently.
  }

  const listingMatch = {
    $or: [{ mobileNumber: suffix }, { alternateMobileNumber: suffix }],
    isDeleted: { $ne: true },
  };

  const [businessListing, propertyListing, marketplaceListing, job] =
    await Promise.all([
      BusinessListing.findOne(listingMatch).select(
        "_id businessName createdBy",
      ),
      PropertyListing.findOne(listingMatch).select("_id title createdBy"),
      MarketplaceListing.findOne(listingMatch).select("_id title createdBy"),
      Job.findOne({
        $or: [{ "contact.phone": suffix }, { "contact.whatsapp": suffix }],
        isDeleted: { $ne: true },
      }).select("_id title createdBy"),
    ]);

  result.businessListing = businessListing;
  result.propertyListing = propertyListing;
  result.marketplaceListing = marketplaceListing;
  result.job = job;

  return result;
}
