# Production-Ready API Edge Functions

A comprehensive, modular, and scalable API system built with TypeScript, Hono, and Supabase Edge Functions. This system provides authentication, authorization, rate limiting, validation, error handling, and structured logging.

## 🏗️ Architecture Overview

### Core Components

- **Configuration Management** (`core/config.ts`) - Centralized configuration with validation
- **Type Definitions** (`core/types.ts`) - Comprehensive TypeScript interfaces
- **Logging System** (`core/logger.ts`) - Structured logging with configurable levels
- **Error Handling** (`core/errors.ts`) - Standardized error types and handling
- **Input Validation** (`core/validation.ts`) - Request validation and sanitization
- **Authentication** (`core/auth.ts`) - JWT tokens, user management, role-based access
- **Rate Limiting** (`core/rateLimit.ts`) - Configurable rate limiting strategies
- **API Routes** (`routes/`) - Modular route handlers

### Key Features

✅ **Production-Ready** - Comprehensive error handling, logging, and monitoring  
✅ **Modular Architecture** - Clean separation of concerns and reusable components  
✅ **Type Safety** - Full TypeScript coverage with strict type checking  
✅ **Security** - JWT authentication, rate limiting, input validation  
✅ **Scalability** - Memory and KV storage options, configurable limits  
✅ **Maintainability** - Clean code structure, comprehensive documentation  

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Deno runtime
- Supabase project
- Environment variables configured

### Environment Variables

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Security
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRY=3600
REFRESH_TOKEN_EXPIRY=604800

# CORS Configuration
CORS_ORIGINS=*
CORS_MAX_AGE=600

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_REQUEST_BODY=false
LOG_SENSITIVE_DATA=false

# SMS Configuration
SMS_PROVIDER=mock
SMS_CODE_EXPIRY=300
SMS_MAX_ATTEMPTS=3

# Development
ENVIRONMENT=development
```

### Installation

1. Clone the repository
2. Install dependencies
3. Configure environment variables
4. Deploy to Supabase Edge Functions

```bash
# Deploy the main API function
supabase functions deploy api --no-verify-jwt
```

## 📚 API Documentation

### Base URL
```
https://your-project.supabase.co/functions/v1/api
```

### Authentication

All API endpoints (except health checks and SMS sending) require authentication via JWT token.

#### Header Format
```
Authorization: Bearer <access_token>
```
or
```
X-Access-Token: <access_token>
```

### Endpoints

#### Health Checks

##### GET `/health`
Basic health check endpoint.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "version": "2.1.0",
    "environment": "development",
    "uptime": 12345
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req_1234567890_abc123",
    "version": "1.0.0"
  }
}
```

##### GET `/health/status`
Basic status check.

##### GET `/health/detailed`
Detailed health check with service status.

#### Authentication

##### POST `/auth/sms/send`
Send SMS verification code.

**Request Body:**
```json
{
  "phone": "998123456789",
  "purpose": "signin" // optional: "signin", "signup", "password_reset"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "SMS verification code sent",
    "expiresIn": 300,
    "purpose": "signin"
  }
}
```

##### POST `/auth/sms/signin`
Sign in with SMS verification code.

**Request Body:**
```json
{
  "phone": "998123456789",
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresAt": "2024-01-01T01:00:00.000Z",
    "user": {
      "id": "user_123",
      "phone": "998123456789",
      "firstName": "John",
      "lastName": "Doe",
      "role": {
        "type": "user",
        "permissions": []
      },
      "isActive": true,
      "isVerified": true,
      "preferences": {
        "language": "uz",
        "theme": "light",
        "notifications": {
          "email": true,
          "sms": true,
          "push": true
        }
      },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  },
  "message": "Successfully signed in"
}
```

##### POST `/auth/sms/signup`
Sign up with SMS verification code.

**Request Body:**
```json
{
  "phone": "998123456789",
  "code": "123456",
  "firstName": "John",
  "lastName": "Doe",
  "birthDate": "1990-01-01",
  "gender": "male"
}
```

##### POST `/auth/refresh`
Refresh access token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

##### POST `/auth/logout`
Logout user.

**Headers:** Requires authentication

##### GET `/auth/me`
Get current user information.

**Headers:** Requires authentication

#### User Management

##### GET `/user/profile`
Get user profile.

**Headers:** Requires authentication

##### PUT `/user/profile`
Update user profile.

**Headers:** Requires authentication

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "birthDate": "1990-01-01",
  "gender": "male"
}
```

##### PUT `/user/preferences`
Update user preferences.

**Headers:** Requires authentication

**Request Body:**
```json
{
  "language": "uz",
  "theme": "dark",
  "notifications": {
    "email": true,
    "sms": false,
    "push": true
  }
}
```

##### DELETE `/user/account`
Delete user account.

**Headers:** Requires authentication

## 🔧 Configuration

### Rate Limiting

The API includes configurable rate limiting with multiple strategies:

- **IP-based** - Limits by IP address
- **User-based** - Limits by authenticated user
- **Path-based** - Limits by IP + endpoint path
- **Action-based** - Limits by user + specific action

### Presets

```typescript
// Strict: 5 requests per 15 minutes
RateLimitPresets.strict

// Moderate: 100 requests per 15 minutes  
RateLimitPresets.moderate

// Lenient: 1000 requests per 15 minutes
RateLimitPresets.lenient

// Auth: 10 requests per 15 minutes
RateLimitPresets.auth

// SMS: 5 requests per hour
RateLimitPresets.sms
```

### Logging

Structured logging with configurable levels:

- **debug** - Detailed debugging information
- **info** - General information messages
- **warn** - Warning messages
- **error** - Error messages

### Error Handling

Standardized error responses:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "validationErrors": [
        {
          "field": "phone",
          "message": "Phone number is required",
          "code": "REQUIRED_FIELD"
        }
      ]
    }
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Request validation failed |
| AUTHENTICATION_ERROR | 401 | Authentication required |
| AUTHORIZATION_ERROR | 403 | Access denied |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT_ERROR | 409 | Resource conflict |
| RATE_LIMIT_ERROR | 429 | Too many requests |
| SERVER_ERROR | 500 | Internal server error |

## 🛡️ Security Features

### Authentication

- JWT-based authentication with access and refresh tokens
- Token expiration and refresh mechanism
- Role-based access control (RBAC)
- Permission-based authorization

### Rate Limiting

- Multiple storage backends (Memory, KV)
- Configurable windows and limits
- Different strategies for different endpoints
- Automatic cleanup of expired data

### Input Validation

- Comprehensive request validation
- Type checking and format validation
- Custom validation rules
- Input sanitization

### CORS Support

- Configurable allowed origins
- Proper header handling
- Credentials support
- Cache control

## 📊 Monitoring & Observability

### Logging

- Request/response logging
- Error tracking
- Performance metrics
- Security event logging

### Health Checks

- Basic health status
- Detailed service status
- Memory usage monitoring
- Performance metrics

### Request Tracing

- Unique request IDs
- Request context tracking
- Performance timing
- Error correlation

## 🧪 Testing

The API includes comprehensive testing support:

### Unit Tests

```typescript
import { Validator } from './core/validation.ts';
import { CommonSchemas } from './core/validation.ts';

Deno.test('phone validation', () => {
  const result = Validator.validate(
    { phone: '998123456789' },
    CommonSchemas.phone
  );
  
  assertEquals(result.isValid, true);
});
```

### Integration Tests

```typescript
import { app } from './index.ts';

Deno.test('POST /auth/sms/send', async () => {
  const res = await app.request('/auth/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '998123456789' })
  });
  
  assertEquals(res.status, 200);
});
```

## 🚀 Deployment

### Supabase Edge Functions

```bash
# Deploy main API function
supabase functions deploy api --no-verify-jwt

# Set environment variables
supabase secrets set JWT_SECRET=your-secret
supabase secrets set SUPABASE_URL=your-url
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-key
```

### Environment-Specific Configurations

- **Development** - Verbose logging, mock services
- **Staging** - Production-like setup with test data
- **Production** - Optimized logging, real services

## 📝 Development Guidelines

### Code Style

- TypeScript strict mode enabled
- Consistent naming conventions
- Comprehensive error handling
- Modular architecture

### Best Practices

- Always validate input data
- Use structured logging
- Handle errors gracefully
- Implement proper authentication
- Use rate limiting
- Write comprehensive tests

### Contributing

1. Follow the existing code structure
2. Add comprehensive tests
3. Update documentation
4. Ensure all types are properly defined
5. Handle all error cases

## 🔍 Troubleshooting

### Common Issues

1. **JWT Token Errors** - Check token format and expiration
2. **Rate Limiting** - Verify configuration and storage
3. **Database Errors** - Check connection and permissions
4. **Validation Errors** - Review request format and required fields

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug
```

### Health Monitoring

Monitor health endpoints:

```bash
curl https://your-project.supabase.co/functions/v1/api/health
```

## 📄 License

This project is licensed under the MIT License.

## 🤝 Support

For support and questions:

1. Check the documentation
2. Review the troubleshooting guide
3. Check health endpoints
4. Review logs for errors

---

**Note**: This is a production-ready API system designed for scalability and maintainability. All components are thoroughly tested and documented for enterprise use.
