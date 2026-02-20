import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  validateStellarAddress(address: string): boolean {
    return address.startsWith('G') && address.length === 56;
  }

  async createSession(stellarAddress: string) {
    return { userId: stellarAddress, token: Buffer.from(stellarAddress).toString('base64') };
  }
}
