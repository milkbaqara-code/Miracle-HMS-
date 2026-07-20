import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import engine
from app.models.models import MovieAsset

def create_cinema_tables():
    print("Creating Movie Vault tables...")
    MovieAsset.__table__.create(bind=engine, checkfirst=True)
    print("Tables created successfully.")

if __name__ == "__main__":
    create_cinema_tables()
