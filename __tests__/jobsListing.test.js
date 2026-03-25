import request from 'supertest';
import app from '../app.js';
import JobsListingModel from '../model/jobsListingSchema.js';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { SECRET_KEY } from '../services/constant.js';

describe('Jobs Listing API', () => {

  const dummyJob = {
    title: 'Software Engineer',
    category: new mongoose.Types.ObjectId(),
    sector: 'it',
    jobType: 'full-time',
    experienceLevel: 'mid',
    status: 'active',
    isActive: true,
    isDeleted: false,
    slug: 'software-engineer-tech-corp-1234'
  };

  it('should fetch all jobs', async () => {
    // Seed DB first so we don't get a 404 No Jobs Found error
    await JobsListingModel.create(dummyJob);
    const res = await request(app).get('/jobs-listing/get-all-jobs');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status');
  });

  it('should handle fetching a non-existent job', async () => {
    const res = await request(app).get('/jobs-listing/get-job/non-existent-slug');
    expect(res.statusCode).toBe(404);
  });
  
  it('should delete a job if it exists (soft delete)', async () => {
    // Ensure one exists
    const job = await JobsListingModel.create({
        ...dummyJob, 
        slug: 'delete-me-123'
    });
    
    const res = await request(app).delete(`/jobs-listing/delete-job/${job.slug}`);
    expect(['200', '201']).toContain(String(res.statusCode)); // Ensure endpoint works correctly
    
    // Verify it's soft-deleted
    const updatedJob = await JobsListingModel.findById(job._id);
    expect(updatedJob.isDeleted).toBe(true);
    expect(updatedJob.status).toBe('closed');
  });

  it('should create a new job via Step 1 POST', async () => {
    const newJobPayload = {
      step: 1,
      title: 'Backend Developer',
      category_id: new mongoose.Types.ObjectId().toString(),
      sector: 'it',
      jobType: 'full-time',
      experienceLevel: 'mid',
    };

    const res = await request(app)
      .post('/jobs-listing/save-job/1')
      .send(newJobPayload);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('id');
  });

  it('should fetch all jobs by user', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const token = jwt.sign({ user: { id: userId, email: "test@test.com" } }, SECRET_KEY || "test_secret");

    await JobsListingModel.create({
      ...dummyJob,
      slug: 'user-specific-job-123',
      createdBy: userId,
    });

    const res = await request(app)
      .get('/jobs-listing/get-user-jobs')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.jobs.length).toBeGreaterThan(0);
    expect(res.body.data.jobs[0].createdBy.toString()).toBe(userId);
  });
});
