import asyncio
import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

if __package__ in (None, ""):
    sys.path.append(str(Path(__file__).resolve().parent.parent))
    __package__ = "app"

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import Base, SessionLocal, engine
from .routers import admin, auth, public
from .seed import seed
from .services.instagram import sync_instagram

logger = logging.getLogger(__name__)

IG_SYNC_INTERVAL_SECONDS = 24 * 60 * 60


async def _instagram_sync_loop() -> None:
    while True:
        try:
            with SessionLocal() as db:
                result = await asyncio.to_thread(sync_instagram, db)
                logger.info("Instagram auto-sync: %s", result)
        except Exception:
            logger.exception("Instagram auto-sync failed")
        await asyncio.sleep(IG_SYNC_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed(db)
    task = None
    if get_settings().ig_auto_sync:
        task = asyncio.create_task(_instagram_sync_loop())
    yield
    if task:
        task.cancel()


app = FastAPI(title="Mulher Viva API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(public.router)
app.include_router(admin.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
