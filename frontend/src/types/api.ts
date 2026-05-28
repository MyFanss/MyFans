// API Types for typed client
// Generated from backend structure (users, posts, subscriptions, etc.)

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// User endpoints
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

// Post endpoints
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

// Subscription endpoints
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

// Add more as needed (comments, likes, etc.)

