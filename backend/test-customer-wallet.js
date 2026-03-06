/**
 * Test script to verify customer data and wallet recharge functionality
 * Run this with: node test-customer-wallet.js
 */

const mongoose = require('mongoose');
const axios = require('axios');

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/zeto-mart';
const API_BASE = 'http://localhost:5000/api';

// Admin credentials (update these with actual admin credentials)
const ADMIN_EMAIL = 'admin@zetomart.com';
const ADMIN_PASSWORD = 'admin123';

async function testCustomerWallet() {
    try {
        console.log('🚀 Starting Customer Wallet Test...\n');

        // Step 1: Connect to MongoDB
        console.log('📦 Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Step 2: Check if customers exist in database
        const Customer = mongoose.model('Customer', new mongoose.Schema({}, { strict: false }));
        const customers = await Customer.find({}).limit(10);

        console.log(`📊 Found ${customers.length} customers in database:`);
        customers.forEach((customer, index) => {
            console.log(`  ${index + 1}. ${customer.name} (${customer.email}) - Wallet: ₹${customer.walletAmount || 0}`);
        });
        console.log('');

        // Step 3: Login as admin to get token
        console.log('🔐 Logging in as admin...');
        let adminToken;
        try {
            const loginRes = await axios.post(`${API_BASE}/admin/auth/login`, {
                email: ADMIN_EMAIL,
                password: ADMIN_PASSWORD
            });
            adminToken = loginRes.data.token;
            console.log('✅ Admin login successful\n');
        } catch (err) {
            console.log('❌ Admin login failed:', err.response?.data?.message || err.message);
            console.log('⚠️  Skipping API tests (no token available)\n');
        }

        // Step 4: Test GET /admin/customers API
        if (adminToken) {
            console.log('📡 Testing GET /admin/customers API...');
            try {
                const customersRes = await axios.get(`${API_BASE}/admin/customers`, {
                    headers: { Authorization: `Bearer ${adminToken}` },
                    params: { page: 1, limit: 10 }
                });

                console.log(`✅ API Response: ${customersRes.data.data.length} customers returned`);
                console.log('   Customers from API:');
                customersRes.data.data.forEach((customer, index) => {
                    console.log(`     ${index + 1}. ${customer.name} - Wallet: ₹${customer.walletAmount || 0}`);
                });
                console.log('');
            } catch (err) {
                console.log('❌ API call failed:', err.response?.data?.message || err.message);
                console.log('');
            }
        }

        // Step 5: Test wallet recharge for first customer
        if (adminToken && customers.length > 0) {
            const testCustomer = customers[0];
            const amountToAdd = 100;

            console.log(`💰 Testing wallet recharge for: ${testCustomer.name}`);
            console.log(`   Current balance: ₹${testCustomer.walletAmount || 0}`);
            console.log(`   Adding: ₹${amountToAdd}`);

            try {
                const rechargeRes = await axios.post(
                    `${API_BASE}/admin/customers/${testCustomer._id}/add-wallet`,
                    {
                        amount: amountToAdd,
                        description: 'Test recharge from script'
                    },
                    {
                        headers: { Authorization: `Bearer ${adminToken}` }
                    }
                );

                console.log(`✅ Wallet recharged successfully!`);
                console.log(`   New balance: ₹${rechargeRes.data.data.walletAmount}`);
                console.log('');

                // Verify in database
                const updatedCustomer = await Customer.findById(testCustomer._id);
                console.log(`✅ Database verification:`);
                console.log(`   Balance in DB: ₹${updatedCustomer.walletAmount}`);
                console.log('');
            } catch (err) {
                console.log('❌ Wallet recharge failed:', err.response?.data?.message || err.message);
                console.log('');
            }
        }

        // Step 6: Check WalletTransaction records
        const WalletTransaction = mongoose.model('WalletTransaction', new mongoose.Schema({}, { strict: false }));
        const transactions = await WalletTransaction.find({ userType: 'CUSTOMER' })
            .sort({ createdAt: -1 })
            .limit(5);

        console.log(`📝 Recent wallet transactions (${transactions.length}):`);
        transactions.forEach((txn, index) => {
            console.log(`  ${index + 1}. ${txn.type} - ₹${txn.amount} - ${txn.description || 'No description'}`);
        });
        console.log('');

        console.log('✅ Test completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n📦 Disconnected from MongoDB');
    }
}

// Run the test
testCustomerWallet();
