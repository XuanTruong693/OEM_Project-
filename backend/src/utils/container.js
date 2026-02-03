/**
 * container.js - Simple Dependency Injection Container
 * 
 * Provides a lightweight DI container for registering and resolving dependencies.
 * Supports lazy loading and singleton instances.
 */

class Container {
    constructor() {
        this._factories = new Map();
        this._instances = new Map();
    }

    /**
     * Register a factory function for a dependency
     * @param {string} name - Dependency name
     * @param {Function} factory - Factory function that returns the dependency
     * @param {boolean} singleton - If true, cache the instance (default: true)
     */
    register(name, factory, singleton = true) {
        if (typeof factory !== 'function') {
            throw new Error(`Factory for "${name}" must be a function`);
        }
        this._factories.set(name, { factory, singleton });
        // Clear any cached instance when re-registering
        this._instances.delete(name);
    }

    /**
     * Resolve a dependency by name
     * @param {string} name - Dependency name
     * @returns {*} The resolved dependency
     */
    resolve(name) {
        // Check for cached singleton instance
        if (this._instances.has(name)) {
            return this._instances.get(name);
        }

        // Get factory
        const registration = this._factories.get(name);
        if (!registration) {
            throw new Error(`Dependency "${name}" not registered`);
        }

        // Create instance
        const instance = registration.factory(this);

        // Cache if singleton
        if (registration.singleton) {
            this._instances.set(name);
        }

        return instance;
    }

    /**
     * Check if a dependency is registered
     * @param {string} name - Dependency name
     * @returns {boolean}
     */
    has(name) {
        return this._factories.has(name);
    }

    /**
     * Clear all cached instances (useful for testing)
     */
    clearInstances() {
        this._instances.clear();
    }

    /**
     * List all registered dependencies
     * @returns {string[]}
     */
    list() {
        return Array.from(this._factories.keys());
    }
}

// Singleton container instance
const container = new Container();

module.exports = container;
