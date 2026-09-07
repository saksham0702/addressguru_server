import FlashDeal from "../flash-deal/flashDealSchema.js";
import { successData, errorData } from "../../services/helper.js";

export const createFlashDeal = async (req, res) => {
  try {
    const {
      name,
      badgeText,
      description,
      basePlan,
      planType,
      dealPrice,
      durationMinutes,
      eligibility,
      isActive,
      currency,
    } = req.body;

    if (!name) return errorData(res, 400, false, "Deal name is required");
    if (!basePlan) return errorData(res, 400, false, "basePlan is required");
    if (dealPrice === undefined || dealPrice === null)
      return errorData(res, 400, false, "dealPrice is required");

    const deal = await FlashDeal.create({
      name,
      badgeText: badgeText || "NOW OR NEVER",
      description: description || "",
      basePlan,
      planType: planType || "business",
      dealPrice,
      durationMinutes: durationMinutes || 5,
      eligibility: eligibility || "first_listing_only",
      isActive: isActive ?? true,
      currency: currency || "AED",
    });

    return successData(res, 201, true, "Flash deal created", { deal });
  } catch (error) {
    console.warn("createFlashDeal error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

export const listFlashDeals = async (req, res) => {
  try {
    const { planType } = req.query;
    const filter = {};
    if (planType) filter.planType = planType;

    const deals = await FlashDeal.find(filter)
      .populate("basePlan", "name price theme flags")
      .sort({ createdAt: -1 })
      .lean();

    return successData(res, 200, true, "OK", { deals });
  } catch (error) {
    console.warn("listFlashDeals error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

export const updateFlashDeal = async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = [
      "name",
      "badgeText",
      "description",
      "basePlan",
      "planType",
      "dealPrice",
      "durationMinutes",
      "eligibility",
      "isActive",
      "currency",
    ];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }

    const deal = await FlashDeal.findByIdAndUpdate(id, update, { new: true });
    if (!deal) return errorData(res, 404, false, "Deal not found");

    return successData(res, 200, true, "Deal updated", { deal });
  } catch (error) {
    console.warn("updateFlashDeal error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

export const deleteFlashDeal = async (req, res) => {
  try {
    const { id } = req.params;
    const deal = await FlashDeal.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true },
    );
    if (!deal) return errorData(res, 404, false, "Deal not found");
    return successData(res, 200, true, "Deal deactivated", { deal });
  } catch (error) {
    console.warn("deleteFlashDeal error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};
