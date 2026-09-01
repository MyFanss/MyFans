import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    const user = await this.authService.validateUser(payload.sub);

    if (!user) {
      throw new UnauthorizedException();
    }

    // Session revocation (#1566): a deleted (or otherwise force-logged-out)
    // account has its token_version bumped, which invalidates every JWT
    // issued before that bump — even though the JWT itself hasn't expired.
    // Tokens issued before this field existed carry no `tokenVersion` claim
    // and default to 0, matching a freshly-created user's default column
    // value, so this is backwards compatible.
    const tokenVersion = payload.tokenVersion ?? 0;
    if (tokenVersion !== (user.token_version ?? 0)) {
      throw new UnauthorizedException('Session has been revoked');
    }

    return {
      userId: payload.sub,
      email: user.email,
      role: user.role,
    };
  }
}
