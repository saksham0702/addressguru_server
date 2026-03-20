import request from 'supertest';
import app from '../app.js';
import CategoryModel from '../model/categoriesSchema.js';

describe('Categories API', () => {

  const dummyCategory = {
    name: 'Technology',
    type: 'business',
    description: 'Tech business category'
  };

  let categoryId = null;

  it('should create a new category', async () => {
    const res = await request(app)
      .post('/categories/create-category')
      .send(dummyCategory);
      
    expect([200, 201]).toContain(res.statusCode);
  });

  it('should get all categories', async () => {
    await CategoryModel.create(dummyCategory);
    const res = await request(app).get('/categories/get-categories');
    expect(res.statusCode).toBe(200);
  });

  it('should update a category', async () => {
    const cat = await CategoryModel.create(dummyCategory);
    const res = await request(app)
      .put(`/categories/update-category/${cat._id}`)
      .send({ description: 'Updated Tech' });
      
    expect(res.statusCode).toBe(200);
  });

  it('should delete a category', async () => {
    const cat = await CategoryModel.create({ ...dummyCategory, name: 'delete-cat' });
    const res = await request(app).delete(`/categories/delete-category/${cat._id}`);
    expect(res.statusCode).toBe(200);
  });
});
