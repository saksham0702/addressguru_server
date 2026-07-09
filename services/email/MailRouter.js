import { emailConfig } from "../constant.js";

export const getSender = (type = "default") => {
  return emailConfig.mailboxes[type] || emailConfig.mailboxes.default;
};
