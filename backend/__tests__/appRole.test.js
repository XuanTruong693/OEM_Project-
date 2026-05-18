/**
 * Unit tests for appRole utility
 * Tests the core functionality of role management
 */

describe('appRole utility', () => {
  beforeEach(() => {
    // Reset module cache to get fresh state each test
    jest.resetModules();
    // Clear environment variable
    delete process.env.APP_ROLE;
  });

  describe('getAppRole', () => {
    it('should return the current role value', () => {
      const { getAppRole } = require('../src/utils/appRole');
      
      // Initial state - getAppRole should return a value (null or from file/env)
      const role = getAppRole();
      expect(role === null || typeof role === 'string').toBe(true);
    });
  });

  describe('setAppRole', () => {
    it('should set and return the new role', () => {
      const { setAppRole, getAppRole } = require('../src/utils/appRole');
      
      const result = setAppRole('student');
      
      expect(result).toBe('student');
      expect(getAppRole()).toBe('student');
    });

    it('should clear the role when set to null', () => {
      const { setAppRole, getAppRole } = require('../src/utils/appRole');
      
      setAppRole('instructor');
      setAppRole(null);
      
      expect(getAppRole()).toBeNull();
    });

    it('should handle empty string as null', () => {
      const { setAppRole, getAppRole } = require('../src/utils/appRole');
      
      setAppRole('');
      
      expect(getAppRole()).toBeNull();
    });

    it('should support all valid roles', () => {
      const { setAppRole, getAppRole } = require('../src/utils/appRole');
      
      const validRoles = ['admin', 'instructor', 'student'];
      
      validRoles.forEach(role => {
        setAppRole(role);
        expect(getAppRole()).toBe(role);
      });
    });
  });
});
