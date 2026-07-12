"""In-memory pub/sub for lunch poll real-time updates (SSE)."""
from __future__ import annotations

import queue
import threading
from typing import Any

_lock = threading.Lock()
_subscribers: dict[str, list[queue.Queue]] = {}


def subscribe(user_id: str) -> queue.Queue:
    q: queue.Queue = queue.Queue(maxsize=64)
    with _lock:
        _subscribers.setdefault(user_id, []).append(q)
    return q


def unsubscribe(user_id: str, q: queue.Queue) -> None:
    with _lock:
        subs = _subscribers.get(user_id, [])
        if q in subs:
            subs.remove(q)
        if not subs:
            _subscribers.pop(user_id, None)


def broadcast_lunch_event(event: dict[str, Any]) -> None:
    """Push an event to every connected lunch SSE client."""
    with _lock:
        queues = [q for subs in _subscribers.values() for q in subs]
    for q in queues:
        try:
            q.put_nowait(event)
        except queue.Full:
            pass
