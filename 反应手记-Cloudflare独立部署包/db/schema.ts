import {integer, primaryKey, sqliteTable, text} from 'drizzle-orm/sqlite-core';
export const reactionRecords = sqliteTable('reaction_records', {
 userId: text('user_id').notNull(),
 id: text('id').notNull(),
 version: integer('version').notNull(),
 payload: text('payload'),
 updatedAt: text('updated_at').notNull(),
}, table => [primaryKey({columns:[table.userId, table.id]})]);

// Better Auth's documented core schema; the existing journal table is unchanged.
export const user=sqliteTable('journal_user',{
 id:text('id').primaryKey(),name:text('name').notNull(),email:text('email').notNull().unique(),
 emailVerified:integer('email_verified',{mode:'boolean'}).notNull().default(false),image:text('image'),
 createdAt:integer('created_at',{mode:'timestamp_ms'}).notNull(),updatedAt:integer('updated_at',{mode:'timestamp_ms'}).notNull(),
});
export const session=sqliteTable('journal_session',{
 id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>user.id,{onDelete:'cascade'}),
 token:text('token').notNull().unique(),expiresAt:integer('expires_at',{mode:'timestamp_ms'}).notNull(),
 ipAddress:text('ip_address'),userAgent:text('user_agent'),createdAt:integer('created_at',{mode:'timestamp_ms'}).notNull(),updatedAt:integer('updated_at',{mode:'timestamp_ms'}).notNull(),
});
export const account=sqliteTable('journal_account',{
 id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>user.id,{onDelete:'cascade'}),
 accountId:text('account_id').notNull(),providerId:text('provider_id').notNull(),accessToken:text('access_token'),refreshToken:text('refresh_token'),idToken:text('id_token'),scope:text('scope'),password:text('password'),
 accessTokenExpiresAt:integer('access_token_expires_at',{mode:'timestamp_ms'}),refreshTokenExpiresAt:integer('refresh_token_expires_at',{mode:'timestamp_ms'}),
 createdAt:integer('created_at',{mode:'timestamp_ms'}).notNull(),updatedAt:integer('updated_at',{mode:'timestamp_ms'}).notNull(),
});
export const verification=sqliteTable('journal_verification',{
 id:text('id').primaryKey(),identifier:text('identifier').notNull(),value:text('value').notNull(),expiresAt:integer('expires_at',{mode:'timestamp_ms'}).notNull(),
 createdAt:integer('created_at',{mode:'timestamp_ms'}).notNull(),updatedAt:integer('updated_at',{mode:'timestamp_ms'}).notNull(),
});
export const rateLimit=sqliteTable('journal_rate_limit',{
 id:text('id').primaryKey(),key:text('key').notNull().unique(),count:integer('count').notNull(),lastRequest:integer('last_request').notNull(),
});
