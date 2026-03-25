import request from 'supertest';
import app from '../app.js';
import mongoose from 'mongoose';

describe('Marketplace API', () => {

  it('should create a new marketplace listing via Step 1 POST', async () => {
    const longDescription = 'A'.repeat(505);

    const cat = await mongoose.model('Category').create({
      name: 'Electronics',
      slug: 'electronics',
      type: 'marketplace'
    });

    const res = await request(app)
      .post('/marketplace/create-listing/step/1')
      .field('title', 'Used iPhone 12')
      .field('category_id', cat._id.toString())
      .field('description', longDescription)
      .field('condition', 'used');
      
    if(res.statusCode !== 200 && res.statusCode !== 201) {
        console.warn("Marketplace Validation Error Output:", res.body);
    }
      
    expect([200, 201]).toContain(res.statusCode);
  });

  it('should get all marketplace listings', async () => {
    await mongoose.model('MarketplaceListing').create({
      title: 'dummy listing',
      slug: 'dummy-listing-mark',
      category: new mongoose.Types.ObjectId(),
      description: 'Test description',
      condition: 'used',
    });
    const res = await request(app).get('/marketplace/get-all-listings');
    expect(res.statusCode).toBe(200);
  });
  
  it('should handle fetching non-existent listing', async () => {
    const res = await request(app).get('/marketplace/get-listing-by-slug/invalid-slug');
    expect(res.statusCode).toBe(404);
  });
});
