import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { GamesService } from './games.service';
import { Game, GameStatus } from './entities/game.entity';
import { Player } from './entities/player.entity';

describe('GamesService', () => {
  let service: GamesService;
  let mockManager: Record<string, jest.Mock>;

  const mockGame: Partial<Game> = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    status: GameStatus.PENDING,
    number_of_players: 4,
    players: [],
    game_settings: {
      starting_cash: 1500,
      randomize_turn_order: false,
    },
  };

  const mockPlayer: Partial<Player> = {
    id: '660e8400-e29b-41d4-a716-446655440001',
    game_id: mockGame.id!,
    user_id: '770e8400-e29b-41d4-a716-446655440002',
    balance: 1500,
    turn_order: 1,
  };

  beforeEach(async () => {
    mockManager = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamesService,
        {
          provide: getRepositoryToken(Game),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Player),
          useValue: {},
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn((cb: (manager: typeof mockManager) => Promise<unknown>) =>
              cb(mockManager),
            ),
          },
        },
      ],
    }).compile();

    service = module.get<GamesService>(GamesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('joinGame', () => {
    it('should successfully join a pending game', async () => {
      mockManager.findOne
        .mockResolvedValueOnce(mockGame)
        .mockResolvedValueOnce(null);
      mockManager.create.mockReturnValue(mockPlayer);
      mockManager.save.mockResolvedValue(mockPlayer);

      const result = await service.joinGame(mockGame.id!, mockPlayer.user_id!);

      expect(result).toEqual(mockPlayer);
      expect(mockManager.findOne).toHaveBeenCalledWith(Game, {
        where: { id: mockGame.id },
        relations: ['players'],
        lock: { mode: 'pessimistic_write' },
      });
      expect(mockManager.create).toHaveBeenCalledWith(Player, {
        game_id: mockGame.id,
        user_id: mockPlayer.user_id,
        balance: mockGame.game_settings!.starting_cash,
        turn_order: 1,
      });
      expect(mockManager.save).toHaveBeenCalledWith(Player, mockPlayer);
    });

    it('should assign sequential turn_order when randomize_turn_order is false', async () => {
      const gameWith2Players = {
        ...mockGame,
        players: [{ id: 'p1' }, { id: 'p2' }],
      };
      mockManager.findOne
        .mockResolvedValueOnce(gameWith2Players)
        .mockResolvedValueOnce(null);
      mockManager.create.mockReturnValue(mockPlayer);
      mockManager.save.mockResolvedValue(mockPlayer);

      await service.joinGame(mockGame.id!, mockPlayer.user_id!);

      expect(mockManager.create).toHaveBeenCalledWith(
        Player,
        expect.objectContaining({ turn_order: 3 }),
      );
    });

    it('should assign random turn_order when randomize_turn_order is true', async () => {
      const randomizedGame = {
        ...mockGame,
        game_settings: { starting_cash: 1500, randomize_turn_order: true },
      };
      mockManager.findOne
        .mockResolvedValueOnce(randomizedGame)
        .mockResolvedValueOnce(null);
      mockManager.create.mockReturnValue(mockPlayer);
      mockManager.save.mockResolvedValue(mockPlayer);

      await service.joinGame(mockGame.id!, mockPlayer.user_id!);

      const createCall = mockManager.create.mock.calls[0][1];
      expect(createCall.turn_order).toBeGreaterThanOrEqual(0);
      expect(createCall.turn_order).toBeLessThan(1000);
    });

    it('should use starting_cash from game_settings as player balance', async () => {
      const customCashGame = {
        ...mockGame,
        game_settings: { starting_cash: 3000, randomize_turn_order: false },
      };
      mockManager.findOne
        .mockResolvedValueOnce(customCashGame)
        .mockResolvedValueOnce(null);
      mockManager.create.mockReturnValue(mockPlayer);
      mockManager.save.mockResolvedValue(mockPlayer);

      await service.joinGame(mockGame.id!, mockPlayer.user_id!);

      expect(mockManager.create).toHaveBeenCalledWith(
        Player,
        expect.objectContaining({ balance: 3000 }),
      );
    });

    it('should throw NotFoundException when game does not exist', async () => {
      mockManager.findOne.mockResolvedValueOnce(null);

      await expect(service.joinGame('nonexistent-id', mockPlayer.user_id!))
        .rejects.toThrow('Game not found');
    });

    it('should throw BadRequestException when game is not PENDING', async () => {
      const inProgressGame = { ...mockGame, status: GameStatus.IN_PROGRESS };
      mockManager.findOne.mockResolvedValueOnce(inProgressGame);

      await expect(service.joinGame(mockGame.id!, mockPlayer.user_id!))
        .rejects.toThrow('Game is not in PENDING status');
    });

    it('should throw BadRequestException when game is full', async () => {
      const fullGame = {
        ...mockGame,
        number_of_players: 2,
        players: [{ id: 'p1' }, { id: 'p2' }],
      };
      mockManager.findOne.mockResolvedValueOnce(fullGame);

      await expect(service.joinGame(mockGame.id!, mockPlayer.user_id!))
        .rejects.toThrow('Game is full');
    });

    it('should throw BadRequestException when player already joined', async () => {
      mockManager.findOne
        .mockResolvedValueOnce(mockGame)
        .mockResolvedValueOnce({ id: 'existing-player' });

      await expect(service.joinGame(mockGame.id!, mockPlayer.user_id!))
        .rejects.toThrow('Player already joined this game');
    });
  });
});
