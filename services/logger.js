import { format, createLogger, transports } from "winston";
import { MongoDB } from "winston-mongodb";
import { MONGODB_URL, NODE_ENV } from "./constant.js";

const logFormat = format.combine(format.timestamp(), format.json());
const consoleFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  format.printf(
    ({ timestamp, level, message }) => `${timestamp} [${level}]: ${message}`
  )
);

const transportsArray = [
  new transports.Console({ format: consoleFormat }),
  new transports.File({ filename: "application.log", format: logFormat }),
];

// If Check Production

if (NODE_ENV === "production") {
  transportsArray.push(
    new MongoDB({
      db: MONGODB_URL,
      collection: "logs",
      level: "info",
      expireAfterSeconds: 60 * 60 * 24 * 5, // Expiry in 5 Days
      options: {
        useUnifiedTopology: true,
      },
    })
  );
}

const logger = createLogger({
  level: "info",
  transports: transportsArray,
});

export default logger;
