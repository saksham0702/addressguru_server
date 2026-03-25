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
    from: '"AddressGuru UAE Support" <adx.ddn@gmail.com>',
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
    from: '"AddressGuru UAE Support" <adx.ddn@gmail.com>',
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
    businessName:  extra.businessName  || name,
    category:      extra.category      || "",
    listingUrl:    extra.listingUrl    || "https://addressguru.ae",
    previewLink:   extra.previewLink   || extra.listingUrl || "https://addressguru.ae",
    dashboardUrl:  extra.dashboardUrl  || "https://addressguru.ae/dashboard",
    plansUrl:      extra.plansUrl      || "https://addressguru.ae/plans",
    year:          new Date().getFullYear(),
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
    from: '"AddressGuru UAE" <adx.ddn@gmail.com>',
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
    dashboardUrl:  dashboardUrl || "https://addressguru.ae/dashboard",
    year:          new Date().getFullYear(),
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
    from: '"AddressGuru UAE" <adx.ddn@gmail.com>',
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
    from: '"AddressGuru UAE Support" <adx.ddn@gmail.com>',
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
    from: '"AddressGuru UAE Support" <adx.ddn@gmail.com>',
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
    from: '"AddressGuru UAE Support" <adx.ddn@gmail.com>',
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
    from: '"AddressGuru UAE Support" <adx.ddn@gmail.com>',
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
    from: '"AddressGuru UAE Support" <adx.ddn@gmail.com>',
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

export {
  sendMail,
  sendAddMail,
  sendOTPMail,
  sendResendOTPMail,
  sendChangeEMail,
  sendChangeEMailSuccess,
  sendSuccessMail,
  sendApprovedAndRejectedListingMail,
  sendListingSubmittedMail,   // ← new export added
};