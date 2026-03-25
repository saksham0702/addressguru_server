import request from 'supertest';
import app from '../app.js';
import BusinessListingModel from '../model/businessListingSchema.js';
import mongoose from 'mongoose';

describe('Business Listings API', () => {

  const dummyListing = {
    category: new mongoose.Types.ObjectId(),
    businessName: 'Super Fix Auto',
    businessAddress: '123 Main St, Dubai',
    description: 'Auto repair shop in Dubai',
    slug: 'super-fix-auto-1234',
    isDeleted: false,
    isPublished: true,
  };

  it('should create a new business listing via Step 1 POST', async () => {
    const longDescription = 'A'.repeat(505);

    const cat = await mongoose.model('Category').create({
      name: 'Testing Auto',
      slug: 'testing-auto',
      type: 'business'
    });
    
    const res = await request(app)
      .post('/business-listing/create-listing/step/1')
      .field('business_name', 'New Shop LLC')
      .field('category_id', cat._id.toString())
      .field('business_address', '456 Side Street, Dubai, UAE')
      .field('ad_description', longDescription);
      
    if(res.statusCode !== 200) {
        console.warn("Validation Error Output:", res.body);
    }
      
    expect([200, 201]).toContain(res.statusCode);
  });

  it('should get all listings', async () => {
    await BusinessListingModel.create(dummyListing);
    const res = await request(app).get('/business-listing/get-all-listings');
    expect(res.statusCode).toBe(200);
  });

  it('should handle fetching a non-existent listing', async () => {
    const res = await request(app).get('/business-listing/get-listing-by-slug/invalid-slug');
    expect(res.statusCode).toBe(404);
  });
  
  it('should delete a listing if it exists (soft delete)', async () => {
    const listing = await BusinessListingModel.create({
        ...dummyListing, 
        slug: 'to-be-deleted-listing',
        businessName: 'Delete Me LLC'
    });
    
    const res = await request(app).delete(`/business-listing/delete-listing/${listing.slug}`);
    expect(['200', '201']).toContain(String(res.statusCode));
    
    const updated = await BusinessListingModel.findById(listing._id);
    expect(updated.isDeleted).toBe(true);
  });
});
