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
    text: `Your OTP is: ${otp}`, // Plain text fallback
    html: mailBody, // HTML email content
  };

  return transporter.sendMail(mailOptions);
};

const sendChangeEMail = (email, otp) => {
  console.log("EMAILL :", email, "OTP :", otp);

  const path = require("path");
  const tamplatePath = path.resolve(
    __dirname,
    "./mailThemes/changeEmailOTP.hjs"
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
    text: `Your OTP is: ${otp}`, // Plain text fallback
    html: mailBody, // HTML email content
  };

  return transporter.sendMail(mailOptions);
};

const sendChangeEMailSuccess = (name, email) => {
  console.log("EMAILL :", email, "Name :", name);

  const path = require("path");
  const tamplatePath = path.resolve(
    __dirname,
    "./mailThemes/changeEmailOTP.hjs"
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
    text: `Your OTP is: ${otp}`, // Plain text fallback
    html: mailBody, // HTML email content
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
    text: `Your OTP is: ${otp}`, // Plain text fallback
    html: mailBody, // HTML email content
  };

  return transporter.sendMail(mailOptions);
};

// const sendDemoMail = (email) => {
//   //   const { email, full_name, preferred_contact_slot } = demoData;

//   // Configure the transporter
//   const transporter = nodemailer.createTransport({
//     host: SMTP_HOST,
//     port: SMTP_PORT,
//     secure: true,
//     auth: {
//       user: SMTP_EMAIL,
//       pass: SMTP_PASS,
//     },
//   });

//   // Mail options for a simple text email
//   const mailOptions = {
//     from: '"AddressGuru UAE Support" <adx.ddn@gmail.com>',
//     to: email,
//     subject: "Demo Booking Confirmation",
//     text: `Hi ${email},

//             Thank you for booking a demo with us! We have scheduled your demo for this Tool.

//             Our team will reach out to you at the specified time.

//             If you have any questions, feel free to reply to this email.

//             Best regards,
//            AddressGuru UAE Support Team`,
//   };

//   // Send the email
//   return transporter.sendMail(mailOptions);
// };

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
};
