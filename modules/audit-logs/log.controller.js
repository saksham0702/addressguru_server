import * as service from "./log.service.js";

export const getLogs = async (req, res) => {
  const filter = {};

  if (req.query.method) filter.method = req.query.method;

  if (req.query.status) filter.statusCode = Number(req.query.status);

  if (req.query.browser) filter.browser = req.query.browser;

  if (req.query.os) filter.os = req.query.os;

  if (req.query.module) filter.module = req.query.module;

  if (req.query.user) filter.user = req.query.user;

  if (req.query.ip) filter.ip = req.query.ip;

  if (req.query.start || req.query.end) {
    filter.createdAt = {};

    if (req.query.start) filter.createdAt.$gte = new Date(req.query.start);

    if (req.query.end) filter.createdAt.$lte = new Date(req.query.end);
  }

  const logs = await service.getLogs(
    filter,
    Number(req.query.page) || 1,
    Number(req.query.limit) || 20,
  );

  res.json(logs);
};
