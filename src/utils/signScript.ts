import { ethers } from 'ethers';

import dotenv from 'dotenv';

// Initialize configuration
dotenv.config();

// Function to sign the message
async function signMessage(message: string): Promise<string | undefined> {
    try {

        // Replace this with your private key for testing
        const privateKey = process.env.TEST_PRIVATE_KEY; // Example: '0xabc123...'

        // Create a wallet instance from the private key
        const wallet = new ethers.Wallet(privateKey!);
        // Sign the message
        const signature = await wallet.signMessage(message);
        console.log(`Message: ${message}`);
        console.log(`Signature: ${signature}`);

        return signature;
    } catch (error) {
        console.error('Error signing message:', error);
    }
}

async function createWallet(): Promise<void> {

    const wallet = ethers.Wallet.createRandom();
    console.log(wallet.address);
    console.log(wallet.mnemonic);
    console.log(wallet.privateKey);
}


// Define the message (nonce) to sign
const message = process.argv[2];

signMessage(message);
// createWallet();
