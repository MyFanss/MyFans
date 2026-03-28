import { validateFile, formatFileSize } from './upload-utils';

describe('Upload utilities', () => {
  describe('validateFile', () => {
    it('validates correct file type', () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      expect(validateFile(file)).toBeNull();
    });

    it('rejects invalid file type', () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      const error = validateFile(file);
      expect(error).toContain('Invalid file type');
    });

    it('validates file size', () => {
      const file = new File(['x'.repeat(20 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
      const error = validateFile(file, 10 * 1024 * 1024);
      expect(error).toContain('exceeds');
    });

    it('accepts file within size limit', () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      expect(validateFile(file, 10 * 1024 * 1024)).toBeNull();
    });

    it('uses custom accepted types', () => {
      const file = new File(['content'], 'test.png', { type: 'image/png' });
      const error = validateFile(file, 10 * 1024 * 1024, ['image/jpeg']);
      expect(error).toContain('Invalid file type');
    });
  });

  describe('formatFileSize', () => {
    it('formats bytes', () => {
      expect(formatFileSize(512)).toBe('512 B');
    });

    it('formats kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(2048)).toBe('2.0 KB');
    });

    it('formats megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
      expect(formatFileSize(10 * 1024 * 1024)).toBe('10.0 MB');
    });
  });
});
