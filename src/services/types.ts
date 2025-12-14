export interface ListOptions<TFilters = Record<string, unknown>> {
  page?: number;
  limit?: number;
  filters?: TFilters;
  sort?: Record<string, 'ASC' | 'DESC'>;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
