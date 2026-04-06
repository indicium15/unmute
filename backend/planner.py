from typing import List, Dict, Optional, Any
import os
import sys

from vocab import vocab
from gcs_storage import get_static_url, GCS_SGLS_DATASET_ROOT


def build_render_plan(gloss_tokens: List[str]) -> List[Dict[str, Any]]:
    """
    Convert a list of gloss tokens into a rendering plan with asset URLs.
    """
    plan = []
    
    for token in gloss_tokens:
        # Default fallback
        item = {
            "token": token,
            "sign_name": None,
            "type": "text", # fallback
            "assets": {}
        }
        
        # Resolve sign name
        sign_name = vocab.token_to_video_name(token)
        
        if sign_name:
            item["sign_name"] = sign_name
            item["type"] = "sign"
            # Construct paths using GCS or local static paths
            
            # GIF: {GCS_SGLS_DATASET_ROOT}/{sign_name}/{sign_name}.gif (see gcs_storage)
            item["assets"]["gif"] = get_static_url(
                f"{GCS_SGLS_DATASET_ROOT}/{sign_name}/{sign_name}.gif"
            )
            
            # PKL: sgsl_processed/landmarks_pkl/{sign_name}.pkl
            item["assets"]["pkl"] = get_static_url(f"sgsl_processed/landmarks_pkl/{sign_name}.pkl")
            
        plan.append(item)
        
    return plan
