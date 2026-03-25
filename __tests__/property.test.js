import request from 'supertest';
import app from '../app.js';
import mongoose from 'mongoose';

describe('Properties API', () => {

  it('should create a new property listing via Step 1 POST', async () => {
    const longDescription = 'A'.repeat(505);

    const cat = await mongoose.model('Category').create({
      name: 'Real Estate',
      slug: 'real-estate',
      type: 'property'
    });

    const res = await request(app)
      .post('/property-listings/create-listing/step/1')
      .field('title', 'Luxury Villa in Dubai')
      .field('category_id', cat._id.toString())
      .field('description', longDescription)
      .field('purpose', 'sale');
      
    if(res.statusCode !== 200 && res.statusCode !== 201) {
        console.warn("Property Validation Error Output:", res.body);
    }
      
    expect([200, 201]).toContain(res.statusCode);
  });

  it('should get all property listings', async () => {
    await mongoose.model('PropertyListing').create({
      title: 'dummy listing prop',
      slug: 'dummy-listing-prop',
      category: new mongoose.Types.ObjectId(),
      description: 'Test description prop',
      purpose: 'sale',
    });
    const res = await request(app).get('/property-listings/get-all-listings');
    expect(res.statusCode).toBe(200);
  });
  
  it('should handle fetching non-existent listing', async () => {
    const res = await request(app).get('/property-listings/get-listing-by-slug/invalid-slug');
    expect(res.statusCode).toBe(404);
  });
});
