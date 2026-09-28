import {
  formatPrice,
  priceGap,
  pricePairs,
  truncate,
  type PricePair,
  type ProductRow,
} from './product';

const NAVY = '#1B3A5C';
const MUTED = '#93A8C4';
const YELLOW = '#FFD814';
const RETAILER_COLOR: Record<PricePair['retailer'], string> = {
  coles: '#E50016',
  woolworths: '#129C4F',
  aldi: '#00529F',
};

// Satori renders text nodes literally, so card text keeps real glyphs.
// Only '<' can break its HTML parser. Metadata uses HTML escaping separately.
function cardText(s: string): string {
  return s.replace(/</g, '');
}

function priceChip(pair: PricePair, compact: boolean): string {
  return `
    <div style="display: flex; flex-direction: column; align-items: center; background: ${RETAILER_COLOR[pair.retailer]}; color: #FFFFFF; border-radius: 20px; padding: ${compact ? '12px 18px' : '18px 32px'};">
      <span style="font-size: ${compact ? '20px' : '26px'}; opacity: 0.9;">${pair.label}</span>
      <span style="font-size: ${compact ? '36px' : '46px'}; font-weight: 700;">${formatPrice(pair.price)}</span>
    </div>`;
}

export function cardHtml(p: ProductRow, imageUri: string | null): string {
  const pairs = pricePairs(p);
  const gap = priceGap(p);
  const compact = pairs.length > 2;
  const name = cardText(truncate(p.name, 70));
  const sizeBits = [
    p.brand ? cardText(p.brand) : null,
    p.size_value != null ? `${p.size_value}${p.size_unit ?? ''}` : null,
  ].filter(Boolean);

  return `
  <div style="display: flex; flex-direction: row; width: 1200px; height: 630px; background: ${NAVY}; padding: 56px 64px; font-family: Inter;">
    <div style="display: flex; flex-direction: column; flex: 1; justify-content: space-between; padding-right: ${imageUri ? '48px' : '0'};">
      <div style="display: flex; align-items: center;">
        <div style="display: flex; width: 18px; height: 18px; border-radius: 9px; background: ${YELLOW}; margin-right: 14px;"></div>
        <span style="font-size: 38px; font-weight: 700; color: #FFFFFF; letter-spacing: -1px;">StockUp</span>
      </div>
      <div style="display: flex; flex-direction: column;">
        <span style="font-size: 52px; font-weight: 700; color: #FFFFFF; line-height: 1.15;">${name}</span>
        ${sizeBits.length ? `<span style="font-size: 26px; color: ${MUTED}; margin-top: 10px;">${sizeBits.join(' · ')}</span>` : ''}
        <div style="display: flex; flex-direction: row; align-items: center; margin-top: 30px;">
          ${pairs.map((pair) => priceChip(pair, compact)).join('<div style="display: flex; width: 12px;"></div>')}
        </div>
          ${
            gap
              ? `<div style="display: flex; align-self: flex-start; background: ${YELLOW}; color: ${NAVY}; border-radius: 999px; padding: 10px 22px; margin-top: 18px; font-size: 25px; font-weight: 700;">Price gap ${formatPrice(gap)}</div>`
              : ''
          }
      </div>
      <span style="font-size: 24px; color: ${MUTED};">stockup.au - free price-drop alerts</span>
    </div>
    ${
      imageUri
        ? `<div style="display: flex; align-items: center; justify-content: center; width: 360px; background: #FFFFFF; border-radius: 28px; padding: 24px;">
            <img src="${imageUri}" width="312" height="312" style="object-fit: contain;" />
          </div>`
        : ''
    }
  </div>`;
}
