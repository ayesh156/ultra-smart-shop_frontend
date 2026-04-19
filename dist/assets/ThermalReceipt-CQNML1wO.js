import{j as e}from"./ui-components-D_-vtgxh.js";import{r as g}from"./vendor-react-D6Cmrr4M.js";import{c as f}from"./index-zERR2iDz.js";const t={invoice:"බිල්පත",invoiceNo:"බිල්පත් අංකය",date:"දින",time:"වේලාව",customer:"ගෙනුම්කරු",phone:"දුරකථන",cashier:"මුදල් අයකැමි",item:"අයිතමය",qty:"ප්‍රමාණය",price:"මිල",amount:"මුදල",subtotal:"උප එකතුව",discount:"වට්ටම",total:"මුළු එකතුව",paid:"ගෙවූ මුදල",change:"ඉතිරි මුදල",paymentMethod:"ගෙවීම් ක්‍රමය",cash:"මුදල්",card:"කාඩ්පත",bankTransfer:"බැංකු හුවමාරු",thankYou:"ස්තූතියි!",comeAgain:"නැවතත් පැමිණෙන්න",noRefund:"භාණ්ඩ මාරු කළ හැක · මුදල් ආපසු නොලැබේ",warranty:"වගකීම් බිල්පත රැගෙන එන්න"},m=g.forwardRef(({data:s},p)=>{const a=r=>`Rs. ${r.toLocaleString("en-LK",{minimumFractionDigits:2,maximumFractionDigits:2})}`,o=s.createdAt?new Date(s.createdAt):new Date,l=o.getFullYear(),c=String(o.getMonth()+1).padStart(2,"0"),i=String(o.getDate()).padStart(2,"0"),n=`${l}-${c}-${i}`,d=o.toLocaleTimeString("en-LK",{hour:"2-digit",minute:"2-digit",second:"2-digit"}),x=s.paymentMethod==="CARD"?t.card:s.paymentMethod==="BANK_TRANSFER"?t.bankTransfer:t.cash;return e.jsxs("div",{ref:p,className:"thermal-receipt",children:[e.jsx("style",{children:`
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
        `}),e.jsxs("div",{className:"receipt-header",children:[e.jsx("div",{className:"shop-name",children:s.shopName||"ULTRA SMART"}),e.jsxs("div",{className:"shop-details",children:["මාවරල පාර, මාකඳුර, මාතර",e.jsx("br",{}),"0776318840"]})]}),e.jsxs("div",{className:"receipt-title",children:["— ",t.invoice," —"]}),e.jsxs("div",{className:"receipt-meta",children:[e.jsxs("div",{className:"meta-row",children:[e.jsxs("span",{className:"meta-label",children:[t.invoiceNo,":"]}),e.jsx("span",{style:{fontFamily:"Consolas, monospace",fontWeight:700},children:s.invoiceNumber})]}),e.jsxs("div",{className:"meta-row",children:[e.jsxs("span",{className:"meta-label",children:[t.date,":"]}),e.jsx("span",{children:n})]}),e.jsxs("div",{className:"meta-row",children:[e.jsxs("span",{className:"meta-label",children:[t.time,":"]}),e.jsx("span",{children:d})]}),s.customerName&&s.customerName!=="Walk-in"&&e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"meta-row",children:[e.jsxs("span",{className:"meta-label",children:[t.customer,":"]}),e.jsx("span",{children:s.customerName})]}),s.customerPhone&&e.jsxs("div",{className:"meta-row",children:[e.jsxs("span",{className:"meta-label",children:[t.phone,":"]}),e.jsx("span",{children:s.customerPhone})]})]}),s.cashierName&&e.jsxs("div",{className:"meta-row",children:[e.jsxs("span",{className:"meta-label",children:[t.cashier,":"]}),e.jsx("span",{children:s.cashierName})]})]}),e.jsxs("div",{className:"items-section",children:[e.jsxs("div",{className:"items-header",children:[e.jsx("span",{className:"col-name",children:t.item}),e.jsx("span",{className:"col-qty",children:t.qty}),e.jsx("span",{className:"col-price",children:t.price}),e.jsx("span",{className:"col-total",children:t.amount})]}),s.items.map((r,h)=>e.jsxs("div",{className:"item-row",children:[e.jsx("span",{className:"col-name",children:r.productName}),e.jsx("span",{className:"col-qty",children:r.quantity}),e.jsx("span",{className:"col-price",children:a(r.unitPrice).replace("Rs. ","")}),e.jsx("span",{className:"col-total",children:a(r.total).replace("Rs. ","")})]},h))]}),e.jsxs("div",{className:"totals-section",children:[e.jsxs("div",{className:"totals-row",children:[e.jsx("span",{className:"label",children:t.subtotal}),e.jsx("span",{className:"value",children:a(s.subtotal)})]}),s.discount>0&&e.jsxs("div",{className:"totals-row",children:[e.jsxs("span",{className:"label",children:["(-) ",t.discount]}),e.jsxs("span",{className:"value",children:["-",a(s.discount)]})]}),e.jsxs("div",{className:"totals-row grand-total",children:[e.jsx("span",{className:"label",children:t.total}),e.jsx("span",{className:"value",children:a(s.total)})]}),e.jsxs("div",{className:"totals-row paid-row",children:[e.jsx("span",{className:"label",children:t.paid}),e.jsx("span",{className:"value",children:a(s.paidAmount)})]}),s.change>0&&e.jsxs("div",{className:"totals-row change-row",children:[e.jsx("span",{className:"label",children:t.change}),e.jsx("span",{className:"value",children:a(s.change)})]}),e.jsxs("div",{className:"totals-row payment-row",children:[e.jsxs("span",{className:"label",children:[t.paymentMethod,":"]}),e.jsx("span",{className:"value",children:x})]})]}),e.jsxs("div",{className:"receipt-footer",children:[e.jsx("p",{className:"thank-you",children:t.thankYou}),e.jsx("p",{className:"come-again",children:t.comeAgain}),e.jsxs("div",{className:"policy",children:[t.noRefund,e.jsx("br",{}),t.warranty]})]})]})});m.displayName="ThermalReceipt";function N(s){return new Promise(p=>{const a=document.createElement("div");a.className="thermal-receipt-wrapper",a.style.position="fixed",a.style.left="-9999px",a.style.top="0",document.body.appendChild(a);const o=f.createRoot(a);o.render(e.jsx(m,{data:s})),setTimeout(()=>{const l=document.body.children,c=[];for(let i=0;i<l.length;i++){const n=l[i];n!==a&&n.style.display!=="none"&&(c.push(n),n.style.display="none")}a.style.position="fixed",a.style.left="0",a.style.top="0",window.print(),c.forEach(i=>i.style.display=""),o.unmount(),document.body.removeChild(a),p()},300)})}export{N as p};
