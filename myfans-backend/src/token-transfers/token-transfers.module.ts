import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TokenTransfer } from './entities/token-transfer.entity';
import { TokenTransfersService } from './token-transfers.service';
import { TokenTransfersController } from './token-transfers.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TokenTransfer])],
  providers: [TokenTransfersService],
  controllers: [TokenTransfersController],
  exports: [TokenTransfersService],
})
export class TokenTransfersModule { }
