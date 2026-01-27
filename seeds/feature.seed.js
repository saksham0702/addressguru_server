import Feature from "../model/categoryFeaturesSchema.js";

export const seedFeatures = async () => {
  try {
    // PAYMENT MODES (STATIC)
    const paymentExists = await Feature.findOne({ type: "payment" });

    if (!paymentExists) {
      await Feature.create({
        type: "payment",
        isStatic: true,
        items: [
          { name: "Cash" },
          { name: "Credit Card" },
          { name: "Debit Card" },
          { name: "UPI" },
          { name: "Net Banking" },
          { name: "Apple Pay" },
          { name: "Google Pay" },
        ],
      });

      console.log("✅ Payment modes seeded");
    }
  } catch (error) {
    console.error("❌ Seeding failed:", error.message);
  }
};
