export async function connectWallet() {
  if (typeof window === 'undefined') return null;
  
  const freighter = (window as any).freighter;
  if (!freighter) {
    alert('Please install Freighter wallet');
    return null;
  }
  
  const publicKey = await freighter.getPublicKey();
  return publicKey;
}

export async function signTransaction(xdr: string) {
  const freighter = (window as any).freighter;
  if (!freighter) throw new Error('Freighter not found');
  
  return await freighter.signTransaction(xdr);
}

export async function disconnectWallet() {
  if (typeof window === 'undefined') return;
  
  const freighter = (window as any).freighter;
  if (!freighter) return;
  
  // Freighter doesn't have explicit disconnect, but we can clear local state
  try {
    if (typeof freighter.disconnect === 'function') {
      await freighter.disconnect();
    }
  } catch (err) {
    console.warn('Wallet disconnect failed or not supported:', err);
  }
}

export function isWalletConnected(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).freighter;
}
