import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Player } from './player.entity';

export enum GameStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

@Entity('games')
export class Game {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: GameStatus, default: GameStatus.PENDING })
  status: GameStatus;

  @Column({ type: 'int' })
  number_of_players: number;

  @Column({ type: 'jsonb' })
  game_settings: {
    starting_cash: number;
    randomize_turn_order: boolean;
  };

  /** User ID of the player who can start the game; the first player to join. */
  @Column({ type: 'varchar', nullable: true })
  host_user_id: string | null;

  @OneToMany(() => Player, player => player.game)
  players: Player[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
