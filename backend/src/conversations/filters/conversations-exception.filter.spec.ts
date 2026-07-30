import {
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import {
  ConversationsExceptionFilter,
  ConversationErrorResponse,
} from './conversations-exception.filter';

describe('ConversationsExceptionFilter', () => {
  let filter: ConversationsExceptionFilter;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockHost: any;

  beforeEach(() => {
    filter = new ConversationsExceptionFilter();
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => ({ status: mockStatus }),
        getRequest: () => ({ url: '/v1/conversations', method: 'POST' }),
      }),
    };
  });

  function getResponseBody(): ConversationErrorResponse {
    return mockJson.mock.calls[0][0];
  }

  it('returns consistent shape for BadRequestException', () => {
    filter.catch(new BadRequestException('Invalid input'), mockHost);

    const body = getResponseBody();
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(body).toEqual({
      statusCode: 400,
      error: 'BAD_REQUEST',
      message: 'Invalid input',
      timestamp: expect.any(String),
      path: '/v1/conversations',
    });
  });

  it('returns consistent shape for NotFoundException', () => {
    filter.catch(new NotFoundException('Conversation not found'), mockHost);

    const body = getResponseBody();
    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(body.statusCode).toBe(404);
    expect(body.error).toBe('NOT_FOUND');
    expect(body.message).toBe('Conversation not found');
    expect(body.path).toBe('/v1/conversations');
  });

  it('returns consistent shape for HttpException with object response', () => {
    filter.catch(
      new HttpException(
        { error: 'CONFLICT', message: 'Conversation already exists' },
        HttpStatus.CONFLICT,
      ),
      mockHost,
    );

    const body = getResponseBody();
    expect(body.statusCode).toBe(409);
    expect(body.error).toBe('CONFLICT');
    expect(body.message).toBe('Conversation already exists');
  });

  it('returns consistent shape for HttpException with string response', () => {
    filter.catch(
      new HttpException('Forbidden', HttpStatus.FORBIDDEN),
      mockHost,
    );

    const body = getResponseBody();
    expect(body.statusCode).toBe(403);
    expect(body.error).toBe('FORBIDDEN');
    expect(body.message).toBe('Forbidden');
  });

  it('returns 500 for unknown errors', () => {
    filter.catch(new Error('unexpected crash'), mockHost);

    const body = getResponseBody();
    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(body.statusCode).toBe(500);
    expect(body.error).toBe('INTERNAL_ERROR');
    expect(body.message).toBe('unexpected crash');
  });

  it('returns 500 for non-Error thrown values', () => {
    filter.catch('string error', mockHost);

    const body = getResponseBody();
    expect(body.statusCode).toBe(500);
    expect(body.error).toBe('INTERNAL_ERROR');
    expect(body.message).toBe('Internal server error');
  });

  it('joins array messages into single string', () => {
    filter.catch(
      new HttpException(
        { message: ['content must not be empty', 'content must be a string'], error: 'Bad Request' },
        HttpStatus.BAD_REQUEST,
      ),
      mockHost,
    );

    const body = getResponseBody();
    expect(body.message).toBe('content must not be empty; content must be a string');
  });

  it('handles 429 Too Many Requests', () => {
    filter.catch(
      new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS),
      mockHost,
    );

    const body = getResponseBody();
    expect(body.statusCode).toBe(429);
    expect(body.error).toBe('TOO_MANY_REQUESTS');
  });

  it('includes timestamp in ISO format', () => {
    filter.catch(new BadRequestException('test'), mockHost);

    const body = getResponseBody();
    expect(() => new Date(body.timestamp)).not.toThrow();
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it('all error responses have exactly the same keys', () => {
    const exceptions = [
      new BadRequestException('bad'),
      new NotFoundException('missing'),
      new HttpException('forbidden', 403),
      new Error('crash'),
    ];

    const expectedKeys = ['statusCode', 'error', 'message', 'timestamp', 'path'];

    for (const exception of exceptions) {
      mockJson.mockClear();
      mockStatus.mockClear().mockReturnValue({ json: mockJson });
      filter.catch(exception, mockHost);
      const body = getResponseBody();
      expect(Object.keys(body).sort()).toEqual(expectedKeys.sort());
    }
  });
});
