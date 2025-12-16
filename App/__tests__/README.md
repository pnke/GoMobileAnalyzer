# Mobile App Tests

This directory contains tests for the Go Analysis Mobile App.

## Test Structure

- `components/` - Component tests
- `lib/` - Library/utility function tests
- `services/` - API service tests
- `integration/` - Integration tests

## Running Tests

To run the tests:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

## Test Categories

### Unit Tests
- Test individual components in isolation
- Test utility functions
- Use Jest snapshots for UI components

### Integration Tests
- Test component interactions
- Test API service layers
- Test navigation flows

### Mocking Strategy
- Mock API calls with MSW or jest-fetch-mock
- Mock context providers
- Use React Native Testing Library for component testing
