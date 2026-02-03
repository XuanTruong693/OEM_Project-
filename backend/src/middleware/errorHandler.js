/**
 * errorHandler.js - Global Error Handler Middleware
 * 
 * Provides centralized error handling for the Express application.
 * Catches all errors and returns consistent error responses.
 */

/**
 * Custom Application Error class
 */
class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Validation Error
 */
class ValidationError extends AppError {
    constructor(message, field = null) {
        super(message, 400, 'VALIDATION_ERROR');
        this.field = field;
    }
}

/**
 * Not Found Error
 */
class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404, 'NOT_FOUND');
    }
}

/**
 * Authorization Error
 */
class UnauthorizedError extends AppError {
    constructor(message = 'Access denied') {
        super(message, 403, 'UNAUTHORIZED');
    }
}

/**
 * Global error handler middleware
 * Must be registered AFTER all routes
 */
const errorHandler = (err, req, res, next) => {
    // Log error
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] Error:`, err.message);

    if (process.env.NODE_ENV === 'development') {
        console.error(err.stack);
    }

    // Determine status code
    let statusCode = err.statusCode || err.status || 500;
    let message = err.message || 'Internal server error';
    let code = err.code || 'INTERNAL_ERROR';

    // Handle specific error types
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
        code = 'INVALID_TOKEN';
    } else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
        code = 'TOKEN_EXPIRED';
    } else if (err.name === 'SequelizeValidationError') {
        statusCode = 400;
        message = err.errors?.map(e => e.message).join(', ') || 'Validation error';
        code = 'VALIDATION_ERROR';
    } else if (err.name === 'SequelizeUniqueConstraintError') {
        statusCode = 409;
        message = 'Duplicate entry';
        code = 'DUPLICATE_ERROR';
    }

    // Build response
    const response = {
        success: false,
        message,
        code,
        ...(process.env.NODE_ENV === 'development' && {
            stack: err.stack,
            details: err.details || null
        })
    };

    // Add field info for validation errors
    if (err.field) {
        response.field = err.field;
    }

    res.status(statusCode).json(response);
};

/**
 * 404 handler for unmatched routes
 */
const notFoundHandler = (req, res, next) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.path} not found`,
        code: 'ROUTE_NOT_FOUND'
    });
};

/**
 * Async wrapper to catch errors in async route handlers
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
    errorHandler,
    notFoundHandler,
    asyncHandler,
    AppError,
    ValidationError,
    NotFoundError,
    UnauthorizedError
};
