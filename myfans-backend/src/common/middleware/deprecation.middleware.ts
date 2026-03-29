import { Request, Response, NextFunction } from 'express';

export function DeprecationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.path.startsWith('/v1/')) {
    res.setHeader('Deprecation', 'true');
    res.setHeader(
      'Warning',
      '299 - "This versionless API route is deprecated and will be removed in the future. Please use /v1 prefix."',
    );
  }
  next();
}
