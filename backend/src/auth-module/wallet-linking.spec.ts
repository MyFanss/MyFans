import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { Keypair } from '@stellar/stellar-sdk';
import * as crypto from 'crypto';
import { WalletLinkingService } from './services/wallet-linking.service';
import { UserWalletLink } from './entities/user-wallet-link.entity';
import { WalletChallenge } from '../auth/wallet-challenge.entity';
import { EventBus } from '../events/event-bus';
import { InProcessEventBus } from '../events/in-process-event-bus';

describe('WalletLinkingService', () => {
  let service: WalletLinkingService;
  let walletLinkRepo: Repository<UserWalletLink>;
  let challengeRepo: Repository<WalletChallenge>;
  let eventBus: EventBus;

  const keypair = Keypair.random();
  const address = keypair.publicKey();
  const userId = 'user-1-uuid';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletLinkingService,
        {
          provide: getRepositoryToken(UserWalletLink),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(WalletChallenge),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
        { provide: EventBus, useClass: InProcessEventBus },
      ],
    }).compile();

    service = module.get<WalletLinkingService>(WalletLinkingService);
    walletLinkRepo = module.get<Repository<UserWalletLink>>(
      getRepositoryToken(UserWalletLink),
    );
    challengeRepo = module.get<Repository<WalletChallenge>>(
      getRepositoryToken(WalletChallenge),
    );
    eventBus = module.get<EventBus>(EventBus);
  });

  it('should create a challenge', async () => {
    const challenge = {
      id: 'challenge-1',
      stellarAddress: address,
      nonce: crypto.randomBytes(32).toString('hex'),
      expiresAt: new Date(Date.now() + 300000),
      used: false,
    };

    (challengeRepo.create as jest.Mock).mockReturnValue(challenge);
    (challengeRepo.save as jest.Mock).mockResolvedValue(challenge);

    const result = await service.createChallenge(address);

    expect(result).toHaveProperty('nonce');
    expect(result).toHaveProperty('expiresAt');
    expect(challengeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        stellarAddress: address,
      }),
    );
  });

  it('should link a verified wallet to a user', async () => {
    const nonce = crypto.randomBytes(32).toString('hex');
    const messageBytes = Buffer.from(nonce, 'utf8');
    const signature = keypair.sign(messageBytes);
    const signatureHex = signature.toString('hex');

    const challenge = {
      id: 'challenge-1',
      stellarAddress: address,
      nonce,
      expiresAt: new Date(Date.now() + 300000),
      used: false,
    };

    const walletLink = {
      id: 'link-1',
      userId,
      stellarAddress: address,
      verifiedAt: new Date(),
      isPrimary: true,
      createdAt: new Date(),
    };

    (challengeRepo.findOne as jest.Mock).mockResolvedValue(challenge);
    (walletLinkRepo.find as jest.Mock).mockResolvedValue([]);
    (walletLinkRepo.create as jest.Mock).mockReturnValue(walletLink);
    (walletLinkRepo.save as jest.Mock)
      .mockResolvedValueOnce(challenge)
      .mockResolvedValueOnce(walletLink);

    const result = await service.verifyAndLinkWallet(
      userId,
      address,
      nonce,
      signatureHex,
    );

    expect(result).toEqual({
      id: walletLink.id,
      stellarAddress: walletLink.stellarAddress,
      verifiedAt: walletLink.verifiedAt,
    });
  });

  it('should reject linking an address already linked to a different user', async () => {
    const nonce = crypto.randomBytes(32).toString('hex');
    const messageBytes = Buffer.from(nonce, 'utf8');
    const signature = keypair.sign(messageBytes);
    const signatureHex = signature.toString('hex');

    const challenge = {
      id: 'challenge-1',
      stellarAddress: address,
      nonce,
      expiresAt: new Date(Date.now() + 300000),
      used: false,
    };

    const existingLink = {
      id: 'existing-link',
      userId: 'other-user-id',
      stellarAddress: address,
      verifiedAt: new Date(),
      isPrimary: true,
      createdAt: new Date(),
    };

    (challengeRepo.findOne as jest.Mock).mockResolvedValue(challenge);
    (walletLinkRepo.findOne as jest.Mock).mockResolvedValue(existingLink);
    (walletLinkRepo.save as jest.Mock).mockResolvedValue(challenge);

    await expect(
      service.verifyAndLinkWallet(userId, address, nonce, signatureHex),
    ).rejects.toThrow(ConflictException);
  });

  it('should reject expired challenges', async () => {
    const nonce = crypto.randomBytes(32).toString('hex');
    const messageBytes = Buffer.from(nonce, 'utf8');
    const signature = keypair.sign(messageBytes);
    const signatureHex = signature.toString('hex');

    const expiredChallenge = {
      id: 'challenge-1',
      stellarAddress: address,
      nonce,
      expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      used: false,
    };

    (challengeRepo.findOne as jest.Mock).mockResolvedValue(expiredChallenge);

    await expect(
      service.verifyAndLinkWallet(userId, address, nonce, signatureHex),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should reject already-used challenges', async () => {
    const nonce = crypto.randomBytes(32).toString('hex');
    const messageBytes = Buffer.from(nonce, 'utf8');
    const signature = keypair.sign(messageBytes);
    const signatureHex = signature.toString('hex');

    const usedChallenge = {
      id: 'challenge-1',
      stellarAddress: address,
      nonce,
      expiresAt: new Date(Date.now() + 300000),
      used: true,
    };

    (challengeRepo.findOne as jest.Mock).mockResolvedValue(usedChallenge);

    await expect(
      service.verifyAndLinkWallet(userId, address, nonce, signatureHex),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should get user wallet links', async () => {
    const links = [
      {
        id: 'link-1',
        userId,
        stellarAddress: address,
        verifiedAt: new Date(),
        isPrimary: true,
        createdAt: new Date(),
      },
    ];

    (walletLinkRepo.find as jest.Mock).mockResolvedValue(links);

    const result = await service.getWalletLinks(userId);

    expect(result).toEqual(links);
    expect(walletLinkRepo.find).toHaveBeenCalledWith({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  });
});
