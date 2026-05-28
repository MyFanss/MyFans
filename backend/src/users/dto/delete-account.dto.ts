import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class DeleteAccountDto {
    @IsNotEmpty()
    @IsString()
    @MinLength(6)
    password: string;
}
