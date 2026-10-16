import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { RedactionExceptionFilter } from './redaction.exception-filter';

type JsonSpy = jest.Mock;

interface MockResponse {
  status: jest.Mock;
  json: JsonSpy;
}

function createHost(): { host: ArgumentsHost; response: MockResponse } {
  const response: MockResponse = {
    status: jest.fn(),
    json: jest.fn(),
  };
  response.status.mockReturnValue(response);

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({}),
      getNext: () => undefined,
    }),
  } as unknown as ArgumentsHost;

  return { host, response };
}

function capturedBody(response: MockResponse): Record<string, unknown> {
  expect(response.json).toHaveBeenCalledTimes(1);
  return response.json.mock.calls[0][0] as Record<string, unknown>;
}

function serialized(response: MockResponse): string {
  return JSON.stringify(capturedBody(response));
}

describe('RedactionExceptionFilter', () => {
  let filter: RedactionExceptionFilter;

  beforeEach(() => {
    filter = new RedactionExceptionFilter();
  });

  it('scrubs a JWT embedded in the exception payload', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const exception = new HttpException(
      {
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Unauthorized',
        correlationId: 'corr-jwt-1',
        authorization: `Bearer ${jwt}`,
      },
      HttpStatus.UNAUTHORIZED,
    );

    const { host, response } = createHost();
    filter.catch(exception, host);

    const body = serialized(response);
    expect(body).not.toContain(jwt);
    expect(body).toContain('[REDACTED]');
  });

  it('scrubs cookie headers and webhook secrets', () => {
    const cookieValue = 'session=abc123supersecretcookie';
    const webhookSecret = 'whsec_9f8e7d6c5b4a3210';
    const exception = new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Bad request',
        correlationId: 'corr-cookie-1',
        headers: { cookie: cookieValue },
        webhookSecret,
      },
      HttpStatus.BAD_REQUEST,
    );

    const { host, response } = createHost();
    filter.catch(exception, host);

    const body = serialized(response);
    expect(body).not.toContain(cookieValue);
    expect(body).not.toContain(webhookSecret);
    expect(body).toContain('[REDACTED]');
  });

  it('scrubs payout fields', () => {
    const wallet = '0xDEADBEEFCAFEBABE1234567890abcdef';
    const amount = '1234.56';
    const exception = new HttpException(
      {
        statusCode: HttpStatus.CONFLICT,
        message: 'Payout failed',
        correlationId: 'corr-payout-1',
        payout: { wallet, amount },
      },
      HttpStatus.CONFLICT,
    );

    const { host, response } = createHost();
    filter.catch(exception, host);

    const body = serialized(response);
    expect(body).not.toContain(wallet);
    expect(body).not.toContain(amount);
    expect(body).toContain('[REDACTED]');
  });

  it('preserves non-sensitive fields such as statusCode and correlationId', () => {
    const exception = new HttpException(
      {
        statusCode: HttpStatus.FORBIDDEN,
        message: 'Forbidden',
        correlationId: 'corr-preserve-1',
        authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.abc',
      },
      HttpStatus.FORBIDDEN,
    );

    const { host, response } = createHost();
    filter.catch(exception, host);

    const body = capturedBody(response);
    expect(body.statusCode).toBe(HttpStatus.FORBIDDEN);
    expect(body.correlationId).toBe('corr-preserve-1');
  });
});
