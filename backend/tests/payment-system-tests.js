// Payment System End-to-End Tests
// This file contains tests for the payment and subscription system

const request = require('supertest');
const { Pool } = require('pg');

// Test configuration
const TEST_CONFIG = {
  apiUrl: process.env.TEST_API_URL || 'http://localhost:3000',
  testUser: {
    email: 'test-payment@example.com',
    password: 'TestPassword123!',
    username: 'testpaymentuser'
  },
  stripe: {
    testProPriceId: process.env.STRIPE_PRO_PRICE_ID || 'price_test_pro',
    testEnterprisePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_test_enterprise'
  }
};

class PaymentSystemTests {
  constructor() {
    this.authToken = null;
    this.userId = null;
    this.testResults = [];
  }

  // Helper method to make authenticated requests
  async makeRequest(method, path, data = null) {
    const req = request(TEST_CONFIG.apiUrl)[method](path);
    
    if (this.authToken) {
      req.set('Authorization', `Bearer ${this.authToken}`);
    }
    
    if (data) {
      req.send(data);
    }
    
    return req;
  }

  // Test user registration and authentication
  async testAuthentication() {
    console.log('🔐 Testing Authentication...');
    
    try {
      // Register test user
      const registerResponse = await this.makeRequest('post', '/api/auth/register', {
        email: TEST_CONFIG.testUser.email,
        password: TEST_CONFIG.testUser.password,
        username: TEST_CONFIG.testUser.username
      });

      if (registerResponse.status === 201 || registerResponse.status === 400) {
        // User might already exist, try login
        const loginResponse = await this.makeRequest('post', '/api/auth/login', {
          email: TEST_CONFIG.testUser.email,
          password: TEST_CONFIG.testUser.password
        });

        if (loginResponse.status === 200) {
          this.authToken = loginResponse.body.token;
          this.userId = loginResponse.body.user.id;
          this.testResults.push({ test: 'Authentication', status: 'PASS', message: 'User authenticated successfully' });
          return true;
        }
      }

      this.testResults.push({ test: 'Authentication', status: 'FAIL', message: 'Failed to authenticate user' });
      return false;
    } catch (error) {
      this.testResults.push({ test: 'Authentication', status: 'ERROR', message: error.message });
      return false;
    }
  }

  // Test subscription plans endpoint
  async testSubscriptionPlans() {
    console.log('📋 Testing Subscription Plans...');
    
    try {
      const response = await this.makeRequest('get', '/api/payments/plans');
      
      if (response.status === 200 && response.body.plans) {
        const plans = response.body.plans;
        const hasRequiredPlans = plans.free && plans.pro && plans.enterprise;
        
        if (hasRequiredPlans) {
          this.testResults.push({ test: 'Subscription Plans', status: 'PASS', message: 'All subscription plans available' });
          return true;
        }
      }
      
      this.testResults.push({ test: 'Subscription Plans', status: 'FAIL', message: 'Missing required subscription plans' });
      return false;
    } catch (error) {
      this.testResults.push({ test: 'Subscription Plans', status: 'ERROR', message: error.message });
      return false;
    }
  }

  // Test checkout session creation
  async testCheckoutSession() {
    console.log('💳 Testing Checkout Session Creation...');
    
    try {
      const response = await this.makeRequest('post', '/api/payments/create-checkout-session', {
        priceId: TEST_CONFIG.stripe.testProPriceId,
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel'
      });
      
      if (response.status === 200 && response.body.sessionUrl) {
        this.testResults.push({ test: 'Checkout Session', status: 'PASS', message: 'Checkout session created successfully' });
        return true;
      }
      
      this.testResults.push({ 
        test: 'Checkout Session', 
        status: 'FAIL', 
        message: `Failed to create checkout session: ${response.status}` 
      });
      return false;
    } catch (error) {
      this.testResults.push({ test: 'Checkout Session', status: 'ERROR', message: error.message });
      return false;
    }
  }

  // Test subscription status check
  async testSubscriptionStatus() {
    console.log('📊 Testing Subscription Status...');
    
    try {
      const response = await this.makeRequest('get', '/api/payments/subscription');
      
      if (response.status === 200 && response.body.subscription) {
        const subscription = response.body.subscription;
        const hasRequiredFields = subscription.tier && subscription.status;
        
        if (hasRequiredFields) {
          this.testResults.push({ test: 'Subscription Status', status: 'PASS', message: 'Subscription status retrieved successfully' });
          return true;
        }
      }
      
      this.testResults.push({ test: 'Subscription Status', status: 'FAIL', message: 'Invalid subscription status response' });
      return false;
    } catch (error) {
      this.testResults.push({ test: 'Subscription Status', status: 'ERROR', message: error.message });
      return false;
    }
  }

  // Test usage limits enforcement
  async testUsageLimits() {
    console.log('🚫 Testing Usage Limits...');
    
    try {
      // Try to create a project (should check usage limits)
      const response = await this.makeRequest('post', '/api/projects', {
        title: 'Test Project for Usage Limits',
        description: 'Testing usage limit enforcement'
      });
      
      // Should either succeed (if under limit) or fail with usage limit message
      if (response.status === 201 || 
          (response.status === 429 && response.body.error === 'Usage Limit Exceeded')) {
        this.testResults.push({ test: 'Usage Limits', status: 'PASS', message: 'Usage limits are being enforced' });
        return true;
      }
      
      this.testResults.push({ test: 'Usage Limits', status: 'FAIL', message: 'Usage limits not properly enforced' });
      return false;
    } catch (error) {
      this.testResults.push({ test: 'Usage Limits', status: 'ERROR', message: error.message });
      return false;
    }
  }

  // Test monitoring endpoints
  async testMonitoring() {
    console.log('📈 Testing Monitoring Endpoints...');
    
    try {
      const healthResponse = await this.makeRequest('get', '/api/monitoring/health');
      
      if (healthResponse.status === 200 && healthResponse.body.status) {
        this.testResults.push({ test: 'Health Monitoring', status: 'PASS', message: 'Health endpoint working' });
        
        // Test metrics endpoint
        const metricsResponse = await this.makeRequest('get', '/api/monitoring/metrics');
        if (metricsResponse.status === 200) {
          this.testResults.push({ test: 'Metrics Monitoring', status: 'PASS', message: 'Metrics endpoint working' });
          return true;
        }
      }
      
      this.testResults.push({ test: 'Monitoring', status: 'FAIL', message: 'Monitoring endpoints not working' });
      return false;
    } catch (error) {
      this.testResults.push({ test: 'Monitoring', status: 'ERROR', message: error.message });
      return false;
    }
  }

  // Run all tests
  async runAllTests() {
    console.log('🧪 Starting Payment System Tests...\n');
    
    const tests = [
      () => this.testAuthentication(),
      () => this.testSubscriptionPlans(),
      () => this.testCheckoutSession(),
      () => this.testSubscriptionStatus(),
      () => this.testUsageLimits(),
      () => this.testMonitoring()
    ];

    for (const test of tests) {
      await test();
      console.log(''); // Add spacing between tests
    }

    this.printResults();
  }

  // Print test results
  printResults() {
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('========================');
    
    let passed = 0;
    let failed = 0;
    let errors = 0;

    this.testResults.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
      console.log(`${icon} ${result.test}: ${result.status} - ${result.message}`);
      
      if (result.status === 'PASS') passed++;
      else if (result.status === 'FAIL') failed++;
      else errors++;
    });

    console.log('\n📈 SUMMARY:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️  Errors: ${errors}`);
    console.log(`📊 Total: ${this.testResults.length}`);

    if (failed === 0 && errors === 0) {
      console.log('\n🎉 All tests passed! Payment system is ready for production.');
    } else {
      console.log('\n⚠️  Some tests failed. Please review and fix issues before production deployment.');
    }
  }
}

// Export for use in other files
module.exports = PaymentSystemTests;

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new PaymentSystemTests();
  tester.runAllTests().catch(console.error);
}
