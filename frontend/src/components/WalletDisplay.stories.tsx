import WalletDisplay from './WalletDisplay';

export default {
  title: 'Components/WalletDisplay',
  component: WalletDisplay,
  argTypes: {
    onDisconnect: { action: 'disconnected' }
  }
};

export const Connected = {
  args: {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    network: 'Mainnet'
  }
};

export const Testnet = {
  args: {
    address: '0xabcdef1234567890abcdef1234567890abcdef12',
    network: 'Testnet'
  }
};

export const Disconnected = {
  args: {
    address: '',
    network: 'Mainnet'
  }
};
