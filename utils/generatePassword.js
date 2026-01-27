export const generateEasyPassword = (name) => {
  const randomNum = Math.floor(1000 + Math.random() * 9000); // 4-digit number
  const namePart = name.toLowerCase().replace(/\s+/g, "").slice(0, 5); // First 5 letters of name, no spaces
  return `${namePart}@${randomNum}`; // e.g. "anita@4821"
};
