// Test setup - environment variables for test runs
process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'file:./test.db';
process.env.NODE_ENV = 'test';
process.env.CLIENT_URL = 'http://localhost:5173';
