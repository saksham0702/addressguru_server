// utils/resolvelisting.js
import BusinessListing from "../model/businessListingSchema.js";
import Job             from "../model/jobsListingSchema.js";
// import Property        from "../models/Property.js";
// import Marketplace     from "../models/Marketplace.js";

/**
 * Model map: listingType query param → { model, modelName }
 * Frontend passes ?type=business | property | marketplace | job
 */
const MODEL_MAP = {
  business:    { model: BusinessListing, modelName: "BusinessListing" },
  job:         { model: Job,             modelName: "Job"             },
//   property:    { model: Property,        modelName: "Property"        },
//   marketplace: { model: Marketplace,     modelName: "Marketplace"     },
};

/**
 * Resolve a listing by slug (or 24-char ObjectId) across any model.
 *
 * Usage:
 *   const { listing, modelName } = await resolveListing("some-slug", "business");
 *
 * @param {string} slugOrId  - URL param (slug string or ObjectId)
 * @param {string} type      - "business" | "job" | "property" | "marketplace"
 * @returns {{ listing, modelName }} or throws
 */



export async function resolveListing(slugOrId, type) {
  const entry = MODEL_MAP[type];
  if (!entry) {
    const err = new Error(`Unknown listing type: ${type}`);
    err.status = 400;
    throw err;
  }

  const { model, modelName } = entry;
  const isObjectId = /^[a-fA-F0-9]{24}$/.test(slugOrId);

  const listing = isObjectId
    ? await model.findOne({ _id: slugOrId, isDeleted: false })
    : await model.findOne({ slug: slugOrId, isDeleted: false });

  if (!listing) {
    const err = new Error("Listing not found");
    err.status = 404;
    throw err;
  }

  return { listing, modelName };
}

export { MODEL_MAP };