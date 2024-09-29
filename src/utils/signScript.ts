import { ethers } from 'ethers';

import dotenv from 'dotenv';
import { SiweMessage } from 'siwe';

// Initialize configuration
dotenv.config();

// Function to sign the message
async function signMessage(nonce: string, address: string): Promise<string | undefined> {
    try {

        // Replace this with your private key for testing
        const privateKey = process.env.TEST_PRIVATE_KEY; // Example: '0xabc123...'

        // Create a wallet instance from the private key
        const wallet = new ethers.Wallet(privateKey!);

        const message = new SiweMessage({
            domain: 'localhost:3000',
            address,
            statement: nonce,
            uri: 'http://localhost:3000',
            version: '1',
            chainId: 1
        });

        const prep = message.prepareMessage();

        // Sign the message
        const signature = await wallet.signMessage(prep);
        console.log(`Message: ${JSON.stringify(message)}`);
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
const address = process.env.TEST_PUB_KEY;

signMessage(message, address!);
// createWallet();
