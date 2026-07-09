import nodemailer from "nodemailer";
import { emailConfig } from "../constant.js";
import { getSender } from "./mailRouter.js";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASS,
  },
});

export const sendEmail = async ({
  type = "default",
  to,
  subject,
  html,
  text,
}) => {
  const sender = getSender(type);

  return transporter.sendMail({
    from: `"${sender.name}" <${sender.email}>`,
    to,
    subject,
    html,
    text,
  });
};
