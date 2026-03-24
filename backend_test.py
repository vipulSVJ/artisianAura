#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Artisan & Aura E-commerce App
Tests all endpoints including auth-gated ones using MongoDB test user/session
"""

import requests
import sys
import json
from datetime import datetime, timezone, timedelta
import uuid
import subprocess
import time

class ArtisanAuraAPITester:
    def __init__(self, base_url="https://craft-studio-44.preview.emergentagent.com"):
        self.base_url = base_url
        self.session_token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.test_results = []

    def log_result(self, test_name, success, details="", expected_status=None, actual_status=None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name} - PASSED")
        else:
            print(f"❌ {test_name} - FAILED: {details}")
            if expected_status and actual_status:
                print(f"   Expected status: {expected_status}, Got: {actual_status}")
            self.failed_tests.append({"test": test_name, "error": details})
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })

    def create_test_user_session(self):
        """Create test user and session in MongoDB"""
        print("\n🔧 Creating test user and session in MongoDB...")
        
        timestamp = int(time.time())
        self.user_id = f"test-user-{timestamp}"
        self.session_token = f"test_session_{timestamp}"
        
        mongo_script = f"""
use('test_database');
var userId = '{self.user_id}';
var sessionToken = '{self.session_token}';
var expiresAt = new Date(Date.now() + 7*24*60*60*1000);

db.users.insertOne({{
  user_id: userId,
  email: 'test.user.{timestamp}@example.com',
  name: 'Test User {timestamp}',
  picture: 'https://via.placeholder.com/150',
  phone: '+1234567890',
  address: {{}},
  created_at: new Date()
}});

db.user_sessions.insertOne({{
  user_id: userId,
  session_token: sessionToken,
  expires_at: expiresAt.toISOString(),
  created_at: new Date()
}});

print('Test user and session created successfully');
"""
        
        try:
            result = subprocess.run(
                ['mongosh', '--eval', mongo_script],
                capture_output=True, text=True, timeout=30
            )
            if result.returncode == 0:
                print(f"✅ Test user created: {self.user_id}")
                print(f"✅ Session token: {self.session_token}")
                return True
            else:
                print(f"❌ MongoDB script failed: {result.stderr}")
                return False
        except Exception as e:
            print(f"❌ Failed to create test user: {str(e)}")
            return False

    def make_request(self, method, endpoint, data=None, auth_required=False):
        """Make HTTP request with optional auth"""
        url = f"{self.base_url}/api{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if auth_required and self.session_token:
            headers['Authorization'] = f'Bearer {self.session_token}'
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            return response
        except requests.exceptions.RequestException as e:
            print(f"❌ Request failed: {str(e)}")
            return None

    def test_seed_data(self):
        """Test seeding data"""
        print("\n📊 Testing data seeding...")
        response = self.make_request('POST', '/seed')
        if response and response.status_code in [200, 201]:
            self.log_result("Seed Data", True)
            return True
        else:
            status = response.status_code if response else "No response"
            self.log_result("Seed Data", False, f"Status: {status}", 200, status)
            return False

    def test_products_list(self):
        """Test GET /api/products with various filters"""
        print("\n📦 Testing products listing...")
        
        # Basic products list
        response = self.make_request('GET', '/products')
        if response and response.status_code == 200:
            data = response.json()
            if 'products' in data and len(data['products']) > 0:
                self.log_result("Products List - Basic", True, f"Found {len(data['products'])} products")
            else:
                self.log_result("Products List - Basic", False, "No products returned")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Products List - Basic", False, f"Status: {status}", 200, status)

        # Test with filters
        test_filters = [
            ('?category=Ceramics', 'Category Filter'),
            ('?featured=true', 'Featured Filter'),
            ('?sort=price_asc', 'Price Sort Ascending'),
            ('?sort=price_desc', 'Price Sort Descending'),
            ('?search=candle', 'Search Filter'),
            ('?page=1&limit=5', 'Pagination'),
        ]
        
        for filter_param, test_name in test_filters:
            response = self.make_request('GET', f'/products{filter_param}')
            if response and response.status_code == 200:
                data = response.json()
                self.log_result(f"Products List - {test_name}", True, f"Returned {len(data.get('products', []))} products")
            else:
                status = response.status_code if response else "No response"
                self.log_result(f"Products List - {test_name}", False, f"Status: {status}", 200, status)

    def test_product_detail(self):
        """Test GET /api/products/{product_id}"""
        print("\n🔍 Testing product detail...")
        
        # First get a product ID from the list
        response = self.make_request('GET', '/products?limit=1')
        if response and response.status_code == 200:
            data = response.json()
            if data.get('products'):
                product_id = data['products'][0]['product_id']
                
                # Test valid product detail
                detail_response = self.make_request('GET', f'/products/{product_id}')
                if detail_response and detail_response.status_code == 200:
                    product_data = detail_response.json()
                    if 'product_id' in product_data:
                        self.log_result("Product Detail - Valid ID", True, f"Retrieved product: {product_data.get('name', 'Unknown')}")
                    else:
                        self.log_result("Product Detail - Valid ID", False, "Missing product_id in response")
                else:
                    status = detail_response.status_code if detail_response else "No response"
                    self.log_result("Product Detail - Valid ID", False, f"Status: {status}", 200, status)
            else:
                self.log_result("Product Detail - Valid ID", False, "No products available for testing")
        
        # Test invalid product ID
        response = self.make_request('GET', '/products/invalid_id')
        if response and response.status_code == 404:
            self.log_result("Product Detail - Invalid ID", True, "Correctly returned 404")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Product Detail - Invalid ID", False, f"Expected 404, got {status}", 404, status)

    def test_categories_and_filters(self):
        """Test GET /api/categories and GET /api/filters"""
        print("\n🏷️ Testing categories and filters...")
        
        # Test categories
        response = self.make_request('GET', '/categories')
        if response and response.status_code == 200:
            data = response.json()
            if 'categories' in data and len(data['categories']) > 0:
                self.log_result("Categories List", True, f"Found {len(data['categories'])} categories")
            else:
                self.log_result("Categories List", False, "No categories returned")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Categories List", False, f"Status: {status}", 200, status)
        
        # Test filters
        response = self.make_request('GET', '/filters')
        if response and response.status_code == 200:
            data = response.json()
            expected_keys = ['categories', 'materials', 'colors']
            if all(key in data for key in expected_keys):
                self.log_result("Filters List", True, f"All filter types available")
            else:
                self.log_result("Filters List", False, f"Missing filter keys. Got: {list(data.keys())}")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Filters List", False, f"Status: {status}", 200, status)

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n🔐 Testing authentication endpoints...")
        
        # Test /auth/me with valid token
        response = self.make_request('GET', '/auth/me', auth_required=True)
        if response and response.status_code == 200:
            data = response.json()
            if 'user_id' in data and data['user_id'] == self.user_id:
                self.log_result("Auth - Get Current User", True, f"Retrieved user: {data.get('name', 'Unknown')}")
            else:
                self.log_result("Auth - Get Current User", False, f"User ID mismatch or missing")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Auth - Get Current User", False, f"Status: {status}", 200, status)
        
        # Test /auth/me without token
        response = self.make_request('GET', '/auth/me', auth_required=False)
        if response and response.status_code == 401:
            self.log_result("Auth - Unauthorized Access", True, "Correctly returned 401")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Auth - Unauthorized Access", False, f"Expected 401, got {status}", 401, status)

    def test_cart_operations(self):
        """Test cart CRUD operations"""
        print("\n🛒 Testing cart operations...")
        
        # Get a product ID for testing
        response = self.make_request('GET', '/products?limit=1')
        if not response or response.status_code != 200:
            self.log_result("Cart Operations", False, "Cannot get product for cart testing")
            return
        
        product_id = response.json()['products'][0]['product_id']
        
        # Test add to cart
        response = self.make_request('POST', '/cart', {'product_id': product_id, 'quantity': 2}, auth_required=True)
        if response and response.status_code == 200:
            self.log_result("Cart - Add Item", True, "Item added to cart")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Cart - Add Item", False, f"Status: {status}", 200, status)
        
        # Test get cart
        response = self.make_request('GET', '/cart', auth_required=True)
        if response and response.status_code == 200:
            data = response.json()
            if 'items' in data and len(data['items']) > 0:
                self.log_result("Cart - Get Items", True, f"Found {len(data['items'])} items in cart")
            else:
                self.log_result("Cart - Get Items", False, "No items in cart")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Cart - Get Items", False, f"Status: {status}", 200, status)
        
        # Test update cart item
        response = self.make_request('PUT', f'/cart/{product_id}', {'quantity': 3}, auth_required=True)
        if response and response.status_code == 200:
            self.log_result("Cart - Update Item", True, "Item quantity updated")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Cart - Update Item", False, f"Status: {status}", 200, status)
        
        # Test remove from cart
        response = self.make_request('DELETE', f'/cart/{product_id}', auth_required=True)
        if response and response.status_code == 200:
            self.log_result("Cart - Remove Item", True, "Item removed from cart")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Cart - Remove Item", False, f"Status: {status}", 200, status)

    def test_wishlist_operations(self):
        """Test wishlist operations"""
        print("\n❤️ Testing wishlist operations...")
        
        # Get a product ID for testing
        response = self.make_request('GET', '/products?limit=1')
        if not response or response.status_code != 200:
            self.log_result("Wishlist Operations", False, "Cannot get product for wishlist testing")
            return
        
        product_id = response.json()['products'][0]['product_id']
        
        # Test toggle wishlist (add)
        response = self.make_request('POST', f'/wishlist/{product_id}', auth_required=True)
        if response and response.status_code == 200:
            data = response.json()
            if data.get('wishlisted') == True:
                self.log_result("Wishlist - Add Item", True, "Item added to wishlist")
            else:
                self.log_result("Wishlist - Add Item", False, "Item not marked as wishlisted")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Wishlist - Add Item", False, f"Status: {status}", 200, status)
        
        # Test get wishlist
        response = self.make_request('GET', '/wishlist', auth_required=True)
        if response and response.status_code == 200:
            data = response.json()
            if 'items' in data:
                self.log_result("Wishlist - Get Items", True, f"Found {len(data['items'])} items in wishlist")
            else:
                self.log_result("Wishlist - Get Items", False, "No items key in response")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Wishlist - Get Items", False, f"Status: {status}", 200, status)
        
        # Test check wishlist status
        response = self.make_request('GET', f'/wishlist/check/{product_id}', auth_required=True)
        if response and response.status_code == 200:
            data = response.json()
            if 'wishlisted' in data:
                self.log_result("Wishlist - Check Status", True, f"Wishlist status: {data['wishlisted']}")
            else:
                self.log_result("Wishlist - Check Status", False, "Missing wishlisted key in response")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Wishlist - Check Status", False, f"Status: {status}", 200, status)

    def test_reviews_operations(self):
        """Test reviews operations"""
        print("\n⭐ Testing reviews operations...")
        
        # Get a product ID for testing
        response = self.make_request('GET', '/products?limit=1')
        if not response or response.status_code != 200:
            self.log_result("Reviews Operations", False, "Cannot get product for reviews testing")
            return
        
        product_id = response.json()['products'][0]['product_id']
        
        # Test get reviews
        response = self.make_request('GET', f'/products/{product_id}/reviews')
        if response and response.status_code == 200:
            data = response.json()
            if 'reviews' in data:
                self.log_result("Reviews - Get Reviews", True, f"Found {len(data['reviews'])} reviews")
            else:
                self.log_result("Reviews - Get Reviews", False, "No reviews key in response")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Reviews - Get Reviews", False, f"Status: {status}", 200, status)
        
        # Test add review
        review_data = {
            'rating': 5,
            'comment': 'Test review from automated testing',
            'reaction': 'like'
        }
        response = self.make_request('POST', f'/products/{product_id}/reviews', review_data, auth_required=True)
        if response and response.status_code == 200:
            data = response.json()
            if 'review_id' in data:
                self.log_result("Reviews - Add Review", True, f"Review added with ID: {data['review_id']}")
            else:
                self.log_result("Reviews - Add Review", False, "No review_id in response")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Reviews - Add Review", False, f"Status: {status}", 200, status)

    def test_orders_operations(self):
        """Test orders operations"""
        print("\n📋 Testing orders operations...")
        
        # First add an item to cart for order testing
        response = self.make_request('GET', '/products?limit=1')
        if not response or response.status_code != 200:
            self.log_result("Orders Operations", False, "Cannot get product for orders testing")
            return
        
        product_id = response.json()['products'][0]['product_id']
        
        # Add item to cart
        self.make_request('POST', '/cart', {'product_id': product_id, 'quantity': 1}, auth_required=True)
        
        # Test create order
        order_data = {
            'shipping_address': {
                'name': 'Test User',
                'street': '123 Test St',
                'city': 'Test City',
                'state': 'Test State',
                'zip': '12345'
            },
            'payment_method': 'cod'
        }
        response = self.make_request('POST', '/orders', order_data, auth_required=True)
        if response and response.status_code == 200:
            data = response.json()
            if 'order_id' in data:
                self.log_result("Orders - Create Order", True, f"Order created with ID: {data['order_id']}")
                order_id = data['order_id']
                
                # Test get specific order
                response = self.make_request('GET', f'/orders/{order_id}', auth_required=True)
                if response and response.status_code == 200:
                    self.log_result("Orders - Get Specific Order", True, "Order retrieved successfully")
                else:
                    status = response.status_code if response else "No response"
                    self.log_result("Orders - Get Specific Order", False, f"Status: {status}", 200, status)
            else:
                self.log_result("Orders - Create Order", False, "No order_id in response")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Orders - Create Order", False, f"Status: {status}", 200, status)
        
        # Test get orders list
        response = self.make_request('GET', '/orders', auth_required=True)
        if response and response.status_code == 200:
            data = response.json()
            if 'orders' in data:
                self.log_result("Orders - Get Orders List", True, f"Found {len(data['orders'])} orders")
            else:
                self.log_result("Orders - Get Orders List", False, "No orders key in response")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Orders - Get Orders List", False, f"Status: {status}", 200, status)

    def test_profile_operations(self):
        """Test profile operations"""
        print("\n👤 Testing profile operations...")
        
        # Test update profile
        profile_data = {
            'name': 'Updated Test User',
            'phone': '+1987654321',
            'address': {
                'street': '456 Updated St',
                'city': 'Updated City',
                'state': 'Updated State',
                'zip': '54321'
            }
        }
        response = self.make_request('PUT', '/profile', profile_data, auth_required=True)
        if response and response.status_code == 200:
            data = response.json()
            if data.get('name') == profile_data['name']:
                self.log_result("Profile - Update Profile", True, "Profile updated successfully")
            else:
                self.log_result("Profile - Update Profile", False, "Profile data not updated correctly")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Profile - Update Profile", False, f"Status: {status}", 200, status)

    def cleanup_test_data(self):
        """Clean up test user and session"""
        print("\n🧹 Cleaning up test data...")
        
        mongo_script = f"""
use('test_database');
db.users.deleteOne({{user_id: '{self.user_id}'}});
db.user_sessions.deleteOne({{user_id: '{self.user_id}'}});
db.cart.deleteMany({{user_id: '{self.user_id}'}});
db.wishlist.deleteMany({{user_id: '{self.user_id}'}});
db.orders.deleteMany({{user_id: '{self.user_id}'}});
print('Test data cleaned up');
"""
        
        try:
            subprocess.run(['mongosh', '--eval', mongo_script], capture_output=True, text=True, timeout=30)
            print("✅ Test data cleaned up")
        except Exception as e:
            print(f"⚠️ Cleanup warning: {str(e)}")

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🚀 Starting Artisan & Aura Backend API Tests")
        print(f"🌐 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Create test user and session
        if not self.create_test_user_session():
            print("❌ Cannot proceed without test user. Exiting.")
            return False
        
        try:
            # Run all tests
            self.test_seed_data()
            self.test_products_list()
            self.test_product_detail()
            self.test_categories_and_filters()
            self.test_auth_endpoints()
            self.test_cart_operations()
            self.test_wishlist_operations()
            self.test_reviews_operations()
            self.test_orders_operations()
            self.test_profile_operations()
            
        finally:
            # Always cleanup
            self.cleanup_test_data()
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"Total tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Tests failed: {len(self.failed_tests)}")
        print(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        if self.failed_tests:
            print("\n❌ FAILED TESTS:")
            for failure in self.failed_tests:
                print(f"  - {failure['test']}: {failure['error']}")
        
        return len(self.failed_tests) == 0

def main():
    """Main test execution"""
    tester = ArtisanAuraAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())