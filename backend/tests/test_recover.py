from datetime import datetime, timedelta

from app.routers import public


def test_recover_rate_limit_allows_then_blocks(monkeypatch):
    monkeypatch.setattr(public, "_recover_attempts", {})
    now = datetime(2026, 6, 1, 10, 0)
    for _ in range(public.MAX_RECOVER_PER_EMAIL_PER_HOUR):
        assert public._recover_rate_limited("a@b.com", now) is False
    assert public._recover_rate_limited("a@b.com", now) is True
    # a different address is not affected
    assert public._recover_rate_limited("c@d.com", now) is False


def test_recover_rate_limit_resets_after_an_hour(monkeypatch):
    monkeypatch.setattr(public, "_recover_attempts", {})
    now = datetime(2026, 6, 1, 10, 0)
    for _ in range(public.MAX_RECOVER_PER_EMAIL_PER_HOUR):
        public._recover_rate_limited("a@b.com", now)
    assert public._recover_rate_limited("a@b.com", now) is True
    later = now + timedelta(hours=1, minutes=1)
    assert public._recover_rate_limited("a@b.com", later) is False
