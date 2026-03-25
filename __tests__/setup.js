import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// Ensure critical environment variables exist for isolated testing (e.g., GitHub Actions without .env)
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-ci';

let mongoServer;

beforeAll(async () => {
  // Disconnect any existing connections first
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  // Create an in-memory database instance
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Connect Mongoose to the in-memory database
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
});

afterAll(async () => {
  // Disconnect Mongoose and stop the in-memory server
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

afterEach(async () => {
  // Clear all data between tests to ensure a clean slate
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});
