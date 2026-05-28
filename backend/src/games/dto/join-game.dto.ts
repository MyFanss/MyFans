import { IsUUID } from 'class-validator';

export class JoinGameDto {
  @IsUUID()
  userId: string;
}
