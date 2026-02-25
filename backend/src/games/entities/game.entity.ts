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

  @OneToMany(() => Player, player => player.game)
  players: Player[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
