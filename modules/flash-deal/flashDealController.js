import { successData, errorData } from "../../services/helper.js";
import {
  checkFlashDealForUser,
  attachListingToClaim,
  getMyActiveFlashDeals,
} from "../../modules/flash-deal/FlashDealService.js";
import { createFlashDealOrderService } from "../../modules/payment/payment.service.js";

export const checkFlashDeal = async (req, res) => {
  try {
    const { planType = "business" } = req.query;
    const deal = await checkFlashDealForUser({
      userId: req.user.id,
      planType,
    });
    return successData(res, 200, true, "OK", { deal });
  } catch (error) {
    console.warn("checkFlashDeal error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

export const attachListing = async (req, res) => {
  try {
    const { claimId, listingId } = req.body;
    if (!claimId || !listingId) {
      return errorData(res, 400, false, "claimId and listingId are required");
    }
    await attachListingToClaim({ userId: req.user.id, claimId, listingId });
    return successData(res, 200, true, "Linked", {});
  } catch (error) {
    console.warn("attachListing error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

export const myActiveFlashDeals = async (req, res) => {
  try {
    const deals = await getMyActiveFlashDeals(req.user.id);
    return successData(res, 200, true, "OK", { deals });
  } catch (error) {
    console.warn("myActiveFlashDeals error:", error);
    return errorData(res, 500, false, "Internal server error");
  }
};

export const purchaseFlashDeal = async (req, res) => {
  try {
    const { claimId, listing_id } = req.body;
    if (!claimId) return errorData(res, 400, false, "claimId is required");

    const { order, payment, isFreePlan } = await createFlashDealOrderService({
      userId: req.user.id,
      claimId,
      listingId: listing_id || null,
    });

    if (isFreePlan) {
      return successData(res, 200, true, "Deal applied", {
        free_plan: true,
        payment_id: payment._id,
      });
    }

    return successData(res, 200, true, "Payment initiated", {
      free_plan: false,
      payment_id: payment._id,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.warn("purchaseFlashDeal error:", error);
    return errorData(res, 400, false, error.message || "Purchase failed");
  }
};
