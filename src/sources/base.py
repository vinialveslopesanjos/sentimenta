"""
Interface base para fontes de comentários.
"""

from abc import ABC, abstractmethod
from typing import Iterator


class CommentSource(ABC):
    """Interface para conectores de fonte de comentários."""
    
    @abstractmethod
    def fetch_comments(self, video_id: str, max_comments: int = 500) -> Iterator[dict]:
        """
        Busca comentários e retorna iterator de dicts normalizados.
        
        Cada dict deve conter:
        - comment_id: str
        - video_id: str
        - parent_comment_id: str | None
        - author_name: str
        - author_channel_id: str | None
        - text_original: str
        - text_clean: str
        - text_hash: str
        - like_count: int
        - reply_count: int
        - published_at: str (ISO format)
        - updated_at: str (ISO format)
        - raw_payload: dict
        """
        pass
    
    @abstractmethod
    def discover_latest_video(self, channel_handle: str) -> str | None:
        """
        Descobre o vídeo mais recente de um canal.
        Retorna video_id ou None.
        """
        pass
