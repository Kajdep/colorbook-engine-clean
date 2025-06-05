# Database Backup Guide

This project includes a simple script to create PostgreSQL backups.

## Usage

1. Ensure the backend `.env` file has your database credentials (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`).
2. From the `backend` directory run:

```bash
./backup.sh /path/to/backup-dir
```

If no directory is specified, backups are stored in `./backups`.

The script creates a timestamped `.sql` file using `pg_dump`.
