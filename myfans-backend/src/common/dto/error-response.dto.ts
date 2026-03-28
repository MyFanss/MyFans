export class ErrorResponseDto {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;

  constructor(
    statusCode: number,
    error: string,
    message: string | string[],
    path: string,
  ) {
    this.statusCode = statusCode;
    this.error = error;
    this.message = message;
    this.timestamp = new Date().toISOString();
    this.path = path;
  }
}
