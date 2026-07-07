import Log from "./log.model.js";

export const getLogs = async (filter, page, limit) => {
  return Log.find(filter)
    .populate("user", "name email")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
};
