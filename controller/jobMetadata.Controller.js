import { successData } from "../services/helper.js";

export const getJobTypes = async (req, res) => {
  const jobTypes = [
    { name: "Full Time", value: "full-time" },
    { name: "Part Time", value: "part-time" },
    { name: "Contract", value: "contract" },
    { name: "Freelance", value: "freelance" },
    { name: "Internship", value: "internship" },
    { name: "Temporary", value: "temporary" },
  ];
  return successData(res, 200, true, "Job types fetched successfully", jobTypes);
};

export const getWorkModes = async (req, res) => {
  const workModes = [
    { name: "On-site", value: "on-site" },
    { name: "Remote", value: "remote" },
    { name: "Hybrid", value: "hybrid" },
  ];
  return successData(res, 200, true, "Work modes fetched successfully", workModes);
};

export const getExperienceLevels = async (req, res) => {
  const experienceLevels = [
    { name: "Entry Level", value: "entry" },
    { name: "Junior", value: "junior" },
    { name: "Mid Level", value: "mid" },
    { name: "Senior", value: "senior" },
    { name: "Lead", value: "lead" },
    { name: "Executive", value: "executive" },
  ];
  return successData(res, 200, true, "Experience levels fetched successfully", experienceLevels);
};

export const getEducationLevels = async (req, res) => {
  const educationLevels = [
    { name: "Any", value: "any" },
    { name: "None", value: "none" },
    { name: "Matric", value: "matric" },
    { name: "Intermediate", value: "intermediate" },
    { name: "Bachelor", value: "bachelor" },
    { name: "Master", value: "master" },
    { name: "PhD", value: "phd" },
  ];
  return successData(res, 200, true, "Education levels fetched successfully", educationLevels);
};

export const getNationalities = async (req, res) => {
  const nationalities = [
    { name: "Afghan", value: "afghan" },
    { name: "Albanian", value: "albanian" },
    { name: "Algerian", value: "algerian" },
    { name: "American", value: "american" },
    { name: "Bangladeshi", value: "bangladeshi" },
    { name: "British", value: "british" },
    { name: "Canadian", value: "canadian" },
    { name: "Chinese", value: "chinese" },
    { name: "Egyptian", value: "egyptian" },
    { name: "Ethiopian", value: "ethiopian" },
    { name: "Filipino", value: "filipino" },
    { name: "French", value: "french" },
    { name: "German", value: "german" },
    { name: "Indian", value: "indian" },
    { name: "Indonesian", value: "indonesian" },
    { name: "Iranian", value: "iranian" },
    { name: "Iraqi", value: "iraqi" },
    { name: "Italian", value: "italian" },
    { name: "Jordanian", value: "jordanian" },
    { name: "Kenyan", value: "kenyan" },
    { name: "Lebanese", value: "lebanese" },
    { name: "Libyan", value: "libyan" },
    { name: "Malaysian", value: "malaysian" },
    { name: "Moroccan", value: "moroccan" },
    { name: "Nepalese", value: "nepalese" },
    { name: "Nigerian", value: "nigerian" },
    { name: "Pakistani", value: "pakistani" },
    { name: "Palestinian", value: "palestinian" },
    { name: "Russian", value: "russian" },
    { name: "Saudi Arabian", value: "saudi-arabian" },
    { name: "Somali", value: "somali" },
    { name: "South African", value: "south-african" },
    { name: "Sri Lankan", value: "sri-lankan" },
    { name: "Sudanese", value: "sudanese" },
    { name: "Syrian", value: "syrian" },
    { name: "Turkish", value: "turkish" },
    { name: "UAE National", value: "uae-national" },
    { name: "Ukrainian", value: "ukrainian" },
    { name: "Yemeni", value: "yemeni" },
    { name: "Any", value: "any" },
  ];
  return successData(res, 200, true, "Nationalities fetched successfully", nationalities);
};

export const getLanguages = async (req, res) => {
  const languages = [
    { name: "Arabic", value: "arabic" },
    { name: "Bengali", value: "bengali" },
    { name: "Chinese (Mandarin)", value: "mandarin" },
    { name: "Dutch", value: "dutch" },
    { name: "English", value: "english" },
    { name: "Filipino", value: "filipino" },
    { name: "French", value: "french" },
    { name: "German", value: "german" },
    { name: "Hindi", value: "hindi" },
    { name: "Indonesian", value: "indonesian" },
    { name: "Italian", value: "italian" },
    { name: "Japanese", value: "japanese" },
    { name: "Korean", value: "korean" },
    { name: "Malay", value: "malay" },
    { name: "Nepali", value: "nepali" },
    { name: "Persian (Farsi)", value: "farsi" },
    { name: "Portuguese", value: "portuguese" },
    { name: "Russian", value: "russian" },
    { name: "Sinhalese", value: "sinhalese" },
    { name: "Spanish", value: "spanish" },
    { name: "Swahili", value: "swahili" },
    { name: "Tamil", value: "tamil" },
    { name: "Tagalog", value: "tagalog" },
    { name: "Turkish", value: "turkish" },
    { name: "Urdu", value: "urdu" },
  ];
  return successData(res, 200, true, "Languages fetched successfully", languages);
};

export const getJobBenefits = async (req, res) => {
  const benefits = [
    { name: "Accommodation", value: "accommodation" },
    { name: "Annual Leave", value: "annual-leave" },
    { name: "As per UAE law", value: "as-per-uae-law" },
    { name: "Bonus", value: "bonus" },
    { name: "Commission", value: "commission" },
    { name: "Company Car", value: "company-car" },
    { name: "End of Service Gratuity", value: "end-of-service-gratuity" },
    { name: "Family Visa", value: "family-visa" },
    { name: "Flight Tickets", value: "flight-tickets" },
    { name: "Food Allowance", value: "food-allowance" },
    { name: "Health Insurance", value: "health-insurance" },
    { name: "Housing Allowance", value: "housing-allowance" },
    { name: "Incentives", value: "incentives" },
    { name: "Medical Insurance", value: "medical-insurance" },
    { name: "Overtime Pay", value: "overtime-pay" },
    { name: "Performance Bonus", value: "performance-bonus" },
    { name: "Petrol Allowance", value: "petrol-allowance" },
    { name: "Profit Sharing", value: "profit-sharing" },
    { name: "Residence Visa", value: "residence-visa" },
    { name: "Sick Leave", value: "sick-leave" },
    { name: "Training & Development", value: "training-development" },
    { name: "Transportation", value: "transportation" },
    { name: "Travel Allowance", value: "travel-allowance" },
    { name: "Work From Home", value: "work-from-home" },
  ];
  return successData(res, 200, true, "Job benefits fetched successfully", benefits);
};

export const getCompanySizes = async (req, res) => {
  const companySizes = [
    { name: "1-10", value: "1-10" },
    { name: "11-50", value: "11-50" },
    { name: "51-200", value: "51-200" },
    { name: "201-500", value: "201-500" },
    { name: "500+", value: "500+" },
  ];
  return successData(res, 200, true, "Company sizes fetched successfully", companySizes);
};

export const getMonthlySalaryRanges = async (req, res) => {
  const salaryRanges = [
    { name: "Negotiable", value: "negotiable" },
    { name: "Less than 2,000", value: "lt-2000" },
    { name: "2,000 - 3,999", value: "2000-3999" },
    { name: "4,000 - 5,999", value: "4000-5999" },
    { name: "6,000 - 7,999", value: "6000-7999" },
    { name: "8,000 - 11,999", value: "8000-11999" },
    { name: "12,000 - 19,999", value: "12000-19999" },
    { name: "20,000 +", value: "gt-20000" },
  ];
  return successData(res, 200, true, "Monthly salary ranges fetched successfully", salaryRanges);
};
