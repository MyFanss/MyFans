import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateCommentDto, UpdateCommentDto } from './comment.dto';

// ── helpers ──────────────────────────────────────────────────────────────────

async function validateDto<T extends object>(cls: new () => T, plain: object) {
  const dto = plainToInstance(cls, plain);
  return validate(dto);
}

const VALID_UUID = '00000000-0000-4000-8000-000000000001';

// ── CreateCommentDto ─────────────────────────────────────────────────────────

describe('CreateCommentDto – validation', () => {
  const validPayload = {
    content: 'Great post!',
    postId: VALID_UUID,
  };

  it('accepts a fully valid payload', async () => {
    const errors = await validateDto(CreateCommentDto, validPayload);
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid payload with optional parentId', async () => {
    const errors = await validateDto(CreateCommentDto, {
      ...validPayload,
      parentId: VALID_UUID,
    });
    expect(errors).toHaveLength(0);
  });

  // ── content ────────────────────────────────────────────────────────────────

  describe('content', () => {
    it('rejects missing content', async () => {
      const { content, ...rest } = validPayload;
      const errors = await validateDto(CreateCommentDto, rest);
      expect(errors.some((e) => e.property === 'content')).toBe(true);
    });

    it('rejects empty string content', async () => {
      const errors = await validateDto(CreateCommentDto, {
        ...validPayload,
        content: '',
      });
      const err = errors.find((e) => e.property === 'content');
      expect(err).toBeDefined();
    });

    it('rejects content shorter than 1 character', async () => {
      const errors = await validateDto(CreateCommentDto, {
        ...validPayload,
        content: '',
      });
      expect(errors.some((e) => e.property === 'content')).toBe(true);
    });

    it('rejects content longer than 2000 characters', async () => {
      const errors = await validateDto(CreateCommentDto, {
        ...validPayload,
        content: 'a'.repeat(2001),
      });
      const err = errors.find((e) => e.property === 'content');
      expect(err).toBeDefined();
      expect(err?.constraints).toHaveProperty('maxLength');
    });

    it('accepts content with exactly 2000 characters', async () => {
      const errors = await validateDto(CreateCommentDto, {
        ...validPayload,
        content: 'a'.repeat(2000),
      });
      expect(errors.filter((e) => e.property === 'content')).toHaveLength(0);
    });

    it('rejects non-string content', async () => {
      const errors = await validateDto(CreateCommentDto, {
        ...validPayload,
        content: 12345,
      });
      const err = errors.find((e) => e.property === 'content');
      expect(err).toBeDefined();
      expect(err?.constraints).toHaveProperty('isString');
    });
  });

  // ── postId ─────────────────────────────────────────────────────────────────

  describe('postId', () => {
    it('rejects missing postId', async () => {
      const { postId, ...rest } = validPayload;
      const errors = await validateDto(CreateCommentDto, rest);
      expect(errors.some((e) => e.property === 'postId')).toBe(true);
    });

    it('rejects empty string postId', async () => {
      const errors = await validateDto(CreateCommentDto, {
        ...validPayload,
        postId: '',
      });
      expect(errors.some((e) => e.property === 'postId')).toBe(true);
    });

    it('rejects non-UUID postId', async () => {
      const errors = await validateDto(CreateCommentDto, {
        ...validPayload,
        postId: 'not-a-uuid',
      });
      const err = errors.find((e) => e.property === 'postId');
      expect(err).toBeDefined();
      expect(err?.constraints).toHaveProperty('isUuid');
    });

    it('rejects non-string postId', async () => {
      const errors = await validateDto(CreateCommentDto, {
        ...validPayload,
        postId: 123,
      });
      const err = errors.find((e) => e.property === 'postId');
      expect(err).toBeDefined();
    });
  });

  // ── parentId ───────────────────────────────────────────────────────────────

  describe('parentId', () => {
    it('accepts omitted parentId (optional)', async () => {
      const errors = await validateDto(CreateCommentDto, validPayload);
      expect(errors.filter((e) => e.property === 'parentId')).toHaveLength(0);
    });

    it('rejects non-UUID parentId', async () => {
      const errors = await validateDto(CreateCommentDto, {
        ...validPayload,
        parentId: 'not-a-uuid',
      });
      const err = errors.find((e) => e.property === 'parentId');
      expect(err).toBeDefined();
      expect(err?.constraints).toHaveProperty('isUuid');
    });

    it('rejects non-string parentId', async () => {
      const errors = await validateDto(CreateCommentDto, {
        ...validPayload,
        parentId: 999,
      });
      const err = errors.find((e) => e.property === 'parentId');
      expect(err).toBeDefined();
    });
  });

  // ── combined ───────────────────────────────────────────────────────────────

  describe('combined validation', () => {
    it('reports multiple errors simultaneously when all required fields are missing', async () => {
      const errors = await validateDto(CreateCommentDto, {});
      expect(errors.length).toBeGreaterThanOrEqual(2);
    });
  });
});

// ── UpdateCommentDto ─────────────────────────────────────────────────────────

describe('UpdateCommentDto – validation', () => {
  it('accepts an empty payload (all fields optional)', async () => {
    const errors = await validateDto(UpdateCommentDto, {});
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid content update', async () => {
    const errors = await validateDto(UpdateCommentDto, {
      content: 'Updated comment text',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects empty string content', async () => {
    const errors = await validateDto(UpdateCommentDto, { content: '' });
    const err = errors.find((e) => e.property === 'content');
    expect(err).toBeDefined();
  });

  it('rejects content shorter than 1 character', async () => {
    const errors = await validateDto(UpdateCommentDto, { content: '' });
    expect(errors.some((e) => e.property === 'content')).toBe(true);
  });

  it('rejects content longer than 2000 characters', async () => {
    const errors = await validateDto(UpdateCommentDto, {
      content: 'x'.repeat(2001),
    });
    const err = errors.find((e) => e.property === 'content');
    expect(err).toBeDefined();
    expect(err?.constraints).toHaveProperty('maxLength');
  });

  it('accepts content with exactly 2000 characters', async () => {
    const errors = await validateDto(UpdateCommentDto, {
      content: 'x'.repeat(2000),
    });
    expect(errors.filter((e) => e.property === 'content')).toHaveLength(0);
  });

  it('rejects non-string content', async () => {
    const errors = await validateDto(UpdateCommentDto, { content: 42 });
    const err = errors.find((e) => e.property === 'content');
    expect(err).toBeDefined();
    expect(err?.constraints).toHaveProperty('isString');
  });
});
