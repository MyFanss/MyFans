import { PaginatedResponseDto } from './paginated-response.dto';

describe('PaginatedResponseDto', () => {
  it('should set all fields correctly', () => {
    const result = new PaginatedResponseDto(['a', 'b'], 10, 1, 5);

    expect(result.items).toEqual(['a', 'b']);
    expect(result.total).toBe(10);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(5);
    expect(result.total_pages).toBe(2);
  });

  it('should calculate total_pages = 0 when total is 0', () => {
    const result = new PaginatedResponseDto([], 0, 1, 20);

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.total_pages).toBe(0);
  });

  it('should calculate total_pages = 1 for a single item', () => {
    const result = new PaginatedResponseDto([{ id: 1 }], 1, 1, 20);

    expect(result.total_pages).toBe(1);
  });

  it('should ceil total_pages when items do not divide evenly', () => {
    const result = new PaginatedResponseDto([], 21, 2, 20);

    expect(result.total_pages).toBe(2);
  });

  it('should handle exact page boundary', () => {
    const result = new PaginatedResponseDto([], 40, 1, 20);

    expect(result.total_pages).toBe(2);
  });

  it('should work with generic types', () => {
    interface User {
      id: string;
      name: string;
    }

    const users: User[] = [{ id: '1', name: 'Alice' }];
    const result = new PaginatedResponseDto<User>(users, 1, 1, 10);

    expect(result.items).toEqual(users);
    expect(result.total_pages).toBe(1);
  });
});
