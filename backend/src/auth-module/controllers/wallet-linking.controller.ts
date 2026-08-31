import { Body, Controller, Post, UseGuards, Req, Delete, Param, Get } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { WalletLinkingService } from '../services/wallet-linking.service';
import { UserWalletLink } from '../entities/user-wallet-link.entity';

interface ChallengeRequest {
  stellarAddress: string;
}

interface VerifyRequest {
  stellarAddress: string;
  nonce: string;
  signature: string;
}

@Controller('v1/auth/wallet')
export class WalletLinkingController {
  constructor(private readonly walletLinkingService: WalletLinkingService) {}

  @Post('challenge')
  async createChallenge(
    @Body() dto: ChallengeRequest,
  ): Promise<{ nonce: string; expiresAt: Date }> {
    return this.walletLinkingService.createChallenge(dto.stellarAddress);
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  async verifyAndLinkWallet(
    @Req() req: any,
    @Body() dto: VerifyRequest,
  ): Promise<{ id: string; stellarAddress: string; verifiedAt: Date }> {
    const userId = req.user.sub;
    return this.walletLinkingService.verifyAndLinkWallet(
      userId,
      dto.stellarAddress,
      dto.nonce,
      dto.signature,
    );
  }

  @Get('links')
  @UseGuards(JwtAuthGuard)
  async getWalletLinks(@Req() req: any): Promise<UserWalletLink[]> {
    const userId = req.user.sub;
    return this.walletLinkingService.getWalletLinks(userId);
  }

  @Delete('links/:linkId')
  @UseGuards(JwtAuthGuard)
  async unlinkWallet(
    @Req() req: any,
    @Param('linkId') linkId: string,
  ): Promise<{ success: boolean }> {
    const userId = req.user.sub;
    await this.walletLinkingService.unlinkWallet(userId, linkId);
    return { success: true };
  }
}
