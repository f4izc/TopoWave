import requests
import json
import sys
from datetime import datetime

class VHFPathProfilerTester:
    def __init__(self, base_url="https://los-profiler.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, timeout=30):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}" if endpoint else self.base_url
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=timeout)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=timeout)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Raw response: {response.text[:200]}")
                return False, {}

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timeout after {timeout}s")
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test GET /api/ returns correct message"""
        success, response = self.run_test(
            "Root API endpoint",
            "GET",
            "",
            200
        )
        if success:
            if "VHF-SHF Path Profiler API" in response.get("message", ""):
                print("   ✅ Correct API message returned")
                return True
            else:
                print("   ❌ Incorrect API message")
        return False

    def test_bands_endpoint(self):
        """Test GET /api/bands returns amateur bands list"""
        success, response = self.run_test(
            "Bands endpoint",
            "GET", 
            "bands",
            200
        )
        if success:
            bands = response.get("bands", [])
            expected_bands = ["2m", "70cm", "21cm", "13cm", "3cm"]
            found_bands = [band.get("id") for band in bands]
            
            if all(band_id in found_bands for band_id in expected_bands):
                print(f"   ✅ All expected bands found: {found_bands}")
                return True
            else:
                print(f"   ❌ Missing bands. Expected: {expected_bands}, Found: {found_bands}")
        return False

    def test_calculate_path_valid_short(self):
        """Test POST /api/calculate-path with valid short-distance locators"""
        success, response = self.run_test(
            "Calculate path - Valid short distance (should be clear)",
            "POST",
            "calculate-path",
            200,
            data={
                "locator_a": "JN18CU",
                "locator_b": "JN18DV", 
                "height_a": 10.0,
                "height_b": 10.0,
                "num_points": 30,
                "band": "2m"
            },
            timeout=45
        )
        if success:
            required_fields = ["distance_km", "azimuth_ab", "azimuth_ba", "elevation_profile", "is_clear"]
            missing_fields = [field for field in required_fields if field not in response]
            
            if not missing_fields:
                distance = response.get("distance_km", 0)
                is_clear = response.get("is_clear", False)
                profile_len = len(response.get("elevation_profile", []))
                print(f"   ✅ Distance: {distance}km, Clear: {is_clear}, Profile points: {profile_len}")
                return True
            else:
                print(f"   ❌ Missing required fields: {missing_fields}")
        return False

    def test_calculate_path_valid_long(self):
        """Test POST /api/calculate-path with valid long-distance locators"""
        success, response = self.run_test(
            "Calculate path - Valid long distance (likely obstructed)",
            "POST",
            "calculate-path",
            200,
            data={
                "locator_a": "JN18DQ",
                "locator_b": "IN96GC",
                "height_a": 20.0,
                "height_b": 15.0,
                "num_points": 50,
                "band": "70cm"
            },
            timeout=45
        )
        if success:
            distance = response.get("distance_km", 0)
            is_clear = response.get("is_clear", True)
            profile_len = len(response.get("elevation_profile", []))
            fresnel_percent = response.get("fresnel_clearance_percent")
            print(f"   ✅ Distance: {distance}km, Clear: {is_clear}, Profile points: {profile_len}")
            if fresnel_percent is not None:
                print(f"   ✅ Fresnel clearance: {fresnel_percent}%")
            return True
        return False

    def test_calculate_path_invalid_locator(self):
        """Test POST /api/calculate-path with invalid locator"""
        success, response = self.run_test(
            "Calculate path - Invalid locator format",
            "POST",
            "calculate-path",
            422,  # Validation error
            data={
                "locator_a": "INVALID",
                "locator_b": "JN18DQ",
                "height_a": 10.0,
                "height_b": 10.0,
                "num_points": 50
            }
        )
        if success:
            print("   ✅ Correctly rejected invalid locator")
            return True
        return False

    def test_calculate_path_invalid_band(self):
        """Test POST /api/calculate-path with invalid band"""
        success, response = self.run_test(
            "Calculate path - Invalid band",
            "POST",
            "calculate-path",
            422,  # Validation error
            data={
                "locator_a": "JN18CU",
                "locator_b": "JN18DV",
                "height_a": 10.0,
                "height_b": 10.0,
                "num_points": 50,
                "band": "invalid_band"
            }
        )
        if success:
            print("   ✅ Correctly rejected invalid band")
            return True
        return False

    def test_calculate_path_missing_fields(self):
        """Test POST /api/calculate-path with missing required fields"""
        success, response = self.run_test(
            "Calculate path - Missing required fields",
            "POST",
            "calculate-path", 
            422,  # Validation error
            data={
                "locator_a": "JN18CU"
                # Missing locator_b, heights, etc.
            }
        )
        if success:
            print("   ✅ Correctly rejected incomplete request")
            return True
        return False

    def test_locator_6_chars(self):
        """Test 6-character locator validation"""
        success, response = self.run_test(
            "6-character locator (JN18DU)",
            "POST",
            "calculate-path",
            200,
            data={
                "locator_a": "JN18DU",
                "locator_b": "JN18CV",
                "height_a": 10.0,
                "height_b": 10.0,
                "num_points": 30
            },
            timeout=45
        )
        if success:
            print("   ✅ 6-character locator accepted")
            return True
        return False

    def test_locator_8_chars(self):
        """Test 8-character locator validation"""
        success, response = self.run_test(
            "8-character locator (JN18DU55)",
            "POST",
            "calculate-path",
            200,
            data={
                "locator_a": "JN18DU55",
                "locator_b": "JN18CV22",
                "height_a": 10.0,
                "height_b": 10.0,
                "num_points": 30
            },
            timeout=45
        )
        if success:
            print("   ✅ 8-character locator accepted")
            return True
        return False

    def test_locator_10_chars(self):
        """Test 10-character locator validation"""
        success, response = self.run_test(
            "10-character locator (JN18DU55IX)",
            "POST",
            "calculate-path",
            200,
            data={
                "locator_a": "JN18DU55IX",
                "locator_b": "JN18CV22GH",
                "height_a": 10.0,
                "height_b": 10.0,
                "num_points": 30
            },
            timeout=45
        )
        if success:
            print("   ✅ 10-character locator accepted")
            return True
        return False

    def test_locator_invalid_lengths(self):
        """Test invalid locator lengths (5, 7, 9, 11 chars)"""
        invalid_locators = [
            ("5-char", "JN18D"),
            ("7-char", "JN18DU5"),
            ("9-char", "JN18DU55I"),
            ("11-char", "JN18DU55IXZ")
        ]
        
        all_passed = True
        for name, locator in invalid_locators:
            success, response = self.run_test(
                f"Invalid {name} locator ({locator})",
                "POST",
                "calculate-path",
                422,  # Validation error
                data={
                    "locator_a": locator,
                    "locator_b": "JN18DU",
                    "height_a": 10.0,
                    "height_b": 10.0,
                    "num_points": 30
                }
            )
            if not success:
                all_passed = False
        
        if all_passed:
            print("   ✅ All invalid lengths correctly rejected")
            return True
        return False

    def test_locator_invalid_patterns(self):
        """Test invalid locator patterns within valid lengths"""
        invalid_locators = [
            ("Invalid field chars", "ZZ18DU"),  # Z not in A-R range
            ("Invalid square chars", "JNA8DU"),  # A not in 0-9 range
            ("Invalid subsquare chars", "JN18ZZ"),  # Z not in A-X range
        ]
        
        all_passed = True
        for name, locator in invalid_locators:
            success, response = self.run_test(
                f"Invalid pattern - {name} ({locator})",
                "POST",
                "calculate-path",
                422,  # Validation error
                data={
                    "locator_a": locator,
                    "locator_b": "JN18DU",
                    "height_a": 10.0,
                    "height_b": 10.0,
                    "num_points": 30
                }
            )
            if not success:
                all_passed = False
        
        if all_passed:
            print("   ✅ All invalid patterns correctly rejected")
            return True
        return False

def main():
    print("🚀 Starting VHF-SHF Path Profiler API Tests")
    print("=" * 60)
    
    tester = VHFPathProfilerTester()
    
    # Test all endpoints
    tests = [
        tester.test_root_endpoint,
        tester.test_bands_endpoint,
        tester.test_calculate_path_valid_short,
        tester.test_calculate_path_valid_long,
        tester.test_calculate_path_invalid_locator,
        tester.test_calculate_path_invalid_band,
        tester.test_calculate_path_missing_fields,
        # New locator validation tests (6-10 characters)
        tester.test_locator_6_chars,
        tester.test_locator_8_chars,
        tester.test_locator_10_chars,
        tester.test_locator_invalid_lengths,
        tester.test_locator_invalid_patterns,
    ]
    
    passed_tests = []
    failed_tests = []
    
    for test in tests:
        try:
            if test():
                passed_tests.append(test.__name__)
            else:
                failed_tests.append(test.__name__)
        except Exception as e:
            print(f"❌ Test {test.__name__} crashed: {str(e)}")
            failed_tests.append(test.__name__)
    
    # Print summary
    print("\n" + "=" * 60)
    print("📊 BACKEND TEST SUMMARY")
    print("=" * 60)
    print(f"Total tests: {tester.tests_run}")
    print(f"Passed: {tester.tests_passed} ({len(passed_tests)} test functions)")
    print(f"Failed: {tester.tests_run - tester.tests_passed} ({len(failed_tests)} test functions)")
    
    if failed_tests:
        print(f"\n❌ Failed test functions:")
        for test in failed_tests:
            print(f"   - {test}")
    
    if passed_tests:
        print(f"\n✅ Passed test functions:")
        for test in passed_tests:
            print(f"   - {test}")
    
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"\n🎯 Success rate: {success_rate:.1f}%")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())