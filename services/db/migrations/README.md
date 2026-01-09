# Database Migrations

This directory contains database migration scripts for schema changes after the initial deployment.

## Overview

Migrations are SQL scripts that modify the database schema or data in a controlled, versioned manner. Each migration represents a single, atomic change to the database.

## Migration Naming Convention

Migration files should follow this naming pattern:

```
<number>-<description>.sql
```

Examples:
- `003-add-user-authentication.sql`
- `004-add-video-frame-table.sql`
- `005-add-depth-map-versions.sql`

**Important**: Numbers should be sequential and zero-padded to at least 3 digits.

## Migration Structure

Each migration file should contain:

1. **Header comment**: Description of the change
2. **Upgrade section**: SQL to apply the change
3. **Rollback section**: SQL to undo the change (commented out)

### Template

```sql
-- Migration: <Number> - <Description>
-- Date: <YYYY-MM-DD>
-- Author: <Name>
-- Description: <Detailed description of what this migration does>

-- ===========================================================================
-- UPGRADE
-- ===========================================================================

BEGIN;

-- Your migration SQL here
ALTER TABLE example_table ADD COLUMN new_column VARCHAR(255);

COMMIT;

-- ===========================================================================
-- ROLLBACK (Keep commented - for reference only)
-- ===========================================================================

-- BEGIN;
-- ALTER TABLE example_table DROP COLUMN new_column;
-- COMMIT;
```

## Current Schema Version

The current schema is at **version 2** (initial schema + sample data).

## Applying Migrations

### Manual Application

Currently, migrations are applied manually. To apply a migration:

```bash
# 1. Copy the migration file to the database container
docker compose cp migrations/003-new-migration.sql db:/tmp/

# 2. Apply the migration
docker compose exec db psql -U immichvr -d immichvr -f /tmp/003-new-migration.sql

# 3. Verify the change
docker compose exec db psql -U immichvr -d immichvr -c "\d table_name"
```

### Automated Application (Future Enhancement)

For production environments, consider using migration tools:

- **node-pg-migrate**: Node.js migration tool
- **Flyway**: Java-based migration tool
- **Liquibase**: Enterprise-grade database change management
- **Sqitch**: Database-agnostic migration tool

## Best Practices

### 1. One Change Per Migration

Each migration should represent a single logical change:

✅ Good:
- `003-add-user-table.sql`
- `004-add-user-indexes.sql`

❌ Bad:
- `003-add-users-and-sessions-and-modify-media.sql`

### 2. Use Transactions

Always wrap migrations in transactions:

```sql
BEGIN;
-- migration code
COMMIT;
```

This ensures atomicity - either all changes succeed or none do.

### 3. Test Migrations

Before applying to production:

1. Test on a development database
2. Test the upgrade path
3. Test the rollback path
4. Verify data integrity

### 4. Keep Rollback Scripts

Always include rollback SQL (commented out) for reference:

```sql
-- Rollback:
-- BEGIN;
-- DROP TABLE users;
-- COMMIT;
```

### 5. Document Breaking Changes

If a migration breaks compatibility, document it clearly:

```sql
-- ⚠️ BREAKING CHANGE: This migration removes the 'old_column' column
-- Applications must be updated before applying this migration
```

### 6. Use IF EXISTS/IF NOT EXISTS

Prevent errors from repeated application:

```sql
-- Safe to run multiple times
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS new_field VARCHAR(255);
DROP TABLE IF EXISTS old_table;
```

### 7. Create Indexes Concurrently

In production, create indexes without locking:

```sql
CREATE INDEX CONCURRENTLY idx_media_items_new_field ON media_items(new_field);
```

Note: This cannot be done inside a transaction block.

### 8. Avoid Data Migrations in Schema Changes

Separate schema changes from data changes:

```sql
-- Good: Schema change
003-add-user-column.sql

-- Good: Data migration
004-populate-user-column.sql

-- Bad: Mixed
003-add-and-populate-user-column.sql
```

## Common Migration Patterns

### Adding a Column

```sql
BEGIN;

ALTER TABLE media_items 
ADD COLUMN is_favorite BOOLEAN DEFAULT false NOT NULL;

-- Add index if needed
CREATE INDEX idx_media_items_is_favorite ON media_items(is_favorite);

COMMIT;
```

### Modifying a Column

```sql
BEGIN;

-- Change column type
ALTER TABLE media_items 
ALTER COLUMN file_size TYPE BIGINT USING file_size::BIGINT;

-- Change constraint
ALTER TABLE media_items 
ALTER COLUMN original_filename SET NOT NULL;

COMMIT;
```

### Adding a Table

```sql
BEGIN;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

-- Add trigger
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMIT;
```

### Adding a Foreign Key

```sql
BEGIN;

-- Add column
ALTER TABLE media_items 
ADD COLUMN owner_id UUID;

-- Add foreign key constraint
ALTER TABLE media_items
ADD CONSTRAINT fk_media_items_owner
FOREIGN KEY (owner_id)
REFERENCES users(id)
ON DELETE SET NULL;

-- Add index
CREATE INDEX idx_media_items_owner_id ON media_items(owner_id);

COMMIT;
```

### Adding an Enum Value

```sql
BEGIN;

-- Add new value to existing enum
ALTER TYPE processing_status ADD VALUE 'paused' AFTER 'processing';

COMMIT;
```

Note: This cannot be rolled back or done inside a transaction in older PostgreSQL versions.

### Renaming a Column

```sql
BEGIN;

ALTER TABLE media_items 
RENAME COLUMN old_name TO new_name;

COMMIT;
```

### Dropping a Table

```sql
BEGIN;

-- Drop dependent objects first
DROP VIEW IF EXISTS media_processing_status CASCADE;

-- Drop the table
DROP TABLE IF EXISTS old_table CASCADE;

COMMIT;
```

## Migration Checklist

Before applying a migration to production:

- [ ] Migration tested on development database
- [ ] Rollback tested on development database
- [ ] Migration wrapped in transaction (if possible)
- [ ] Rollback script provided (commented)
- [ ] Breaking changes documented
- [ ] Database backup taken
- [ ] Migration file added to version control
- [ ] Migration logged in this README
- [ ] Application code updated (if needed)
- [ ] Deployment plan documented

## Migration History

| Version | File | Date | Description |
|---------|------|------|-------------|
| 001 | `01-schema.sql` | 2024-01-15 | Initial schema with media_items, processing_queue, and depth_map_cache |
| 002 | `02-sample-data.sql` | 2024-01-15 | Sample data for development |

## Troubleshooting

### Migration Failed

1. Check the error message in PostgreSQL logs
2. Verify the migration syntax
3. Check for conflicts with existing schema
4. Rollback if needed:
   ```bash
   docker compose exec db psql -U immichvr -d immichvr
   # Run rollback SQL manually
   ```

### Cannot Drop Column

If a column is referenced by views or foreign keys:

1. Drop dependent objects first
2. Drop the column
3. Recreate dependent objects (if needed)

### Enum Cannot Be Modified

PostgreSQL enums are immutable in older versions. Workarounds:

1. **Add value**: Works in PostgreSQL 9.1+
2. **Remove value**: Create new enum, migrate data, drop old enum
3. **Rename value**: Not supported - must recreate enum

### Long-Running Migration

For large tables:

1. Test migration duration on production-sized data
2. Schedule during maintenance window
3. Consider using concurrent operations where possible
4. Monitor lock waits and deadlocks

## Future Enhancements

Planned improvements for migration management:

1. **Automated migration tool**: Integrate node-pg-migrate or similar
2. **Migration version tracking**: Add migrations table to track applied migrations
3. **Pre-migration checks**: Validate schema before applying
4. **Automated rollback**: Automatic rollback on failure
5. **Migration tests**: Automated testing of migrations
6. **CI/CD integration**: Run migrations as part of deployment pipeline

## Resources

- [PostgreSQL ALTER TABLE Documentation](https://www.postgresql.org/docs/current/sql-altertable.html)
- [PostgreSQL Transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)
- [node-pg-migrate](https://github.com/salsita/node-pg-migrate)
- [Database Migration Best Practices](https://www.postgresql.org/docs/current/ddl-alter.html)
