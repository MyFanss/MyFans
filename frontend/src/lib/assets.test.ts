import { describe, expect, it } from 'vitest';
import {
  formatAtomicAssetAmount,
  formatDisplayAssetPrice,
  getAssetByContractId,
  getAssetDecimals,
  getAssetSymbol,
  SUPPORTED_ASSETS,
  XLM_NATIVE_SENTINEL,
} from './assets';

const USDC_ADDR = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';

describe('SUPPORTED_ASSETS registry', () => {
  it('contains XLM and USDC entries', () => {
    const symbols = SUPPORTED_ASSETS.map((a) => a.symbol);
    expect(symbols).toContain('XLM');
    expect(symbols).toContain('USDC');
  });

  it('XLM is not a stablecoin', () => {
    const xlm = SUPPORTED_ASSETS.find((a) => a.symbol === 'XLM');
    expect(xlm?.isStablecoin).toBe(false);
  });

  it('USDC is a stablecoin', () => {
    const usdc = SUPPORTED_ASSETS.find((a) => a.symbol === 'USDC');
    expect(usdc?.isStablecoin).toBe(true);
  });
});

describe('getAssetByContractId', () => {
  it('returns the XLM asset for the native sentinel', () => {
    const asset = getAssetByContractId(XLM_NATIVE_SENTINEL);
    expect(asset?.symbol).toBe('XLM');
  });

  it('returns undefined for an unknown address', () => {
    expect(getAssetByContractId('CUNKNOWN')).toBeUndefined();
  });

  it('trims whitespace before lookup', () => {
    const asset = getAssetByContractId(`  ${XLM_NATIVE_SENTINEL}  `);
    expect(asset?.symbol).toBe('XLM');
  });
});

describe('getAssetSymbol', () => {
  it('returns XLM for the native sentinel', () => {
    expect(getAssetSymbol(XLM_NATIVE_SENTINEL)).toBe('XLM');
  });

  it('returns TOKEN for an empty string', () => {
    expect(getAssetSymbol('')).toBe('TOKEN');
  });

  it('truncates unknown addresses', () => {
    const sym = getAssetSymbol('CABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(sym).toMatch(/^CABC.*XYZ$/);
  });
});

describe('getAssetDecimals', () => {
  it('returns 7 for XLM', () => {
    expect(getAssetDecimals(XLM_NATIVE_SENTINEL)).toBe(7);
  });

  it('falls back to 7 for unknown assets', () => {
    expect(getAssetDecimals('CUNKNOWN')).toBe(7);
  });
});

describe('formatAtomicAssetAmount', () => {
  it('formats XLM atomic amount correctly', () => {
    expect(formatAtomicAssetAmount('10000000', XLM_NATIVE_SENTINEL)).toBe('1.0000000 XLM');
  });

  it('formats zero correctly', () => {
    expect(formatAtomicAssetAmount('0', XLM_NATIVE_SENTINEL)).toBe('0.0000000 XLM');
  });

  it('formats a large amount', () => {
    expect(formatAtomicAssetAmount('1250000000', XLM_NATIVE_SENTINEL)).toBe('125.0000000 XLM');
  });

  it('uses symbol for unknown contract', () => {
    const result = formatAtomicAssetAmount('5000000', 'CABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(result).toContain('CABC');
  });
});

describe('formatDisplayAssetPrice', () => {
  it('appends XLM symbol', () => {
    expect(formatDisplayAssetPrice('12.50', XLM_NATIVE_SENTINEL)).toBe('12.50 XLM');
  });

  it('appends TOKEN for empty contract', () => {
    expect(formatDisplayAssetPrice('5.00', '')).toBe('5.00 TOKEN');
  });

  it('appends truncated address for unknown contract', () => {
    const result = formatDisplayAssetPrice('1.00', 'CABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(result).toMatch(/^1\.00 CABC/);
  });
});
