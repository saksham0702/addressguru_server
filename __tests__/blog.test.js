import request from 'supertest';
import app from '../app.js';

describe('Blogs API', () => {
  it('should get all public blogs', async () => {
    const res = await request(app).get('/blogs/get-blogs');
    expect(res.statusCode).toBe(200);
  });

  it('should create a new blog category', async () => {
    const res = await request(app)
      .post('/blogs/admin/create-category')
      .send({ name: 'Tech News', slug: 'tech-news' });
      
    expect([200, 201]).toContain(res.statusCode);
  });
});
