import { Controller, Get, Req, Res, HttpCode, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import * as crypto from 'crypto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CSRF_COOKIE } from '../common/middleware/csrf.middleware';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('csrf')
@Controller({ path: 'csrf', version: '1' })
export class CsrfController {
  @Get('token')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtain a CSRF token (sets __Host-csrf cookie)' })
  @ApiResponse({ status: 200, description: 'CSRF token' })
  getToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): { csrfToken: string } {
    let token: string = (req.cookies as Record<string, string>)?.[CSRF_COOKIE];
    if (!token) {
      token = crypto.randomBytes(32).toString('hex');
      res.cookie(CSRF_COOKIE, token, {
        httpOnly: false,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      });
    }
    return { csrfToken: token };
  }
}
