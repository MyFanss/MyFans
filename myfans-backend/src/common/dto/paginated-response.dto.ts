export class PaginatedResponseDto<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;

  constructor(items: T[], total: number, page: number, limit: number) {
    this.items = items;
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.total_pages = Math.ceil(total / limit);
  }
}
