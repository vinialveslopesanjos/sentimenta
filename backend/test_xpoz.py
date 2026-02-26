import sys
import os
sys.path.append(os.getcwd())
from app.services.xpoz_service import _call_mcp, _get_text

res = _call_mcp('searchInstagramUsers', {'name': 'therock', 'fields': ['followerCount', 'mediaCount', 'profilePicUrl']})
print("response:", res)
