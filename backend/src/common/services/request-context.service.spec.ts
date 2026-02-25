import { Test, TestingModule } from '@nestjs/testing';
import { RequestContextService, RequestContext } from './request-context.service';

describe('RequestContextService', () => {
    let service: RequestContextService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [RequestContextService],
        }).compile();

        service = module.get<RequestContextService>(RequestContextService);
        
        // Clear context before each test
        service.clearContext();
    });

    afterEach(() => {
        service.clearContext();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should set and get context', () => {
        const mockContext: RequestContext = {
            correlationId: 'test-correlation-id',
            requestId: 'test-request-id',
            method: 'GET',
            url: '/test',
            ip: '127.0.0.1',
            userAgent: 'test-agent',
            userId: null,
        };

        service.setContext(mockContext);
        const retrievedContext = service.getContext();

        expect(retrievedContext).toEqual(mockContext);
    });

    it('should return null when no context is set', () => {
        expect(service.getContext()).toBeNull();
        expect(service.getCorrelationId()).toBeNull();
        expect(service.getRequestId()).toBeNull();
        expect(service.getUserId()).toBeNull();
    });

    it('should return correct IDs when context is set', () => {
        const mockContext: RequestContext = {
            correlationId: 'test-correlation-id',
            requestId: 'test-request-id',
            method: 'GET',
            url: '/test',
            ip: '127.0.0.1',
            userAgent: 'test-agent',
            userId: 'user123',
        };

        service.setContext(mockContext);

        expect(service.getCorrelationId()).toBe('test-correlation-id');
        expect(service.getRequestId()).toBe('test-request-id');
        expect(service.getUserId()).toBe('user123');
    });

    it('should set user ID correctly', () => {
        const mockContext: RequestContext = {
            correlationId: 'test-correlation-id',
            requestId: 'test-request-id',
            method: 'GET',
            url: '/test',
            ip: '127.0.0.1',
            userAgent: 'test-agent',
            userId: null,
        };

        service.setContext(mockContext);
        expect(service.getUserId()).toBeNull();

        service.setUserId('user456');
        expect(service.getUserId()).toBe('user456');
    });

    it('should return log context correctly', () => {
        const mockContext: RequestContext = {
            correlationId: 'test-correlation-id',
            requestId: 'test-request-id',
            method: 'GET',
            url: '/test',
            ip: '127.0.0.1',
            userAgent: 'test-agent',
            userId: 'user123',
        };

        service.setContext(mockContext);
        const logContext = service.getLogContext();

        expect(logContext).toEqual({
            correlationId: 'test-correlation-id',
            requestId: 'test-request-id',
            userId: 'user123',
            method: 'GET',
            url: '/test',
            ip: '127.0.0.1',
        });
    });

    it('should return empty log context when no context is set', () => {
        const logContext = service.getLogContext();
        expect(logContext).toEqual({});
    });

    it('should clear context correctly', () => {
        const mockContext: RequestContext = {
            correlationId: 'test-correlation-id',
            requestId: 'test-request-id',
            method: 'GET',
            url: '/test',
            ip: '127.0.0.1',
            userAgent: 'test-agent',
            userId: 'user123',
        };

        service.setContext(mockContext);
        expect(service.getContext()).not.toBeNull();

        service.clearContext();
        expect(service.getContext()).toBeNull();
    });
});
