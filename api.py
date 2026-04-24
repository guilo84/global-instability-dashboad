import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text
import json

app = FastAPI(title="Global Instability API")

# Enable CORS so your frontend dashboard can make requests to this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# Update this if you used different credentials or a Dockerized DB
load_dotenv()
DATABASE_URI = os.getenv("DATABASE_URI")
engine = create_engine(DATABASE_URI)

# This returns an empty "204 No Content" status, telling the browser 
# to stop looking for an icon without throwing an error.
@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return Response(status_code=204)

@app.get("/api/events")
def get_events(limit: int = 1000):
    """
    Fetches instability events, filtering out US domestic noise.
    """

    query = text("""
        SELECT 
            id, 
            event_date, 
            event_category, 
            country_code, 
            goldstein_scale, 
            source_url, 
            ST_AsGeoJSON(geom) as geometry
        FROM instability_events
        WHERE goldstein_scale <= -2.0 
          AND country_code != 'US'
        ORDER BY event_date DESC
        LIMIT :limit
    """)
    
    features = []
    with engine.connect() as conn:
        result = conn.execute(query, {"limit": limit})
        for row in result:
            feature = {
                "type": "Feature",
                "geometry": json.loads(row.geometry),
                "properties": {
                    "id": row.id,
                    "date": str(row.event_date),
                    "category": row.event_category,
                    "country": row.country_code,
                    "severity": float(row.goldstein_scale),
                    "source": row.source_url
                }
            }
            features.append(feature)
            
    return {
        "type": "FeatureCollection",
        "features": features
    }

