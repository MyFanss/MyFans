import { CommentsController } from './comments.controller';

// Decorator metadata lives on the unbound prototype methods, so reading it
// back is exactly what these specs are meant to do.

describe('CommentsController – Swagger/OpenAPI documentation', () => {
  const proto = CommentsController.prototype as unknown as Record<
    string,
    object
  >;

  const endpoints = [
    'create',
    'findAll',
    'findByPost',
    'findOne',
    'update',
    'remove',
  ];

  it.each(endpoints)('%s has ApiOperation metadata', (method) => {
    const metadata = Reflect.getMetadata(
      'swagger/apiOperation',
      proto[method],
    ) as { summary?: string } | undefined;
    expect(metadata).toBeDefined();
    expect(metadata?.summary).toBeDefined();
    expect(metadata?.summary?.length).toBeGreaterThan(0);
  });

  it.each(endpoints)('%s has at least one ApiResponse metadata', (method) => {
    const metadata = Reflect.getMetadata(
      'swagger/apiResponse',
      proto[method],
    ) as Record<string, unknown> | undefined;
    expect(metadata).toBeDefined();
    expect(Object.keys(metadata ?? {}).length).toBeGreaterThan(0);
  });

  it('controller class has ApiTags metadata', () => {
    const tags = Reflect.getMetadata(
      'swagger/apiUseTags',
      CommentsController,
    ) as string[];
    expect(tags).toContain('comments');
  });

  const writeEndpoints = ['create', 'update', 'remove'];

  it.each(writeEndpoints)('%s documents 429 rate-limit response', (method) => {
    const metadata = Reflect.getMetadata(
      'swagger/apiResponse',
      proto[method],
    ) as Record<string, { description: string } | undefined>;
    expect(metadata['429']).toBeDefined();
    expect(metadata['429']?.description).toMatch(/too many requests/i);
  });

  const paramEndpoints = ['findOne', 'update', 'remove'];

  it.each(paramEndpoints)('%s has ApiParam metadata for id', (method) => {
    const params = Reflect.getMetadata(
      'swagger/apiParameters',
      proto[method],
    ) as { name: string }[];
    expect(params).toBeDefined();
    const idParam = params.find((p) => p.name === 'id');
    expect(idParam).toBeDefined();
  });

  it('findByPost has ApiParam metadata for postId', () => {
    const params = Reflect.getMetadata(
      'swagger/apiParameters',
      proto.findByPost,
    ) as { name: string }[];
    expect(params).toBeDefined();
    const postIdParam = params.find((p) => p.name === 'postId');
    expect(postIdParam).toBeDefined();
  });

  // @ApiBody and @ApiQuery both write into the shared apiParameters array and
  // are told apart by their `in` field — there is no per-decorator metadata key.
  const parametersIn = (method: string, location: string) =>
    (
      (Reflect.getMetadata('swagger/apiParameters', proto[method]) ?? []) as {
        in: string;
      }[]
    ).filter((p) => p.in === location);

  it.each(['create', 'update'])('%s has ApiBody metadata', (method) => {
    expect(parametersIn(method, 'body').length).toBeGreaterThan(0);
  });

  it.each(['findAll', 'findByPost'])(
    '%s has ApiQuery metadata for pagination',
    (method) => {
      expect(parametersIn(method, 'query').length).toBeGreaterThan(0);
    },
  );
});
