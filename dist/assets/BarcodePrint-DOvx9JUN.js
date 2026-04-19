import{u as re,j as e,s as G,O as k,Q as J,V as X,B as le,f as C,as as oe,D as V,E as W,H as de,a7 as ie,X as ce}from"./ui-components-D_-vtgxh.js";import{r as o}from"./vendor-react-D6Cmrr4M.js";import{a as P,z as h}from"./modal-components-Y5HV5Dfg.js";import{J as Q}from"./JsBarcode-pwVGBBnV.js";import"./vendor-date-DYNBJTeP.js";import"./vendor-utils-DyIMpuv8.js";const be=()=>{const{theme:r}=re(),[y,_]=o.useState([]),[f,S]=o.useState(""),[L,q]=o.useState(!0),[d,n]=o.useState([]),[i,$]=o.useState(""),[w,E]=o.useState(""),[j,A]=o.useState(""),[B,z]=o.useState("1"),[D,I]=o.useState(!1),[m,U]=o.useState(!1),[x,Y]=o.useState(!1),R=o.useRef(null),p=32.5,u=15,T=o.useCallback(async()=>{try{const[t,a]=await Promise.all([P.get("/products"),P.get("/variants")]),s={};(a.data.data||[]).forEach(c=>{s[c.productId]||(s[c.productId]=[]),s[c.productId].push(c)});const l=(t.data.data||[]).map(c=>({...c,variants:s[c.id]||[]}));_(l)}catch{h.error("Failed to load products")}finally{q(!1)}},[]);o.useEffect(()=>{T()},[T]);const F=o.useMemo(()=>{if(!f.trim())return[];const t=f.toLowerCase(),a=[];return y.forEach(s=>{s.barcode&&(s.name.toLowerCase().includes(t)||(s.barcode||"").toLowerCase().includes(t)||(s.sku||"").toLowerCase().includes(t))&&a.push({id:s.id,label:s.name,barcode:s.barcode,price:s.sellingPrice,type:"product"}),(s.variants||[]).forEach(l=>{l.barcode&&(l.name.toLowerCase().includes(t)||(l.barcode||"").toLowerCase().includes(t)||(l.sku||"").toLowerCase().includes(t)||s.name.toLowerCase().includes(t))&&a.push({id:l.id,label:`${s.name} — ${l.name}`,barcode:l.barcode,price:l.sellingPrice,type:"variant"})})}),a.slice(0,20)},[f,y]),K=t=>{const a=d.find(s=>s.barcode===t.barcode);n(a?s=>s.map(l=>l.barcode===t.barcode?{...l,copies:l.copies+1}:l):s=>[...s,{id:t.id,label:t.label,barcode:t.barcode,price:t.price,copies:1}]),S(""),R.current?.focus()},Z=async()=>{I(!0);try{const a=(await P.post("/shop/generate-barcode")).data.data.barcode;$(a),h.success(`Generated: ${a}`)}catch{h.error("Failed to generate barcode")}finally{I(!1)}},ee=()=>{if(!i.trim()){h.error("Enter or generate a barcode");return}const t=parseInt(B)||1,a=d.find(s=>s.barcode===i.trim());n(a?s=>s.map(l=>l.barcode===i.trim()?{...l,copies:l.copies+t}:l):s=>[...s,{id:`custom-${Date.now()}`,label:w.trim()||i.trim(),barcode:i.trim(),price:j.trim(),copies:t}]),$(""),E(""),A(""),z("1")},M=(t,a)=>{n(s=>s.map(l=>l.barcode===t?{...l,copies:Math.max(1,l.copies+a)}:l))},te=(t,a)=>{const s=parseInt(a)||1;n(l=>l.map(c=>c.barcode===t?{...c,copies:Math.max(1,s)}:c))},se=t=>{n(a=>a.filter(s=>s.barcode!==t))},N=d.reduce((t,a)=>t+a.copies,0),b=o.useMemo(()=>d.length>0?d[0]:i.trim()?{id:"preview",label:w.trim()||i.trim(),barcode:i.trim(),price:j.trim(),copies:1}:null,[d,i,w,j]),ae=t=>/^\d{12,13}$/.test(t)?"EAN13":"CODE128",O=(t,a)=>{const s=ae(t);try{Q(a,t,{format:s,width:s==="EAN13"?1.5:1.2,height:35,displayValue:!0,fontSize:s==="EAN13"?12:10,margin:2,textMargin:2,flat:!1})}catch{try{Q(a,t,{format:"CODE128",width:1.2,height:35,displayValue:!0,fontSize:10,margin:2,textMargin:2})}catch{}}},H=()=>{if(d.length===0){h.error("Add items to print");return}const t=window.open("","_blank","width=400,height=600");if(!t){h.error("Please allow popups to print");return}let a="";d.forEach(s=>{for(let l=0;l<s.copies;l++)a+=`
          <div class="label">
            ${m?`<div class="label-name">${s.label.length>20?s.label.substring(0,20)+"…":s.label}</div>`:""}
            <svg class="barcode" id="bc-${s.barcode}-${l}"></svg>
            ${x&&s.price?`<div class="label-price">Rs. ${parseFloat(s.price).toLocaleString()}</div>`:""}
          </div>
        `}),t.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Barcode Labels</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page {
            size: ${p}mm ${u}mm;
            margin: 0;
          }
          body { margin: 0; padding: 0; }
          .label {
            width: ${p}mm;
            height: ${u}mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            page-break-after: always;
            overflow: hidden;
            padding: 0.8mm 1mm;
          }
          .label:last-child { page-break-after: auto; }
          .label-name {
            font-family: Arial, sans-serif;
            font-size: 5.5pt;
            font-weight: bold;
            text-align: center;
            line-height: 1;
            max-width: 100%;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
            width: 100%;
          }
          .barcode {
            width: 100%;
            height: auto;
            max-height: ${m&&x?"7.8mm":m||x?"9.2mm":"11mm"};
          }
          .label-price {
            font-family: Arial, sans-serif;
            font-size: 5.2pt;
            font-weight: bold;
            text-align: center;
            line-height: 1;
            width: 100%;
          }
        </style>
      </head>
      <body>
        ${a}
        <script>
          // Render all barcodes
          document.querySelectorAll('.barcode').forEach(function(svg) {
            var code = svg.id.replace(/^bc-/, '').replace(/-\\d+$/, '');
            var fmt = /^\\d{12,13}$/.test(code) ? 'EAN13' : 'CODE128';
            try {
              JsBarcode(svg, code, {
                format: fmt,
                width: fmt === 'EAN13' ? 1.15 : 0.95,
                height: 24,
                displayValue: true,
                fontSize: fmt === 'EAN13' ? 7 : 6,
                margin: 0,
                textMargin: 0,
                flat: false,
              });
            } catch(e) {
              try {
                JsBarcode(svg, code, {
                  format: 'CODE128',
                  width: 0.95,
                  height: 24,
                  displayValue: true,
                  fontSize: 6,
                  margin: 0,
                  textMargin: 0,
                });
              } catch(e2) { console.error(e2); }
            }
          });
          // Auto-print after render
          setTimeout(function() { window.print(); }, 300);
        <\/script>
      </body>
      </html>
    `),t.document.close()},g=`w-full px-4 py-2.5 rounded-xl border transition-all outline-none ${r==="dark"?"bg-slate-800/50 border-slate-700/50 text-white placeholder-slate-500 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20":"bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"}`,v=`rounded-2xl border ${r==="dark"?"bg-slate-800/30 border-slate-700/50":"bg-white border-slate-200"}`;return e.jsxs("div",{className:"space-y-6",children:[e.jsxs("div",{className:"flex flex-col sm:flex-row sm:items-center justify-between gap-4",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("div",{className:"w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center",children:e.jsx(G,{className:"w-5 h-5 text-white"})}),e.jsxs("div",{children:[e.jsx("h1",{className:`text-2xl font-bold ${r==="dark"?"text-white":"text-slate-900"}`,children:"Barcode Print"}),e.jsx("p",{className:`text-sm ${r==="dark"?"text-slate-400":"text-slate-500"}`,children:"Print barcode labels for your Xprinter"})]})]}),d.length>0&&e.jsxs("button",{onClick:H,className:"flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-emerald-500/25 transition-all",children:[e.jsx(k,{className:"w-4 h-4"}),"Print ",N," Label",N!==1?"s":""]})]}),e.jsxs("div",{className:"grid grid-cols-1 lg:grid-cols-2 gap-6",children:[e.jsxs("div",{className:`${v} p-5`,children:[e.jsxs("h2",{className:`text-lg font-semibold mb-4 flex items-center gap-2 ${r==="dark"?"text-white":"text-slate-900"}`,children:[e.jsx(J,{className:"w-5 h-5 text-emerald-500"})," Add from Products"]}),e.jsxs("div",{className:"relative",children:[e.jsx(J,{className:`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${r==="dark"?"text-slate-500":"text-slate-400"}`}),e.jsx("input",{ref:R,type:"text",value:f,onChange:t=>S(t.target.value),placeholder:"Search by name, barcode, or short code...",className:`${g} pl-10`}),F.length>0&&e.jsx("div",{className:`absolute z-20 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-xl border shadow-xl ${r==="dark"?"bg-slate-800 border-slate-700":"bg-white border-slate-200"}`,children:F.map(t=>e.jsxs("button",{onClick:()=>K(t),className:`w-full text-left px-4 py-2.5 flex items-center justify-between gap-2 transition-colors ${r==="dark"?"hover:bg-slate-700/50 text-slate-300":"hover:bg-slate-50 text-slate-700"}`,children:[e.jsxs("div",{className:"flex-1 min-w-0",children:[e.jsx("div",{className:`text-sm font-medium truncate ${r==="dark"?"text-white":"text-slate-900"}`,children:t.label}),e.jsx("div",{className:`text-xs ${r==="dark"?"text-slate-400":"text-slate-500"}`,children:t.barcode})]}),e.jsxs("div",{className:"text-xs font-mono text-emerald-500",children:["Rs. ",parseFloat(t.price).toLocaleString()]})]},`${t.type}-${t.id}`))})]}),L&&e.jsx("div",{className:"flex items-center justify-center py-8",children:e.jsx(X,{className:"w-5 h-5 animate-spin text-emerald-500"})}),!L&&y.length===0&&e.jsxs("div",{className:`text-center py-8 ${r==="dark"?"text-slate-400":"text-slate-500"}`,children:[e.jsx(le,{className:"w-10 h-10 mx-auto mb-2 opacity-30"}),e.jsx("p",{className:"text-sm",children:"No products with barcodes found"})]})]}),e.jsxs("div",{className:`${v} p-5`,children:[e.jsxs("h2",{className:`text-lg font-semibold mb-4 flex items-center gap-2 ${r==="dark"?"text-white":"text-slate-900"}`,children:[e.jsx(C,{className:"w-5 h-5 text-emerald-500"})," Custom / New Barcode"]}),e.jsxs("div",{className:`mb-5 p-4 rounded-xl border ${r==="dark"?"bg-slate-900/40 border-slate-700/40":"bg-slate-50 border-slate-200"}`,children:[e.jsxs("div",{className:"flex items-center justify-between gap-3 mb-3",children:[e.jsx("h3",{className:`text-sm font-semibold ${r==="dark"?"text-white":"text-slate-900"}`,children:"Barcode Details"}),e.jsx("span",{className:`text-[11px] ${r==="dark"?"text-slate-400":"text-slate-500"}`,children:"Top-right preview"})]}),e.jsxs("div",{className:"flex flex-wrap gap-2 mb-3",children:[e.jsxs("button",{onClick:()=>U(!m),className:`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${m?"bg-emerald-500/10 border-emerald-500/30 text-emerald-500":r==="dark"?"border-slate-700/50 text-slate-400 hover:border-slate-600":"border-slate-200 text-slate-500 hover:border-slate-300"}`,children:[e.jsx(oe,{className:"w-3.5 h-3.5"}),"Product Name",m?e.jsx(V,{className:"w-3 h-3"}):e.jsx(W,{className:"w-3 h-3"})]}),e.jsxs("button",{onClick:()=>Y(!x),className:`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${x?"bg-emerald-500/10 border-emerald-500/30 text-emerald-500":r==="dark"?"border-slate-700/50 text-slate-400 hover:border-slate-600":"border-slate-200 text-slate-500 hover:border-slate-300"}`,children:[e.jsx(de,{className:"w-3.5 h-3.5"}),"Price",x?e.jsx(V,{className:"w-3 h-3"}):e.jsx(W,{className:"w-3 h-3"})]})]}),e.jsx("div",{className:`rounded-lg border p-2 ${r==="dark"?"bg-black/60 border-slate-700/40":"bg-white border-slate-200"}`,children:b?e.jsxs("div",{className:"mx-auto w-full max-w-[245px] bg-white border border-slate-200 rounded-[6px] p-2 flex flex-col justify-between",style:{aspectRatio:`${p} / ${u}`},children:[m?e.jsx("div",{className:"text-[10px] font-semibold text-slate-900 text-center leading-none truncate",children:b.label}):e.jsx("div",{className:"h-2"}),e.jsx("div",{className:"flex justify-center items-center min-h-[45px]",children:e.jsx("svg",{ref:t=>{t&&O(b.barcode,t)},style:{width:"100%",maxHeight:"46px"}})}),x&&b.price?e.jsxs("div",{className:"text-[10px] font-semibold text-slate-900 text-center leading-none",children:["Rs. ",parseFloat(b.price).toLocaleString()]}):e.jsx("div",{className:"h-2"})]}):e.jsx("div",{className:`text-center text-xs py-6 ${r==="dark"?"text-slate-500":"text-slate-400"}`,children:"Add a product or type a custom barcode to see preview"})})]}),e.jsxs("div",{className:"space-y-3",children:[e.jsxs("div",{className:"flex gap-2",children:[e.jsx("input",{type:"text",value:i,onChange:t=>$(t.target.value),placeholder:"Barcode number",className:`${g} flex-1`}),e.jsxs("button",{onClick:Z,disabled:D,className:"flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium text-sm whitespace-nowrap disabled:opacity-50",children:[e.jsx(X,{className:`w-4 h-4 ${D?"animate-spin":""}`}),"Generate"]})]}),e.jsx("input",{type:"text",value:w,onChange:t=>E(t.target.value),placeholder:"Label name (optional)",className:g}),e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsx("input",{type:"text",value:j,onChange:t=>A(t.target.value),placeholder:"Price (optional)",className:g}),e.jsx("input",{type:"number",value:B,onChange:t=>z(t.target.value),onWheel:t=>t.target.blur(),min:"1",placeholder:"Copies",className:g})]}),e.jsxs("button",{onClick:ee,className:`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${i.trim()?"bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:shadow-lg hover:shadow-emerald-500/25":r==="dark"?"bg-slate-700 text-slate-400 cursor-not-allowed":"bg-slate-100 text-slate-400 cursor-not-allowed"}`,disabled:!i.trim(),children:[e.jsx(C,{className:"w-4 h-4"})," Add to Print Queue"]})]})]})]}),e.jsxs("div",{className:`${v} p-5`,children:[e.jsxs("div",{className:"flex items-center justify-between mb-4",children:[e.jsxs("h2",{className:`text-lg font-semibold flex items-center gap-2 ${r==="dark"?"text-white":"text-slate-900"}`,children:[e.jsx(k,{className:"w-5 h-5 text-emerald-500"})," Print Queue",d.length>0&&e.jsxs("span",{className:"ml-2 px-2.5 py-0.5 text-xs font-medium rounded-full bg-emerald-500/10 text-emerald-500",children:[N," label",N!==1?"s":""]})]}),d.length>0&&e.jsxs("div",{className:"flex gap-2",children:[e.jsx("button",{onClick:()=>n([]),className:`text-xs px-3 py-1.5 rounded-lg ${r==="dark"?"text-slate-400 hover:bg-slate-700":"text-slate-500 hover:bg-slate-100"}`,children:"Clear All"}),e.jsxs("button",{onClick:H,className:"flex items-center gap-1.5 text-xs px-4 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg font-medium",children:[e.jsx(k,{className:"w-3 h-3"})," Print All"]})]})]}),d.length===0?e.jsxs("div",{className:`text-center py-12 ${r==="dark"?"text-slate-400":"text-slate-500"}`,children:[e.jsx(G,{className:"w-12 h-12 mx-auto mb-3 opacity-20"}),e.jsx("p",{className:"text-sm",children:"No items in print queue"}),e.jsx("p",{className:`text-xs mt-1 ${r==="dark"?"text-slate-500":"text-slate-400"}`,children:"Search for a product or generate a custom barcode above"})]}):e.jsx("div",{className:"space-y-2",children:d.map(t=>e.jsxs("div",{className:`flex items-center gap-3 p-3 rounded-xl border ${r==="dark"?"bg-slate-800/50 border-slate-700/30":"bg-slate-50 border-slate-200"}`,children:[e.jsx("div",{className:"flex-shrink-0 bg-white rounded-lg p-1.5",children:e.jsx("svg",{ref:a=>{a&&O(t.barcode,a)},style:{width:"80px",height:"35px"}})}),e.jsxs("div",{className:"flex-1 min-w-0",children:[e.jsx("div",{className:`text-sm font-medium truncate ${r==="dark"?"text-white":"text-slate-900"}`,children:t.label}),e.jsxs("div",{className:`text-xs font-mono ${r==="dark"?"text-slate-400":"text-slate-500"}`,children:[t.barcode,t.price&&e.jsxs("span",{className:"ml-2 text-emerald-500",children:["Rs. ",parseFloat(t.price).toLocaleString()]})]})]}),e.jsxs("div",{className:"flex items-center gap-1",children:[e.jsx("button",{onClick:()=>M(t.barcode,-1),className:`w-7 h-7 flex items-center justify-center rounded-lg ${r==="dark"?"bg-slate-700 text-slate-300 hover:bg-slate-600":"bg-slate-200 text-slate-700 hover:bg-slate-300"}`,children:e.jsx(ie,{className:"w-3 h-3"})}),e.jsx("input",{type:"number",value:t.copies,onChange:a=>te(t.barcode,a.target.value),onWheel:a=>a.target.blur(),className:`w-12 text-center text-sm font-medium py-1 rounded-lg border ${r==="dark"?"bg-slate-800 border-slate-700 text-white":"bg-white border-slate-200 text-slate-900"}`,min:"1"}),e.jsx("button",{onClick:()=>M(t.barcode,1),className:`w-7 h-7 flex items-center justify-center rounded-lg ${r==="dark"?"bg-slate-700 text-slate-300 hover:bg-slate-600":"bg-slate-200 text-slate-700 hover:bg-slate-300"}`,children:e.jsx(C,{className:"w-3 h-3"})})]}),e.jsx("button",{onClick:()=>se(t.barcode),className:`w-7 h-7 flex items-center justify-center rounded-lg ${r==="dark"?"text-red-400 hover:bg-red-500/10":"text-red-500 hover:bg-red-50"}`,children:e.jsx(ce,{className:"w-4 h-4"})})]},t.barcode))})]}),e.jsx("div",{className:`${v} p-4`,children:e.jsxs("div",{className:`text-xs space-y-1 ${r==="dark"?"text-slate-500":"text-slate-400"}`,children:[e.jsx("p",{className:"font-medium",children:"Printer Setup (Xprinter XP-T361U):"}),e.jsxs("p",{children:["• Label size: ",p,"mm × ",u,"mm (",(p/25.4).toFixed(2),"in × ",(u/25.4).toFixed(2),"in)"]}),e.jsx("p",{children:"• In printer properties: Stock → Labels with gaps, Direct Thermal | Page Size → User Defined 1.28in × 0.59in (Portrait)"}),e.jsx("p",{children:"• Template area inside label: approx 1.18in × 0.59in (matches printer driver preview)"}),e.jsx("p",{children:"• Make sure the Xprinter is set as the default printer or select it in the print dialog"})]})})]})};export{be as default};
