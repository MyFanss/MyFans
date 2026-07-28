import {
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AuthExceptionFilter,
  AuthErrorResponse,
} from './auth-exception.filter';

describe('AuthExceptionFilter', () => {
  let filter: AuthExceptionFilter;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockHost: any;

  beforeEach(() => {
    filter = new AuthExceptionFilter();
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => ({ status: mockStatus }),
        getRequest: () => ({ url: '/v1/auth/login', method: 'POST' }),
      }),
    };
  });

  function getBody(): AuthErrorResponse {
    return mockJson.mock.calls[0][0];
  }

  it('returns consistent shape for BadRequestException', () => {
    filter.catch(new BadRequestException('Invalid Stellar address'), mockHost);

    const body = getBody();
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(body).toEqual({
      statusCode: 400,
      error: 'BAD_REQUEST',
      message: 'Invalid Stellar address',
      timestamp: expect.any(String),
      path: '/v1/auth/login',
    });
  });

  it('returns consistent shape for UnauthorizedException', () => {
    filter.catch(new UnauthorizedException('Challenge expired'), mockHost);

    const body = getBody();
    expect(mockStatus).toHaveBeenCalledWith(401);
    expect(body.statusCode).toBe(401);
    expect(body.error).toBe('UNAUTHORIZED');
    expect(body.message).toBe('Challenge expired');
    expect(body.path).toBe('/v1/auth/login');
  });

  it('returns consistent shape for NotFoundException', () => {
    filter.catch(new NotFoundException('Resource not found'), mockHost);

    const body = getBody();
    expect(body.statusCode).toBe(404);
    expect(body.error).toBe('NOT_FOUND');
    expect(body.message).toBe('Resource not found');
  });

  it('extracts error and message from HttpException with object response', () => {
    filter.catch(
      new HttpException(
        {
          error: 'NETWORK_MISMATCH',
          message: 'Wallet network does not match server network',
          expectedNetwork: 'testnet',
          currentNetwork: 'mainnet',
        },
        HttpStatus.BAD_REQUEST,
      ),
      mockHost,
    );

    const body = getBody();
    expect(body.statusCode).toBe(400);
    expect(body.error).toBe('NETWORK_MISMATCH');
    expect(body.message).toBe('Wallet network does not match server network');
  });

  it('returns consistent shape for HttpException with string response', () => {
    filter.catch(
      new HttpException('Something went wrong', HttpStatus.FORBIDDEN),
      mockHost,
    );

    const body = getBody();
    expect(body.statusCode).toBe(403);
    expect(body.error).toBe('FORBIDDEN');
    expect(body.message).toBe('Something went wrong');
  });

  it('returns 500 for unknown errors', () => {
    filter.catch(new Error('unexpected crash'), mockHost);

    const body = getBody();
    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(body.statusCode).toBe(500);
    expect(body.error).toBe('INTERNAL_ERROR');
    expect(body.message).toBe('unexpected crash');
  });

  it('returns 500 for non-Error thrown values', () => {
    filter.catch('string error', mockHost);

    const body = getBody();
    expect(body.statusCode).toBe(500);
    expect(body.error).toBe('INTERNAL_ERROR');
    expect(body.message).toBe('Internal server error');
  });

  it('joins array messages into a single string', () => {
    filter.catch(
      new HttpException(
        { message: ['field1 is required', 'field2 must be a string'], error: 'Bad Request' },
        HttpStatus.BAD_REQUEST,
      ),
      mockHost,
    );

    const body = getBody();
    expect(body.message).toBe('field1 is required; field2 must be a string');
    expect(body.error).toBe('BAD_REQUEST');
  });

  it('returns 429 for rate-limit errors', () => {
    filter.catch(
      new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS),
      mockHost,
    );

    const body = getBody();
    expect(body.statusCode).toBe(429);
    expect(body.error).toBe('TOO_MANY_REQUESTS');
  });

  it('includes a valid ISO timestamp', () => {
    filter.catch(new BadRequestException('test'), mockHost);

    const body = getBody();
    expect(() => new Date(body.timestamp)).not.toThrow();
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it('includes the request path', () => {
    filter.catch(new BadRequestException('test'), mockHost);

    expect(getBody().path).toBe('/v1/auth/login');
  });

  it('all error responses have exactly the same keys', () => {
    const exceptions = [
      new BadRequestException('bad'),
      new UnauthorizedException('unauth'),
      new NotFoundException('missing'),
      new HttpException('forbidden', 403),
      new Error('crash'),
    ];

    const expectedKeys = ['statusCode', 'error', 'message', 'timestamp', 'path'];

    for (const exception of exceptions) {
      mockJson.mockClear();
      mockStatus.mockClear().mockReturnValue({ json: mockJson });
      filter.catch(exception, mockHost);
      const body = getBody();
      expect(Object.keys(body).sort()).toEqual(expectedKeys.sort());
    }
  });
});
