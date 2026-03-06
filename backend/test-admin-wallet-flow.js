require('dotenv').config();
const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';
const ADMIN_MOBILE = '9111966732';

async function testAdminLogin() {
    try {
        console.log('🔐 Testing Admin Login Flow...\n');

        // Step 1: Send OTP
        console.log(`📱 Sending OTP to: ${ADMIN_MOBILE}`);
        const otpRes = await axios.post(`${API_BASE}/admin/auth/send-otp`, {
            mobile: ADMIN_MOBILE
        });
        console.log('✅ OTP sent successfully!');
        console.log(`   Response:`, otpRes.data);

        // For testing, the OTP is usually 9999 or check backend logs
        const testOTP = '9999';
        console.log(`\n🔑 Using OTP: ${testOTP}`);

        // Step 2: Verify OTP and get token
        console.log('🔓 Verifying OTP...');
        const verifyRes = await axios.post(`${API_BASE}/admin/auth/verify-otp`, {
            mobile: ADMIN_MOBILE,
            otp: testOTP
        });

        if (verifyRes.data.success) {
            console.log('✅ Login successful!');
            console.log(`   Admin Name: ${verifyRes.data.data.user.name}`);
            console.log(`   Token: ${verifyRes.data.data.token.substring(0, 30)}...`);

            const token = verifyRes.data.data.token;

            // Step 3: Test customer list API
            console.log('\n📋 Fetching customer list...');
            const customersRes = await axios.get(`${API_BASE}/admin/customers`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { page: 1, limit: 10 }
            });

            console.log(`✅ Found ${customersRes.data.data.length} customers:`);
            customersRes.data.data.forEach((c, i) => {
                console.log(`   ${i + 1}. ${c.name} - Wallet: ₹${c.walletAmount || 0}`);
            });

            // Step 4: Test wallet recharge
            if (customersRes.data.data.length > 0) {
                const testCustomer = customersRes.data.data[0];
                console.log(`\n💰 Testing wallet recharge for: ${testCustomer.name}`);
                console.log(`   Current balance: ₹${testCustomer.walletAmount || 0}`);

                const rechargeRes = await axios.post(
                    `${API_BASE}/admin/customers/${testCustomer._id}/add-wallet`,
                    {
                        amount: 50,
                        description: 'Test recharge from automated script'
                    },
                    {
                        headers: { Authorization: `Bearer ${token}` }
                    }
                );

                console.log(`✅ Wallet recharged successfully!`);
                console.log(`   New balance: ₹${rechargeRes.data.data.walletAmount}`);
            }

            console.log('\n✅ All tests passed!');

        } else {
            console.log('❌ Login failed:', verifyRes.data.message);
        }

    } catch (error) {
        console.error('❌ Error:', error.response?.data?.message || error.message);
    }
}

testAdminLogin();
