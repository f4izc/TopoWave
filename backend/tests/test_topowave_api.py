"""
TopoWave API Tests - Testing Maidenhead locator validation and path calculation
Tests cover: locator format validation (6-10 chars), coordinate conversion, path calculation
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://los-profiler.preview.emergentagent.com')


class TestAPIHealth:
    """Basic API health and connectivity tests"""
    
    def test_api_root_endpoint(self):
        """Test API root returns correct message"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "VHF-SHF Path Profiler API"
        assert data["version"] == "1.0.0"
        print("✓ API root endpoint working")

    def test_bands_endpoint(self):
        """Test bands endpoint returns amateur radio bands"""
        response = requests.get(f"{BASE_URL}/api/bands")
        assert response.status_code == 200
        data = response.json()
        assert "bands" in data
        assert len(data["bands"]) == 8  # 8 bands defined
        band_ids = [b["id"] for b in data["bands"]]
        assert "2m" in band_ids
        assert "70cm" in band_ids
        print("✓ Bands endpoint working")


class TestLocatorValidation:
    """Test Maidenhead locator format validation (6, 8, 10 chars)"""
    
    def test_6_char_locator_valid(self):
        """Test valid 6-character locator: JN18DQ"""
        response = requests.post(f"{BASE_URL}/api/calculate-path", json={
            "locator_a": "JN18DQ",
            "locator_b": "IN96GC",
            "height_a": 10,
            "height_b": 10,
            "num_points": 50
        })
        assert response.status_code == 200
        data = response.json()
        assert data["station_a"]["locator"] == "JN18DQ"
        print("✓ 6-character locator accepted: JN18DQ")

    def test_8_char_locator_valid(self):
        """Test valid 8-character locator: JN18DQ96"""
        response = requests.post(f"{BASE_URL}/api/calculate-path", json={
            "locator_a": "JN18DQ96",
            "locator_b": "IN96GC45",
            "height_a": 10,
            "height_b": 10,
            "num_points": 50
        })
        assert response.status_code == 200
        data = response.json()
        assert data["station_a"]["locator"] == "JN18DQ96"
        print("✓ 8-character locator accepted: JN18DQ96")

    def test_10_char_locator_valid(self):
        """Test valid 10-character locator: JN18DQ96AB"""
        response = requests.post(f"{BASE_URL}/api/calculate-path", json={
            "locator_a": "JN18DQ96AB",
            "locator_b": "IN96GC45CD",
            "height_a": 10,
            "height_b": 10,
            "num_points": 50
        })
        assert response.status_code == 200
        data = response.json()
        assert data["station_a"]["locator"] == "JN18DQ96AB"
        print("✓ 10-character locator accepted: JN18DQ96AB")

    def test_invalid_5_char_locator(self):
        """Test invalid 5-character locator (too short)"""
        response = requests.post(f"{BASE_URL}/api/calculate-path", json={
            "locator_a": "JN18D",
            "locator_b": "IN96GC",
            "height_a": 10,
            "height_b": 10
        })
        assert response.status_code == 422  # Validation error
        print("✓ 5-character locator correctly rejected")

    def test_invalid_7_char_locator(self):
        """Test invalid 7-character locator (odd length)"""
        response = requests.post(f"{BASE_URL}/api/calculate-path", json={
            "locator_a": "JN18DQ9",
            "locator_b": "IN96GC",
            "height_a": 10,
            "height_b": 10
        })
        assert response.status_code == 422
        print("✓ 7-character locator correctly rejected")

    def test_invalid_locator_pattern(self):
        """Test invalid locator pattern (wrong characters)"""
        response = requests.post(f"{BASE_URL}/api/calculate-path", json={
            "locator_a": "99AAAA",  # Invalid pattern
            "locator_b": "IN96GC",
            "height_a": 10,
            "height_b": 10
        })
        assert response.status_code == 422
        print("✓ Invalid locator pattern correctly rejected")


class TestPathCalculation:
    """Test path calculation with various input modes"""
    
    def test_path_calculation_basic(self):
        """Test basic path calculation returns all expected fields"""
        response = requests.post(f"{BASE_URL}/api/calculate-path", json={
            "locator_a": "JN18DQ96",
            "locator_b": "IN96GC45",
            "height_a": 10,
            "height_b": 10,
            "num_points": 50
        })
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "station_a" in data
        assert "station_b" in data
        assert "distance_km" in data
        assert "azimuth_ab" in data
        assert "azimuth_ba" in data
        assert "elevation_profile" in data
        assert "is_clear" in data
        
        # Verify station data has lat/lon
        assert "latitude" in data["station_a"]
        assert "longitude" in data["station_a"]
        assert "elevation" in data["station_a"]
        
        # Verify distance is reasonable (Paris to somewhere in Spain ~400-500km)
        assert 300 < data["distance_km"] < 600
        print(f"✓ Path calculation working - Distance: {data['distance_km']} km")

    def test_path_with_fresnel_band(self):
        """Test path calculation with Fresnel zone (2m band)"""
        response = requests.post(f"{BASE_URL}/api/calculate-path", json={
            "locator_a": "JN18DQ96",
            "locator_b": "IN96GC45",
            "height_a": 10,
            "height_b": 10,
            "num_points": 50,
            "band": "2m"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data["band"] == "2m"
        assert data["frequency_mhz"] == 144.0
        
        # Check Fresnel radius in profile
        has_fresnel = any(p.get("fresnel_radius") is not None for p in data["elevation_profile"])
        assert has_fresnel, "Should have Fresnel radius data"
        print("✓ Fresnel zone calculation working with 2m band")

    def test_path_elevation_profile_points(self):
        """Test elevation profile has correct number of points"""
        num_points = 100
        response = requests.post(f"{BASE_URL}/api/calculate-path", json={
            "locator_a": "JN18DQ",
            "locator_b": "JN19AA",
            "height_a": 15,
            "height_b": 20,
            "num_points": num_points
        })
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["elevation_profile"]) == num_points
        
        # Check each point has required fields
        for point in data["elevation_profile"][:5]:  # Check first 5 points
            assert "distance_km" in point
            assert "latitude" in point
            assert "longitude" in point
            assert "elevation" in point
            assert "los_height" in point
        print(f"✓ Elevation profile has correct {num_points} points")


class TestCoordinateConversion:
    """Test locator to coordinate conversion accuracy"""
    
    def test_paris_locator_coordinates(self):
        """Test JN18DQ (Paris area) converts to correct coordinates"""
        response = requests.post(f"{BASE_URL}/api/calculate-path", json={
            "locator_a": "JN18DQ",
            "locator_b": "JN18DQ",  # Same locator for testing
            "height_a": 10,
            "height_b": 10,
            "num_points": 10
        })
        assert response.status_code == 200
        data = response.json()
        
        # JN18DQ should be near Paris (lat ~48.x, lon ~2.x)
        lat = data["station_a"]["latitude"]
        lon = data["station_a"]["longitude"]
        
        assert 48 < lat < 49, f"Latitude {lat} should be ~48.x"
        assert 2 < lon < 3, f"Longitude {lon} should be ~2.x"
        print(f"✓ JN18DQ coordinates verified: {lat}°, {lon}°")

    def test_known_locator_precision(self):
        """Test high precision 10-char locator conversion"""
        response = requests.post(f"{BASE_URL}/api/calculate-path", json={
            "locator_a": "JN18DQ96IX",
            "locator_b": "JN18DQ96IX",
            "height_a": 10,
            "height_b": 10,
            "num_points": 10
        })
        assert response.status_code == 200
        data = response.json()
        
        # With 10-char locator, we should have very precise coordinates
        lat = data["station_a"]["latitude"]
        lon = data["station_a"]["longitude"]
        
        # Paris area bounds
        assert 48.0 < lat < 49.0
        assert 2.0 < lon < 3.0
        print(f"✓ 10-char locator coordinates: {lat}°, {lon}°")


class TestInputModeSimulation:
    """Simulate inputs from different UI modes (GPS, Address converted to locator)"""
    
    def test_gps_derived_locator(self):
        """Test calculation with locator derived from GPS coordinates (Tour Eiffel)"""
        # Tour Eiffel: 48.8584, 2.2945 -> Should be ~JN18DU
        # We simulate frontend converting GPS to locator
        response = requests.post(f"{BASE_URL}/api/calculate-path", json={
            "locator_a": "JN18DU73",  # Near Eiffel Tower
            "locator_b": "JO20HL",    # Brussels area
            "height_a": 330,  # Eiffel tower height
            "height_b": 10,
            "num_points": 50
        })
        assert response.status_code == 200
        data = response.json()
        
        # Paris to Brussels distance ~250-300km
        assert 200 < data["distance_km"] < 350
        print(f"✓ GPS-derived locator calculation working - Distance: {data['distance_km']} km")

    def test_address_derived_locator(self):
        """Test calculation with locator derived from address geocoding"""
        # Berlin area locator (from address geocoding simulation)
        response = requests.post(f"{BASE_URL}/api/calculate-path", json={
            "locator_a": "JO62PM",  # Berlin area
            "locator_b": "JN48RR",  # Munich area
            "height_a": 10,
            "height_b": 10,
            "num_points": 50
        })
        assert response.status_code == 200
        data = response.json()
        
        # Berlin to Munich ~500km
        assert 400 < data["distance_km"] < 600
        print(f"✓ Address-derived locator calculation working - Distance: {data['distance_km']} km")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
