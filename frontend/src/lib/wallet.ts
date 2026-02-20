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
