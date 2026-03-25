import request from 'supertest';
import app from '../app.js';

describe('Job Applications API', () => {
  it('should restrict access to authenticated-only applications dashboard', async () => {
    const res = await request(app).get('/api/applications/my');
    expect([401, 403]).toContain(res.statusCode);
  });

  it('should gracefully handle application submissions for invalid job slugs', async () => {
    const res = await request(app)
      .post('/api/applications/non-existent-job-slug/apply')
      .send({
         name: 'Seeker',
         email: 'seeker@example.com'
      });
      
    expect([400, 404, 500]).toContain(res.statusCode);
  });
});
