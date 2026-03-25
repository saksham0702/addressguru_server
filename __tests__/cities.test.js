import request from 'supertest';
import app from '../app.js';
import CityModel from '../model/CitiesSchema.js';

describe('Cities API', () => {

  const dummyCity = {
    name: 'Dubai',
    slug: 'dubai'
  };

  let cityId = null;

  it('should create a new city', async () => {
    const res = await request(app)
      .post('/cities/add-cities')
      .send(dummyCity); 
      
    expect([200, 201]).toContain(res.statusCode);
  });

  it('should get all cities', async () => {
    await CityModel.create({ name: 'Abu Dhabi', slug: 'abu-dhabi' });
    const res = await request(app).get('/cities/get-cities');
    expect(res.statusCode).toBe(200);
  });

  it('should update a city', async () => {
    const city = await CityModel.create({ name: 'Sharjah', slug: 'sharjah' });
    const res = await request(app)
      .put(`/cities/update-city/${city._id}`)
      .send({ name: 'Sharjah Updated', slug: 'sharjah-updated' });
      
    expect(res.statusCode).toBe(200);
  });

  it('should delete a city', async () => {
    const city = await CityModel.create({ name: 'Ajman', slug: 'ajman' });
    const res = await request(app).delete(`/cities/delete-city/${city._id}`);
    expect(res.statusCode).toBe(200);
  });
});
