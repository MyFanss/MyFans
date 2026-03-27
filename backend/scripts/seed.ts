#!/usr/bin/env ts-node
import 'dotenv/config';
/**
 * Database seed script for development/testing.
 * Inserts deterministic mock data for creators, fans, posts, comments, likes, and notifications.
 * Idempotent — safe to run multiple times.
 */
import { DataSource } from 'typeorm';
import { User, UserRole } from '../src/users/entities/user.entity';
import { Creator } from '../src/creators/entities/creator.entity';
import { Post } from '../src/posts/entities/post.entity';
import { Comment } from '../src/comments/entities/comment.entity';
import { Like } from '../src/likes/entities/like.entity';
import { Notification, NotificationType } from '../src/notifications/entities/notification.entity';
import * as bcrypt from 'bcrypt';

async function createDataSource(): Promise<DataSource> {
  const host = process.env.DB_HOST ?? 'localhost';
  const port = parseInt(process.env.DB_PORT ?? '5432', 10);
  const username = process.env.DB_USER ?? 'myfans';
  const password = process.env.DB_PASSWORD ?? 'password';
  const database = process.env.DB_NAME ?? 'myfans';

  console.log('🌍 DB connection:', { host, port, username, database });

  const dataSource = new DataSource({
    type: 'postgres',
    host,
    port,
    username,
    password,
    database,
    entities: [User, Creator, Post, Comment, Like, Notification],
    synchronize: true, // create schema for local dev
    logging: false,
  });

  await dataSource.initialize();
  return dataSource;
}

async function seedDatabase() {
  console.log('🌱 Starting database seed...');

  const dataSource = await createDataSource();

  try {
    // Check if already seeded
    const userRepo = dataSource.getRepository(User);
    const existingUser = await userRepo.findOne({ where: { email: 'creator1@example.com' } });

    if (existingUser) {
      console.log('✅ Database already seeded. Skipping...');
      return;
    }

    console.log('📝 Seeding users...');

    // Hash password for all users
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Create fans
    const fan1 = await userRepo.save({
      email: 'fan1@example.com',
      username: 'fan1',
      password_hash: hashedPassword,
      display_name: 'John Fan',
      role: UserRole.USER,
      is_creator: false,
      email_notifications: true,
      push_notifications: false,
      marketing_emails: false,
      email_new_subscriber: true,
      email_subscription_renewal: true,
      email_new_comment: true,
      email_new_like: false,
      email_new_message: true,
      email_payout: true,
      push_new_subscriber: true,
      push_subscription_renewal: true,
      push_new_comment: true,
      push_new_like: true,
      push_new_message: true,
      push_payout: false,
    });

    const fan2 = await userRepo.save({
      email: 'fan2@example.com',
      username: 'fan2',
      password_hash: hashedPassword,
      display_name: 'Jane Fan',
      role: UserRole.USER,
      is_creator: false,
      email_notifications: true,
      push_notifications: true,
      marketing_emails: true,
      email_new_subscriber: true,
      email_subscription_renewal: true,
      email_new_comment: true,
      email_new_like: true,
      email_new_message: true,
      email_payout: true,
      push_new_subscriber: true,
      push_subscription_renewal: true,
      push_new_comment: true,
      push_new_like: true,
      push_new_message: true,
      push_payout: false,
    });

    // Create creators
    const creatorUser1 = await userRepo.save({
      email: 'creator1@example.com',
      username: 'creator1',
      password_hash: hashedPassword,
      display_name: 'Alice Creator',
      role: UserRole.USER,
      is_creator: true,
      email_notifications: true,
      push_notifications: true,
      marketing_emails: false,
      email_new_subscriber: true,
      email_subscription_renewal: true,
      email_new_comment: true,
      email_new_like: true,
      email_new_message: true,
      email_payout: true,
      push_new_subscriber: true,
      push_subscription_renewal: true,
      push_new_comment: true,
      push_new_like: true,
      push_new_message: true,
      push_payout: true,
    });

    const creatorUser2 = await userRepo.save({
      email: 'creator2@example.com',
      username: 'creator2',
      password_hash: hashedPassword,
      display_name: 'Bob Creator',
      role: UserRole.USER,
      is_creator: true,
      email_notifications: true,
      push_notifications: false,
      marketing_emails: true,
      email_new_subscriber: true,
      email_subscription_renewal: true,
      email_new_comment: true,
      email_new_like: false,
      email_new_message: true,
      email_payout: true,
      push_new_subscriber: true,
      push_subscription_renewal: true,
      push_new_comment: true,
      push_new_like: true,
      push_new_message: true,
      push_payout: true,
    });

    console.log('📝 Seeding creators...');

    const creatorRepo = dataSource.getRepository(Creator);

    const creator1 = await creatorRepo.save({
      user_id: creatorUser1.id,
      bio: 'I create amazing content about technology and programming!',
      subscription_price: '10.0000000',
      currency: 'XLM',
      is_verified: true,
      followers_count: 150,
    });

    const creator2 = await creatorRepo.save({
      user_id: creatorUser2.id,
      bio: 'Art and creativity enthusiast sharing my journey.',
      subscription_price: '5.0000000',
      currency: 'XLM',
      is_verified: false,
      followers_count: 75,
    });

    console.log('📝 Seeding posts...');

    const postRepo = dataSource.getRepository(Post);

    const post1 = await postRepo.save({
      title: 'My First Post',
      content: 'This is my first post on the platform! Excited to share my journey with you all.',
      authorId: creatorUser1.id,
      isPublished: true,
      isPremium: false,
      likesCount: 0,
    });

    const post2 = await postRepo.save({
      title: 'Premium Content: Advanced Tutorial',
      content: 'This premium tutorial covers advanced techniques that only subscribers can access.',
      authorId: creatorUser1.id,
      isPublished: true,
      isPremium: true,
      likesCount: 0,
    });

    const post3 = await postRepo.save({
      title: 'Creative Process Behind My Art',
      content: 'Let me walk you through how I create my artwork from concept to completion.',
      authorId: creatorUser2.id,
      isPublished: true,
      isPremium: false,
      likesCount: 0,
    });

    console.log('📝 Seeding comments...');

    const commentRepo = dataSource.getRepository(Comment);

    const comment1 = await commentRepo.save({
      content: 'Great post! Looking forward to more content.',
      authorId: fan1.id,
      postId: post1.id,
    });

    const comment2 = await commentRepo.save({
      content: 'This tutorial is exactly what I needed. Thank you!',
      authorId: fan2.id,
      postId: post2.id,
    });

    const comment3 = await commentRepo.save({
      content: 'Your art style is amazing. How long did this piece take?',
      authorId: fan1.id,
      postId: post3.id,
    });

    console.log('📝 Seeding likes...');

    const likeRepo = dataSource.getRepository(Like);

    await likeRepo.save({
      userId: fan1.id,
      postId: post1.id,
    });

    await likeRepo.save({
      userId: fan2.id,
      postId: post1.id,
    });

    await likeRepo.save({
      userId: fan1.id,
      postId: post3.id,
    });

    // Update likes count
    await postRepo.update(post1.id, { likesCount: 2 });
    await postRepo.update(post3.id, { likesCount: 1 });

    console.log('📝 Seeding notifications...');

    const notificationRepo = dataSource.getRepository(Notification);

    await notificationRepo.save({
      user_id: creatorUser1.id,
      type: NotificationType.NEW_COMMENT,
      title: 'New Comment',
      body: 'fan1 commented on your post "My First Post"',
      is_read: false,
      metadata: { postId: post1.id, commentId: comment1.id },
    });

    await notificationRepo.save({
      user_id: creatorUser1.id,
      type: NotificationType.NEW_LIKE,
      title: 'New Like',
      body: 'fan1 liked your post "My First Post"',
      is_read: false,
      metadata: { postId: post1.id },
    });

    await notificationRepo.save({
      user_id: creatorUser1.id,
      type: NotificationType.NEW_LIKE,
      title: 'New Like',
      body: 'fan2 liked your post "My First Post"',
      is_read: false,
      metadata: { postId: post1.id },
    });

    await notificationRepo.save({
      user_id: creatorUser2.id,
      type: NotificationType.NEW_COMMENT,
      title: 'New Comment',
      body: 'fan1 commented on your post "Creative Process Behind My Art"',
      is_read: false,
      metadata: { postId: post3.id, commentId: comment3.id },
    });

    console.log('✅ Database seeded successfully!');
    console.log('');
    console.log('Created data:');
    console.log('- 2 fans (fan1@example.com, fan2@example.com)');
    console.log('- 2 creators (creator1@example.com, creator2@example.com)');
    console.log('- 3 posts (2 public, 1 premium)');
    console.log('- 3 comments');
    console.log('- 3 likes');
    console.log('- 4 notifications');
    console.log('');
    console.log('All users have password: password123');

  } finally {
    await dataSource.destroy();
  }
}

async function main() {
  try {
    await seedDatabase();
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

main();