import { Test, TestingModule } from '@nestjs/testing';
import { SecurityHeadersMiddleware } from './security-headers.middleware';
import { Request, Response, NextFunction } from 'express';

describe('SecurityHeadersMiddleware', () => {
    let middleware: SecurityHeadersMiddleware;
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [SecurityHeadersMiddleware],
        }).compile();

        middleware = module.get<SecurityHeadersMiddleware>(SecurityHeadersMiddleware);

        mockRequest = {
            headers: {},
            method: 'GET',
            originalUrl: '/test',
            ip: '127.0.0.1',
        };

        mockResponse = {
            setHeader: jest.fn(),
            removeHeader: jest.fn(),
        };

        mockNext = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(middleware).toBeDefined();
    });

    it('should set X-Frame-Options header', () => {
        middleware.use(
            mockRequest as Request,
            mockResponse as Response,
            mockNext,
        );

        expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    });

    it('should set X-Content-Type-Options header', () => {
        middleware.use(
            mockRequest as Request,
            mockResponse as Response,
            mockNext,
        );

        expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    });

    it('should set X-XSS-Protection header', () => {
        middleware.use(
            mockRequest as Request,
            mockResponse as Response,
            mockNext,
        );

        expect(mockResponse.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
    });

    it('should set Referrer-Policy header', () => {
        middleware.use(
            mockRequest as Request,
            mockResponse as Response,
            mockNext,
        );

        expect(mockResponse.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
    });

    it('should set Permissions-Policy header', () => {
        middleware.use(
            mockRequest as Request,
            mockResponse as Response,
            mockNext,
        );

        expect(mockResponse.setHeader).toHaveBeenCalledWith('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    });

    it('should set Cross-Origin-Embedder-Policy header', () => {
        middleware.use(
            mockRequest as Request,
            mockResponse as Response,
            mockNext,
        );

        expect(mockResponse.setHeader).toHaveBeenCalledWith('Cross-Origin-Embedder-Policy', 'require-corp');
    });

    it('should set Cross-Origin-Opener-Policy header', () => {
        middleware.use(
            mockRequest as Request,
            mockResponse as Response,
            mockNext,
        );

        expect(mockResponse.setHeader).toHaveBeenCalledWith('Cross-Origin-Opener-Policy', 'same-origin');
    });

    it('should set Cross-Origin-Resource-Policy header', () => {
        middleware.use(
            mockRequest as Request,
            mockResponse as Response,
            mockNext,
        );

        expect(mockResponse.setHeader).toHaveBeenCalledWith('Cross-Origin-Resource-Policy', 'same-origin');
    });

    it('should set Content-Security-Policy header', () => {
        middleware.use(
            mockRequest as Request,
            mockResponse as Response,
            mockNext,
        );

        expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Security-Policy', expect.any(String));
        const cspCall = (mockResponse.setHeader as jest.Mock).mock.calls.find(
            (call: string[]) => call[0] === 'Content-Security-Policy',
        );
        expect(cspCall).toBeDefined();
        expect(cspCall[1]).toContain("default-src 'self'");
    });

    it('should call next middleware', () => {
        middleware.use(
            mockRequest as Request,
            mockResponse as Response,
            mockNext,
        );

        expect(mockNext).toHaveBeenCalled();
    });

    it('should remove X-Powered-By header', () => {
        middleware.use(
            mockRequest as Request,
            mockResponse as Response,
            mockNext,
        );

        expect(mockResponse.removeHeader).toHaveBeenCalledWith('X-Powered-By');
    });

    it('should remove Server header', () => {
        middleware.use(
            mockRequest as Request,
            mockResponse as Response,
            mockNext,
        );

        expect(mockResponse.removeHeader).toHaveBeenCalledWith('Server');
    });

    describe('in development mode', () => {
        beforeAll(() => {
            process.env.NODE_ENV = 'development';
        });

        afterAll(() => {
            delete process.env.NODE_ENV;
        });

        it('should have relaxed CSP for development', () => {
            const freshMiddleware = new SecurityHeadersMiddleware();
            freshMiddleware.use(
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );

            const cspCall = (mockResponse.setHeader as jest.Mock).mock.calls.find(
                (call: string[]) => call[0] === 'Content-Security-Policy',
            );
            expect(cspCall[1]).toContain("'unsafe-inline'");
        });
    });

    describe('in production mode', () => {
        beforeAll(() => {
            process.env.NODE_ENV = 'production';
        });

        afterAll(() => {
            delete process.env.NODE_ENV;
        });

        it('should have strict CSP for production', () => {
            const freshMiddleware = new SecurityHeadersMiddleware();
            mockResponse.setHeader = jest.fn();
            mockResponse.removeHeader = jest.fn();

            freshMiddleware.use(
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );

            const cspCall = (mockResponse.setHeader as jest.Mock).mock.calls.find(
                (call: string[]) => call[0] === 'Content-Security-Policy',
            );
            expect(cspCall[1]).not.toContain("'unsafe-inline'");
            expect(cspCall[1]).toContain("default-src 'self'");
        });

        it('should set HSTS header in production', () => {
            const freshMiddleware = new SecurityHeadersMiddleware();
            mockResponse.setHeader = jest.fn();
            mockResponse.removeHeader = jest.fn();

            freshMiddleware.use(
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );

            expect(mockResponse.setHeader).toHaveBeenCalledWith(
                'Strict-Transport-Security',
                'max-age=31536000; includeSubDomains; preload',
            );
        });
    });
});
