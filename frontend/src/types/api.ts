/**
 * API envelope types for MyFans frontend.
 *
 * These types mirror the shape produced by CorrelationExceptionFilter (backend) and
 * the success responses returned by NestJS controllers.
 *
 * Success envelope:  { success: true,  data: T }
 * Error envelope:    { success: false, statusCode: number, message: string, correlationId?: string }
 *
 * `correlationId` is included by the backend outside production so consumers can
 * cross-reference server logs.  Frontends should treat it as optional/opaque.
 */

// ---------------------------------------------------------------------------
// Core envelope types
// ---------------------------------------------------------------------------

/**
 * Success response envelope.  All successful API calls return this shape.
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  /** Optional informational message (e.g. "Created successfully"). */
  message?: string;
}

/**
 * Error response envelope.  Matches the shape emitted by CorrelationExceptionFilter:
 *   { statusCode, message, correlationId? }
 * Extended with `success: false` so the union is discriminated.
 */
export interface ApiErrorResponse {
  success: false;
  /** HTTP status code echoed from the server (e.g. 400, 401, 404, 500). */
  statusCode: number;
  /** Human-readable error message from the server. */
  message: string;
  /**
   * Correlation ID present in non-production environments.
   * Use it to cross-reference backend logs.  Never show to end-users as-is.
   */
  correlationId?: string;
  /** Optional machine-readable error code (e.g. "VALIDATION_ERROR"). */
  error?: string;
}

/**
 * Discriminated union of success and error envelopes.
 * Use `response.success` as the type guard:
 *
 * ```ts
 * const res = await apiClient.getUser(id);
 * if (res.success) {
 *   console.log(res.data.username);
 * } else {
 *   console.error(res.message, res.correlationId);
 * }
 * ```
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Type guard — narrows an ApiResponse to its success branch.
 */
export function isApiSuccess<T>(res: ApiResponse<T>): res is ApiSuccessResponse<T> {
  return res.success === true;
}

/**
 * Type guard — narrows an ApiResponse to its error branch.
 */
export function isApiError<T>(res: ApiResponse<T>): res is ApiErrorResponse {
  return res.success === false;
}

/**
 * Parse an unknown value (e.g. from a catch block) as an ApiErrorResponse.
 * Returns a synthetic error envelope when the shape cannot be recognised — never throws.
 *
 * @example
 * ```ts
 * try {
 *   await doSomething();
 * } catch (err) {
 *   const envelope = parseApiErrorEnvelope(err);
 *   // envelope is always a valid ApiErrorResponse
 * }
 * ```
 */
export function parseApiErrorEnvelope(raw: unknown): ApiErrorResponse {
  if (
    raw !== null &&
    typeof raw === 'object' &&
    'statusCode' in raw &&
    'message' in raw
  ) {
    const r = raw as Record<string, unknown>;
    return {
      success: false,
      statusCode: typeof r.statusCode === 'number' ? r.statusCode : 500,
      message: typeof r.message === 'string' ? r.message : 'Unknown error',
      correlationId: typeof r.correlationId === 'string' ? r.correlationId : undefined,
      error: typeof r.error === 'string' ? r.error : undefined,
    };
  }

  // Fallback for unrecognised shapes (plain Error, string thrown, etc.)
  return {
    success: false,
    statusCode: 0,
    message:
      raw instanceof Error
        ? raw.message
        : typeof raw === 'string'
          ? raw
          : 'Unknown error',
  };
}

/**
 * Unwrap the data from a success envelope or throw the error envelope.
 * Useful for callers that want to work with the data directly.
 *
 * @throws {ApiErrorResponse} when response.success is false
 */
export function unwrapApiResponse<T>(res: ApiResponse<T>): T {
  if (isApiSuccess(res)) return res.data;
  throw res;
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// ---------------------------------------------------------------------------
// User endpoints
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  username: string;
  email?: string;
  avatar?: string;
  bio?: string;
  followers: number;
  following: number;
  isVerified: boolean;
  createdAt: string;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
}

export interface UpdateUserRequest {
  bio?: string;
  avatar?: string;
}

export type GetCurrentUserResponse = ApiResponse<User>;
export type GetUserResponse = ApiResponse<User>;
export type CreateUserResponse = ApiResponse<User>;
export type UpdateUserResponse = ApiResponse<User>;

// ---------------------------------------------------------------------------
// Post endpoints
// ---------------------------------------------------------------------------

export interface Post {
  id: string;
  userId: string;
  content: string;
  image?: string;
  likes: number;
  comments: number;
  isLiked: boolean;
  createdAt: string;
}

export interface CreatePostRequest {
  content: string;
  image?: string;
}

export interface PostListResponse {
  posts: Post[];
  pagination: Pagination;
}

export type GetPostsResponse = ApiResponse<PostListResponse>;
export type CreatePostResponse = ApiResponse<Post>;

// ---------------------------------------------------------------------------
// Subscription endpoints
// ---------------------------------------------------------------------------

export interface Subscription {
  id: string;
  userId: string;
  creatorId: string;
  amount: number;
  currency: string;
  status: 'active' | 'cancelled' | 'expired';
  startDate: string;
  endDate?: string;
}

export interface CreateSubscriptionRequest {
  creatorId: string;
  amount: number;
  currency: string;
}

export type GetSubscriptionsResponse = ApiResponse<Subscription[]>;
export type CreateSubscriptionResponse = ApiResponse<Subscription>;

// ---------------------------------------------------------------------------
// Paginated cursor responses
// ---------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  data: T[];
  limit?: number;
  nextCursor?: string | null;
  hasMore?: boolean;
  page?: number;
  total?: number;
  totalPages?: number;
}

// ---------------------------------------------------------------------------
// Subscription / payment history
// ---------------------------------------------------------------------------

export interface SubscriptionHistoryItem {
  id: string;
  creatorName: string;
  creatorUsername?: string;
  creatorId?: string;
  planName: string;
  price: number;
  currency: string;
  startedAt: string;
  endedAt: string;
  cancelReason?: string;
  status?: 'cancelled' | 'expired';
}

export interface PaymentRecord {
  id: string;
  date: string;
  creatorName: string;
  creatorAddress?: string;
  planName: string;
  amount: number;
  currency: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  description?: string;
  txHash?: string;
}

export interface GetSubscriptionHistoryParams {
  status?: string;
  sort?: string;
  cursor?: string;
  limit?: number;
}

export interface GetPaymentHistoryParams {
  creator?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}
