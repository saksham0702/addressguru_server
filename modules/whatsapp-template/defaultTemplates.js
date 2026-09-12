// backend/modules/whatsapp-template/defaultTemplates.js

export const DEFAULT_TEMPLATES = [
  // ─── 1. PITCH PLANS (WHATSAPP) ──────────────────────────────────────────
  {
    title: "Pitch Business Growth Plans",
    slug: "pitch_plans",
    type: "whatsapp",
    category: "business_pitch",
    message: `Hello *{{name}}*, 🚀 Take *{{businessName}}* to the next level on AddressGuru UAE!

Upgrade your listing to unlock premium growth features and boost your customer reach across the UAE:

{{plansList}}

✨ *Key Benefits:*
• Priority placement in category and city searches
• Verified Business Badge building customer trust
• Direct customer call, WhatsApp & email leads
• Multi-photo gallery & interactive Google Map

👉 Upgrade your plan directly from your dashboard:
{{upgradeLink}}

Need help choosing the right plan? Reply directly to this message!`,
    variables: [
      "name",
      "businessName",
      "plansList",
      "upgradeLink",
      "dashboardUrl",
    ],
    isSystem: true,
    status: "active",
  },

  // ─── 2. LISTING APPROVED (WHATSAPP) ─────────────────────────────────────
  {
    title: "Listing Approved & Live",
    slug: "listing_approved",
    type: "whatsapp",
    category: "listing_approved",
    message: `Hello *{{name}}*, 🎉 Congratulations! Your business listing *{{businessName}}* has been approved and is now live on AddressGuru UAE.

📍 *Listing Details:*
• *Title:* {{businessName}}
• *Category:* {{category}}
• *Live URL:* {{listingUrl}}

You can manage your listing details, photos, and customer leads anytime from your dashboard:
👉 {{dashboardUrl}}

Thank you for partnering with AddressGuru UAE!`,
    variables: ["name", "businessName", "category", "listingUrl", "dashboardUrl"],
    isSystem: true,
    status: "active",
  },

  // ─── 3. LISTING REJECTED (WHATSAPP) ─────────────────────────────────────
  {
    title: "Listing Needs Updates / Rejected",
    slug: "listing_rejected",
    type: "whatsapp",
    category: "listing_rejected",
    message: `Hello *{{name}}*, Thank you for submitting *{{businessName}}* on AddressGuru UAE.

Our team reviewed your submission, but it requires updates before it can be published.

⚠️ *Reason for Rejection:*
{{rejectionReason}}
{{adminNote}}

Please log in to your dashboard to make the necessary changes and resubmit:
👉 {{dashboardUrl}}

Need help? Reply to this message or contact support@addressguru.ae.`,
    variables: [
      "name",
      "businessName",
      "rejectionReason",
      "adminNote",
      "dashboardUrl",
    ],
    isSystem: true,
    status: "active",
  },

  // ─── 4. CLAIM 2-STEP VERIFICATION (WHATSAPP) ───────────────────────────
  {
    title: "Claim 2-Step Ownership Verification",
    slug: "claim_verification_request",
    type: "whatsapp",
    category: "claim_verification",
    message: `Hello *{{name}}*, 👋

Thank you for claiming your business listing *{{businessName}}* on AddressGuru UAE.

Before we transfer the listing ownership to your account, we require a simple 2-step verification for security purposes.

You can complete the verification using either one of the following options:

*Option 1 – Email Verification*
Send us an email from the email address currently associated with the business listing.

*Option 2 – WhatsApp Verification*
Send us a WhatsApp message from the phone number currently registered on the business listing.

Once we receive and verify either one, we will complete the ownership transfer of your business listing to your account.

Thank you for your cooperation and for helping us keep business listings secure.

Best regards,
*AddressGuru UAE Team*`,
    variables: ["name", "businessName"],
    isSystem: true,
    status: "active",
  },

  // ─── 5. CLAIM TRANSFERRED (WHATSAPP) ────────────────────────────────────
  {
    title: "Claim Ownership Transferred",
    slug: "claim_transferred",
    type: "whatsapp",
    category: "claim_transferred",
    message: `Hello *{{name}}*, 🎉 Great news! We have verified your ownership claim and transferred the business listing *{{businessName}}* to your account on AddressGuru UAE.

You now have full owner access to manage and update your listing:
👉 {{dashboardUrl}}

Log in with your registered account to manage details, view incoming customer enquiries, or upgrade your plan.

Thank you for choosing AddressGuru UAE!`,
    variables: ["name", "businessName", "dashboardUrl"],
    isSystem: true,
    status: "active",
  },

  // ─── 6. CLAIM REJECTED (WHATSAPP) ───────────────────────────────────────
  {
    title: "Claim Request Rejected",
    slug: "claim_rejected",
    type: "whatsapp",
    category: "claim_rejected",
    message: `Hello *{{name}}*, We have reviewed your ownership claim for the listing *{{businessName}}* on AddressGuru UAE.

Unfortunately, we are unable to approve this claim at this time.

⚠️ *Reason:*
{{rejectionReason}}
{{adminNote}}

If you believe this is an error or have additional supporting documents, please reach out to us at support@addressguru.ae.`,
    variables: ["name", "businessName", "rejectionReason", "adminNote"],
    isSystem: true,
    status: "active",
  },

  // ─── 7. LEAD NOTIFICATION TO BUSINESS OWNER (WHATSAPP) ─────────────────
  {
    title: "New Customer Lead Alert",
    slug: "lead_notification",
    type: "whatsapp",
    category: "lead_notification",
    message: `Hello *{{name}}*, 🔔 Great news! You have received a new customer lead for *{{businessName}}* on AddressGuru UAE.

👤 *Customer Details:*
• *Name:* {{leadName}}
• *Phone:* {{leadPhone}}
• *Email:* {{leadEmail}}

💬 *Customer Enquiry:*
"{{leadMessage}}"

We recommend reaching out to the customer promptly to convert this lead!

View all your enquiries in your dashboard:
👉 {{dashboardUrl}}`,
    variables: [
      "name",
      "businessName",
      "leadName",
      "leadPhone",
      "leadEmail",
      "leadMessage",
      "dashboardUrl",
    ],
    isSystem: true,
    status: "active",
  },

  // ─── 8. LEAD REPLY TO CUSTOMER (WHATSAPP) ───────────────────────────────
  {
    title: "Customer Enquiry Follow-up",
    slug: "lead_reply",
    type: "whatsapp",
    category: "lead_notification",
    message: `Hello *{{leadName}}*, 👋 Thank you for reaching out regarding *{{businessName}}* on AddressGuru UAE.

We received your enquiry:
"{{leadMessage}}"

Our team is here to assist you. Please let us know if you have any questions or how we can help!`,
    variables: ["leadName", "businessName", "leadMessage"],
    isSystem: true,
    status: "active",
  },

  // ─── 9. EMAIL PITCH PLANS ───────────────────────────────────────────────
  {
    title: "Business Plan Upgrade Offer Email",
    slug: "email_pitch_plans",
    type: "email",
    category: "business_pitch",
    subject: "Unlock Premium Growth for {{businessName}} — AddressGuru UAE",
    message: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #ea580c;">Grow Your Business with AddressGuru UAE 🚀</h2>
  <p>Hello <strong>{{name}}</strong>,</p>
  <p>Take <strong>{{businessName}}</strong> to the next level and get discovered by thousands of potential customers looking for services across the UAE.</p>
  
  <div style="background: #fff7ed; border-left: 4px solid #ea580c; padding: 15px; margin: 20px 0; border-radius: 4px;">
    <h3 style="margin-top: 0; color: #9a3412;">Available Business Plans:</h3>
    <div>{{plansList}}</div>
  </div>

  <p style="text-align: center; margin: 30px 0;">
    <a href="{{upgradeLink}}" style="background: #ea580c; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; display: inline-block;">Upgrade Your Plan Now</a>
  </p>

  <p style="font-size: 13px; color: #666;">Need help? Reply to this email or contact support@addressguru.ae</p>
</div>`,
    variables: ["name", "businessName", "plansList", "upgradeLink"],
    isSystem: true,
    status: "active",
  },

  // ─── 10. EMAIL LISTING APPROVED ─────────────────────────────────────────
  {
    title: "Listing Approved Notification Email",
    slug: "email_listing_approved",
    type: "email",
    category: "listing_approved",
    subject: "Your Business Listing {{businessName}} is Live! — AddressGuru UAE",
    message: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #16a34a;">Congratulations! Your Listing is Live 🎉</h2>
  <p>Hello <strong>{{name}}</strong>,</p>
  <p>Your business listing <strong>{{businessName}}</strong> has passed our verification and is now officially published on AddressGuru UAE.</p>

  <p style="text-align: center; margin: 25px 0;">
    <a href="{{listingUrl}}" style="background: #16a34a; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-weight: bold; display: inline-block; margin-right: 10px;">View Live Listing</a>
    <a href="{{dashboardUrl}}" style="background: #f1f5f9; color: #334155; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-weight: bold; display: inline-block;">Manage in Dashboard</a>
  </p>
</div>`,
    variables: ["name", "businessName", "listingUrl", "dashboardUrl"],
    isSystem: true,
    status: "active",
  },

  // ─── 11. EMAIL LISTING REJECTED ─────────────────────────────────────────
  {
    title: "Listing Action Required Email",
    slug: "email_listing_rejected",
    type: "email",
    category: "listing_rejected",
    subject: "Listing Update Required: {{businessName}} — AddressGuru UAE",
    message: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #dc2626;">Updates Needed for Your Listing ⚠️</h2>
  <p>Hello <strong>{{name}}</strong>,</p>
  <p>Thank you for submitting <strong>{{businessName}}</strong> to AddressGuru UAE. Our moderation team reviewed your submission, but it requires updates before it can be published.</p>

  <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 4px;">
    <p style="margin: 0; color: #991b1b;"><strong>Reason for Rejection:</strong> {{rejectionReason}}</p>
  </div>

  <p style="text-align: center; margin: 25px 0;">
    <a href="{{dashboardUrl}}" style="background: #dc2626; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; display: inline-block;">Update & Resubmit in Dashboard</a>
  </p>
</div>`,
    variables: ["name", "businessName", "rejectionReason", "dashboardUrl"],
    isSystem: true,
    status: "active",
  },
];
