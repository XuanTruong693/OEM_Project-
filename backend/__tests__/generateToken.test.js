/**
 * Unit tests for generateToken utility
 */

// Mock dotenv config
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

// Set test environment variables before requiring the module
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

const { generateAccessToken, generateRefreshToken } = require('../src/utils/generateToken');
const jwt = require('jsonwebtoken');

describe('generateToken utility', () => {
  const testPayload = {
    id: 1,
    email: 'test@example.com',
    role: 'student',
  };

  describe('generateAccessToken', () => {
    it('should generate a valid JWT access token', () => {
      const token = generateAccessToken(testPayload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should contain the correct payload data', () => {
      const token = generateAccessToken(testPayload);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      expect(decoded.id).toBe(testPayload.id);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.role).toBe(testPayload.role);
    });

    it('should have an expiration time', () => {
      const token = generateAccessToken(testPayload);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid JWT refresh token', () => {
      const token = generateRefreshToken(testPayload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should contain the correct payload data', () => {
      const token = generateRefreshToken(testPayload);
      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
      
      expect(decoded.id).toBe(testPayload.id);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.role).toBe(testPayload.role);
    });

    it('should have a longer expiration than access token', () => {
      const accessToken = generateAccessToken(testPayload);
      const refreshToken = generateRefreshToken(testPayload);
      
      const accessDecoded = jwt.verify(accessToken, process.env.JWT_SECRET);
      const refreshDecoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      
      const accessDuration = accessDecoded.exp - accessDecoded.iat;
      const refreshDuration = refreshDecoded.exp - refreshDecoded.iat;
      
      expect(refreshDuration).toBeGreaterThan(accessDuration);
    });
  });
});
