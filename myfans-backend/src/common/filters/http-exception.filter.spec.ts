import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { HttpExceptionFilter } from './http-exception.filter';

function buildHost(
  request: Partial<Request>,
  response: Partial<Response>,
): ArgumentsHost {
  return {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(request),
      getResponse: jest.fn().mockReturnValue(response),
    }),
  } as unknown as ArgumentsHost;
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let mockResponse: Partial<Response>;
  let mockRequest: Partial<Request>;

  beforeEach(() => {
    filter = new HttpExceptionFilter();

    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockResponse = { status: statusMock };
    mockRequest = { originalUrl: '/v1/test-endpoint' };
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.NODE_ENV;
  });

  describe('HttpException handling', () => {
    it('should handle HttpException with string response', () => {
      const exception = new HttpException('Custom error message', HttpStatus.BAD_REQUEST);
      const host = buildHost(mockRequest, mockResponse);

      filter.catch(exception, host);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Custom error message',
          path: '/v1/test-endpoint',
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        }),
      );
    });

    it('should handle NotFoundException with string message', () => {
      const exception = new NotFoundException('Post not found');
      const host = buildHost(mockRequest, mockResponse);

      filter.catch(exception, host);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          error: 'Not Found',
          message: 'Post not found',
          path: '/v1/test-endpoint',
        }),
      );
    });

    it('should preserve 403 status for ForbiddenException', () => {
      const exception = new ForbiddenException('Access denied');
      const host = buildHost(mockRequest, mockResponse);

      filter.catch(exception, host);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Access denied',
        }),
      );
    });

    it('should preserve 401 status for UnauthorizedException', () => {
      const exception = new UnauthorizedException('Token expired');
      const host = buildHost(mockRequest, mockResponse);

      filter.catch(exception, host);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 401, error: 'Unauthorized' }),
      );
    });

    it('should handle BadRequestException with array messages (validation errors)', () => {
      const validationMessages = ['username must not be empty', 'email must be a valid email'];
      const exception = new BadRequestException(validationMessages);
      const host = buildHost(mockRequest, mockResponse);

      filter.catch(exception, host);

      expect(statusMock).toHaveBeenCalledWith(400);
      const body = jsonMock.mock.calls[0][0];
      expect(Array.isArray(body.message)).toBe(true);
      expect(body.message).toEqual(validationMessages);
    });

    it('should extract path from request.originalUrl', () => {
      const request: Partial<Request> = { originalUrl: '/v1/creators/abc-123/subscribe' };
      const exception = new NotFoundException();
      const host = buildHost(request, mockResponse);

      filter.catch(exception, host);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/v1/creators/abc-123/subscribe' }),
      );
    });

    it('should include a valid ISO 8601 timestamp', () => {
      const exception = new NotFoundException();
      const host = buildHost(mockRequest, mockResponse);

      filter.catch(exception, host);

      const body = jsonMock.mock.calls[0][0];
      expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should always include all 5 required fields for HttpExceptions', () => {
      const exception = new NotFoundException('Something missing');
      const host = buildHost(mockRequest, mockResponse);

      filter.catch(exception, host);

      const body = jsonMock.mock.calls[0][0];
      expect(body).toHaveProperty('statusCode');
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('path');
    });
  });

  describe('Unknown/non-HTTP exception handling', () => {
    it('should return 500 for unknown Error in development', () => {
      process.env.NODE_ENV = 'development';
      const exception = new Error('DB connection lost');
      const host = buildHost(mockRequest, mockResponse);

      filter.catch(exception, host);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'DB connection lost',
        }),
      );
    });

    it('should sanitize error message in production for unknown exceptions', () => {
      process.env.NODE_ENV = 'production';
      const exception = new Error('Sensitive DB details here');
      const host = buildHost(mockRequest, mockResponse);

      filter.catch(exception, host);

      expect(statusMock).toHaveBeenCalledWith(500);
      const body = jsonMock.mock.calls[0][0];
      expect(body.message).toBe('Internal server error');
      expect(body.message).not.toContain('Sensitive DB details');
    });

    it('should return "Unknown error" for non-Error thrown values in development', () => {
      process.env.NODE_ENV = 'development';
      const host = buildHost(mockRequest, mockResponse);

      filter.catch('raw string thrown', host);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Unknown error' }),
      );
    });

    it('should always include all 5 required fields for unknown exceptions', () => {
      const exception = new Error('Unexpected failure');
      const host = buildHost(mockRequest, mockResponse);

      filter.catch(exception, host);

      const body = jsonMock.mock.calls[0][0];
      expect(body).toHaveProperty('statusCode');
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('path');
    });

    it('should use the request path for unknown exceptions', () => {
      const request: Partial<Request> = { originalUrl: '/v1/payments/process' };
      const exception = new Error('Timeout');
      const host = buildHost(request, mockResponse);

      filter.catch(exception, host);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/v1/payments/process' }),
      );
    });
  });
});
