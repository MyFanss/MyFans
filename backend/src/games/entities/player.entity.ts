import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Game } from './game.entity';
import { User } from '../../users/entities/user.entity';

@Entity('players')
@Unique(['game', 'user'])
export class Player {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Game, game => game.players)
  @JoinColumn({ name: 'game_id' })
  game: Game;

  @Column()
  game_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  balance: number;

  @Column({ type: 'int', nullable: true })
  turn_order: number;

  @Column({ nullable: true })
  symbol: string;

  @CreateDateColumn()
  created_at: Date;
}
