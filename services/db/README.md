# ImmichVR Database

This directory contains the PostgreSQL database schema, initialization scripts, and migration files for the ImmichVR project.

## Directory Structure

```
db/
├── init/                   # Database initialization scripts
│   ├── 01-schema.sql      # Main schema definition
│   └── 02-sample-data.sql # Sample data (optional, for development)
├── migrations/            # Database migration scripts
│   └── README.md         # Migration guidelines
├── SCHEMA.md             # Comprehensive schema documentation
└── README.md             # This file
```

## Quick Start

### Automatic Initialization

When the PostgreSQL container starts for the first time, it automatically executes all `.sql` files in the `init/` directory in alphabetical order. The schema is created automatically via Docker Compose volume mounting.

No manual setup is required!

### Verify Schema

After starting the services, verify the schema was created:

```bash
# Access the database container
docker compose exec db psql -U immichvr -d immichvr

# List all tables
\dt

# Describe a table
\d media_items

# View sample data (if loaded)
SELECT * FROM media_items;

# Exit
\q
```

## Schema Overview

The database consists of three main tables:

1. **media_items**: Stores metadata for photos and videos
2. **processing_queue**: Manages depth map processing with status tracking
3. **depth_map_cache**: Caches generated depth map file paths

See [SCHEMA.md](SCHEMA.md) for complete documentation including:
- Entity Relationship Diagram (ERD)
- Detailed table descriptions
- Indexes and constraints
- Views and triggers
- Usage examples
- Migration strategies

## Database Connection

### Connection Parameters

The following environment variables configure the database connection:

- `POSTGRES_USER`: Database username (default: `immichvr`)
- `POSTGRES_PASSWORD`: Database password (default: `changeme`)
- `POSTGRES_DB`: Database name (default: `immichvr`)
- `POSTGRES_HOST`: Database host (default: `db` in Docker, `localhost` outside)

### Connection String

```
postgresql://immichvr:changeme@db:5432/immichvr
```

### From Backend Service

The Node.js backend automatically connects using the `pg` library:

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  port: 5432,
});
```

## Development

### Sample Data

The `02-sample-data.sql` file contains sample data for development and testing. This file is optional and can be removed in production environments.

To disable sample data loading:
```bash
# Rename or remove the file
mv init/02-sample-data.sql init/02-sample-data.sql.disabled
```

### Reset Database

To completely reset the database:

```bash
# Stop services and remove volumes
docker compose down -v

# Start services (this will recreate the database)
docker compose up -d
```

### Backup Database

```bash
# Create a backup
docker compose exec db pg_dump -U immichvr immichvr > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
cat backup_20240315_120000.sql | docker compose exec -T db psql -U immichvr immichvr
```

### Direct Database Access

```bash
# Interactive psql session
docker compose exec db psql -U immichvr -d immichvr

# Execute a query
docker compose exec db psql -U immichvr -d immichvr -c "SELECT * FROM processing_queue_summary;"

# Execute a SQL file
docker compose exec -T db psql -U immichvr -d immichvr < query.sql
```

## Migrations

Database migrations are managed in the `migrations/` directory. See [migrations/README.md](migrations/README.md) for detailed migration guidelines.

### Creating a Migration

1. Create a new migration file with a descriptive name:
   ```bash
   touch migrations/003-add-user-authentication.sql
   ```

2. Write the migration with both upgrade and rollback:
   ```sql
   -- Upgrade
   ALTER TABLE media_items ADD COLUMN is_public BOOLEAN DEFAULT false;
   
   -- Rollback (commented)
   -- ALTER TABLE media_items DROP COLUMN is_public;
   ```

3. Test the migration on a development database
4. Document the migration in migrations/README.md

### Applying Migrations

Migrations are currently applied manually. A future enhancement could add automatic migration tooling (e.g., Flyway, Liquibase, or node-pg-migrate).

## Maintenance

### Vacuum and Analyze

```bash
# Vacuum all tables
docker compose exec db psql -U immichvr -d immichvr -c "VACUUM ANALYZE;"

# Vacuum a specific table
docker compose exec db psql -U immichvr -d immichvr -c "VACUUM ANALYZE media_items;"
```

### Check Table Sizes

```bash
docker compose exec db psql -U immichvr -d immichvr -c "
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

### Monitor Active Connections

```bash
docker compose exec db psql -U immichvr -d immichvr -c "
SELECT
    pid,
    usename,
    application_name,
    client_addr,
    state,
    query
FROM pg_stat_activity
WHERE datname = 'immichvr';
"
```

## Troubleshooting

### Database Won't Start

1. Check logs: `docker compose logs db`
2. Verify volume permissions: `docker volume inspect immichvr_postgres_data`
3. Check for port conflicts: `lsof -i :5432` (on host)

### Schema Not Created

1. Check if init scripts were executed: `docker compose logs db | grep "init"`
2. Verify volume mounting in docker-compose.yml
3. Remove volume and recreate: `docker compose down -v && docker compose up -d`

### Connection Refused

1. Verify database is healthy: `docker compose ps`
2. Check environment variables: `docker compose exec backend env | grep POSTGRES`
3. Wait for health check: Database may take 10-20 seconds to be ready

### Performance Issues

1. Run VACUUM ANALYZE
2. Check for missing indexes
3. Review slow queries: Enable `log_min_duration_statement` in PostgreSQL config
4. Consider connection pooling in application code

## Security

### Production Recommendations

1. **Change default password**: Update `POSTGRES_PASSWORD` in `.env`
2. **Restrict network access**: Use firewall rules or network policies
3. **Enable SSL**: Configure SSL certificates for encrypted connections
4. **Regular backups**: Implement automated backup strategy
5. **Update regularly**: Keep PostgreSQL version up to date
6. **Monitor logs**: Watch for suspicious activity

### Secrets Management

Never commit `.env` files with real passwords to version control. Use:
- Environment-specific .env files (not in git)
- Secret management services (AWS Secrets Manager, HashiCorp Vault)
- Kubernetes secrets (for k8s deployments)

## Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Docker PostgreSQL Image](https://hub.docker.com/_/postgres)
- [pg (node-postgres) Documentation](https://node-postgres.com/)
- [ImmichVR Project README](../../README.md)

## Support

For issues related to the database schema or migrations, please:
1. Check [SCHEMA.md](SCHEMA.md) for detailed documentation
2. Review [migrations/README.md](migrations/README.md) for migration guidelines
3. Open an issue on GitHub: https://github.com/Papyszoo/ImmichVR/issues
