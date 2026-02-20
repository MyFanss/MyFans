import { IsUUID } from 'class-validator';

export class CreateConversationDto {
  @IsUUID()
  creator_id!: string;
}
