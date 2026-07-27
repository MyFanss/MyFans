import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Game, GameStatus } from './entities/game.entity';
import { Player } from './entities/player.entity';
import { ListGamesDto } from './dto/list-games.dto';
import { SubmitScoreDto } from './dto/submit-score.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';

@Injectable()
export class GamesService {
  constructor(
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
    @InjectRepository(Player)
    private playerRepository: Repository<Player>,
    private dataSource: DataSource,
  ) {}

  async findAll(listGamesDto: ListGamesDto): Promise<PaginatedResponseDto<Game>> {
    const { page = 1, limit = 20, status } = listGamesDto;

    const queryBuilder = this.gameRepository
      .createQueryBuilder('game')
      .orderBy('game.created_at', 'DESC');

    if (status) {
      queryBuilder.where('game.status = :status', { status });
    }

    const total = await queryBuilder.getCount();

    const data = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return new PaginatedResponseDto(data, total, page, limit);
  }

  async joinGame(gameId: string, userId: string): Promise<Player> {
    return await this.dataSource.transaction(async (manager) => {
      const game = await manager.findOne(Game, {
        where: { id: gameId },
        relations: ['players'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      if (game.status !== GameStatus.PENDING) {
        throw new BadRequestException('Game is not in PENDING status');
      }

      if (game.players.length >= game.number_of_players) {
        throw new BadRequestException('Game is full');
      }

      const existingPlayer = await manager.findOne(Player, {
        where: { game_id: gameId, user_id: userId },
      });

      if (existingPlayer) {
        throw new BadRequestException('Player already joined this game');
      }

      const isFirstPlayer = game.players.length === 0;
      const turnOrder = game.game_settings.randomize_turn_order
        ? Math.floor(Math.random() * 1000)
        : game.players.length + 1;

      const player = manager.create(Player, {
        game_id: gameId,
        user_id: userId,
        balance: game.game_settings.starting_cash,
        turn_order: turnOrder,
      });

      const savedPlayer = await manager.save(Player, player);

      if (isFirstPlayer) {
        game.host_user_id = userId;
        await manager.save(Game, game);
      }

      return savedPlayer;
    });
  }

  /**
   * Starts a pending game. Only the host (the first player to join) may
   * start it, and only while it is still PENDING.
   */
  async startGame(gameId: string, userId: string): Promise<Game> {
    return await this.dataSource.transaction(async (manager) => {
      const game = await manager.findOne(Game, {
        where: { id: gameId },
        relations: ['players'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      if (game.host_user_id !== userId) {
        throw new ForbiddenException('Only the host can start the game');
      }

      if (game.status !== GameStatus.PENDING) {
        throw new BadRequestException('Game is not in PENDING status');
      }

      if (game.players.length < 2) {
        throw new BadRequestException(
          'At least 2 players are required to start the game',
        );
      }

      game.status = GameStatus.IN_PROGRESS;
      return await manager.save(Game, game);
    });
  }

  /**
   * Removes the caller from a game. If the departing player was the host,
   * host status is handed to the remaining player with the lowest turn
   * order, if any players remain.
   */
  async leaveGame(gameId: string, userId: string): Promise<{ left: boolean }> {
    return await this.dataSource.transaction(async (manager) => {
      const game = await manager.findOne(Game, {
        where: { id: gameId },
        relations: ['players'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      if (game.status === GameStatus.COMPLETED) {
        throw new BadRequestException('Cannot leave a completed game');
      }

      const player = await manager.findOne(Player, {
        where: { game_id: gameId, user_id: userId },
      });

      if (!player) {
        throw new NotFoundException('Player not found in this game');
      }

      await manager.remove(Player, player);

      if (game.host_user_id === userId) {
        const remaining = game.players
          .filter((p) => p.user_id !== userId)
          .sort((a, b) => (a.turn_order ?? 0) - (b.turn_order ?? 0));
        game.host_user_id = remaining[0]?.user_id ?? null;
        await manager.save(Game, game);
      }

      return { left: true };
    });
  }

  /**
   * Records a player's current/final balance while the game is in progress.
   * A stub for real scoring/payout logic, which will land once the game
   * engine emits authoritative results.
   */
  async submitScore(
    gameId: string,
    userId: string,
    dto: SubmitScoreDto,
  ): Promise<Player> {
    return await this.dataSource.transaction(async (manager) => {
      const game = await manager.findOne(Game, {
        where: { id: gameId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!game) {
        throw new NotFoundException('Game not found');
      }

      if (game.status !== GameStatus.IN_PROGRESS) {
        throw new BadRequestException('Game is not in progress');
      }

      const player = await manager.findOne(Player, {
        where: { game_id: gameId, user_id: userId },
      });

      if (!player) {
        throw new NotFoundException('Player not found in this game');
      }

      player.balance = dto.balance;
      return await manager.save(Player, player);
    });
  }
}
