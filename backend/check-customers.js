require('dotenv').config();
const mongoose = require('mongoose');

async function checkCustomers() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected!\n');

        // Define Customer schema
        const Customer = mongoose.model('Customer', new mongoose.Schema({}, { strict: false }));

        // Get all customers
        const customers = await Customer.find({}).select('name email phone walletAmount status').limit(20);

        console.log(`📊 Total Customers Found: ${customers.length}\n`);

        if (customers.length === 0) {
            console.log('⚠️  No customers found in database!');
            console.log('   This is why the admin panel shows an empty list.\n');
        } else {
            console.log('Customer List:');
            console.log('─'.repeat(80));
            customers.forEach((c, i) => {
                console.log(`${i + 1}. ${c.name || 'N/A'}`);
                console.log(`   Email: ${c.email || 'N/A'}`);
                console.log(`   Phone: ${c.phone || 'N/A'}`);
                console.log(`   Wallet: ₹${c.walletAmount || 0}`);
                console.log(`   Status: ${c.status || 'N/A'}`);
                console.log('─'.repeat(80));
            });

            // Check for "harshvardhan" user
            const harshvardhan = customers.find(c =>
                c.name?.toLowerCase().includes('harsh') ||
                c.email?.toLowerCase().includes('harsh')
            );

            if (harshvardhan) {
                console.log('\n✅ Found "harshvardhan" user:');
                console.log(`   Name: ${harshvardhan.name}`);
                console.log(`   Email: ${harshvardhan.email}`);
                console.log(`   Wallet: ₹${harshvardhan.walletAmount || 0}\n`);
            } else {
                console.log('\n⚠️  "harshvardhan" user not found in customer list\n');
            }
        }

        // Check WalletTransactions
        const WalletTransaction = mongoose.model('WalletTransaction', new mongoose.Schema({}, { strict: false }));
        const txnCount = await WalletTransaction.countDocuments({ userType: 'CUSTOMER' });
        console.log(`💳 Total Customer Wallet Transactions: ${txnCount}\n`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');
    }
}

checkCustomers();
