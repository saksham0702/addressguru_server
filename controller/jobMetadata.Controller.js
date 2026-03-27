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
