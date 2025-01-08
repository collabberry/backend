import { ethers } from 'ethers';

async function createWallet(): Promise<void> {

    const wallet = ethers.Wallet.fromMnemonic('');
    console.log(wallet.address);
    console.log(wallet.mnemonic);
    console.log(wallet.privateKey);
}



createWallet();
