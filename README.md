# Banking Transaction Analyzer

Categorizes and summarizes bank transactions from Excel statements (.xlsx). Upload monthly files, view spending breakdowns by category and card holder, and manage category rules.

## Stack

- **Frontend:** React, Recharts, nginx
- **Backend:** Python, FastAPI, SQLite
- **Infrastructure:** Docker Compose

## Quick Start

```bash
docker compose up -d
```

App runs at `http://localhost:3000`.

## Usage

1. Upload an `.xlsx` bank statement via drag & drop or file picker
2. Transactions are parsed, categorized, and stored in SQLite
3. Upload additional monthly files — duplicates are skipped automatically
4. Click a transaction's category badge to reassign it (updates all matching merchants)
5. Add custom categories via the "+ Add Category" button
6. Filter by category, card holder, or source file

## Architecture

```
banking-app/
├── docker-compose.yml
├── Dockerfile              # React build → nginx
├── nginx.conf              # Serves frontend, proxies /api → backend
├── backend/
│   ├── Dockerfile
│   ├── main.py             # FastAPI endpoints + Excel parser
│   ├── database.py         # SQLite schema, seed data
│   └── requirements.txt
└── src/
    ├── App.js              # React app
    └── App.css
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/upload` | Upload .xlsx file |
| `GET` | `/api/transactions` | List transactions (query: `category`, `card_holder`, `source_file`) |
| `GET` | `/api/categories` | List all categories |
| `POST` | `/api/categories` | Create category `{ "name": "..." }` |
| `GET` | `/api/category-rules` | List keyword→category mappings |
| `PUT` | `/api/category-rules/{keyword}` | Update rule + all matching transactions `{ "category": "..." }` |
| `POST` | `/api/category-rules` | Create rule `{ "keyword": "...", "category": "..." }` |
| `GET` | `/api/source-files` | List imported filenames |

## Database

SQLite with three tables:

- **transactions** — date, description, city, amount, card_holder, category, source_file (dedup index on date+description+amount+card_holder+source_file)
- **categories** — unique category names
- **category_rules** — keyword→category mappings; changing a rule updates all matching transactions

Data persists in Docker volume `db-data`. Wipe with `docker compose down -v`.

## Commands

```bash
docker compose up -d          # start
docker compose down           # stop
docker compose up --build -d  # rebuild after code changes
docker compose down -v        # stop + wipe database
```
