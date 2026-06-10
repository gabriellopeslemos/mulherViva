import logging
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import AppSetting, BlogPost

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.instagram.com"
MEDIA_FIELDS = "id,caption,media_url,media_type,permalink,timestamp,thumbnail_url"
TOKEN_REFRESH_AFTER_DAYS = 30


def _get_setting(db: Session, key: str) -> str | None:
    row = db.get(AppSetting, key)
    return row.value if row else None


def _set_setting(db: Session, key: str, value: str) -> None:
    row = db.get(AppSetting, key)
    if row:
        row.value = value
    else:
        db.add(AppSetting(key=key, value=value))


def _maybe_refresh_token(db: Session, token: str) -> tuple[str, bool]:
    refreshed_at_raw = _get_setting(db, "ig_token_refreshed_at")
    if refreshed_at_raw:
        refreshed_at = datetime.fromisoformat(refreshed_at_raw)
        if datetime.now(timezone.utc) - refreshed_at < timedelta(
            days=TOKEN_REFRESH_AFTER_DAYS
        ):
            return token, False
    try:
        resp = httpx.get(
            f"{GRAPH_BASE}/refresh_access_token",
            params={"grant_type": "ig_refresh_token", "access_token": token},
            timeout=15,
        )
        resp.raise_for_status()
        new_token = resp.json()["access_token"]
        _set_setting(db, "ig_access_token", new_token)
        _set_setting(db, "ig_token_refreshed_at", datetime.now(timezone.utc).isoformat())
        db.commit()
        return new_token, True
    except Exception:
        logger.warning("Instagram token refresh failed", exc_info=True)
        return token, False


def _title_from_caption(caption: str | None) -> str:
    if not caption or not caption.strip():
        return "Post do Instagram"
    first_line = caption.strip().splitlines()[0].strip()
    if len(first_line) > 80:
        return first_line[:77] + "..."
    return first_line or "Post do Instagram"


def _media_to_post(item: dict) -> BlogPost | None:
    media_type = item.get("media_type")
    image_url = item.get("media_url")
    if media_type == "VIDEO":
        image_url = item.get("thumbnail_url")
        if not image_url:
            return None
    caption = item.get("caption") or ""
    published_at = datetime.fromisoformat(
        item["timestamp"].replace("+0000", "+00:00")
    ).replace(tzinfo=None)
    return BlogPost(
        title=_title_from_caption(caption),
        body=caption,
        tag="Instagram",
        source="instagram",
        instagram_media_id=str(item["id"]),
        image_url=image_url,
        permalink=item.get("permalink"),
        published_at=published_at,
    )


def sync_instagram(db: Session) -> dict:
    token = _get_setting(db, "ig_access_token")
    if not token:
        return {
            "fetched": 0,
            "created": 0,
            "skipped": 0,
            "token_refreshed": False,
            "error": "Token do Instagram nao configurado (IG_ACCESS_TOKEN)",
        }

    token, refreshed = _maybe_refresh_token(db, token)

    first_sync = _get_setting(db, "ig_last_sync_at") is None
    items: list[dict] = []
    url = f"{GRAPH_BASE}/me/media"
    params: dict | None = {"fields": MEDIA_FIELDS, "access_token": token, "limit": 25}
    try:
        while url:
            resp = httpx.get(url, params=params, timeout=20)
            resp.raise_for_status()
            data = resp.json()
            items.extend(data.get("data", []))
            next_url = data.get("paging", {}).get("next")
            if not first_sync or not next_url:
                break
            url, params = next_url, None
    except httpx.HTTPStatusError as exc:
        logger.warning("Instagram fetch failed: %s", exc.response.text)
        return {
            "fetched": 0,
            "created": 0,
            "skipped": 0,
            "token_refreshed": refreshed,
            "error": f"Erro da API do Instagram ({exc.response.status_code})",
        }
    except httpx.HTTPError:
        logger.warning("Instagram fetch failed", exc_info=True)
        return {
            "fetched": 0,
            "created": 0,
            "skipped": 0,
            "token_refreshed": refreshed,
            "error": "Falha de conexao com a API do Instagram",
        }

    media_ids = [str(i["id"]) for i in items]
    existing = set(
        db.scalars(
            select(BlogPost.instagram_media_id).where(
                BlogPost.instagram_media_id.in_(media_ids)
            )
        )
    )

    created = 0
    skipped = 0
    for item in items:
        if str(item["id"]) in existing:
            skipped += 1
            continue
        post = _media_to_post(item)
        if post is None:
            skipped += 1
            continue
        db.add(post)
        created += 1

    _set_setting(db, "ig_last_sync_at", datetime.now(timezone.utc).isoformat())
    db.commit()
    return {
        "fetched": len(items),
        "created": created,
        "skipped": skipped,
        "token_refreshed": refreshed,
        "error": None,
    }
