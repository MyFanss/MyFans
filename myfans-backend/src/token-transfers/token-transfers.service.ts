import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenTransfer, TransferDirection } from './entities/token-transfer.entity';
import { CreateTokenTransferDto } from './dto/create-token-transfer.dto';

@Injectable()
export class TokenTransfersService {
  constructor(
    @InjectRepository(TokenTransfer)
    private readonly tokenTransfersRepository: Repository<TokenTransfer>,
  ) {}

  /**
   * Index a new token transfer event
   */
  async indexTransfer(dto: CreateTokenTransferDto): Promise<TokenTransfer> {
    const transfer = this.tokenTransfersRepository.create({
      ...dto,
      amount: dto.amount.toString(),
      fee: dto.fee?.toString() || null,
      net_amount: dto.net_amount?.toString() || null,
      timestamp: new Date(),
    });
    return this.tokenTransfersRepository.save(transfer);
  }

  /**
   * Get transfer history for an account (incoming and outgoing)
   */
  async getTransferHistory(
    accountAddress: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ data: TokenTransfer[]; total: number }> {
    const [transfers, total] = await this.tokenTransfersRepository.findAndCount({
      where: { account_address: accountAddress },
      order: { timestamp: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { data: transfers, total };
  }

  /**
   * Get incoming transfers for an account (as receiver)
   */
  async getIncomingTransfers(
    accountAddress: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ data: TokenTransfer[]; total: number }> {
    const [transfers, total] = await this.tokenTransfersRepository.findAndCount({
      where: {
        receiver_address: accountAddress,
        direction: TransferDirection.INCOMING,
      },
      order: { timestamp: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { data: transfers, total };
  }

  /**
   * Get outgoing transfers for an account (as sender)
   */
  async getOutgoingTransfers(
    accountAddress: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ data: TokenTransfer[]; total: number }> {
    const [transfers, total] = await this.tokenTransfersRepository.findAndCount({
      where: {
        sender_address: accountAddress,
        direction: TransferDirection.OUTGOING,
      },
      order: { timestamp: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { data: transfers, total };
  }

  /**
   * Get transfer by transaction hash
   */
  async getTransferByTxHash(txHash: string): Promise<TokenTransfer | null> {
    return this.tokenTransfersRepository.findOne({ where: { tx_hash: txHash } });
  }

  /**
   * Get transfers between two addresses
   */
  async getTransfersBetween(
    addressA: string,
    addressB: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ data: TokenTransfer[]; total: number }> {
    const [transfers, total] = await this.tokenTransfersRepository
      .createQueryBuilder('transfer')
      .where(
        '(transfer.sender_address = :addr1 AND transfer.receiver_address = :addr2) OR ' +
        '(transfer.sender_address = :addr2 AND transfer.receiver_address = :addr1)',
        { addr1: addressA, addr2: addressB },
      )
      .orderBy('transfer.timestamp', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    return { data: transfers, total };
  }

  /**
   * Get aggregate stats for an account
   */
  async getAccountStats(accountAddress: string): Promise<{
    totalIncoming: string;
    totalOutgoing: string;
    incomingCount: number;
    outgoingCount: number;
    totalFeesPaid: string;
  }> {
    const queryBuilder = this.tokenTransfersRepository.createQueryBuilder('t');

    const incomingSum = await queryBuilder
      .select('SUM(t.amount)', 'total')
      .where('t.receiver_address = :account AND t.direction = :direction', {
        account: accountAddress,
        direction: TransferDirection.INCOMING,
      })
      .getRawOne();

    const outgoingSum = await queryBuilder
      .select('SUM(t.amount)', 'total')
      .where('t.sender_address = :account AND t.direction = :direction', {
        account: accountAddress,
        direction: TransferDirection.OUTGOING,
      })
      .getRawOne();

    const incomingCount = await queryBuilder
      .where('t.receiver_address = :account AND t.direction = :direction', {
        account: accountAddress,
        direction: TransferDirection.INCOMING,
      })
      .getCount();

    const outgoingCount = await queryBuilder
      .where('t.sender_address = :account AND t.direction = :direction', {
        account: accountAddress,
        direction: TransferDirection.OUTGOING,
      })
      .getCount();

    const feesSum = await queryBuilder
      .select('SUM(CAST(t.fee as DECIMAL))', 'total')
      .where('t.account_address = :account AND t.fee IS NOT NULL', {
        account: accountAddress,
      })
      .getRawOne();

    return {
      totalIncoming: incomingSum?.total || '0',
      totalOutgoing: outgoingSum?.total || '0',
      incomingCount,
      outgoingCount,
      totalFeesPaid: feesSum?.total || '0',
    };
  }

  /**
   * Check if a transfer has been indexed
   */
  async isTransferIndexed(txHash: string): Promise<boolean> {
    const count = await this.tokenTransfersRepository.count({
      where: { tx_hash: txHash },
    });
    return count > 0;
  }
}
