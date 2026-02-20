# User Entity & DTOs Setup

## Created Files

### Entity
- `src/users/entities/user.entity.ts` - User entity with UUID, email, username, password_hash, display_name, avatar_url, role enum, is_creator, timestamps

### DTOs
- `src/users/dto/create-user.dto.ts` - Validation for user registration
- `src/users/dto/update-user.dto.ts` - Partial update DTO (excludes password, includes avatar_url)
- `src/users/dto/user-profile.dto.ts` - Public profile response (excludes sensitive fields)
- `src/users/dto/index.ts` - Barrel export for all DTOs

## Required Dependencies

Install the following packages:

```bash
npm install typeorm @nestjs/typeorm pg class-validator class-transformer @nestjs/mapped-types
```

## Database Configuration

Add TypeORM configuration to `app.module.ts`:

```typescript
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'myfans',
      entities: [User],
      synchronize: true, // Set to false in production
    }),
  ],
})
```

## Validation

Enable global validation pipes in `main.ts`:

```typescript
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  await app.listen(3000);
}
```

## Features

- ✅ UUID primary key
- ✅ Unique email and username with indexes
- ✅ Role enum (user, admin)
- ✅ is_creator flag
- ✅ Timestamps (created_at, updated_at)
- ✅ Email validation
- ✅ Username validation (alphanumeric + underscore, 3-30 chars)
- ✅ Password minimum 8 characters
- ✅ Public profile DTO excludes password_hash and email
- ✅ Update DTO excludes password field
