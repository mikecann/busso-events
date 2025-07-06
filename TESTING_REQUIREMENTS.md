# Testing Requirements for Busso Events

## Testing Philosophy

We use behavior-driven testing with natural English descriptions that clearly state what should happen. Tests should:

1. **Use descriptive test names** that read like requirements in plain English
2. **Mock external services** to avoid hitting real APIs during testing
3. **Be type-safe** with proper TypeScript types for mocks
4. **Focus on behavior** rather than implementation details
5. **Test both success and failure scenarios**

## External Service Mocking Strategy

### Services to Mock
- **Jina.ai API** - Used for web content scraping
- **OpenAI API** - Used for event extraction from scraped content
- **Any HTTP fetch calls** to external services

### Mocking Approach
- Use Vitest's `vi.stubGlobal` for fetch calls
- Create typed mock responses that match expected API contracts
- Test various response scenarios (success, failure, malformed data)

## Scraping Functionality Testing Requirements

### Core Behaviors to Test

#### 1. Source URL Scraping
**Behavior**: "Given a valid source URL, it should successfully scrape the content and extract a list of events"

**Test Cases**:
- ✅ Should extract multiple events from a successful scrape
- ✅ Should handle empty event lists gracefully
- ✅ Should validate URLs before scraping
- ✅ Should handle Jina API failures gracefully
- ✅ Should handle OpenAI extraction failures gracefully
- ✅ Should timeout after reasonable duration
- ✅ Should sanitize content that exceeds length limits

#### 2. Individual Event Page Scraping  
**Behavior**: "Given an event URL, it should scrape detailed information about that specific event"

**Test Cases**:
- ✅ Should extract comprehensive event details from event page
- ✅ Should handle missing optional event details gracefully
- ✅ Should validate event URLs before scraping
- ✅ Should handle API failures for event page scraping

#### 3. Event Queueing (Future Enhancement)
**Behavior**: "After extracting events from a source URL, each event should be queued for detailed scraping"

**Test Cases**:
- ⏳ Should queue each extracted event for individual scraping
- ⏳ Should handle queueing failures gracefully
- ⏳ Should avoid duplicate queueing of the same event

### Test Data Strategy

#### Mock Response Templates
- **Successful Jina Response**: Well-formatted markdown content with event information
- **Failed Jina Response**: HTTP error responses (404, 500, timeout)
- **Successful OpenAI Response**: Valid JSON with extracted event data
- **Failed OpenAI Response**: Malformed JSON or API errors

#### Test URLs
- Valid URLs for testing successful flows
- Invalid URLs for testing validation
- URLs that should trigger various error conditions

## Test Organization

### File Structure
- `convex/scraping/scraping.test.ts` - Main scraping behavior tests
- Test files should be co-located with the functionality they test
- Use descriptive test suite names that group related behaviors

### Test Naming Convention
```typescript
describe("Source URL Scraping", () => {
  test("should extract multiple events when scraping a valid source URL with event listings", async () => {
    // Test implementation
  });
  
  test("should return empty event list when source URL contains no events", async () => {
    // Test implementation  
  });
});
```

## Mock Type Safety

All mocks should be properly typed to ensure:
- Mock responses match real API response shapes
- Test data is realistic and valid
- TypeScript compilation catches mock/real API mismatches

## Coverage Goals

- **Core scraping functions**: 100% line coverage
- **Error handling paths**: All error scenarios tested
- **Edge cases**: URL validation, content limits, timeout handling
- **Integration points**: Mocked external service interactions 