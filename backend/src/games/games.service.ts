import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Game, GameStatus } from './entities/game.entity';
import { Player } from './entities/player.entity';

@Injectable()
export class GamesService {
  constructor(
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
    @InjectRepository(Player)
    private playerRepository: Repository<Player>,
    private dataSource: DataSource,
  ) {}

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

      const turnOrder = game.game_settings.randomize_turn_order
        ? Math.floor(Math.random() * 1000)
        : game.players.length + 1;

      const player = manager.create(Player, {
        game_id: gameId,
        user_id: userId,
        balance: game.game_settings.starting_cash,
        turn_order: turnOrder,
      });

      return await manager.save(Player, player);
    });
  }
}
