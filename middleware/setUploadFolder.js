// setUploadFolder.js
export const setUploadFolder = (folderName) => (req, res, next) => {
  req._uploadFolder = folderName;
  next();
};