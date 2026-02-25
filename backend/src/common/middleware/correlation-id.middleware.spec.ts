import { Test, TestingModule } from '@nestjs/testing';
import { CorrelationIdMiddleware } from './correlation-id.middleware';
import { RequestContextService } from '../services/request-context.service';
import { Request, Response, NextFunction } from 'express';

describe('CorrelationIdMiddleware', () => {
    let middleware: CorrelationIdMiddleware;
    let requestContextService: RequestContextService;
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [CorrelationIdMiddleware, RequestContextService],
        }).compile();

        middleware = module.get<CorrelationIdMiddleware>(CorrelationIdMiddleware);
        requestContextService = module.get<RequestContextService>(RequestContextService);

        mockRequest = {
            headers: {},
            method: 'GET',
            originalUrl: '/test',
            ip: '127.0.0.1',
        };

        mockResponse = {
            setHeader: jest.fn(),
        };

        mockNext = jest.fn();
    });

    it('should be defined', () => {
        expect(middleware).toBeDefined();
    });

    it('should generate new correlation ID and request ID when not present in headers', () => {
        middleware.use(
            mockRequest as Request,
            mockResponse as Response,
            mockNext,
        );

        expect(mockRequest.headers['x-correlation-id']).toBeDefined();
        expect(mockRequest.headers['x-request-id']).toBeDefined();
        expect(mockResponse.setHeader).toHaveBeenCalledWith('x-correlation-id', expect.any(String));
        expect(mockResponse.setHeader).toHaveBeenCalledWith('x-request-id', expect.any(String));
        expect(mockNext).toHaveBeenCalled();
    });

    it('should use existing correlation ID and request ID when present in headers', () => {
        const existingCorrelationId = 'existing-correlation-id';
        const existingRequestId = 'existing-request-id';

        mockRequest.headers = {
            'x-correlation-id': existingCorrelationId,
            'x-request-id': existingRequestId,
        };

        middleware.use(
            mockRequest as Request,
            mockResponse as Response,
            mockNext,
        );

        expect(mockRequest.headers['x-correlation-id']).toBe(existingCorrelationId);
        expect(mockRequest.headers['x-request-id']).toBe(existingRequestId);
        expect(mockResponse.setHeader).toHaveBeenCalledWith('x-correlation-id', existingCorrelationId);
        expect(mockResponse.setHeader).toHaveBeenCalledWith('x-request-id', existingRequestId);
        expect(mockNext).toHaveBeenCalled();
    });

    it('should set context in RequestContextService', () => {
        middleware.use(
            mockRequest as Request,
            mockResponse as Response,
            mockNext,
        );

        const context = requestContextService.getContext();
        expect(context).toBeDefined();
        expect(context?.correlationId).toBe(mockRequest.headers['x-correlation-id']);
        expect(context?.requestId).toBe(mockRequest.headers['x-request-id']);
        expect(context?.method).toBe('GET');
        expect(context?.url).toBe('/test');
        expect(context?.ip).toBe('127.0.0.1');
        expect(context?.userId).toBeNull();
    });

    it('should generate valid UUIDs', () => {
        middleware.use(
            mockRequest as Request,
            mockResponse as Response,
            mockNext,
        );

        const correlationId = mockRequest.headers['x-correlation-id'] as string;
        const requestId = mockRequest.headers['x-request-id'] as string;

        // UUID v4 regex pattern
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        expect(correlationId).toMatch(uuidRegex);
        expect(requestId).toMatch(uuidRegex);
    });
});
