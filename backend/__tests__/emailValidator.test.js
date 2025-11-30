/**
 * Unit tests for emailValidator utility
 */

const dns = require('dns').promises;

// Mock dns module
jest.mock('dns', () => ({
  promises: {
    resolveMx: jest.fn(),
  },
}));

const { validateEmailDomain } = require('../src/utils/emailValidator');

describe('emailValidator utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateEmailDomain', () => {
    it('should return true for valid email with existing domain', async () => {
      dns.resolveMx.mockResolvedValue([
        { exchange: 'mail.example.com', priority: 10 },
      ]);

      const result = await validateEmailDomain('test@example.com');
      
      expect(result).toBe(true);
      expect(dns.resolveMx).toHaveBeenCalledWith('example.com');
    });

    it('should throw error for invalid email format', async () => {
      await expect(validateEmailDomain('invalid-email')).rejects.toThrow('Email khong hop le');
      expect(dns.resolveMx).not.toHaveBeenCalled();
    });

    it('should throw error for email without @ symbol', async () => {
      await expect(validateEmailDomain('invalidemail.com')).rejects.toThrow('Email khong hop le');
    });

    it('should throw error for domain without MX records', async () => {
      dns.resolveMx.mockResolvedValue([]);

      await expect(validateEmailDomain('test@nonexistent.xyz')).rejects.toThrow('Ten mien email khong hop le');
    });

    it('should throw error when domain does not exist', async () => {
      const error = new Error('Domain not found');
      error.code = 'ENOTFOUND';
      dns.resolveMx.mockRejectedValue(error);

      await expect(validateEmailDomain('test@fake-domain-xyz.com')).rejects.toThrow();
    });

    it('should handle DNS timeout', async () => {
      const error = new Error('DNS timeout');
      error.code = 'ETIMEOUT';
      dns.resolveMx.mockRejectedValue(error);

      await expect(validateEmailDomain('test@slow-domain.com')).rejects.toThrow();
    });

    it('should validate email with subdomain', async () => {
      dns.resolveMx.mockResolvedValue([
        { exchange: 'mail.sub.example.com', priority: 10 },
      ]);

      const result = await validateEmailDomain('test@sub.example.com');
      
      expect(result).toBe(true);
      expect(dns.resolveMx).toHaveBeenCalledWith('sub.example.com');
    });
  });
});
