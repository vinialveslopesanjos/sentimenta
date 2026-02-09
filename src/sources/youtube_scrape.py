"""
Conector YouTube via scraping usando yt-dlp (recomendado).
Fallback para requests+regex se yt-dlp não disponível.

ATENÇÃO: Este método é frágil e pode quebrar com mudanças no YouTube.
Use apenas quando não tiver acesso à API oficial.
"""

import re
import json
import time
import hashlib
import html
import subprocess
import tempfile
import os
from pathlib import Path
from typing import Iterator, Optional
from urllib.parse import quote

import requests

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import SCRAPE_DELAY
from sources.base import CommentSource


def clean_text(text: str) -> str:
    """Limpa texto do comentário."""
    if not text:
        return ""
    
    # Decodifica HTML entities
    text = html.unescape(text)
    
    # Remove URLs
    text = re.sub(r'https?://\S+|www\.\S+', '', text)
    
    # Normaliza whitespace
    text = re.sub(r'\s+', ' ', text)
    
    return text.strip()


def compute_hash(text: str) -> str:
    """Calcula hash SHA256 do texto limpo."""
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def extract_video_id(url_or_id: str) -> str | None:
    """Extrai video_id de URL ou retorna o ID se já for um."""
    if not url_or_id:
        return None
    
    # Se já é um ID (11 caracteres alfanuméricos)
    if re.match(r'^[a-zA-Z0-9_-]{11}$', url_or_id):
        return url_or_id
    
    # Padrões de URL do YouTube
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})',
        r'youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url_or_id)
        if match:
            return match.group(1)
    
    return None


class YouTubeScrapeSource(CommentSource):
    """
    Fonte de comentários via scraping do YouTube.
    
    Tenta usar yt-dlp primeiro (mais confiável), 
    fallback para requests+regex.
    
    AVISO: Este é um método best-effort que pode falhar a qualquer momento
    devido a mudanças na estrutura do YouTube ou proteções anti-bot.
    """
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        })
        self._ytdlp_available = self._check_ytdlp()
    
    def _check_ytdlp(self) -> bool:
        """Verifica se yt-dlp está instalado."""
        try:
            subprocess.run(['yt-dlp', '--version'], 
                         capture_output=True, check=True, timeout=5)
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False
    
    def _get_video_page(self, video_id: str) -> str:
        """Obtém HTML da página do vídeo."""
        url = f"https://www.youtube.com/watch?v={video_id}"
        response = self.session.get(url, timeout=30)
        response.raise_for_status()
        time.sleep(SCRAPE_DELAY)
        return response.text
    
    def _extract_yt_initial_data(self, html_content: str) -> dict:
        """Extrai dados iniciais do JavaScript da página."""
        patterns = [
            r'var ytInitialData = ({.+?});</script>',
            r'window\["ytInitialData"\] = ({.+?});',
            r'ytInitialData\s*=\s*({.+?});'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, html_content, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(1))
                except json.JSONDecodeError:
                    continue
        
        return {}
    
    def get_video_info(self, video_id: str) -> dict:
        """Extrai informações do vídeo."""
        if self._ytdlp_available:
            return self._get_video_info_ytdlp(video_id)
        else:
            return self._get_video_info_html(video_id)
    
    def _get_video_info_ytdlp(self, video_id: str) -> dict:
        """Extrai info do vídeo usando yt-dlp."""
        url = f"https://youtube.com/watch?v={video_id}"
        
        try:
            result = subprocess.run(
                ['yt-dlp', '--dump-json', '--no-download', '--no-warnings', url],
                capture_output=True, text=True, timeout=30, encoding='utf-8'
            )
            
            if result.returncode != 0:
                raise ValueError(f"yt-dlp error: {result.stderr}")
            
            data = json.loads(result.stdout)
            
            return {
                'video_id': video_id,
                'title': data.get('title', 'Unknown'),
                'channel_title': data.get('channel', 'Unknown'),
                'channel_id': data.get('channel_id'),
                'published_at': data.get('upload_date'),
                'view_count': data.get('view_count', 0),
                'like_count': data.get('like_count', 0),
                'comment_count': data.get('comment_count', 0)
            }
        
        except Exception as e:
            print(f"   yt-dlp falhou, tentando HTML: {e}")
            return self._get_video_info_html(video_id)
    
    def _get_video_info_html(self, video_id: str) -> dict:
        """Extrai info do vídeo do HTML."""
        html_content = self._get_video_page(video_id)
        data = self._extract_yt_initial_data(html_content)
        
        try:
            video_primary = data['contents']['twoColumnWatchNextResults']['results']['results']['contents']
            
            # Título
            title = "Unknown"
            for item in video_primary:
                if 'videoPrimaryInfoRenderer' in item:
                    title_runs = item['videoPrimaryInfoRenderer']['title'].get('runs', [])
                    if title_runs:
                        title = ''.join(r['text'] for r in title_runs)
                    break
            
            # Canal
            channel_title = "Unknown"
            channel_id = None
            for item in video_primary:
                if 'videoSecondaryInfoRenderer' in item:
                    owner = item['videoSecondaryInfoRenderer'].get('owner', {})
                    video_owner = owner.get('videoOwnerRenderer', {})
                    channel_name_runs = video_owner.get('title', {}).get('runs', [])
                    if channel_name_runs:
                        channel_title = channel_name_runs[0]['text']
                    # Channel ID
                    channel_nav = video_owner.get('title', {}).get('navigationEndpoint', {})
                    channel_url = channel_nav.get('commandMetadata', {}).get('webCommandMetadata', {}).get('url', '')
                    if channel_url:
                        channel_id = channel_url.replace('/@', '').replace('/channel/', '')
                    break
            
            return {
                'video_id': video_id,
                'title': title,
                'channel_title': channel_title,
                'channel_id': channel_id,
                'published_at': None,
            }
        
        except (KeyError, IndexError) as e:
            raise ValueError(f"Não foi possível extrair informações do vídeo: {e}")
    
    def fetch_comments(self, video_id: str, max_comments: int = 500) -> Iterator[dict]:
        """
        Busca comentários.
        
        Tenta usar yt-dlp primeiro (mais completo),
        fallback para extração do HTML inicial.
        """
        print("⚠️  Modo scrape: extraindo comentários...")
        
        if self._ytdlp_available:
            print("   Usando yt-dlp (recomendado)...")
            yield from self._fetch_comments_ytdlp(video_id, max_comments)
        else:
            print("   yt-dlp não disponível, usando fallback HTML...")
            print("   💡 Dica: instale yt-dlp para melhores resultados:")
            print("      pip install yt-dlp")
            yield from self._fetch_comments_html(video_id, max_comments)
    
    def _fetch_comments_ytdlp(self, video_id: str, max_comments: int) -> Iterator[dict]:
        """Busca comentários usando yt-dlp."""
        url = f"https://youtube.com/watch?v={video_id}"
        
        try:
            # Cria arquivo temporário para os comentários
            with tempfile.NamedTemporaryFile(mode='w+', suffix='.json', delete=False) as f:
                temp_file = f.name
            
            # Executa yt-dlp para extrair comentários
            cmd = [
                'yt-dlp',
                '--no-download',
                '--no-warnings',
                '--write-comments',
                '--extractor-args', f'youtube:max_comments={max_comments},comment_sort=top',
                '-o', temp_file.replace('.json', ''),
                url
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            
            # Lê arquivo de comentários
            comments_file = temp_file.replace('.json', '.info.json')
            if os.path.exists(comments_file):
                with open(comments_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                comments = data.get('comments', [])
                print(f"   {len(comments)} comentários extraídos via yt-dlp")
                
                for comment in comments[:max_comments]:
                    yield self._normalize_ytdlp_comment(comment, video_id)
                
                # Limpa arquivo temporário
                os.remove(comments_file)
            else:
                print("   Nenhum comentário encontrado via yt-dlp")
        
        except Exception as e:
            print(f"   Erro yt-dlp: {e}")
            print("   Tentando fallback HTML...")
            yield from self._fetch_comments_html(video_id, max_comments)
        
        finally:
            # Limpa arquivo temporário se existir
            if os.path.exists(temp_file):
                os.remove(temp_file)
    
    def _normalize_ytdlp_comment(self, comment: dict, video_id: str) -> dict:
        """Normaliza comentário do yt-dlp."""
        text_original = comment.get('text', '')
        text_clean = clean_text(text_original)
        
        return {
            'comment_id': comment.get('id', ''),
            'video_id': video_id,
            'parent_comment_id': comment.get('parent'),
            'author_name': comment.get('author', 'Unknown'),
            'author_channel_id': comment.get('author_id'),
            'text_original': text_original,
            'text_clean': text_clean,
            'text_hash': compute_hash(text_clean),
            'like_count': comment.get('like_count', 0),
            'reply_count': 0,  # yt-dlp não fornece diretamente
            'published_at': comment.get('timestamp'),
            'updated_at': comment.get('timestamp'),
            'language': None,
            'raw_payload': comment,
            'ingest_mode': 'scrape'
        }
    
    def _fetch_comments_html(self, video_id: str, max_comments: int) -> Iterator[dict]:
        """
        Fallback: extrai comentários do HTML inicial.
        Muito limitado - apenas comentários visíveis na carga inicial.
        """
        html_content = self._get_video_page(video_id)
        data = self._extract_yt_initial_data(html_content)
        
        # Tenta extrair comentários da estrutura inicial
        try:
            comments_section = self._find_comments_section(data)
            if not comments_section:
                print("   Nenhum comentário encontrado na carga inicial.")
                print("   Isso é normal no modo HTML - o YouTube carrega comentários dinamicamente.")
                return
            
            comment_renderers = self._extract_comment_renderers(comments_section)
            print(f"   {len(comment_renderers)} comentários na carga inicial")
            
            for renderer in comment_renderers[:max_comments]:
                comment = self._parse_comment_renderer(renderer, video_id)
                if comment:
                    yield comment
        
        except Exception as e:
            print(f"   Erro ao extrair comentários: {e}")
    
    def _find_comments_section(self, data: dict) -> dict:
        """Navega na estrutura aninhada para encontrar seção de comentários."""
        try:
            contents = data['contents']['twoColumnWatchNextResults']['results']['results']['contents']
            
            for item in contents:
                if 'itemSectionRenderer' in item:
                    section = item['itemSectionRenderer']
                    # Procura por seção de comentários
                    contents_inner = section.get('contents', [])
                    for content in contents_inner:
                        if 'commentsEntryPointHeaderRenderer' in content or \
                           'commentThreadRenderer' in content:
                            return section
            
            return None
        except KeyError:
            return None
    
    def _extract_comment_renderers(self, section: dict) -> list:
        """Extrai renderers de comentários da seção."""
        renderers = []
        contents = section.get('contents', [])
        
        for item in contents:
            if 'commentThreadRenderer' in item:
                renderers.append(item['commentThreadRenderer'])
        
        return renderers
    
    def _parse_comment_renderer(self, thread_renderer: dict, video_id: str) -> dict | None:
        """Parseia um comment renderer para formato normalizado."""
        try:
            comment_renderer = thread_renderer['comment']['commentRenderer']
            
            comment_id = comment_renderer.get('commentId', '')
            
            # Texto
            content_text = comment_renderer.get('contentText', {})
            text_runs = content_text.get('runs', [])
            text_original = ''.join(r.get('text', '') for r in text_runs)
            text_clean = clean_text(text_original)
            
            # Autor
            author_text = comment_renderer.get('authorText', {})
            author_name = author_text.get('simpleText', 'Unknown')
            
            # Likes
            vote_count = comment_renderer.get('voteCount', {})
            like_text = vote_count.get('simpleText', '0')
            like_count = self._parse_like_count(like_text)
            
            # Data
            published_time = comment_renderer.get('publishedTimeText', {}).get('runs', [{}])[0].get('text', '')
            published_at = self._parse_relative_time(published_time)
            
            return {
                'comment_id': comment_id,
                'video_id': video_id,
                'parent_comment_id': None,
                'author_name': author_name,
                'author_channel_id': None,
                'text_original': text_original,
                'text_clean': text_clean,
                'text_hash': compute_hash(text_clean),
                'like_count': like_count,
                'reply_count': 0,
                'published_at': published_at,
                'updated_at': published_at,
                'language': None,
                'raw_payload': comment_renderer,
                'ingest_mode': 'scrape'
            }
        
        except Exception as e:
            print(f"   Erro ao parsear comentário: {e}")
            return None
    
    def _parse_like_count(self, text: str) -> int:
        """Converte texto de likes para número."""
        text = text.lower().replace(',', '.')
        try:
            if 'k' in text:
                return int(float(text.replace('k', '')) * 1000)
            elif 'mil' in text:
                return int(float(text.replace('mil', '')) * 1000)
            elif 'm' in text:
                return int(float(text.replace('m', '')) * 1000000)
            else:
                return int(text) if text.isdigit() else 0
        except ValueError:
            return 0
    
    def _parse_relative_time(self, text: str) -> str:
        """
        Converte tempo relativo para ISO format (aproximado).
        Retorna string vazia se não conseguir parsear.
        """
        # Como não temos a data exata, retornamos o texto original
        return ""
    
    def discover_latest_video(self, channel_handle: str) -> str | None:
        """
        Descobre vídeo mais recente via yt-dlp ou scraping.
        """
        handle = channel_handle.lstrip('@')
        
        # Tenta yt-dlp primeiro
        if self._ytdlp_available:
            try:
                url = f"https://youtube.com/@{handle}/videos"
                result = subprocess.run(
                    ['yt-dlp', '--flat-playlist', '--print', 'id', '--playlist-end', '1', url],
                    capture_output=True, text=True, timeout=30
                )
                
                if result.returncode == 0 and result.stdout.strip():
                    return result.stdout.strip().split('\n')[0]
            
            except Exception as e:
                print(f"   yt-dlp falhou: {e}")
        
        # Fallback para scraping
        try:
            url = f"https://www.youtube.com/@{handle}/videos"
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            # Tenta extrair ID do primeiro vídeo
            video_ids = re.findall(r'"videoId":"([a-zA-Z0-9_-]{11})"', response.text)
            if video_ids:
                return video_ids[0]
        
        except Exception as e:
            print(f"Erro ao descobrir vídeo do canal: {e}")
        
        return None
