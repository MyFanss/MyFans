import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetricsGuard } from './metrics.guard';

describe('MetricsGuard', () => {
  let guard: MetricsGuard;
  let configService: ConfigService;

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    } as unknown as ConfigService;
    guard = new MetricsGuard(configService);
  });

  it('throws UnauthorizedException when Authorization header is missing', () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
      }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(mockContext)).toThrow(
      new UnauthorizedException('Missing authorization token'),
    );
  });

  it('throws UnauthorizedException when Authorization header is not Bearer format', () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: 'Basic dXNlcjpwYXNz' },
        }),
      }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(mockContext)).toThrow(
      new UnauthorizedException('Invalid authorization header format'),
    );
  });

  it('throws UnauthorizedException when METRICS_SCRAPE_TOKEN is not configured', () => {
    (configService.get as jest.Mock).mockReturnValue(undefined);

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: 'Bearer mytoken' },
        }),
      }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(mockContext)).toThrow(
      new UnauthorizedException('Metrics scrape token not configured'),
    );
  });

  it('throws UnauthorizedException when token is invalid', () => {
    (configService.get as jest.Mock).mockReturnValue('expected-token');

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: 'Bearer wrong-token' },
        }),
      }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(mockContext)).toThrow(
      new UnauthorizedException('Invalid scrape token'),
    );
  });

  it('returns true when token is valid', () => {
    (configService.get as jest.Mock).mockReturnValue('expected-token');

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: 'Bearer expected-token' },
        }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(mockContext)).toBe(true);
  });
});
