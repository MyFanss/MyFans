import { PublicCreatorDto } from './public-creator.dto';
import { User, UserRole } from '../../users/entities/user.entity';
import { Creator } from '../../users/entities/creator.entity';

describe('PublicCreatorDto', () => {
  describe('DTO construction with User and Creator entities', () => {
    it('should construct DTO with all public fields from User and Creator', () => {
      // Arrange
      const user: User = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        username: 'johndoe',
        display_name: 'John Doe',
        avatar_url: 'https://example.com/avatar.jpg',
        email: 'john@example.com',
        password_hash: 'hashed_password_123',
        email_notifications: true,
        push_notifications: false,
        marketing_emails: false,
        role: UserRole.USER,
        is_creator: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const creator: Creator = {
        id: '456e7890-e89b-12d3-a456-426614174001',
        user: user,
        bio: 'This is my creator bio',
        subscription_price: 9.99,
        total_subscribers: 100,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Act
      const dto = new PublicCreatorDto(user, creator);

      // Assert
      expect(dto.id).toBe(user.id);
      expect(dto.username).toBe(user.username);
      expect(dto.display_name).toBe(user.display_name);
      expect(dto.avatar_url).toBe(user.avatar_url);
      expect(dto.bio).toBe(creator.bio);
    });

    it('should include all required public fields', () => {
      // Arrange
      const user: User = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        username: 'johndoe',
        display_name: 'John Doe',
        avatar_url: 'https://example.com/avatar.jpg',
        email: 'john@example.com',
        password_hash: 'hashed_password_123',
        email_notifications: true,
        push_notifications: false,
        marketing_emails: false,
        role: UserRole.USER,
        is_creator: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const creator: Creator = {
        id: '456e7890-e89b-12d3-a456-426614174001',
        user: user,
        bio: 'This is my creator bio',
        subscription_price: 9.99,
        total_subscribers: 100,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Act
      const dto = new PublicCreatorDto(user, creator);

      // Assert - verify all public fields are present
      expect(dto).toHaveProperty('id');
      expect(dto).toHaveProperty('username');
      expect(dto).toHaveProperty('display_name');
      expect(dto).toHaveProperty('avatar_url');
      expect(dto).toHaveProperty('bio');
    });
  });

  describe('DTO construction with User only (null bio)', () => {
    it('should construct DTO with null bio when Creator is not provided', () => {
      // Arrange
      const user: User = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        username: 'johndoe',
        display_name: 'John Doe',
        avatar_url: 'https://example.com/avatar.jpg',
        email: 'john@example.com',
        password_hash: 'hashed_password_123',
        email_notifications: true,
        push_notifications: false,
        marketing_emails: false,
        role: UserRole.USER,
        is_creator: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Act
      const dto = new PublicCreatorDto(user);

      // Assert
      expect(dto.id).toBe(user.id);
      expect(dto.username).toBe(user.username);
      expect(dto.display_name).toBe(user.display_name);
      expect(dto.avatar_url).toBe(user.avatar_url);
      expect(dto.bio).toBeNull();
    });

    it('should construct DTO with null bio when Creator bio is undefined', () => {
      // Arrange
      const user: User = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        username: 'johndoe',
        display_name: 'John Doe',
        avatar_url: 'https://example.com/avatar.jpg',
        email: 'john@example.com',
        password_hash: 'hashed_password_123',
        email_notifications: true,
        push_notifications: false,
        marketing_emails: false,
        role: UserRole.USER,
        is_creator: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const creator: Creator = {
        id: '456e7890-e89b-12d3-a456-426614174001',
        user: user,
        bio: undefined as any,
        subscription_price: 9.99,
        total_subscribers: 100,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Act
      const dto = new PublicCreatorDto(user, creator);

      // Assert
      expect(dto.bio).toBeNull();
    });
  });

  describe('Verify only public fields are included', () => {
    it('should only include public fields (id, display_name, username, avatar_url, bio)', () => {
      // Arrange
      const user: User = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        username: 'johndoe',
        display_name: 'John Doe',
        avatar_url: 'https://example.com/avatar.jpg',
        email: 'john@example.com',
        password_hash: 'hashed_password_123',
        email_notifications: true,
        push_notifications: false,
        marketing_emails: false,
        role: UserRole.USER,
        is_creator: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const creator: Creator = {
        id: '456e7890-e89b-12d3-a456-426614174001',
        user: user,
        bio: 'This is my creator bio',
        subscription_price: 9.99,
        total_subscribers: 100,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Act
      const dto = new PublicCreatorDto(user, creator);
      const dtoKeys = Object.keys(dto);

      // Assert - verify only 5 public fields
      expect(dtoKeys).toHaveLength(5);
      expect(dtoKeys).toContain('id');
      expect(dtoKeys).toContain('username');
      expect(dtoKeys).toContain('display_name');
      expect(dtoKeys).toContain('avatar_url');
      expect(dtoKeys).toContain('bio');
    });
  });

  describe('Verify sensitive fields are excluded', () => {
    it('should not include sensitive User fields', () => {
      // Arrange
      const user: User = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        username: 'johndoe',
        display_name: 'John Doe',
        avatar_url: 'https://example.com/avatar.jpg',
        email: 'john@example.com',
        password_hash: 'hashed_password_123',
        email_notifications: true,
        push_notifications: false,
        marketing_emails: false,
        role: UserRole.USER,
        is_creator: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const creator: Creator = {
        id: '456e7890-e89b-12d3-a456-426614174001',
        user: user,
        bio: 'This is my creator bio',
        subscription_price: 9.99,
        total_subscribers: 100,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Act
      const dto = new PublicCreatorDto(user, creator);

      // Assert - verify sensitive fields are not present
      expect(dto).not.toHaveProperty('password_hash');
      expect(dto).not.toHaveProperty('email');
      expect(dto).not.toHaveProperty('role');
      expect(dto).not.toHaveProperty('email_notifications');
      expect(dto).not.toHaveProperty('push_notifications');
      expect(dto).not.toHaveProperty('marketing_emails');
      expect(dto).not.toHaveProperty('is_creator');
      expect(dto).not.toHaveProperty('created_at');
      expect(dto).not.toHaveProperty('updated_at');
    });

    it('should not include sensitive Creator fields', () => {
      // Arrange
      const user: User = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        username: 'johndoe',
        display_name: 'John Doe',
        avatar_url: 'https://example.com/avatar.jpg',
        email: 'john@example.com',
        password_hash: 'hashed_password_123',
        email_notifications: true,
        push_notifications: false,
        marketing_emails: false,
        role: UserRole.USER,
        is_creator: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const creator: Creator = {
        id: '456e7890-e89b-12d3-a456-426614174001',
        user: user,
        bio: 'This is my creator bio',
        subscription_price: 9.99,
        total_subscribers: 100,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Act
      const dto = new PublicCreatorDto(user, creator);

      // Assert - verify Creator sensitive fields are not present
      expect(dto).not.toHaveProperty('subscription_price');
      expect(dto).not.toHaveProperty('total_subscribers');
      expect(dto).not.toHaveProperty('is_active');
    });
  });
});
