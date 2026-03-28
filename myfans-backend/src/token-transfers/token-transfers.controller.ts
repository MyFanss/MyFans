import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { TokenTransfersService } from './token-transfers.service';
import { CreateTokenTransferDto } from './dto/create-token-transfer.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('token-transfers')
export class TokenTransfersController {
  constructor(private readonly tokenTransfersService: TokenTransfersService) {}

  /**
   * Index a new token transfer event
   * POST /token-transfers (internal/webhook)
   */
  @Post()
  async indexTransfer(@Body() dto: CreateTokenTransferDto) {
    try {
      return await this.tokenTransfersService.indexTransfer(dto);
    } catch (error) {
      throw new HttpException(
        'Failed to index transfer',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get transfer history for an account (paginated)
   * GET /token-transfers/account/:accountAddress
   */
  @Get('account/:accountAddress')
  async getTransferHistory(
    @Param('accountAddress') accountAddress: string,
    @Query('limit') limit: string = '50',
    @Query('offset') offset: string = '0',
  ) {
    const limitNum = Math.min(parseInt(limit, 10) || 50, 200);
    const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);

    return this.tokenTransfersService.getTransferHistory(
      accountAddress,
      limitNum,
      offsetNum,
    );
  }

  /**
   * Get incoming transfers for an account
   * GET /token-transfers/incoming/:accountAddress
   */
  @Get('incoming/:accountAddress')
  async getIncomingTransfers(
    @Param('accountAddress') accountAddress: string,
    @Query('limit') limit: string = '50',
    @Query('offset') offset: string = '0',
  ) {
    const limitNum = Math.min(parseInt(limit, 10) || 50, 200);
    const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);

    return this.tokenTransfersService.getIncomingTransfers(
      accountAddress,
      limitNum,
      offsetNum,
    );
  }

  /**
   * Get outgoing transfers for an account
   * GET /token-transfers/outgoing/:accountAddress
   */
  @Get('outgoing/:accountAddress')
  async getOutgoingTransfers(
    @Param('accountAddress') accountAddress: string,
    @Query('limit') limit: string = '50',
    @Query('offset') offset: string = '0',
  ) {
    const limitNum = Math.min(parseInt(limit, 10) || 50, 200);
    const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);

    return this.tokenTransfersService.getOutgoingTransfers(
      accountAddress,
      limitNum,
      offsetNum,
    );
  }

  /**
   * Get transfer by transaction hash
   * GET /token-transfers/tx/:txHash
   */
  @Get('tx/:txHash')
  async getTransferByTxHash(@Param('txHash') txHash: string) {
    const transfer = await this.tokenTransfersService.getTransferByTxHash(txHash);
    if (!transfer) {
      throw new HttpException('Transfer not found', HttpStatus.NOT_FOUND);
    }
    return transfer;
  }

  /**
   * Get transfers between two addresses
   * GET /token-transfers/between/:addressA/:addressB
   */
  @Get('between/:addressA/:addressB')
  async getTransfersBetween(
    @Param('addressA') addressA: string,
    @Param('addressB') addressB: string,
    @Query('limit') limit: string = '50',
    @Query('offset') offset: string = '0',
  ) {
    const limitNum = Math.min(parseInt(limit, 10) || 50, 200);
    const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);

    return this.tokenTransfersService.getTransfersBetween(
      addressA,
      addressB,
      limitNum,
      offsetNum,
    );
  }

  /**
   * Get account statistics
   * GET /token-transfers/stats/:accountAddress
   */
  @Get('stats/:accountAddress')
  async getAccountStats(@Param('accountAddress') accountAddress: string) {
    return this.tokenTransfersService.getAccountStats(accountAddress);
  }

  /**
   * Check if a transfer is indexed
   * GET /token-transfers/exists/:txHash
   */
  @Get('exists/:txHash')
  async isTransferIndexed(@Param('txHash') txHash: string) {
    const indexed = await this.tokenTransfersService.isTransferIndexed(txHash);
    return { indexed, txHash };
  }
}
