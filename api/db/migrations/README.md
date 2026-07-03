# `migrations/` — Database Migrations

```
migrations/
├── __init__.py   # Empty
└── versions/     # Reserved for Alembic migration scripts
```

Currently empty. Database schema is managed via SQLAlchemy `Base.metadata.create_all()` in `api/db/database.py:init_db()`.
