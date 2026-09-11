import { successData, errorData } from "../../services/helper.js";
import {
  getActiveFlashDealsForUser,
  attachListingToClaim,
  getMyActiveFlashDeals,
} from "../../modules/flash-deal/FlashDealService.js";
import { createFlashDealOrderService } from "../../modules/payment/payment.service.js";

export const checkFlashDeal = async (req, res) => {
  try {
    const { planType = "business" } = req.query;
    const deals = await getActiveFlashDealsForUser({
      userId: req.user.id,
      planType,
    });
    return successData(res, 200, true, "OK", { deals }); // plural
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
    if (!claimId) {
      return res
        .status(400)
        .json({ success: false, message: "claimId is required" });
    }

    const { order, payment, isFreePlan } = await createFlashDealOrderService({
      userId: req.user.id,
      claimId,
      listingId: listing_id || null,
    });

    /* FREE FLASH DEAL */
    if (isFreePlan) {
      return res.status(200).json({
        success: true,
        free_plan: true,
        data: { payment_id: payment._id },
      });
    }

    /* PAID FLASH DEAL — return same shape as createPayment so frontend
       can read success / free_plan / data.key / data.order_id identically */
    return res.status(200).json({
      success: true,
      free_plan: false,
      data: {
        payment_id: payment._id,
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    console.warn("purchaseFlashDeal error:", error);
    return res
      .status(400)
      .json({ success: false, message: error.message || "Purchase failed" });
  }
};
