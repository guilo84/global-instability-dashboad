import os
from fastapi import FastAPI, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles # <-- ADD THIS
from sqlalchemy import create_engine, text
import json
from dotenv import load_dotenv

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
def get_events(
    days: str = Query("7", description="Number of days, or 'all'"), 
    keyword: str = Query("", description="Keyword to search in URL or category")
):
    """
    Fetches instability events with dynamic filtering for timeframe and keywords.
    """
    # 1. Base query
    query_str = """
        SELECT 
            id, event_date, event_category, country_code, 
            goldstein_scale, source_url, ST_AsGeoJSON(geom) as geometry
        FROM instability_events
        WHERE goldstein_scale <= -2.0 
          AND country_code != 'US'
    """
    params = {}

    # 2. Apply Timeframe Filter (if they didn't select "all")
    if days != "all":
        # In SQL, CURRENT_DATE - 7 gives us a rolling 7-day window
        query_str += " AND event_date >= CURRENT_DATE - CAST(:days AS INTEGER)"
        params["days"] = int(days)
    else:
        # Cap "all" at 365 days to prevent massive payloads and protect memory
        query_str += " AND event_date >= CURRENT_DATE - 365"

    # 3. Apply Keyword Filter
    if keyword:
        # ILIKE is Postgres for "case-insensitive search"
        # We search both the category and the source URL for the keyword
        query_str += " AND (event_category ILIKE :keyword OR source_url ILIKE :keyword)"
        # The % symbols are SQL wildcards (e.g., search anywhere in the string)
        params["keyword"] = f"%{keyword}%"

    # 4. Finish the query and cap the limit to protect the browser
    query_str += " ORDER BY event_date DESC LIMIT 50000"
    
    features = []
    with engine.connect() as conn:
        result = conn.execute(text(query_str), params)
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

# --- SERVE THE REACT FRONTEND ---
# Get the absolute path to your React build folder
frontend_dist = os.path.join(os.path.dirname(__file__), "frontend", "dist")

# Mount the folder to the root path. 
# html=True tells it to automatically serve 'index.html' when someone visits '/'
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
else:
    print(f"Warning: Could not find React build directory at {frontend_dist}")
