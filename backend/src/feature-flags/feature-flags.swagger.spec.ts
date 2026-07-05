import { FeatureFlagsController } from './feature-flags.controller';

describe('FeatureFlagsController - Swagger/OpenAPI documentation', () => {
  const proto = FeatureFlagsController.prototype;

  function getControllerMethod(name: 'getFlags'): object {
    const value: unknown = Object.getOwnPropertyDescriptor(proto, name)?.value;

    if (typeof value !== 'function') {
      throw new Error(`Missing controller method: ${name}`);
    }

    return value;
  }

  it('controller carries the feature-flags API tag', () => {
    const tags = Reflect.getMetadata(
      'swagger/apiUseTags',
      FeatureFlagsController,
    ) as string[];

    expect(tags).toContain('feature-flags');
  });

  it('documents the GET feature flags operation', () => {
    const operation = Reflect.getMetadata(
      'swagger/apiOperation',
      getControllerMethod('getFlags'),
    ) as { summary?: string; description?: string };

    expect(operation.summary).toMatch(/feature flags/i);
    expect(operation.description).toMatch(/currently enabled/i);
  });

  it('documents typed success and standard guarded responses', () => {
    const responses = Reflect.getMetadata(
      'swagger/apiResponse',
      getControllerMethod('getFlags'),
    ) as Record<string, { description?: string; type?: unknown }> | undefined;

    expect(
      (responses?.['200']?.type as { name?: string } | undefined)?.name,
    ).toBe('FeatureFlagsResponseDto');
    expect(responses?.['401']?.description).toMatch(/unauthorized/i);
    expect(responses?.['429']?.description).toMatch(/too many requests/i);
  });
});
