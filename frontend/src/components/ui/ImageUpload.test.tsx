import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImageUpload } from './ImageUpload';

describe('ImageUpload', () => {
  const mockOnUpload = jest.fn();
  const validImageFile = new File(['dummy content'], 'test.jpg', { type: 'image/jpeg' });
  const oversizedFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
  const invalidTypeFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });

  beforeEach(() => {
    mockOnUpload.mockClear();
  });

  it('renders upload input', () => {
    render(<ImageUpload label="Upload Image" onUpload={mockOnUpload} />);
    expect(screen.getByLabelText('Upload Image')).toBeInTheDocument();
  });

  it('accepts only image files via input', () => {
    render(<ImageUpload label="Upload" onUpload={mockOnUpload} />);
    const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
    expect(input?.accept).toBe('image/jpeg,image/png,image/webp');
  });

  it('validates file type and shows error', async () => {
    render(<ImageUpload label="Upload" onUpload={mockOnUpload} />);
    
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(invalidTypeFile);
    
    fireEvent.change(input, { target: { files: dataTransfer.files } });
    
    await waitFor(() => {
      expect(screen.getByText(/Invalid format/)).toBeInTheDocument();
    });
  });

  it('validates file size and shows error', async () => {
    render(<ImageUpload label="Upload" onUpload={mockOnUpload} maxSize={5 * 1024 * 1024} />);
    
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(oversizedFile);
    
    fireEvent.change(input, { target: { files: dataTransfer.files } });
    
    await waitFor(() => {
      expect(screen.getByText(/exceeds/)).toBeInTheDocument();
    });
  });

  it('calls onUpload for valid files', async () => {
    mockOnUpload.mockResolvedValue(undefined);
    render(<ImageUpload label="Upload" onUpload={mockOnUpload} />);
    
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(validImageFile);
    
    fireEvent.change(input, { target: { files: dataTransfer.files } });
    
    await waitFor(() => {
      expect(mockOnUpload).toHaveBeenCalledWith(validImageFile, expect.any(AbortSignal), expect.any(Function));
    });
  });

  it('shows file info during upload', async () => {
    mockOnUpload.mockImplementation((file, signal, onProgress) => {
      onProgress?.(50);
      return Promise.resolve();
    });

    render(<ImageUpload label="Upload" onUpload={mockOnUpload} />);
    
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(validImageFile);
    
    fireEvent.change(input, { target: { files: dataTransfer.files } });
    
    await waitFor(() => {
      expect(screen.getByText('test.jpg')).toBeInTheDocument();
    });
  });

  it('shows progress percentage', async () => {
    mockOnUpload.mockImplementation((file, signal, onProgress) => {
      onProgress?.(50);
      return
 Promise.resolve();
    });

    render(<ImageUpload label="Upload" onUpload={mockOnUpload} />);
    
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(validImageFile);
    
    fireEvent.change(input, { target: { files: dataTransfer.files } });
    
    await waitFor(() => {
      expect(screen.getByText('50%')).toBeInTheDocument();
    });
  });

  it('allows cancelling upload', async () => {
    let abortSignal: AbortSignal | null = null;
    mockOnUpload.mockImplementation((file, signal, onProgress) => {
      abortSignal = signal;
      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('AbortError')));
      });
    });

    render(<ImageUpload label="Upload" onUpload={mockOnUpload} />);
    
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(validImageFile);
    
    fireEvent.change(input, { target: { files: dataTransfer.files } });
    
    await waitFor(() => {
      const cancelButton = screen.getByText('Cancel');
      expect(cancelButton).toBeInTheDocument();
      fireEvent.click(cancelButton);
    });
  });

  it('handles upload errors', async () => {
    mockOnUpload.mockRejectedValue(new Error('Network error'));
    
    render(<ImageUpload label="Upload" onUpload={mockOnUpload} />);
    
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(validImageFile);
    
    fireEvent.change(input, { target: { files: dataTransfer.files } });
    
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('allows retrying failed uploads', async () => {
    mockOnUpload.mockRejectedValueOnce(new Error('Upload failed')).mockResolvedValueOnce(undefined);
    
    render(<ImageUpload label="Upload" onUpload={mockOnUpload} />);
    
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(validImageFile);
    
    fireEvent.change(input, { target: { files: dataTransfer.files } });
    
    await waitFor(() => {
      expect(screen.getByText('Upload failed')).toBeInTheDocument();
    });

    const retryButton = screen.getByText('Retry');
    fireEvent.click(retryButton);
    
    await waitFor(() => {
      expect(mockOnUpload).toHaveBeenCalledTimes(2);
    });
  });

  it('supports drag and drop', async () => {
    mockOnUpload.mockResolvedValue(undefined);
    
    render(<ImageUpload label="Upload" onUpload={mockOnUpload} />);
    
    const dropZone = screen.getByRole('button');
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(validImageFile);
    
    fireEvent.drop(dropZone, { dataTransfer });
    
    await waitFor(() => {
      expect(mockOnUpload).toHaveBeenCalled();
    });
  });

  it('highlights on drag over', () => {
    render(<ImageUpload label="Upload" onUpload={mockOnUpload} />);
    const dropZone = screen.getByRole('button');
    
    fireEvent.dragOver(dropZone);
    expect(dropZone).toHaveClass('border-blue-500');
  });

  it('filters invalid file types during drag and drop', async () => {
    mockOnUpload.mockResolvedValue(undefined);
    
    render(<ImageUpload label="Upload" onUpload={mockOnUpload} />);
    
    const dropZone = screen.getByRole('button');
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(invalidTypeFile);
    
    fireEvent.drop(dropZone, { dataTransfer });
    
    await waitFor(() => {
      expect(mockOnUpload).not.toHaveBeenCalled();
    });
  });

  it('respects disabled state', () => {
    render(<ImageUpload label="Upload" onUpload={mockOnUpload} disabled={true} />);
    const dropZone = screen.getByRole('button');
    
    expect(dropZone).toHaveAttribute('aria-disabled', 'true');
    expect(dropZone).toHaveClass('opacity-50', 'cursor-not-allowed');
  });

  it('displays custom hint text', () => {
    render(<ImageUpload label="Upload" onUpload={mockOnUpload} hint="Max 10MB" />);
    expect(screen.getByText('Max 10MB')).toBeInTheDocument();
  });

  it('formats file size correctly', async () => {
    mockOnUpload.mockResolvedValue(undefined);
    const smallFile = new File(['x'.repeat(512)], 'small.jpg', { type: 'image/jpeg' });
    
    render(<ImageUpload label="Upload" onUpload={mockOnUpload} />);
    
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(smallFile);
    
    fireEvent.change(input, { target: { files: dataTransfer.files } });
    
    await waitFor(() => {
      expect(screen.getByText('0.5 KB')).toBeInTheDocument();
    });
  });
});
