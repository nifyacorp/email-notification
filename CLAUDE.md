# Email Notification Service Guidelines

## Build Commands
- **Development**: `npm start` (start the service)
- **Testing**: `npm test` (run all tests), `npm test -- -t "test name"` (single test)
- **Docker**: `docker build -t nifya-email-service .` (build image)
- **Manual Testing**: `curl -X POST http://localhost:8080/test-email -H "Content-Type: application/json" -d '{"email":"test@example.com"}'`

## Code Style Guidelines
- **Architecture**: Modular with separation between database, services, templates, and utils
- **JavaScript**: ES modules (type: "module"), async/await for asynchronous code
- **Imports**: External dependencies first, internal imports grouped by functionality
- **Naming**: camelCase for functions/variables, descriptive names that indicate purpose
- **Error Handling**: Try/catch blocks with detailed logging of errors including context
- **Formatting**: 2-space indentation, single quotes for strings, semicolons
- **Logging**: Use Pino logger with context (userId, notificationId) and appropriate levels
- **API Responses**: Standard structure with status codes and message/error fields
- **PubSub**: Structured message handling with detailed logging

## Service Structure
- **Database**: Connection and queries in database/client.js
- **Email**: Template rendering and sending functionality in services/
- **Templates**: Handlebars HTML templates in templates/
- **API**: Express server with health check and test endpoints
- **Logging**: Structured logging via Pino in utils/logger.js