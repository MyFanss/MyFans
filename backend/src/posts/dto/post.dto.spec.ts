import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreatePostDto, UpdatePostDto } from './post.dto';

async function validateDto<T extends object>(cls: new () => T, plain: object) {
  const dto = plainToInstance(cls, plain);
  return validate(dto);
}

describe('CreatePostDto', () => {
  const valid = { title: 'Hello', content: 'World' };

  it('accepts a valid payload', async () => {
    const errors = await validateDto(CreatePostDto, valid);
    expect(errors).toHaveLength(0);
  });

  describe('title', () => {
    it('rejects missing title', async () => {
      const errors = await validateDto(CreatePostDto, { content: 'Body' });
      expect(errors.some((e) => e.property === 'title')).toBe(true);
    });

    it('rejects empty title', async () => {
      const errors = await validateDto(CreatePostDto, { ...valid, title: '' });
      expect(errors.some((e) => e.property === 'title')).toBe(true);
    });

    it('rejects title exceeding 500 characters', async () => {
      const errors = await validateDto(CreatePostDto, {
        ...valid,
        title: 'a'.repeat(501),
      });
      expect(errors.some((e) => e.property === 'title')).toBe(true);
    });

    it('rejects non-string title', async () => {
      const errors = await validateDto(CreatePostDto, { ...valid, title: 123 });
      expect(errors.some((e) => e.property === 'title')).toBe(true);
    });

    it('accepts title exactly 500 characters', async () => {
      const errors = await validateDto(CreatePostDto, {
        ...valid,
        title: 'a'.repeat(500),
      });
      expect(errors).toHaveLength(0);
    });
  });

  describe('content', () => {
    it('rejects missing content', async () => {
      const errors = await validateDto(CreatePostDto, { title: 'T' });
      expect(errors.some((e) => e.property === 'content')).toBe(true);
    });

    it('rejects empty content', async () => {
      const errors = await validateDto(CreatePostDto, { ...valid, content: '' });
      expect(errors.some((e) => e.property === 'content')).toBe(true);
    });

    it('rejects content exceeding 10000 characters', async () => {
      const errors = await validateDto(CreatePostDto, {
        ...valid,
        content: 'a'.repeat(10001),
      });
      expect(errors.some((e) => e.property === 'content')).toBe(true);
    });

    it('accepts content exactly 10000 characters', async () => {
      const errors = await validateDto(CreatePostDto, {
        ...valid,
        content: 'a'.repeat(10000),
      });
      expect(errors).toHaveLength(0);
    });
  });

  describe('isPublished', () => {
    it('accepts boolean true', async () => {
      const errors = await validateDto(CreatePostDto, {
        ...valid,
        isPublished: true,
      });
      expect(errors).toHaveLength(0);
    });

    it('accepts boolean false', async () => {
      const errors = await validateDto(CreatePostDto, {
        ...valid,
        isPublished: false,
      });
      expect(errors).toHaveLength(0);
    });

    it('rejects non-boolean value', async () => {
      const errors = await validateDto(CreatePostDto, {
        ...valid,
        isPublished: 'yes',
      });
      expect(errors.some((e) => e.property === 'isPublished')).toBe(true);
    });

    it('is optional (absent is valid)', async () => {
      const errors = await validateDto(CreatePostDto, valid);
      expect(errors).toHaveLength(0);
    });
  });

  describe('isPremium', () => {
    it('accepts boolean true', async () => {
      const errors = await validateDto(CreatePostDto, {
        ...valid,
        isPremium: true,
      });
      expect(errors).toHaveLength(0);
    });

    it('rejects non-boolean value', async () => {
      const errors = await validateDto(CreatePostDto, {
        ...valid,
        isPremium: 1,
      });
      expect(errors.some((e) => e.property === 'isPremium')).toBe(true);
    });

    it('is optional (absent is valid)', async () => {
      const errors = await validateDto(CreatePostDto, valid);
      expect(errors).toHaveLength(0);
    });
  });
});

describe('UpdatePostDto', () => {
  it('accepts an empty object (all fields optional)', async () => {
    const errors = await validateDto(UpdatePostDto, {});
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully populated valid payload', async () => {
    const errors = await validateDto(UpdatePostDto, {
      title: 'Updated',
      content: 'New body',
      isPublished: true,
      isPremium: false,
    });
    expect(errors).toHaveLength(0);
  });

  describe('title', () => {
    it('rejects empty string', async () => {
      const errors = await validateDto(UpdatePostDto, { title: '' });
      expect(errors.some((e) => e.property === 'title')).toBe(true);
    });

    it('rejects title exceeding 500 characters', async () => {
      const errors = await validateDto(UpdatePostDto, {
        title: 'a'.repeat(501),
      });
      expect(errors.some((e) => e.property === 'title')).toBe(true);
    });

    it('rejects non-string title', async () => {
      const errors = await validateDto(UpdatePostDto, { title: 42 });
      expect(errors.some((e) => e.property === 'title')).toBe(true);
    });
  });

  describe('content', () => {
    it('rejects empty string', async () => {
      const errors = await validateDto(UpdatePostDto, { content: '' });
      expect(errors.some((e) => e.property === 'content')).toBe(true);
    });

    it('rejects content exceeding 10000 characters', async () => {
      const errors = await validateDto(UpdatePostDto, {
        content: 'a'.repeat(10001),
      });
      expect(errors.some((e) => e.property === 'content')).toBe(true);
    });
  });

  describe('isPublished', () => {
    it('rejects non-boolean value', async () => {
      const errors = await validateDto(UpdatePostDto, { isPublished: 'true' });
      expect(errors.some((e) => e.property === 'isPublished')).toBe(true);
    });
  });

  describe('isPremium', () => {
    it('rejects non-boolean value', async () => {
      const errors = await validateDto(UpdatePostDto, { isPremium: 0 });
      expect(errors.some((e) => e.property === 'isPremium')).toBe(true);
    });
  });
});
