import sqlite3
import os

DB_PATH = os.environ.get("DB_PATH", os.path.join(os.path.dirname(__file__), "banking.db"))

SEED_CATEGORIES = {
    "Groceries": ["ICA", "COOP", "HEMKOP", "MAXI ICA", "STORA COOP", "NYTTIG SNABBMAT"],
    "Transport": ["VASTTRAFIK", "BOLT", "EASYPARK", "PARKERING", "INGO ", "CIRCLE K"],
    "Restaurants & Cafés": [
        "SUSHI YAMA", "WAYNES COFFEE", "LUCAS KAFEET", "PRESSBYRAN",
        "7-ELEVEN", "SELECTA", "SNABBMATSGRUPPEN", "KVILLEKIOSKEN",
        "GABY'S", "MANDORLA", "LOOMISP*DAHLS BAGERI", "LOOMISP*SEVEN",
    ],
    "Shopping": [
        "AMAZON", "ZARA", "KAPPAHL", "LINDEX", "STRONGER AB",
        "JOTEX", "LEKIA", "BESTSELLER", "SP LAMPLJUSET",
    ],
    "Health & Beauty": [
        "APOTEK", "APOTEA", "APOHEM", "GYNEKOLOG", "SPECSAVERS",
        "BOKADIREKT", "FLEXMASSAGE",
    ],
    "Subscriptions": ["APPLE.COM/BILL", "CRUNCHYROLL", "COMVIQ", "RED CROSS"],
    "Travel & Hotels": ["HOTEL AT BOOKING", "BOOKING.COM"],
    "Car": ["MJUK BILTVETT"],
    "Home": ["MATHEM", "KRONANS APOTEK"],
    "Furniture & Home Decor": ["TVÅ KANTEN"],
}


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            booked_date TEXT,
            description TEXT,
            city TEXT,
            currency TEXT,
            amount REAL,
            card_holder TEXT,
            category TEXT,
            source_file TEXT
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS category_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            keyword TEXT UNIQUE NOT NULL,
            category TEXT NOT NULL
        )
    """)

    # Dedup index
    c.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_txn_dedup
        ON transactions(date, description, amount, card_holder, source_file)
    """)

    # Seed categories and rules if empty
    existing = c.execute("SELECT COUNT(*) FROM categories").fetchone()[0]
    if existing == 0:
        for cat, keywords in SEED_CATEGORIES.items():
            c.execute("INSERT OR IGNORE INTO categories (name) VALUES (?)", (cat,))
            for kw in keywords:
                c.execute(
                    "INSERT OR IGNORE INTO category_rules (keyword, category) VALUES (?, ?)",
                    (kw, cat),
                )
        c.execute("INSERT OR IGNORE INTO categories (name) VALUES (?)", ("Other",))

    # Always ensure Excluded category exists
    c.execute("INSERT OR IGNORE INTO categories (name) VALUES (?)", ("Excluded",))

    conn.commit()
    conn.close()
