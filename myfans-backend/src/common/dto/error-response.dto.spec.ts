import { ErrorResponseDto } from './error-response.dto';

describe('ErrorResponseDto', () => {
  describe('constructor', () => {
    it('should assign statusCode, error, message, and path', () => {
      const dto = new ErrorResponseDto(404, 'Not Found', 'Resource not found', '/v1/posts/1');

      expect(dto.statusCode).toBe(404);
      expect(dto.error).toBe('Not Found');
      expect(dto.message).toBe('Resource not found');
      expect(dto.path).toBe('/v1/posts/1');
    });

    it('should accept an array of messages', () => {
      const messages = ['field is required', 'email must be valid'];
      const dto = new ErrorResponseDto(400, 'Bad Request', messages, '/v1/users');

      expect(dto.message).toEqual(messages);
    });

    it('should set timestamp to a valid ISO 8601 string', () => {
      const before = new Date().toISOString();
      const dto = new ErrorResponseDto(500, 'Internal Server Error', 'Oops', '/v1/test');
      const after = new Date().toISOString();

      expect(dto.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
      expect(dto.timestamp >= before).toBe(true);
      expect(dto.timestamp <= after).toBe(true);
    });

    it('should expose exactly the five required fields', () => {
      const dto = new ErrorResponseDto(400, 'Bad Request', 'Bad input', '/v1/endpoint');
      const keys = Object.keys(dto);

      expect(keys).toHaveLength(5);
      expect(keys).toContain('statusCode');
      expect(keys).toContain('error');
      expect(keys).toContain('message');
      expect(keys).toContain('timestamp');
      expect(keys).toContain('path');
    });

    it('should handle 500 status code', () => {
      const dto = new ErrorResponseDto(500, 'Internal Server Error', 'Unexpected error', '/v1/any');

      expect(dto.statusCode).toBe(500);
      expect(dto.error).toBe('Internal Server Error');
    });

    it('should handle empty string message', () => {
      const dto = new ErrorResponseDto(401, 'Unauthorized', '', '/v1/auth');

      expect(dto.message).toBe('');
    });
  });
});
