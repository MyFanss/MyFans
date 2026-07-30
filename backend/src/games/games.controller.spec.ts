import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { GameStatus } from './entities/game.entity';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { JwtAuthGuard } from '../auth-module/guards/jwt-auth.guard';

describe('GamesController', () => {
  let controller: GamesController;

  const mockUser = { userId: 'user-1' };

  const mockPlayer = {
    id: 'player-1',
    game_id: 'game-1',
    user_id: 'user-1',
    balance: 1500,
    turn_order: 1,
  };

  const mockGame = {
    id: 'game-1',
    status: GameStatus.PENDING,
    number_of_players: 4,
    players: [],
    game_settings: { starting_cash: 1500, randomize_turn_order: false },
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockGamesService = {
    findAll: jest.fn(),
    joinGame: jest.fn(),
    startGame: jest.fn(),
    leaveGame: jest.fn(),
    submitScore: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GamesController],
      providers: [
        { provide: GamesService, useValue: mockGamesService },
        {
          provide: JwtAuthGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<GamesController>(GamesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('returns paginated list of games', async () => {
      const paginated = new PaginatedResponseDto([mockGame], 1, 1, 20);
      mockGamesService.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll({ page: 1, limit: 20 });

      expect(result).toEqual(paginated);
      expect(mockGamesService.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
      });
    });

    it('filters by status when provided', async () => {
      const dto = { page: 1, limit: 10, status: GameStatus.PENDING };
      const paginated = new PaginatedResponseDto([mockGame], 1, 1, 10);
      mockGamesService.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll(dto);

      expect(result).toEqual(paginated);
      expect(mockGamesService.findAll).toHaveBeenCalledWith(dto);
    });

    it('returns empty page when no games match', async () => {
      const paginated = new PaginatedResponseDto([], 0, 1, 20);
      mockGamesService.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('joinGame', () => {
    it('returns the created player on success', async () => {
      mockGamesService.joinGame.mockResolvedValue(mockPlayer);

      const result = await controller.joinGame('game-1', mockUser);

      expect(result).toEqual(mockPlayer);
      expect(mockGamesService.joinGame).toHaveBeenCalledWith(
        'game-1',
        'user-1',
      );
    });

    it('uses the JWT subject as the joining user, ignoring any spoofed identity', async () => {
      mockGamesService.joinGame.mockResolvedValue(mockPlayer);

      await controller.joinGame('game-1', { userId: 'jwt-user-1' });

      expect(mockGamesService.joinGame).toHaveBeenCalledWith(
        'game-1',
        'jwt-user-1',
      );
    });

    it('propagates NotFoundException when game does not exist', async () => {
      mockGamesService.joinGame.mockRejectedValue(
        new NotFoundException('Game not found'),
      );

      await expect(controller.joinGame('missing', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('propagates BadRequestException when game is not PENDING', async () => {
      mockGamesService.joinGame.mockRejectedValue(
        new BadRequestException('Game is not in PENDING status'),
      );

      await expect(controller.joinGame('game-1', mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('propagates BadRequestException when game is full', async () => {
      mockGamesService.joinGame.mockRejectedValue(
        new BadRequestException('Game is full'),
      );

      await expect(controller.joinGame('game-1', mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('propagates BadRequestException when player already joined', async () => {
      mockGamesService.joinGame.mockRejectedValue(
        new BadRequestException('Player already joined this game'),
      );

      await expect(controller.joinGame('game-1', mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('startGame', () => {
    it('returns the started game on success', async () => {
      const startedGame = { ...mockGame, status: GameStatus.IN_PROGRESS };
      mockGamesService.startGame.mockResolvedValue(startedGame);

      const result = await controller.startGame('game-1', mockUser);

      expect(result).toEqual(startedGame);
      expect(mockGamesService.startGame).toHaveBeenCalledWith('game-1', 'user-1');
    });

    it('propagates ForbiddenException when caller is not the host', async () => {
      mockGamesService.startGame.mockRejectedValue(
        new ForbiddenException('Only the host can start the game'),
      );

      await expect(controller.startGame('game-1', mockUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('propagates BadRequestException when game is not in a startable state', async () => {
      mockGamesService.startGame.mockRejectedValue(
        new BadRequestException('Game is not in PENDING status'),
      );

      await expect(controller.startGame('game-1', mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('leaveGame', () => {
    it('returns confirmation on success', async () => {
      mockGamesService.leaveGame.mockResolvedValue({ left: true });

      const result = await controller.leaveGame('game-1', mockUser);

      expect(result).toEqual({ left: true });
      expect(mockGamesService.leaveGame).toHaveBeenCalledWith('game-1', 'user-1');
    });

    it('propagates BadRequestException when game is completed', async () => {
      mockGamesService.leaveGame.mockRejectedValue(
        new BadRequestException('Cannot leave a completed game'),
      );

      await expect(controller.leaveGame('game-1', mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('propagates NotFoundException when player never joined', async () => {
      mockGamesService.leaveGame.mockRejectedValue(
        new NotFoundException('Player not found in this game'),
      );

      await expect(controller.leaveGame('game-1', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('submitScore', () => {
    it('delegates to the service with the JWT subject and dto', async () => {
      const updatedPlayer = { ...mockPlayer, balance: 2500 };
      mockGamesService.submitScore.mockResolvedValue(updatedPlayer);

      const result = await controller.submitScore('game-1', mockUser, { balance: 2500 });

      expect(result).toEqual(updatedPlayer);
      expect(mockGamesService.submitScore).toHaveBeenCalledWith('game-1', 'user-1', {
        balance: 2500,
      });
    });

    it('propagates BadRequestException when game is not in progress', async () => {
      mockGamesService.submitScore.mockRejectedValue(
        new BadRequestException('Game is not in progress'),
      );

      await expect(
        controller.submitScore('game-1', mockUser, { balance: 100 }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
