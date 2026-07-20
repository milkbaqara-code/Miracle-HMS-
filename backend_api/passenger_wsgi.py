import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app.main import app as fastapi_app
from a2wsgi import ASGIMiddleware

application = ASGIMiddleware(fastapi_app)
