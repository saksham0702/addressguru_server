// 


import nodemailer from "nodemailer";
import fs from "fs";
import Hogan from "hogan.js";
import { emailConfig } from "../services/constant.js";
import path from "path";

const sendSuccessMail = (email, name) => {
  const templatePath = path.resolve("utils/mailThemes/register.hjs");
  const template = fs.readFileSync(templatePath, "utf-8");
  const compliledtamplete = Hogan.compile(template);

  const mailbody = compliledtamplete.render({ name });

  const transporter = nodemailer.createTransport({
    host: emailConfig.SMTP_HOST,
    port: emailConfig.SMTP_PORT,
    secure: true,
    auth: {
      user: emailConfig.SMTP_EMAIL,
      pass: emailConfig.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: '"AddressGuru UAE Support" <addressguruuae@gmail.com>',
    to: email,
    subject: "Welcome to AddressGuru UAE! Registration Successful 🚀",
    text: `Thank you for signing up!`,
    html: mailbody,
  };
  return transporter.sendMail(mailOptions);
};

const sendOTPMail = (email, name = "", otp) => {
  console.log("EMAILL :", email, "OTP :", otp);

  const templatePath = path.resolve("utils/mailThemes/registerOTP.hjs");
  const template = fs.readFileSync(templatePath, "utf-8");
  const compliledtamplete = Hogan.compile(template);

  const mailBody = compliledtamplete.render({ name, otp });

  const transporter = nodemailer.createTransport({
    host: emailConfig.SMTP_HOST,
    port: emailConfig.SMTP_PORT,
    secure: true,
    auth: {
      user: emailConfig.SMTP_EMAIL,
      pass: emailConfig.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: '"AddressGuru UAE Support" <addressguruuae@gmail.com>',
    to: email,
    subject: "Your OTP for Verification 🚀",
    text: `Your OTP is: ${otp}`,
    html: mailBody,
  };

  return transporter.sendMail(mailOptions);
};

// ─── UPDATED: Approved / Rejected listing mail ────────────────────────────────
// Added optional `extra` param for richer approved template data.
// Fully backward-compatible — existing callers with 4 args still work.
const sendApprovedAndRejectedListingMail = (email, name, status, message, extra = {}) => {
  console.log("EMAIL:", email, "Name:", name, "Status:", status, "Message:", message);

  let templatePath;
  if (status === "approved") {
    templatePath = path.resolve("utils/mailThemes/ListingApproved.hjs");
  } else {
    templatePath = path.resolve("utils/mailThemes/ListingRejected.hjs");
  }

  const template = fs.readFileSync(templatePath, "utf-8");
  const compiledTemplate = Hogan.compile(template);

  const mailBody = compiledTemplate.render({
    name,
    status,
    message,
    // approved template extras (ignored by rejected template)
    businessName: extra.businessName || name,
    category: extra.category || "",
    listingUrl: extra.listingUrl || "https://addressguru.ae",
    previewLink: extra.previewLink || extra.listingUrl || "https://addressguru.ae",
    dashboardUrl: extra.dashboardUrl || "https://addressguru.ae/dashboard",
    plansUrl: extra.plansUrl || "https://addressguru.ae/plans",
    year: new Date().getFullYear(),
  });

  const transporter = nodemailer.createTransport({
    host: emailConfig.SMTP_HOST,
    port: emailConfig.SMTP_PORT,
    secure: true,
    auth: {
      user: emailConfig.SMTP_EMAIL,
      pass: emailConfig.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: '"AddressGuru UAE" <addressguruuae@gmail.com>',
    to: email,
    subject:
      status === "approved"
        ? "🎉 Your Listing Has Been Approved — AddressGuru UAE"
        : "⚠️ Action Required: Your Listing Needs Updates — AddressGuru UAE",
    text: `Your listing status is: ${status}`,
    html: mailBody,
  };

  return transporter.sendMail(mailOptions);
};


// top business

const sendTopBusinessesDigestMail = (email, name, category, businesses = []) => {

  console.log(
    "DIGEST MAIL → EMAIL:", email,
    "| Name:", name,
    "| Category:", category,
    "| Businesses:", businesses.length
  );

  const templatePath = path.resolve("utils/mailThemes/TopBusinessesDigest.hjs");
  const template = fs.readFileSync(templatePath, "utf-8");
  const compiledTemplate = Hogan.compile(template);

  // Enrich each business with a fallback initial for the logo placeholder
  const enrichedBusinesses = businesses.map((b) => ({
    ...b,
    initial: b.businessName ? b.businessName.charAt(0).toUpperCase() : "B",
    category: b.category || category,
  }));

  const mailBody = compiledTemplate.render({
    name,
    category,
    businesses: enrichedBusinesses,
    year: new Date().getFullYear(),
  });

  const transporter = nodemailer.createTransport({
    host: emailConfig.SMTP_HOST,
    port: emailConfig.SMTP_PORT,
    secure: true,
    auth: {
      user: emailConfig.SMTP_EMAIL,
      pass: emailConfig.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: '"AddressGuru UAE" <addressguruuae@gmail.com>',
    to: email,
    subject: `🏆 Top Businesses in ${category} — AddressGuru UAE`,
    text: `Check out the top businesses in ${category} on AddressGuru UAE.`,
    html: mailBody,
  };

  return transporter.sendMail(mailOptions);
};


// ─── NEW: Listing submitted / pending mail ────────────────────────────────────
// Call this after step-6 save in updateListingStep.
const sendListingSubmittedMail = (email, name, businessName, category, submissionDate, dashboardUrl) => {
  console.log("📧 sendListingSubmittedMail →", email, name, businessName);

  const templatePath = path.resolve("utils/mailThemes/ListingSubmitted.hjs");
  const template = fs.readFileSync(templatePath, "utf-8");
  const compiledTemplate = Hogan.compile(template);

  const mailBody = compiledTemplate.render({
    name,
    businessName,
    category,
    submissionDate,
    dashboardUrl: dashboardUrl || "https://addressguru.ae/dashboard",
    year: new Date().getFullYear(),
  });

  const transporter = nodemailer.createTransport({
    host: emailConfig.SMTP_HOST,
    port: emailConfig.SMTP_PORT,
    secure: true,
    auth: {
      user: emailConfig.SMTP_EMAIL,
      pass: emailConfig.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: '"AddressGuru UAE" <addressguruuae@gmail.com>',
    to: email,
    subject: "📋 Your Listing Has Been Submitted — AddressGuru UAE",
    text: `Hi ${name}, your listing "${businessName}" has been submitted and is under review.`,
    html: mailBody,
  };

  return transporter.sendMail(mailOptions);
};

const sendChangeEMail = (email, otp) => {
  console.log("EMAILL :", email, "OTP :", otp);

  const path = require("path");
  const tamplatePath = path.resolve(
    __dirname,
    "./mailThemes/changeEmailOTP.hjs",
  );
  const tamplate = fs.readFileSync(tamplatePath, "utf-8");
  const compliledtamplete = Hogan.compile(tamplate);

  const mailBody = compliledtamplete.render({ otp });

  const transporter = nodemailer.createTransport({
    host: emailConfig.SMTP_HOST,
    port: emailConfig.SMTP_PORT,
    secure: true,
    auth: {
      user: emailConfig.SMTP_EMAIL,
      pass: emailConfig.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: '"AddressGuru UAE Support" <addressguruuae@gmail.com>',
    to: email,
    subject: "Your OTP for Verification 🚀",
    text: `Your OTP is: ${otp}`,
    html: mailBody,
  };

  return transporter.sendMail(mailOptions);
};

const sendChangeEMailSuccess = (name, email) => {
  console.log("EMAILL :", email, "Name :", name);

  const path = require("path");
  const tamplatePath = path.resolve(
    __dirname,
    "./mailThemes/changeEmailOTP.hjs",
  );
  const tamplate = fs.readFileSync(tamplatePath, "utf-8");
  const compliledtamplete = Hogan.compile(tamplate);

  const mailBody = compliledtamplete.render({ email, name });

  const transporter = nodemailer.createTransport({
    host: emailConfig.SMTP_HOST,
    port: emailConfig.SMTP_PORT,
    secure: true,
    auth: {
      user: emailConfig.SMTP_EMAIL,
      pass: emailConfig.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: '"AddressGuru UAE Support" <addressguruuae@gmail.com>',
    to: email,
    subject: "Your OTP for Verification 🚀",
    text: `Your OTP is: ${otp}`,
    html: mailBody,
  };

  return transporter.sendMail(mailOptions);
};

const sendMail = (email, password) => {
  const path = require("path");
  const tamplatePath = path.resolve(__dirname, "./mailThemes/email.hjs");
  const tamplate = fs.readFileSync(tamplatePath, "utf-8");
  const compliledtamplete = Hogan.compile(tamplate);

  const mailbody = compliledtamplete.render({ email, password });

  const transporter = nodemailer.createTransport({
    host: emailConfig.SMTP_HOST,
    port: emailConfig.SMTP_PORT,
    secure: true,
    auth: {
      user: emailConfig.SMTP_EMAIL,
      pass: emailConfig.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: '"AddressGuru UAE Support" <addressguruuae@gmail.com>',
    to: email,
    subject: "Welcome to AddressGuru UAE! Registration Successful 🚀",
    text: `Thank you for signing up!`,
    html: mailbody,
  };
  return transporter.sendMail(mailOptions);
};

const sendAddMail = (name, email, password, ROLE) => {
  let filePath =
    ROLE === ROLES.STUDENT
      ? "./mailThemes/addStudent.hjs"
      : "./mailThemes/addTeacher.hjs";

  const path = require("path");
  const tamplatePath = path.resolve(__dirname, filePath);
  const tamplate = fs.readFileSync(tamplatePath, "utf-8");
  const compliledtamplete = Hogan.compile(tamplate);

  const mailbody = compliledtamplete.render({ name, email, password });

  const transporter = nodemailer.createTransport({
    host: emailConfig.SMTP_HOST,
    port: emailConfig.SMTP_PORT,
    secure: true,
    auth: {
      user: emailConfig.SMTP_EMAIL,
      pass: emailConfig.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: '"AddressGuru UAE Support" <addressguruuae@gmail.com>',
    to: email,
    subject: "Welcome to AddressGuru UAE! Registration Successful 🚀",
    text: `Thank you for signing up!`,
    html: mailbody,
  };
  return transporter.sendMail(mailOptions);
};

const sendResendOTPMail = (email, name, otp) => {
  console.log("EMAILL :", email, "OTP :", otp);

  const templatePath = path.resolve("utils/mailThemes/resendOTPMail.hjs");
  const template = fs.readFileSync(templatePath, "utf-8");
  const compliledtamplete = Hogan.compile(template);
  const mailBody = compliledtamplete.render({ email, name, otp });

  const transporter = nodemailer.createTransport({
    host: emailConfig.SMTP_HOST,
    port: emailConfig.SMTP_PORT,
    secure: true,
    auth: {
      user: emailConfig.SMTP_EMAIL,
      pass: emailConfig.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: '"AddressGuru UAE Support" <addressguruuae@gmail.com>',
    to: email,
    subject: "Your OTP for Verification 🚀",
    text: `Your OTP is: ${otp}`,
    html: mailBody,
  };

  return transporter.sendMail(mailOptions);
};

const formatPreferredContactSlot = (datetime) => {
  const options = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  };
  return new Intl.DateTimeFormat("en-US", options).format(new Date(datetime));
};


// enquiry and all 
// ─── 1. ENQUIRY RECEIVED — sent to listing owner ──────────────────────────────
const sendEnquiryReceivedMail = (ownerEmail, ownerName, businessName, listingSlug, enquirer) => {
  console.log(
    "ENQUIRY MAIL → EMAIL:", ownerEmail,
    "| Business:", businessName,
    "| From:", enquirer.fullName
  );

  const templatePath = path.resolve("utils/mailThemes/EnquiryReceived.hjs");
  const template = fs.readFileSync(templatePath, "utf-8");
  const compiledTemplate = Hogan.compile(template);

  const mailBody = compiledTemplate.render({
    ownerName,
    businessName,
    listingSlug,
    fullName: enquirer.fullName,
    email: enquirer.email,
    countryCode: enquirer.countryCode || "91",
    mobileNumber: enquirer.mobileNumber,
    message: enquirer.message || null,
    year: new Date().getFullYear(),
  });

  const transporter = nodemailer.createTransport({
    host: emailConfig.SMTP_HOST,
    port: emailConfig.SMTP_PORT,
    secure: true,
    auth: { user: emailConfig.SMTP_EMAIL, pass: emailConfig.SMTP_PASS },
  });

  const mailOptions = {
    from: '"AddressGuru UAE" <addressguruuae@gmail.com>',
    to: ownerEmail,
    subject: `📩 New Enquiry for ${businessName} — AddressGuru UAE`,
    text: `You have a new enquiry from ${enquirer.fullName} for your listing ${businessName}.`,
    html: mailBody,
  };

  return transporter.sendMail(mailOptions);
};

// ─── 1.1 ENQUIRY CONFIRMATION — sent to enquirer ──────────────────────────────
const sendEnquiryConfirmationMail = (enquirerEmail, enquirerName, businessName, listingSlug, message) => {
  console.log(
    "ENQUIRY CONFIRMATION → EMAIL:", enquirerEmail,
    "| Business:", businessName
  );

  const templatePath = path.resolve("utils/mailThemes/EnquirerConfirmation.hjs");
  const template = fs.readFileSync(templatePath, "utf-8");
  const compiledTemplate = Hogan.compile(template);

  const mailBody = compiledTemplate.render({
    fullName: enquirerName,
    businessName,
    listingSlug,
    message: message || null,
    year: new Date().getFullYear(),
  });

  const transporter = nodemailer.createTransport({
    host: emailConfig.SMTP_HOST,
    port: emailConfig.SMTP_PORT,
    secure: true,
    auth: { user: emailConfig.SMTP_EMAIL, pass: emailConfig.SMTP_PASS },
  });

  const mailOptions = {
    from: '"AddressGuru UAE" <addressguruuae@gmail.com>',
    to: enquirerEmail,
    subject: `✅ Your Enquiry for ${businessName} has been sent — AddressGuru UAE`,
    text: `Hi ${enquirerName}, your enquiry for ${businessName} has been successfully sent.`,
    html: mailBody,
  };

  return transporter.sendMail(mailOptions);
};


// ─── 2. CLAIM SUBMITTED — sent to claimant ────────────────────────────────────
const sendClaimSubmittedMail = (claimantEmail, claim, businessName) => {
  console.log(
    "CLAIM MAIL → EMAIL:", claimantEmail,
    "| Business:", businessName,
    "| Claimant:", claim.fullName
  );

  const templatePath = path.resolve("utils/mailThemes/ClaimSubmitted.hjs");
  const template = fs.readFileSync(templatePath, "utf-8");
  const compiledTemplate = Hogan.compile(template);

  const mailBody = compiledTemplate.render({
    fullName: claim.fullName,
    email: claim.email,
    countryCode: claim.countryCode || "91",
    mobileNumber: claim.mobileNumber,
    reasonForClaim: claim.reasonForClaim,
    businessName,
    submittedDate: new Date().toLocaleDateString("en-AE", {
      day: "numeric", month: "long", year: "numeric",
    }),
    year: new Date().getFullYear(),
  });

  const transporter = nodemailer.createTransport({
    host: emailConfig.SMTP_HOST,
    port: emailConfig.SMTP_PORT,
    secure: true,
    auth: { user: emailConfig.SMTP_EMAIL, pass: emailConfig.SMTP_PASS },
  });

  const mailOptions = {
    from: '"AddressGuru UAE" <addressguruuae@gmail.com>',
    to: claimantEmail,
    subject: `🔐 Your Claim for ${businessName} is Under Review — AddressGuru UAE`,
    text: `Your claim for ${businessName} has been submitted and is under review.`,
    html: mailBody,
  };

  return transporter.sendMail(mailOptions);
};


// ─── 3. CLAIM RECEIVED (ADMIN ALERT) — sent to admin ───────────────────────────
const sendClaimReceivedAdminMail = (claim, businessName, listingSlug) => {
  const adminEmail = emailConfig.ADMIN_EMAIL;
  console.log(
    "CLAIM ADMIN ALERT → EMAIL:", adminEmail,
    "| Business:", businessName,
    "| Claimant:", claim.fullName
  );

  const templatePath = path.resolve("utils/mailThemes/ClaimSubmitted.hjs"); // Reusing same template for now, or use a custom one if available
  const template = fs.readFileSync(templatePath, "utf-8");
  const compiledTemplate = Hogan.compile(template);

  const mailBody = compiledTemplate.render({
    fullName: claim.fullName,
    email: claim.email,
    countryCode: claim.countryCode || "91",
    mobileNumber: claim.mobileNumber,
    reasonForClaim: claim.reasonForClaim,
    businessName,
    listingSlug,
    isAdminAlert: true,
    submittedDate: new Date().toLocaleDateString("en-AE", {
      day: "numeric", month: "long", year: "numeric",
    }),
    year: new Date().getFullYear(),
  });

  const transporter = nodemailer.createTransport({
    host: emailConfig.SMTP_HOST,
    port: emailConfig.SMTP_PORT,
    secure: true,
    auth: { user: emailConfig.SMTP_EMAIL, pass: emailConfig.SMTP_PASS },
  });

  const mailOptions = {
    from: '"AddressGuru UAE" <addressguruuae@gmail.com>',
    to: adminEmail,
    subject: `🚨 New Claim Request for ${businessName} — AddressGuru UAE`,
    text: `A new claim request has been submitted by ${claim.fullName} for listing "${businessName}".`,
    html: mailBody,
  };

  return transporter.sendMail(mailOptions);
};


// ─── 4. LISTING REPORTED — sent to admin ──────────────────────────────────────
const sendListingReportedMail = (adminEmail, report, businessName, listingSlug, pendingReportCount, isFlagged) => {
  const recipient = adminEmail || emailConfig.ADMIN_EMAIL;
  console.log(
    "REPORT MAIL → EMAIL:", recipient,
    "| Business:", businessName,
    "| Reason:", report.reason,
    "| Flagged:", isFlagged
  );

  const templatePath = path.resolve("utils/mailThemes/ListingReported.hjs");
  const template = fs.readFileSync(templatePath, "utf-8");
  const compiledTemplate = Hogan.compile(template);

  const mailBody = compiledTemplate.render({
    businessName,
    listingSlug,
    reason: report.reason,
    description: report.description || null,
    ipAddress: report.ipAddress || "N/A",
    reportedAt: new Date().toLocaleDateString("en-AE", {
      day: "numeric", month: "long", year: "numeric",
    }),
    pendingReportCount,
    isFlagged: isFlagged || false,
    year: new Date().getFullYear(),
  });

  const transporter = nodemailer.createTransport({
    host: emailConfig.SMTP_HOST,
    port: emailConfig.SMTP_PORT,
    secure: true,
    auth: { user: emailConfig.SMTP_EMAIL, pass: emailConfig.SMTP_PASS },
  });

  const mailOptions = {
    from: '"AddressGuru UAE" <addressguruuae@gmail.com>',
    to: recipient,
    subject: isFlagged
      ? `🚨 Auto-Flagged Listing: ${businessName} — AddressGuru UAE`
      : `⚠️ Listing Reported: ${businessName} — AddressGuru UAE`,
    text: `Listing "${businessName}" has been reported. Reason: ${report.reason}`,
    html: mailBody,
  };

  return transporter.sendMail(mailOptions);
};

// ─── 5. REVIEW RECEIVED — sent to listing owner ───────────────────────────────
const sendReviewReceivedMail = (ownerEmail, ownerName, businessName, listingSlug, review) => {
  console.log(
    "REVIEW RECEIVED MAIL → EMAIL:", ownerEmail,
    "| Business:", businessName,
    "| From:", review.fullName
  );

  const templatePath = path.resolve("utils/mailThemes/ReviewReceived.hjs");
  const template = fs.readFileSync(templatePath, "utf-8");
  const compiledTemplate = Hogan.compile(template);

  const ratingStars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);

  const mailBody = compiledTemplate.render({
    ownerName,
    businessName,
    listingSlug,
    reviewerName: review.fullName,
    ratingStars,
    reviewText: review.reviewText || null,
    year: new Date().getFullYear(),
  });

  const transporter = nodemailer.createTransport({
    host: emailConfig.SMTP_HOST,
    port: emailConfig.SMTP_PORT,
    secure: true,
    auth: { user: emailConfig.SMTP_EMAIL, pass: emailConfig.SMTP_PASS },
  });

  const mailOptions = {
    from: '"AddressGuru UAE" <addressguruuae@gmail.com>',
    to: ownerEmail,
    subject: `⭐ New ${review.rating}-Star Review for ${businessName} — AddressGuru UAE`,
    text: `Your listing "${businessName}" received a new ${review.rating}-star review from ${review.fullName}.`,
    html: mailBody,
  };

  return transporter.sendMail(mailOptions);
};


// ─── 6. REVIEW CONFIRMATION — sent to reviewer ───────────────────────────────
const sendReviewConfirmationMail = (reviewerEmail, reviewerName, businessName, listingSlug, rating) => {
  console.log(
    "REVIEW CONFIRMATION MAIL → EMAIL:", reviewerEmail,
    "| Business:", businessName
  );

  const templatePath = path.resolve("utils/mailThemes/ReviewConfirmation.hjs");
  const template = fs.readFileSync(templatePath, "utf-8");
  const compiledTemplate = Hogan.compile(template);

  const ratingStars = "★".repeat(rating) + "☆".repeat(5 - rating);

  const mailBody = compiledTemplate.render({
    reviewerName,
    businessName,
    listingSlug,
    ratingStars,
    year: new Date().getFullYear(),
  });

  const transporter = nodemailer.createTransport({
    host: emailConfig.SMTP_HOST,
    port: emailConfig.SMTP_PORT,
    secure: true,
    auth: { user: emailConfig.SMTP_EMAIL, pass: emailConfig.SMTP_PASS },
  });

  const mailOptions = {
    from: '"AddressGuru UAE" <addressguruuae@gmail.com>',
    to: reviewerEmail,
    subject: `✅ Thank you for reviewing ${businessName} — AddressGuru UAE`,
    text: `Hi ${reviewerName}, thank you for your review of ${businessName}.`,
    html: mailBody,
  };

  return transporter.sendMail(mailOptions);
};


// ─── 7. REPORT CONFIRMATION — sent to reporter ───────────────────────────────
const sendReportConfirmationMail = (reporterEmail, businessName, reason) => {
  console.log(
    "REPORT CONFIRMATION MAIL → EMAIL:", reporterEmail,
    "| Business:", businessName
  );

  const templatePath = path.resolve("utils/mailThemes/ReportConfirmation.hjs");
  const template = fs.readFileSync(templatePath, "utf-8");
  const compiledTemplate = Hogan.compile(template);

  const mailBody = compiledTemplate.render({
    businessName,
    reason,
    year: new Date().getFullYear(),
  });

  const transporter = nodemailer.createTransport({
    host: emailConfig.SMTP_HOST,
    port: emailConfig.SMTP_PORT,
    secure: true,
    auth: { user: emailConfig.SMTP_EMAIL, pass: emailConfig.SMTP_PASS },
  });

  const mailOptions = {
    from: '"AddressGuru UAE" <addressguruuae@gmail.com>',
    to: reporterEmail,
    subject: `⚠️ We've received your report — AddressGuru UAE`,
    text: `Thank you for reporting ${businessName}. Our team is looking into it.`,
    html: mailBody,
  };

  return transporter.sendMail(mailOptions);
};

// ─── 8. CLAIM NOTICE (TO OWNER) — sent to existing listing owner ─────────────
const sendClaimNoticeToOwnerMail = (ownerEmail, ownerName, businessName, claimantName, reason) => {
  console.log(
    "CLAIM OWNER NOTICE → EMAIL:", ownerEmail,
    "| Business:", businessName,
    "| Claimant:", claimantName
  );

  const templatePath = path.resolve("utils/mailThemes/ClaimNoticeOwner.hjs");
  const template = fs.readFileSync(templatePath, "utf-8");
  const compiledTemplate = Hogan.compile(template);

  const mailBody = compiledTemplate.render({
    ownerName,
    businessName,
    claimantName,
    reason,
    year: new Date().getFullYear(),
  });

  const transporter = nodemailer.createTransport({
    host: emailConfig.SMTP_HOST,
    port: emailConfig.SMTP_PORT,
    secure: true,
    auth: { user: emailConfig.SMTP_EMAIL, pass: emailConfig.SMTP_PASS },
  });

  const mailOptions = {
    from: '"AddressGuru UAE" <addressguruuae@gmail.com>',
    to: ownerEmail,
    subject: `❗ Notice: User claim submitted for ${businessName} — AddressGuru UAE`,
    text: `Hello ${ownerName}, a user has submitted a business claim for your listing "${businessName}".`,
    html: mailBody,
  };

  return transporter.sendMail(mailOptions);
};


// ─── 9. REPORT NOTICE (TO OWNER) — sent to listing owner ─────────────────────
const sendReportNoticeToOwnerMail = (ownerEmail, ownerName, businessName, listingSlug, reason) => {
  console.log(
    "REPORT OWNER NOTICE → EMAIL:", ownerEmail,
    "| Business:", businessName,
    "| Reason:", reason
  );

  const templatePath = path.resolve("utils/mailThemes/ReportNoticeOwner.hjs");
  const template = fs.readFileSync(templatePath, "utf-8");
  const compiledTemplate = Hogan.compile(template);

  const mailBody = compiledTemplate.render({
    ownerName,
    businessName,
    listingSlug,
    reason,
    year: new Date().getFullYear(),
  });

  const transporter = nodemailer.createTransport({
    host: emailConfig.SMTP_HOST,
    port: emailConfig.SMTP_PORT,
    secure: true,
    auth: { user: emailConfig.SMTP_EMAIL, pass: emailConfig.SMTP_PASS },
  });

  const mailOptions = {
    from: '"AddressGuru UAE" <addressguruuae@gmail.com>',
    to: ownerEmail,
    subject: `⚠️ Notice: Your listing for ${businessName} has been reported — AddressGuru UAE`,
    text: `Hello ${ownerName}, your listing "${businessName}" has been reported.`,
    html: mailBody,
  };

  return transporter.sendMail(mailOptions);
};


export {
  sendMail,
  sendAddMail,
  sendOTPMail,
  sendResendOTPMail,
  sendChangeEMail,
  sendChangeEMailSuccess,
  sendSuccessMail,
  sendApprovedAndRejectedListingMail,
  sendListingSubmittedMail,
  sendTopBusinessesDigestMail,
  sendEnquiryReceivedMail,
  sendEnquiryConfirmationMail,
  sendClaimSubmittedMail,
  sendClaimReceivedAdminMail,
  sendListingReportedMail,
  sendReviewReceivedMail,
  sendReviewConfirmationMail,
  sendReportConfirmationMail,
  sendClaimNoticeToOwnerMail,
  sendReportNoticeToOwnerMail,
};