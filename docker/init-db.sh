#!/bin/bash
# Creates the application database if it doesn't already exist.
# Runs once at PostgreSQL container startup via /docker-entrypoint-initdb.d/
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'Database already exists' WHERE EXISTS (
        SELECT FROM pg_database WHERE datname = '$POSTGRES_DB'
    );
EOSQL

echo "Database initialization complete."
