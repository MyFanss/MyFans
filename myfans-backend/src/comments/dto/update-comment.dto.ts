import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000, { message: 'Comment body must not exceed 1000 characters' })
  body!: string;
}
