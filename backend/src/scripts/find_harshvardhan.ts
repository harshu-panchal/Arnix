
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Customer from '../models/Customer';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

const findUser = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI as string);
        console.log('Connected to MongoDB');

        const search = "Harshvardhan";
        const searchPhone = "6268423925";

        console.log(`Searching for customer with name containing "${search}" or phone "${searchPhone}"...`);

        const customers = await Customer.find({
            $or: [
                { name: { $regex: search, $options: 'i' } },
                { phone: { $regex: searchPhone, $options: 'i' } }
            ]
        });

        console.log(`Found ${customers.length} customers.`);
        customers.forEach(c => {
            console.log('---');
            console.log(`ID: ${c._id}`);
            console.log(`Name: ${c.name}`);
            console.log(`Phone: ${c.phone}`);
            console.log(`Email: ${c.email}`);
            console.log(`Wallet: ${c.walletAmount}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected');
    }
};

findUser();
