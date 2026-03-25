import request from 'supertest';
import app from '../app.js';
import UserModel from '../model/userSchema.js';

describe('User Authentication API', () => {

  const dummyUser = {
    name: 'Test Analyst',
    email: 'testanalyst@example.com',
    phone: '+971501234567',
    password: 'Password123!',
  };

  it('should complete the full authentication lifecycle', async () => {
    // 1. Register User
    const registerRes = await request(app)
      .post('/user/register')
      .send(dummyUser);

    expect(registerRes.statusCode).toBe(200);

    const userDbObject = await UserModel.findOne({ email: dummyUser.email });
    expect(userDbObject).toBeTruthy();
    expect(userDbObject.otp).toBeTruthy();
    const generatedOtp = userDbObject.otp;

    // 2. Verify OTP
    const verifyRes = await request(app)
      .post('/user/verify-otp')
      .send({ email: dummyUser.email, otp: generatedOtp });
      
    expect(verifyRes.statusCode).toBe(200);
    const verifiedUser = await UserModel.findOne({ email: dummyUser.email });
    expect(verifiedUser.verified_email).toBe(true);

    // 3. Login
    const loginRes = await request(app)
      .post('/user/login')
      .send({ email: dummyUser.email, password: dummyUser.password });

    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body.data).toHaveProperty('authToken');
    const authToken = loginRes.body.data.authToken;

    // 4. Fetch Profile
    const profileRes = await request(app)
      .get('/user/me')
      .set('Cookie', [`authToken=${authToken}`])
      .set('Authorization', `Bearer ${authToken}`);
      
    expect(profileRes.statusCode).toBe(200);
    expect(profileRes.body.data).toHaveProperty('email', dummyUser.email);
  });
});
