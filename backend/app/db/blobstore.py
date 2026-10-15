"""BlobStore – abstraction for high-rate signal storage.

Currently backed by local filesystem.  The interface is designed so it can
swap to S3/MinIO by implementing a different backend class.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Protocol

import numpy as np

from app.config import get_settings


class BlobStoreBackend(Protocol):
    """Interface for blob storage backends."""

    def put(self, key: str, data: np.ndarray, sample_rate: int) -> str: ...
    def get(self, key: str) -> tuple[np.ndarray, int]: ...
    def exists(self, key: str) -> bool: ...
    def delete(self, key: str) -> None: ...


class LocalBlobStore:
    """Local filesystem blob store using NPZ files."""

    def __init__(self, root: Path | None = None):
        self.root = root or get_settings().BLOB_STORE_ROOT
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        p = self.root / key
        p.parent.mkdir(parents=True, exist_ok=True)
        return p

    def put(self, key: str, data: np.ndarray, sample_rate: int) -> str:
        """Store a signal chunk as compressed NPZ."""
        if not key.endswith(".npz"):
            key = key + ".npz"
        path = self._path(key)
        np.savez_compressed(path, signal=data, sample_rate=np.array([sample_rate]))
        return key

    def get(self, key: str) -> tuple[np.ndarray, int]:
        """Load a signal chunk. Returns (data, sample_rate)."""
        path = self._path(key)
        with np.load(path) as npz:
            data = npz["signal"]
            sr = int(npz["sample_rate"][0])
        return data, sr

    def exists(self, key: str) -> bool:
        return self._path(key).exists()

    def delete(self, key: str) -> None:
        path = self._path(key)
        if path.exists():
            os.remove(path)

    def list_keys(self, prefix: str = "") -> list[str]:
        """List all keys with a given prefix."""
        results = []
        search_dir = self.root / prefix if prefix else self.root
        if search_dir.exists():
            for p in search_dir.rglob("*.npz"):
                results.append(str(p.relative_to(self.root)))
        return results


# Singleton
_store: LocalBlobStore | None = None


def get_blob_store() -> LocalBlobStore:
    """Return the global blob store instance."""
    global _store
    if _store is None:
        _store = LocalBlobStore()
    return _store
