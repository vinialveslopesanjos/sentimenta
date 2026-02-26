import json
from google import genai
from pydantic import BaseModel
from typing import List, Optional
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class XpozPost(BaseModel):
    id: str
    text: Optional[str] = ""
    username: Optional[str] = ""
    timestamp: Optional[str] = ""
    url: Optional[str] = ""
    likes: Optional[int] = 0
    comments: Optional[int] = 0
    views: Optional[int] = 0

class XpozComment(BaseModel):
    id: str
    text: Optional[str] = ""
    username: Optional[str] = ""
    timestamp: Optional[str] = ""
    likes: Optional[int] = 0

class XpozProfile(BaseModel):
    id: Optional[str] = ""
    username: str
    name: Optional[str] = ""
    description: Optional[str] = ""
    followers: Optional[int] = 0
    following: Optional[int] = 0
    media_count: Optional[int] = 0
    profile_url: Optional[str] = ""

class ListOfPosts(BaseModel):
    items: List[XpozPost]

class ListOfComments(BaseModel):
    items: List[XpozComment]

def parse_xpoz_data_with_llm(raw_text: str, target_schema: type) -> dict:
    """Takes XPoz messy text output and relies on Gemini to return structured JSON."""
    if not raw_text or not raw_text.strip():
        return {}
        
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    
    prompt = f"""
    You are an AI data parser. I am giving you the raw, messy string output from an MCP tool (XPoz).
    Extract all relevant records and fields from this text to strictly match the requested JSON schema.
    If a field is missing, leave it as default or empty. Do your best to interpret timestamps and numbers.
    Wait for NO user interaction. Respond ONLY with the JSON.
    
    Raw Text:
    '''
    {raw_text[:8000]} 
    '''
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config={
                'response_mime_type': 'application/json',
                'response_schema': target_schema,
                'temperature': 0.1,
            },
        )
        data = json.loads(response.text)
        return data
    except Exception as e:
        logger.error(f"Failed to parse XPoz data with LLM: {e}")
        return {}
