import { forwardRef } from 'react';
import { createRoot } from 'react-dom/client';

interface ReceiptItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface ReceiptData {
  invoiceNumber: string;
  customerName?: string | null;
  customerPhone?: string | null;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  change: number;
  paymentMethod: string;
  cashierName?: string;
  shopName?: string;
  shopAddress?: string;
  shopPhone?: string;
  createdAt?: string;
}

// Sinhala translations for receipt labels
const SI = {
  invoice: 'බිල්පත',
  invoiceNo: 'බිල්පත් අංකය',
  date: 'දින',
  time: 'වේලාව',
  customer: 'ගෙනුම්කරු',
  phone: 'දුරකථන',
  cashier: 'මුදල් අයකැමි',
  item: 'අයිතමය',
  qty: 'ප්\u200Dරමාණය',
  price: 'මිල',
  amount: 'මුදල',
  subtotal: 'උප එකතුව',
  discount: 'වට්ටම',
  total: 'මුළු එකතුව',
  paid: 'ගෙවූ මුදල',
  change: 'ඉතිරි මුදල',
  paymentMethod: 'ගෙවීම් ක්\u200Dරමය',
  cash: 'මුදල්',
  card: 'කාඩ්පත',
  bankTransfer: 'බැංකු හුවමාරු',
  thankYou: 'ස්තූතියි!',
  comeAgain: 'නැවතත් පැමිණෙන්න',
  walkIn: 'අනියම් ගෙනුම්කරු',
  noRefund: 'භාණ්ඩ මාරු කළ හැක · මුදල් ආපසු නොලැබේ',
  warranty: 'වගකීම් බිල්පත රැගෙන එන්න',
};

export const ThermalReceipt = forwardRef<HTMLDivElement, { data: ReceiptData }>(
  ({ data }, ref) => {
    const formatCurrency = (amount: number) =>
      `Rs. ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const now = data.createdAt ? new Date(data.createdAt) : new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const timeStr = now.toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const paymentLabel = data.paymentMethod === 'CARD' ? SI.card
      : data.paymentMethod === 'BANK_TRANSFER' ? SI.bankTransfer
      : SI.cash;

    return (
      <div ref={ref} className="thermal-receipt">
        <style>{`
          @media print {
            @page {
              size: 80mm auto;
              margin: 3mm 3mm 3mm 0;
            }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body { margin: 0; padding: 0; background: white; }
            body > *:not(.thermal-receipt-wrapper) { display: none !important; }
            .no-print { display: none !important; }
            .thermal-receipt { width: 74mm !important; margin: 0 !important; padding: 3mm 3mm 3mm 0 !important; }
          }

          .thermal-receipt {
            width: 80mm;
            padding: 3mm 3mm 3mm 0;
            margin: 0;
            background: white;
            color: #000;
            font-family: 'Noto Sans Sinhala', 'Iskoola Pota', 'Segoe UI', monospace;
            font-size: 11px;
            line-height: 1.4;
            box-sizing: border-box;
          }

          .thermal-receipt * {
            box-sizing: border-box;
          }

          .receipt-header {
            text-align: center;
            padding-bottom: 4px;
            border-bottom: 2px dashed #000;
            margin-bottom: 6px;
          }

          .receipt-header .shop-name {
            font-size: 18px;
            font-weight: 900;
            letter-spacing: 1px;
            margin: 0 0 2px 0;
            text-transform: uppercase;
          }

          .receipt-header .shop-details {
            font-size: 9px;
            color: #333;
            line-height: 1.5;
          }

          .receipt-title {
            text-align: center;
            font-size: 14px;
            font-weight: 800;
            letter-spacing: 3px;
            padding: 4px 0;
            border-bottom: 1px solid #000;
            margin-bottom: 4px;
          }

          .receipt-meta {
            font-size: 10px;
            padding: 2px 0 4px;
            border-bottom: 1px dashed #000;
            margin-bottom: 4px;
          }

          .receipt-meta .meta-row {
            display: flex;
            justify-content: space-between;
            padding: 1px 0;
          }

          .receipt-meta .meta-label {
            font-weight: 600;
            color: #333;
          }

          .items-section {
            margin-bottom: 4px;
          }

          .items-header {
            display: flex;
            font-size: 9px;
            font-weight: 700;
            border-bottom: 1px solid #000;
            padding: 2px 0;
            text-transform: uppercase;
          }

          .items-header .col-name { flex: 1; }
          .items-header .col-qty { width: 28px; text-align: center; }
          .items-header .col-price { width: 55px; text-align: right; }
          .items-header .col-total { width: 60px; text-align: right; }

          .item-row {
            display: flex;
            align-items: flex-start;
            padding: 2px 0;
            font-size: 10px;
            border-bottom: 1px dotted #ccc;
          }

          .item-row .col-name {
            flex: 1;
            word-break: break-word;
            padding-right: 2px;
          }

          .item-row .col-qty { width: 28px; text-align: center; font-weight: 600; }
          .item-row .col-price { width: 55px; text-align: right; font-family: 'Consolas', monospace; font-size: 9px; }
          .item-row .col-total { width: 60px; text-align: right; font-weight: 600; font-family: 'Consolas', monospace; font-size: 9px; }

          .totals-section {
            padding: 4px 0;
            border-top: 2px solid #000;
            margin-top: 2px;
          }

          .totals-row {
            display: flex;
            justify-content: space-between;
            padding: 2px 0;
            font-size: 10px;
          }

          .totals-row .label { font-weight: 600; }
          .totals-row .value { font-family: 'Consolas', monospace; font-weight: 600; }

          .totals-row.grand-total {
            font-size: 16px;
            font-weight: 900;
            padding: 6px 0 4px;
            border-top: 2px dashed #000;
            border-bottom: 2px dashed #000;
            margin-top: 3px;
          }

          .totals-row.grand-total .value {
            font-size: 18px;
          }

          .totals-row.paid-row {
            margin-top: 4px;
            font-size: 11px;
          }

          .totals-row.change-row {
            font-size: 13px;
            font-weight: 800;
            background: #000;
            color: #fff;
            padding: 4px 3mm;
            margin: 3px 0;
            width: 100%;
          }

          .totals-row.payment-row {
            font-size: 10px;
            padding: 2px 0;
          }

          .receipt-footer {
            text-align: center;
            padding-top: 6px;
            padding-bottom: 3mm;
            border-top: 1px dashed #000;
            margin-top: 6px;
            margin-bottom: 0;
          }

          .receipt-footer .thank-you {
            font-size: 14px;
            font-weight: 800;
            margin: 0 0 2px;
          }

          .receipt-footer .come-again {
            font-size: 11px;
            font-weight: 600;
            margin: 0 0 4px;
          }

          .receipt-footer .policy {
            font-size: 8px;
            color: #555;
            line-height: 1.5;
            margin-top: 4px;
            padding-top: 4px;
            border-top: 1px dotted #ccc;
          }

          .receipt-footer .barcode-area {
            margin-top: 6px;
            font-family: 'Consolas', 'Courier New', monospace;
            font-size: 12px;
            letter-spacing: 2px;
            font-weight: 800;
          }

          .dashed-line {
            border: 0;
            border-top: 1px dashed #000;
            margin: 4px 0;
          }
        `}</style>

        {/* ========== HEADER ========== */}
        <div className="receipt-header">
          <div className="shop-name">{data.shopName || 'ULTRA SMART'}</div>
          <div className="shop-details">
            මාවරල පාර, මාකඳුර, මාතර<br />
            0776318840
          </div>
        </div>

        {/* ========== TITLE ========== */}
        <div className="receipt-title">— {SI.invoice} —</div>

        {/* ========== META ========== */}
        <div className="receipt-meta">
          <div className="meta-row">
            <span className="meta-label">{SI.invoiceNo}:</span>
            <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 700 }}>{data.invoiceNumber}</span>
          </div>
          <div className="meta-row">
            <span className="meta-label">{SI.date}:</span>
            <span>{dateStr}</span>
          </div>
          <div className="meta-row">
            <span className="meta-label">{SI.time}:</span>
            <span>{timeStr}</span>
          </div>
          {data.customerName && data.customerName !== 'Walk-in' && (
            <>
              <div className="meta-row">
                <span className="meta-label">{SI.customer}:</span>
                <span>{data.customerName}</span>
              </div>
              {data.customerPhone && (
                <div className="meta-row">
                  <span className="meta-label">{SI.phone}:</span>
                  <span>{data.customerPhone}</span>
                </div>
              )}
            </>
          )}
          {data.cashierName && (
            <div className="meta-row">
              <span className="meta-label">{SI.cashier}:</span>
              <span>{data.cashierName}</span>
            </div>
          )}
        </div>

        {/* ========== ITEMS ========== */}
        <div className="items-section">
          <div className="items-header">
            <span className="col-name">{SI.item}</span>
            <span className="col-qty">{SI.qty}</span>
            <span className="col-price">{SI.price}</span>
            <span className="col-total">{SI.amount}</span>
          </div>

          {data.items.map((item, idx) => (
            <div className="item-row" key={idx}>
              <span className="col-name">{item.productName}</span>
              <span className="col-qty">{item.quantity}</span>
              <span className="col-price">{formatCurrency(item.unitPrice).replace('Rs. ', '')}</span>
              <span className="col-total">{formatCurrency(item.total).replace('Rs. ', '')}</span>
            </div>
          ))}
        </div>

        {/* ========== TOTALS ========== */}
        <div className="totals-section">
          <div className="totals-row">
            <span className="label">{SI.subtotal}</span>
            <span className="value">{formatCurrency(data.subtotal)}</span>
          </div>

          {data.discount > 0 && (
            <div className="totals-row">
              <span className="label">(-) {SI.discount}</span>
              <span className="value">-{formatCurrency(data.discount)}</span>
            </div>
          )}

          <div className="totals-row grand-total">
            <span className="label">{SI.total}</span>
            <span className="value">{formatCurrency(data.total)}</span>
          </div>

          <div className="totals-row paid-row">
            <span className="label">{SI.paid}</span>
            <span className="value">{formatCurrency(data.paidAmount)}</span>
          </div>

          {data.change > 0 && (
            <div className="totals-row change-row">
              <span className="label">{SI.change}</span>
              <span className="value">{formatCurrency(data.change)}</span>
            </div>
          )}

          <div className="totals-row payment-row">
            <span className="label">{SI.paymentMethod}:</span>
            <span className="value">{paymentLabel}</span>
          </div>
        </div>

        {/* ========== FOOTER ========== */}
        <div className="receipt-footer">
          <p className="thank-you">{SI.thankYou}</p>
          <p className="come-again">{SI.comeAgain}</p>
          <div className="policy">
            {SI.noRefund}<br />
            {SI.warranty}
          </div>
        </div>
      </div>
    );
  }
);

ThermalReceipt.displayName = 'ThermalReceipt';

// Helper to print receipt directly
export function printThermalReceipt(data: ReceiptData): Promise<void> {
  return new Promise((resolve) => {
    const container = document.createElement('div');
    container.className = 'thermal-receipt-wrapper';
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);

    const root = createRoot(container);
    root.render(<ThermalReceipt data={data} />);

    // Wait for render, then print
    setTimeout(() => {
      // Hide everything except receipt
      const allElements = document.body.children;
      const hidden: HTMLElement[] = [];
      for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i] as HTMLElement;
        if (el !== container && el.style.display !== 'none') {
          hidden.push(el);
          el.style.display = 'none';
        }
      }
      container.style.position = 'fixed';
      container.style.left = '0';
      container.style.top = '0';

      window.print();

      // Restore
      hidden.forEach((el) => (el.style.display = ''));
      root.unmount();
      document.body.removeChild(container);
      resolve();
    }, 300);
  });
}

export default ThermalReceipt;
