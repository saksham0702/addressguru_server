import logger from "../services/logger.js";

export default async (err, req, res, next) => {
  let errorObject;
  try {
    // compute errorObject
    try {
      if (!err.message) {
        errorObject = {
          developerMessage:
            "Unknown Error Occured (Received empty error message)",
          userMessage: "Unknown Error Occured",
        };
      } else {
        // error.message is parseable object
        errorObject = JSON.parse(err.message);
      }
    } catch (ex) {
      if (err && err.message && typeof err.message === "string") {
        // error.message is string
        errorObject = {
          message: err.stack.split("\n")[0],
        };
      } else {
        // error.message is unknown (false, undefined, null etc)
        errorObject = {
          message: ex.stack.split("\n")[0],
          path: ex.stack.split("\n").slice(1).join("\n"),
        };
      }
    }

    // compute path
    if (!errorObject.path) {
      errorObject.path = err.stack.split("\n").slice(1).join("");
    }

    // compute userMessage
    if (!errorObject.userMessage) {
      if (errorObject.statusCode || err.statusCode) {
        errorObject.userMessage =
          errorObject.message /*|| err.message*/ || "Unknown Error Occured";
      } else {
        errorObject.userMessage = "Unknown Error Occured";
      }
    }

    // compute statusCode
    if (!errorObject.statusCode) {
      if (err && err.statusCode) {
        errorObject.statusCode = err.statusCode;
      } else {
        errorObject.statusCode = 500;
      }
    }

    // compute developerMessage
    if (!errorObject.developerMessage) {
      switch (errorObject.statusCode) {
        case 400:
          errorObject.developerMessage = "Bad Request";
          break;
        case 401:
          errorObject.developerMessage = "Unauthorized";
          break;
        case 403:
          errorObject.developerMessage = "Forbidden";
          break;
        case 404:
          errorObject.developerMessage = "Entity not found";
          break;
        case 405:
          errorObject.developerMessage = "Method not allowed";
          break;
        case 408:
          errorObject.developerMessage = "User Request Timeout";
          break;
        case 409:
          errorObject.developerMessage = "Duplicate Entry";
          break;
        case 422:
          errorObject.developerMessage = "UnProcessable entity";
          break;
        case 426:
          errorObject.developerMessage = "Login Required";
          break;
        default:
          /* statusCode >= 500 */ errorObject.developerMessage =
            errorObject.message || /*err.message ||*/ "Unknown Error Occurred";
          break;
      }
    }
  } catch (ex) {
    errorObject = {
      userMessage: "Something went wrong",
      statusCode: 500,
      developerMessage: `Error in error-handler middleware - ${
        ex.stack.split("\n")[0]
      }`,
      path: ex.stack.split("\n").slice(1).join("\n"),
    };
  }
  if (errorObject.message) {
    delete errorObject.message;
  }
  req.errorObject = {
    ...errorObject,
  };
  if (errorObject && errorObject.path) {
    // do not expose "path" field to front-end
    console.log("Error: ", errorObject);
    delete errorObject.path;
  }
  logger.error({ errorObject });

  return res
    .status(errorObject.statusCode || 500)
    .json({ error: { ...errorObject } });
};
