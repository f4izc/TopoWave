from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import math
import httpx
from pathlib import Path
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create the main app
app = FastAPI(title="VHF-SHF Path Profiler API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Constants
EARTH_RADIUS_KM = 6371.0
EFFECTIVE_EARTH_RADIUS_KM = 8500.0  # 4/3 Earth model for VHF+ propagation

# Amateur radio bands frequencies in MHz
BAND_FREQUENCIES = {
    "6m": 50.0,
    "4m": 70.0,
    "2m": 144.0,
    "1.25m": 222.0,
    "70cm": 432.0,
    "21cm": 1296.0,
    "13cm": 2320.0,
    "3cm": 10368.0
}

# Models
class PathRequest(BaseModel):
    locator_a: str = Field(..., min_length=6, max_length=10, description="Maidenhead locator for station A")
    locator_b: str = Field(..., min_length=6, max_length=10, description="Maidenhead locator for station B")
    height_a: float = Field(..., ge=0, le=1000, description="Antenna height AGL in meters for station A")
    height_b: float = Field(..., ge=0, le=1000, description="Antenna height AGL in meters for station B")
    num_points: int = Field(default=50, ge=10, le=200, description="Number of elevation sample points")
    band: Optional[str] = Field(default=None, description="Amateur radio band for Fresnel zone calculation")

    @field_validator('locator_a', 'locator_b')
    @classmethod
    def validate_locator(cls, v: str) -> str:
        """Validate Maidenhead Grid Locator format (6-10 characters)"""
        v = v.upper()
        if len(v) < 6 or len(v) > 10 or len(v) % 2 != 0:
            raise ValueError('Invalid locator length (must be 6, 8, or 10 characters)')
        
        # Check pattern: AA00aa[00][aa]
        patterns = [
            (0, 2, 'ABCDEFGHIJKLMNOPQR'),  # Field
            (2, 4, '0123456789'),           # Square
            (4, 6, 'ABCDEFGHIJKLMNOPQRSTUVWX'),  # Subsquare
        ]
        if len(v) >= 8:
            patterns.append((6, 8, '0123456789'))  # Extended square
        if len(v) == 10:
            patterns.append((8, 10, 'ABCDEFGHIJKLMNOPQRSTUVWX'))  # Sub-subsquare
        
        for start, end, valid_chars in patterns:
            for char in v[start:end]:
                if char not in valid_chars:
                    raise ValueError(f'Invalid character "{char}" at position {start+1}')
        return v

    @field_validator('band')
    @classmethod
    def validate_band(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.lower()
        if v not in BAND_FREQUENCIES:
            raise ValueError(f'Invalid band. Must be one of: {", ".join(BAND_FREQUENCIES.keys())}')
        return v


class ElevationPoint(BaseModel):
    distance_km: float
    latitude: float
    longitude: float
    elevation: float
    los_height: float
    fresnel_radius: Optional[float] = None
    is_obstructed: bool = False


class PathResponse(BaseModel):
    station_a: dict
    station_b: dict
    distance_km: float
    azimuth_ab: float
    azimuth_ba: float
    elevation_profile: List[ElevationPoint]
    is_clear: bool
    obstruction_point: Optional[dict] = None
    fresnel_clearance_percent: Optional[float] = None
    band: Optional[str] = None
    frequency_mhz: Optional[float] = None


def maidenhead_to_latlon(locator: str) -> tuple:
    """Convert Maidenhead Grid Locator to lat/lon coordinates (center of square)"""
    locator = locator.upper()
    
    lon = -180.0
    lat = -90.0
    
    # Field (first 2 chars) - 20° x 10°
    lon += (ord(locator[0]) - ord('A')) * 20
    lat += (ord(locator[1]) - ord('A')) * 10
    
    # Square (next 2 chars) - 2° x 1°
    lon += int(locator[2]) * 2
    lat += int(locator[3]) * 1
    
    # Subsquare (chars 5-6) - 5' x 2.5'
    if len(locator) >= 6:
        lon += (ord(locator[4]) - ord('A')) * (2 / 24)
        lat += (ord(locator[5]) - ord('A')) * (1 / 24)
    
    # Extended square (chars 7-8) - 30" x 15"
    if len(locator) >= 8:
        lon += int(locator[6]) * (2 / 240)
        lat += int(locator[7]) * (1 / 240)
    
    # Sub-subsquare (chars 9-10) - 3" x 1.5"
    if len(locator) >= 10:
        lon += (ord(locator[8]) - ord('A')) * (2 / 240 / 24)
        lat += (ord(locator[9]) - ord('A')) * (1 / 240 / 24)
    
    # Calculate center of the smallest square
    if len(locator) == 6:
        lon += 1 / 24  # Center of subsquare
        lat += 0.5 / 24
    elif len(locator) == 8:
        lon += 1 / 240  # Center of extended square
        lat += 0.5 / 240
    elif len(locator) == 10:
        lon += 1 / 240 / 24  # Center of sub-subsquare
        lat += 0.5 / 240 / 24
    
    return (lat, lon)


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points using Haversine formula"""
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    return EARTH_RADIUS_KM * c


def calculate_azimuth(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate initial bearing (azimuth) from point 1 to point 2"""
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    dlon_rad = math.radians(lon2 - lon1)
    
    x = math.sin(dlon_rad) * math.cos(lat2_rad)
    y = math.cos(lat1_rad) * math.sin(lat2_rad) - math.sin(lat1_rad) * math.cos(lat2_rad) * math.cos(dlon_rad)
    
    azimuth = math.degrees(math.atan2(x, y))
    return (azimuth + 360) % 360


def interpolate_point(lat1: float, lon1: float, lat2: float, lon2: float, fraction: float) -> tuple:
    """Interpolate a point along the great circle path"""
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    lon1_rad = math.radians(lon1)
    lon2_rad = math.radians(lon2)
    
    d = 2 * math.asin(math.sqrt(
        math.sin((lat2_rad - lat1_rad) / 2)**2 +
        math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin((lon2_rad - lon1_rad) / 2)**2
    ))
    
    if d == 0:
        return (lat1, lon1)
    
    a = math.sin((1 - fraction) * d) / math.sin(d)
    b = math.sin(fraction * d) / math.sin(d)
    
    x = a * math.cos(lat1_rad) * math.cos(lon1_rad) + b * math.cos(lat2_rad) * math.cos(lon2_rad)
    y = a * math.cos(lat1_rad) * math.sin(lon1_rad) + b * math.cos(lat2_rad) * math.sin(lon2_rad)
    z = a * math.sin(lat1_rad) + b * math.sin(lat2_rad)
    
    lat = math.atan2(z, math.sqrt(x**2 + y**2))
    lon = math.atan2(y, x)
    
    return (math.degrees(lat), math.degrees(lon))


def calculate_earth_curvature_correction(distance_km: float, total_distance_km: float) -> float:
    """Calculate earth curvature effect using 4/3 Earth model for radio propagation"""
    # Maximum curvature at midpoint
    d1 = distance_km
    d2 = total_distance_km - distance_km
    
    # Curvature correction formula: h = (d1 * d2) / (2 * R_eff)
    # This gives the "bulge" of the earth between two points
    correction = (d1 * d2) / (2 * EFFECTIVE_EARTH_RADIUS_KM)
    return correction * 1000  # Convert to meters


def calculate_los_height(elev_a: float, height_a: float, elev_b: float, height_b: float,
                         distance_km: float, total_distance_km: float) -> float:
    """Calculate Line of Sight height at a given distance"""
    if total_distance_km == 0:
        return elev_a + height_a
    
    fraction = distance_km / total_distance_km
    
    # Linear interpolation between antenna heights
    h_a = elev_a + height_a
    h_b = elev_b + height_b
    los_height = h_a + fraction * (h_b - h_a)
    
    return los_height


def calculate_fresnel_radius(distance_km: float, total_distance_km: float, frequency_mhz: float) -> float:
    """Calculate first Fresnel zone radius at a given point"""
    if total_distance_km == 0 or frequency_mhz == 0:
        return 0
    
    d1 = distance_km * 1000  # Convert to meters
    d2 = (total_distance_km - distance_km) * 1000
    wavelength = 300 / frequency_mhz  # wavelength in meters
    
    if d1 <= 0 or d2 <= 0:
        return 0
    
    # First Fresnel zone radius formula: r = sqrt(n * lambda * d1 * d2 / (d1 + d2))
    # For first zone, n = 1
    radius = math.sqrt(wavelength * d1 * d2 / (d1 + d2))
    return radius


async def fetch_elevations(points: List[tuple]) -> List[float]:
    """Fetch elevations from Open-TopoData API"""
    # Format points for API
    locations = "|".join([f"{lat:.6f},{lon:.6f}" for lat, lon in points])
    
    # Use SRTM dataset (30m resolution, global coverage)
    url = f"https://api.opentopodata.org/v1/srtm30m?locations={locations}"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
            
            if data.get("status") != "OK":
                raise HTTPException(status_code=502, detail="Elevation API returned error")
            
            elevations = []
            for result in data.get("results", []):
                elev = result.get("elevation")
                elevations.append(elev if elev is not None else 0)
            
            return elevations
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Elevation API timeout")
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Elevation API error: {str(e)}")


@api_router.get("/")
async def root():
    return {"message": "VHF-SHF Path Profiler API", "version": "1.0.0"}


@api_router.get("/bands")
async def get_bands():
    """Get available amateur radio bands"""
    return {
        "bands": [
            {"id": "6m", "name": "6m (VHF)", "frequency_mhz": 50.0},
            {"id": "4m", "name": "4m (VHF)", "frequency_mhz": 70.0},
            {"id": "2m", "name": "2m (VHF)", "frequency_mhz": 144.0},
            {"id": "1.25m", "name": "1.25m (VHF)", "frequency_mhz": 222.0},
            {"id": "70cm", "name": "70cm (UHF)", "frequency_mhz": 432.0},
            {"id": "21cm", "name": "21cm (L-Band)", "frequency_mhz": 1296.0},
            {"id": "13cm", "name": "13cm (S-Band)", "frequency_mhz": 2320.0},
            {"id": "3cm", "name": "3cm (X-Band)", "frequency_mhz": 10368.0},
        ]
    }


@api_router.get("/geocode")
async def geocode_address(q: str):
    """Proxy endpoint for OpenStreetMap Nominatim geocoding to avoid CORS issues"""
    if not q or len(q.strip()) < 2:
        raise HTTPException(status_code=400, detail="Query must be at least 2 characters")
    
    url = f"https://nominatim.openstreetmap.org/search?format=json&q={q}&limit=1"
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(
                url,
                headers={"User-Agent": "TopoWave/1.0"}
            )
            response.raise_for_status()
            data = response.json()
            
            if data and len(data) > 0:
                return {
                    "lat": float(data[0]["lat"]),
                    "lon": float(data[0]["lon"]),
                    "display_name": data[0].get("display_name", "")
                }
            return {"lat": None, "lon": None, "display_name": None}
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Geocoding service timeout")
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Geocoding service error: {str(e)}")


@api_router.post("/calculate-path", response_model=PathResponse)
async def calculate_path(request: PathRequest):
    """Calculate terrain profile and line of sight analysis between two stations"""
    
    # Convert locators to coordinates
    lat_a, lon_a = maidenhead_to_latlon(request.locator_a)
    lat_b, lon_b = maidenhead_to_latlon(request.locator_b)
    
    # Calculate distance and azimuths
    distance_km = haversine_distance(lat_a, lon_a, lat_b, lon_b)
    azimuth_ab = calculate_azimuth(lat_a, lon_a, lat_b, lon_b)
    azimuth_ba = calculate_azimuth(lat_b, lon_b, lat_a, lon_a)
    
    # Generate sample points along the path
    num_points = request.num_points
    points = []
    for i in range(num_points):
        fraction = i / (num_points - 1) if num_points > 1 else 0
        lat, lon = interpolate_point(lat_a, lon_a, lat_b, lon_b, fraction)
        points.append((lat, lon))
    
    # Fetch elevations (batch in groups of 100 for API limits)
    all_elevations = []
    batch_size = 100
    for i in range(0, len(points), batch_size):
        batch = points[i:i + batch_size]
        elevations = await fetch_elevations(batch)
        all_elevations.extend(elevations)
    
    # Get station elevations
    elev_a = all_elevations[0]
    elev_b = all_elevations[-1]
    
    # Get frequency for Fresnel zone calculation
    frequency_mhz = BAND_FREQUENCIES.get(request.band) if request.band else None
    
    # Build elevation profile with LoS analysis
    elevation_profile = []
    is_clear = True
    obstruction_point = None
    worst_clearance = float('inf')
    
    for i, (elev, (lat, lon)) in enumerate(zip(all_elevations, points)):
        point_distance_km = (i / (num_points - 1)) * distance_km if num_points > 1 else 0
        
        # Calculate LoS height at this point
        los_height = calculate_los_height(elev_a, request.height_a, elev_b, request.height_b,
                                          point_distance_km, distance_km)
        
        # Apply earth curvature correction (subtract from LoS)
        curvature_correction = calculate_earth_curvature_correction(point_distance_km, distance_km)
        los_height_corrected = los_height - curvature_correction
        
        # Calculate Fresnel radius if band specified
        fresnel_radius = None
        if frequency_mhz and 0 < i < num_points - 1:
            fresnel_radius = calculate_fresnel_radius(point_distance_km, distance_km, frequency_mhz)
        
        # Check obstruction (ground elevation vs LoS)
        is_obstructed = elev >= los_height_corrected
        clearance = los_height_corrected - elev
        
        if is_obstructed and 0 < i < num_points - 1:
            is_clear = False
            if clearance < worst_clearance:
                worst_clearance = clearance
                obstruction_point = {
                    "distance_km": round(point_distance_km, 2),
                    "elevation": elev,
                    "los_height": round(los_height_corrected, 1),
                    "latitude": round(lat, 6),
                    "longitude": round(lon, 6)
                }
        
        elevation_profile.append(ElevationPoint(
            distance_km=round(point_distance_km, 3),
            latitude=round(lat, 6),
            longitude=round(lon, 6),
            elevation=elev,
            los_height=round(los_height_corrected, 1),
            fresnel_radius=round(fresnel_radius, 1) if fresnel_radius else None,
            is_obstructed=is_obstructed
        ))
    
    # Calculate Fresnel clearance percentage at worst point
    fresnel_clearance_percent = None
    if frequency_mhz and is_clear:
        # Find minimum clearance relative to Fresnel zone
        min_clearance_ratio = float('inf')
        for point in elevation_profile[1:-1]:
            if point.fresnel_radius and point.fresnel_radius > 0:
                clearance = point.los_height - point.elevation
                ratio = clearance / point.fresnel_radius
                if ratio < min_clearance_ratio:
                    min_clearance_ratio = ratio
        
        if min_clearance_ratio != float('inf'):
            fresnel_clearance_percent = round(min_clearance_ratio * 100, 1)
    
    return PathResponse(
        station_a={
            "locator": request.locator_a,
            "latitude": round(lat_a, 6),
            "longitude": round(lon_a, 6),
            "elevation": elev_a,
            "antenna_height": request.height_a
        },
        station_b={
            "locator": request.locator_b,
            "latitude": round(lat_b, 6),
            "longitude": round(lon_b, 6),
            "elevation": elev_b,
            "antenna_height": request.height_b
        },
        distance_km=round(distance_km, 2),
        azimuth_ab=round(azimuth_ab, 1),
        azimuth_ba=round(azimuth_ba, 1),
        elevation_profile=elevation_profile,
        is_clear=is_clear,
        obstruction_point=obstruction_point,
        fresnel_clearance_percent=fresnel_clearance_percent,
        band=request.band,
        frequency_mhz=frequency_mhz
    )


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
