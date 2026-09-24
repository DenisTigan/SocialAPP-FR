// TypeScript interfaces generated from OpenAPI spec (api-docs.json)
// Source of truth: components.schemas

export interface PhotoResponse {
  id: string;           // format: uuid
  userId: string;       // format: uuid
  username: string;
  imageUrl: string;
  caption: string;
  createdAt: string;    // format: date-time
  likeCount: number;    // format: int64
  isLikedByCurrentUser: boolean;
}

export interface CommentRequest {
  text: string;         // required
}

export interface CommentResponse {
  id: string;           // format: uuid
  userId: string;       // format: uuid
  username: string;
  text: string;
  createdAt: string;    // format: date-time
}

export interface MessageRequest {
  content: string;      // required
}

export interface MessageResponse {
  id: string;           // format: uuid
  senderId: string;     // format: uuid
  receiverId: string;   // format: uuid
  content: string;
  createdAt: string;    // format: date-time
}

export interface VerifyRequest {
  email: string;        // required
  code: string;         // required
}

export interface ResendCodeRequest {
  email: string;        // required
}

export interface RegisterRequest {
  username: string;     // required, minLength: 3, maxLength: 50
  email: string;        // required
  password: string;     // required, minLength: 6
}

export interface LoginRequest {
  email: string;        // required
  password: string;     // required
}

export interface AuthResponse {
  token: string;
  userId: string;       // format: uuid
  username: string;
}

export interface PagePhotoResponse {
  totalElements: number;    // format: int64
  totalPages: number;       // format: int32
  size: number;             // format: int32
  content: PhotoResponse[];
  number: number;           // format: int32
  sort: unknown[];          // internal structure not needed
  first: boolean;
  last: boolean;
  numberOfElements: number; // format: int32
  pageable: unknown;        // internal structure not needed
  empty: boolean;
}

export interface ConversationResponse {
  partnerId: string;        // format: uuid
  partnerUsername: string;
  lastMessage: string;
  timestamp: string;        // format: date-time
}

export interface UserResponse {
  id: string;               // format: uuid
  username: string;
}
