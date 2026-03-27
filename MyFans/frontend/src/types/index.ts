// Error types
export type {
  ErrorCode,
  ErrorSeverity,
  ErrorCategory,
  AppError,
  ErrorAction,
  FieldError,
  TransactionErrorDetails,
  NetworkErrorDetails,
} from './errors';

export {
  createAppError,
  isNetworkError,
  isRecoverable,
  isOffline,
  getErrorFromUnknown,
} from './errors';

// API types
export type { 
  ApiResponse, 
  Pagination,
  // User
  User,
  CreateUserRequest,
  UpdateUserRequest,
  GetCurrentUserResponse,
  GetUserResponse,
  CreateUserResponse,
  UpdateUserResponse,
  // Post
  Post,
  CreatePostRequest,
  PostListResponse,
  GetPostsResponse,
  CreatePostResponse,
  // Subscription
  Subscription,
  CreateSubscriptionRequest,
  GetSubscriptionsResponse,
  CreateSubscriptionResponse
} from './api';
