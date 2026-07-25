import {
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import {
  SubscriptionsExceptionFilter,
  SubscriptionErrorResponse,
} from './subscriptions-exception.filter';

describe('SubscriptionsExceptionFilter', () => {
  let filter: SubscriptionsExceptionFilter;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockHost: any;

  beforeEach(() => {
    filter = new SubscriptionsExceptionFilter();
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => ({ status: mockStatus }),
        getRequest: () => ({ url: '/v1/subscriptions/checkout', method: 'POST' }),
      }),
    };
  });

  function getResponseBody(): SubscriptionErrorResponse {
    return mockJson.mock.calls[0][0];
  }

  it('returns consistent shape for BadRequestException', () => {
    filter.catch(new BadRequestException('Invalid plan'), mockHost);

    const body = getResponseBody();
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(body).toEqual({
      statusCode: 400,
      error: 'BAD_REQUEST',
      message: 'Invalid plan',
      timestamp: expect.any(String),
      path: '/v1/subscriptions/checkout',
    });
  });

  it('returns consistent shape for NotFoundException', () => {
    filter.catch(new NotFoundException('Checkout not found'), mockHost);

    const body = getResponseBody();
    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(body.statusCode).toBe(404);
    expect(body.error).toBe('NOT_FOUND');
    expect(body.message).toBe('Checkout not found');
    expect(body.path).toBe('/v1/subscriptions/checkout');
  });

  it('returns consistent shape for HttpException with object response', () => {
    filter.catch(
      new HttpException(
        { error: 'NETWORK_MISMATCH', message: 'Wallet network mismatch' },
        HttpStatus.BAD_REQUEST,
      ),
      mockHost,
    );

    const body = getResponseBody();
    expect(body.statusCode).toBe(400);
    expect(body.error).toBe('NETWORK_MISMATCH');
    expect(body.message).toBe('Wallet network mismatch');
  });

  it('returns consistent shape for HttpException with string response', () => {
    filter.catch(
      new HttpException('Something went wrong', HttpStatus.FORBIDDEN),
      mockHost,
    );

    const body = getResponseBody();
    expect(body.statusCode).toBe(403);
    expect(body.error).toBe('FORBIDDEN');
    expect(body.message).toBe('Something went wrong');
  });

  it('returns 500 for unknown errors', () => {
    filter.catch(new Error('unexpected'), mockHost);

    const body = getResponseBody();
    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(body.statusCode).toBe(500);
    expect(body.error).toBe('INTERNAL_ERROR');
    expect(body.message).toBe('unexpected');
  });

  it('returns 500 for non-Error thrown values', () => {
    filter.catch('string error', mockHost);

    const body = getResponseBody();
    expect(body.statusCode).toBe(500);
    expect(body.error).toBe('INTERNAL_ERROR');
    expect(body.message).toBe('Internal server error');
  });

  it('includes timestamp in ISO format', () => {
    filter.catch(new BadRequestException('test'), mockHost);

    const body = getResponseBody();
    expect(() => new Date(body.timestamp)).not.toThrow();
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it('includes request path', () => {
    filter.catch(new BadRequestException('test'), mockHost);

    const body = getResponseBody();
    expect(body.path).toBe('/v1/subscriptions/checkout');
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

  it('joins array messages into single string', () => {
    filter.catch(
      new HttpException(
        { message: ['field1 is required', 'field2 must be a number'], error: 'Bad Request' },
        HttpStatus.BAD_REQUEST,
      ),
      mockHost,
    );

    const body = getResponseBody();
    expect(body.message).toBe('field1 is required; field2 must be a number');
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
