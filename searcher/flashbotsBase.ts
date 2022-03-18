import { ethers } from 'hardhat';
import { providers, Wallet } from 'ethers';
import { keccak256 } from 'ethers/lib/utils';
import {
  FlashbotsBundleProvider,
  FlashbotsBundleTransaction,
} from '@flashbots/ethers-provider-bundle';

import { SnxLiquidator } from '../typechain/SnxLiquidator';
import operator from '../.secret';

// Standard json rpc provider directly from ethers.js (NOT Flashbots)
export const provider = new providers.WebSocketProvider(
  'wss://mainnet.infura.io/ws/v3/3a57292f72e4472b8ac896816a27d51f'
);

// deployed liquidator contract address
export const contractAddr = '0xb0C352225B161Da1Ba92b7d60Db3c26bF24c1Bb5';

const loanABI = [
  'function loanLiquidationOpen() external view returns(bool)',
  'function getLoan(address _account, uint256 _loanID) external view returns (address,uint256,uint256,uint256,uint256,uint256,uint256, uint256)',
];

export const susdCollateralAddr = '0xfED77055B40d63DCf17ab250FFD6948FBFF57B82';
export const susdCollateral = new ethers.Contract(
  susdCollateralAddr,
  loanABI,
  provider
);

export const sethCollateralAddr = '0x7133afF303539b0A4F60Ab9bd9656598BF49E272';
export const sethCollateral = new ethers.Contract(
  sethCollateralAddr,
  loanABI,
  provider
);

// flashtbots relay signer
const flashbotsSigner = new Wallet(operator.flashBotPrivate);

export async function createFlashbotsProvider(): Promise<FlashbotsBundleProvider> {
  return await FlashbotsBundleProvider.create(provider, flashbotsSigner);
}

// arbitrage signer
const signer = Wallet.createRandom().connect(provider);

export async function getBundles(
  loaners: Array<any>,
  flashbotsProvider: FlashbotsBundleProvider
): Promise<[Array<string>, Array<string>]> {
  const factory = await ethers.getContractFactory('SnxLiquidator');
  const liquidator = factory.attach(contractAddr) as SnxLiquidator;

  let bundles = new Array<FlashbotsBundleTransaction>();
  for (const loaner of loaners) {
    const tx = await liquidator
      .connect(signer)
      .populateTransaction.liquidate(
        loaner.account,
        loaner.loanID,
        loaner.loanType,
        loaner.minerBp,
        {
          gasPrice: 0,
          gasLimit: 1500000,
        }
      );
    bundles.push({ signer: signer, transaction: tx });
  }
  const signedTxs = await flashbotsProvider.signBundle(bundles);
  const revertingTxHashes = signedTxs.map((v) => keccak256(v));
  return [signedTxs, revertingTxHashes];
}
