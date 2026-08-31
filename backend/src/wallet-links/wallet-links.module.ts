import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletLink } from './entities/wallet-link.entity';
import { WalletLinksService } from './wallet-links.service';

@Module({
  imports: [TypeOrmModule.forFeature([WalletLink])],
  providers: [WalletLinksService],
  exports: [WalletLinksService],
})
export class WalletLinksModule {}
