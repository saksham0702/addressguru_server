const mongoose = require('mongoose');
const Job = require('./models/Jobs.js');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.DB_URL).then(async () => {
  const jobs = await Job.find({"company.name": { $exists: true, $ne: null, $ne: "" }}).sort({createdAt: -1}).select("company contact location").lean();
  console.log(JSON.stringify(jobs[0], null, 2));
  process.exit(0);
});
