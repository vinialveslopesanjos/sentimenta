"""
Pure Python parser for XPoz MCP CSV-like response format.

Handles the format:
  results[count]{field1,field2,...}:
    value1,"quoted value",value3,"2026-01-23T00:00:00.000Z"
"""

import csv
import io
import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Regex to match header like: results[110]{id,caption,username,createdAtDate}:
_HEADER_RE = re.compile(r'results\[\d+\]\{([^}]+)\}:')


def parse_xpoz_csv(raw_text: str) -> list[dict]:
    """Parse XPoz CSV-like text into a list of dicts.

    Returns empty list if the format is not recognized.
    """
    if not raw_text or not raw_text.strip():
        return []

    lines = raw_text.split('\n')
    fields: list[str] = []
    data_lines: list[str] = []
    header_found = False

    for line in lines:
        stripped = line.strip()

        if not header_found:
            m = _HEADER_RE.search(stripped)
            if m:
                fields = [f.strip() for f in m.group(1).split(',')]
                header_found = True
            continue

        # After header, collect non-empty lines until next section or end
        if not stripped:
            continue
        # Stop if we hit another section header (e.g. "pagination:" or "success:")
        if re.match(r'^[a-zA-Z_]+(\[|:)', stripped) and not stripped.startswith('"'):
            break
        data_lines.append(stripped)

    if not fields or not data_lines:
        return []

    # Join all data lines and parse as CSV
    csv_text = '\n'.join(data_lines)
    reader = csv.reader(io.StringIO(csv_text), quotechar='"', skipinitialspace=True)

    results = []
    for row in reader:
        if len(row) < len(fields):
            # Pad with empty strings
            row.extend([''] * (len(fields) - len(row)))
        record = {}
        for i, field in enumerate(fields):
            record[field] = row[i] if i < len(row) else ''
        results.append(record)

    return results


def parse_xpoz_posts(raw_text: str) -> dict:
    """Parse XPoz posts response into {"items": [...]}.

    Maps CSV fields to XpozPost schema fields.
    """
    rows = parse_xpoz_csv(raw_text)
    if not rows:
        return {}

    items = []
    for row in rows:
        post_id = row.get('id', '')
        if not post_id:
            continue
        items.append({
            'id': str(post_id),
            'text': row.get('caption', row.get('text', '')),
            'username': row.get('username', ''),
            'timestamp': row.get('createdAtDate', row.get('timestamp', '')),
            'url': row.get('url', row.get('displayUrl', '')),
            'likes': _to_int(row.get('likesCount', row.get('likes', 0))),
            'comments': _to_int(row.get('commentsCount', row.get('comments', 0))),
            'views': _to_int(row.get('viewsCount', row.get('views', 0))),
            'shortcode': row.get('shortcode', ''),
        })
    return {'items': items}


def parse_xpoz_comments(raw_text: str) -> dict:
    """Parse XPoz comments response into {"items": [...]}.

    Maps CSV fields to XpozComment schema fields.
    """
    rows = parse_xpoz_csv(raw_text)
    if not rows:
        return {}

    items = []
    for row in rows:
        text = row.get('text', row.get('comment', ''))
        items.append({
            'id': str(row.get('id', '')),
            'text': text,
            'username': row.get('username', row.get('ownerUsername', '')),
            'timestamp': row.get('timestamp', row.get('createdAtDate', '')),
            'likes': _to_int(row.get('likesCount', row.get('likes', 0))),
        })
    return {'items': items}


def _to_int(val) -> int:
    try:
        if not val:
            return 0
        return int(str(val).replace(',', '').strip())
    except (ValueError, TypeError):
        return 0
