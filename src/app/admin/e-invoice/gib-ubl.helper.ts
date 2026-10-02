import { EInvoiceConfig, EInvoiceItem } from '../../core/models/e-invoice.model';

/**
 * Tutarı Türkçe harflerle resmi muhasebe formatına çevirir.
 * Örnek: 1500.50 -> "#YALNIZ BİN BEŞ YÜZ TÜRK LİRASI ELLİ KURUŞTUR#"
 */
export function turkishNumberToWords(num: number): string {
  const units = ['', 'BİR', 'İKİ', 'ÜÇ', 'DÖRT', 'BEŞ', 'ALTI', 'YEDİ', 'SEKİZ', 'DOKUZ'];
  const tens = ['', 'ON', 'YİRMİ', 'OTUZ', 'KIRK', 'ELLİ', 'ALTMIŞ', 'YETMİŞ', 'SEKSEN', 'DOKSAN'];
  const scales = ['', 'BİN', 'MİLYON', 'MİLYAR', 'TRİLYON'];

  function convertGroup(n: number): string {
    let s = '';
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const u = n % 10;
    if (h > 0) {
      s += (h === 1 ? 'YÜZ ' : units[h] + ' YÜZ ');
    }
    if (t > 0) {
      s += tens[t] + ' ';
    }
    if (u > 0) {
      s += units[u] + ' ';
    }
    return s.trim();
  }

  const rounded = Math.round((Number(num) || 0) * 100) / 100;
  const parts = rounded.toFixed(2).split('.');
  let integerPart = parseInt(parts[0], 10);
  const fractionPart = parseInt(parts[1], 10);

  if (integerPart === 0 && fractionPart === 0) {
    return '#YALNIZ SIFIR TÜRK LİRASI SIFIR KURUŞTUR#';
  }

  let words = '';
  if (integerPart === 0) {
    words = 'SIFIR TÜRK LİRASI';
  } else {
    const groups: number[] = [];
    while (integerPart > 0) {
      groups.push(integerPart % 1000);
      integerPart = Math.floor(integerPart / 1000);
    }
    const res: string[] = [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const g = groups[i];
      if (g > 0) {
        if (i === 1 && g === 1) {
          res.push('BİN');
        } else {
          res.push(convertGroup(g) + (scales[i] ? ' ' + scales[i] : ''));
        }
      }
    }
    words = res.join(' ').trim() + ' TÜRK LİRASI';
  }

  if (fractionPart > 0) {
    words += ' ' + convertGroup(fractionPart) + ' KURUŞTUR';
  } else {
    words += ' SIFIR KURUŞTUR';
  }

  return `#YALNIZ ${words.trim()}#`;
}

/**
 * GİB 01.09.2023 Resmi Karekod Standardı Metni.
 */
export function generateGibQrCodePayload(inv: EInvoiceItem, config: EInvoiceConfig | null): string {
  const sellerVkn = config?.companyVkn || '7290184910';
  const buyerVkn = inv.recipientVknOrTckn || '11111111110';
  const dateStr = inv.issueDate ? (inv.issueDate.toDate ? inv.issueDate.toDate().toISOString().split('T')[0] : String(inv.issueDate).split('T')[0]) : new Date().toISOString().split('T')[0];
  const ettn = inv.gibUuid || '00000000-0000-0000-0000-000000000000';
  const total = (inv.totalAmount || 0).toFixed(2);
  const kdv = (inv.kdvAmount || 0).toFixed(2);
  const invoiceNo = inv.invoiceNumber || 'GIB2026000000001';

  return `vkntckn:${sellerVkn};alici:${buyerVkn};no:${invoiceNo};ettn:${ettn};tarih:${dateStr};toplam:${total};kdv:${kdv};parabirimi:TRY;`;
}

/**
 * Gelir İdaresi Başkanlığı UBL-TR 2.1 E-Fatura / E-Arşiv Standart XML Çıktısı.
 */
export function generateUblTr21Xml(inv: EInvoiceItem, config: EInvoiceConfig | null): string {
  const sellerVkn = config?.companyVkn || '7290184910';
  const sellerTitle = escapeXml(config?.companyTitle || 'ODİVON SPOR VE SAĞLIK HİZMETLERİ LTD. ŞTİ.');
  const taxOffice = escapeXml(config?.taxOffice || 'Beşiktaş Vergi Dairesi');
  const sellerAddress = escapeXml(config?.address || 'Levent Mah. Cömert Sk. No: 12');
  const sellerPhone = escapeXml(config?.phone || '0850 300 00 00');
  const sellerEmail = escapeXml(config?.email || 'muhasebe@odivongym.com');

  const buyerVkn = inv.recipientVknOrTckn || '11111111110';
  const buyerScheme = buyerVkn.length === 11 ? 'TCKN' : 'VKN';
  const buyerName = escapeXml(inv.recipientName || 'Muhatap');
  const buyerTaxOffice = escapeXml(inv.recipientTaxOffice || '');
  const buyerAddress = escapeXml(inv.recipientAddress || 'Türkiye');

  const issueDateObj = inv.issueDate ? (inv.issueDate.toDate ? inv.issueDate.toDate() : new Date(inv.issueDate as any)) : new Date();
  const issueDate = issueDateObj.toISOString().split('T')[0];
  const issueTime = inv.issueTime || issueDateObj.toTimeString().split(' ')[0] || '12:00:00';

  const invoiceNo = inv.invoiceNumber || 'GIB2026000000001';
  const uuid = inv.gibUuid || 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
  const profileId = inv.invoiceProfile || (inv.invoiceType === 'commercial' ? 'TICARIFATURA' : inv.invoiceType === 'basic' ? 'TEMELFATURA' : 'EARSIVFATURA');
  const invoiceTypeCode = inv.invoiceTypeCode || (inv.invoiceType === 'refund' ? 'IADE' : 'SATIS');

  const lines = inv.items && inv.items.length > 0 ? inv.items : [
    {
      name: inv.description || 'Spor & Salon Hizmet Bedeli',
      quantity: 1,
      unit: 'Adet',
      unitPrice: inv.amount,
      discountRate: 0,
      discountAmount: 0,
      kdvRate: inv.kdvRate || 20,
      total: inv.amount,
      kdvAmount: inv.kdvAmount,
      grandTotal: inv.totalAmount,
    },
  ];

  const subtotal = Number(inv.amount || 0).toFixed(2);
  const kdvTotal = Number(inv.kdvAmount || 0).toFixed(2);
  const grandTotal = Number(inv.totalAmount || 0).toFixed(2);

  const linesXml = lines.map((line, index) => {
    const lineNum = index + 1;
    const name = escapeXml(line.name);
    const qty = Number(line.quantity || 1).toFixed(2);
    const unitPrice = Number(line.unitPrice || 0).toFixed(2);
    const lineTotal = Number(line.total || (line.quantity * line.unitPrice)).toFixed(2);
    const lineKdv = Number(line.kdvAmount || 0).toFixed(2);
    const kdvRate = Number(line.kdvRate || 20);
    const unitCode = line.unit === 'Ay' ? 'MON' : line.unit === 'Gün' ? 'DAY' : line.unit === 'Saat' ? 'HUR' : 'C62';

    return `  <cac:InvoiceLine>
    <cbc:ID>${lineNum}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${unitCode}">${qty}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="TRY">${lineTotal}</cbc:LineExtensionAmount>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="TRY">${lineKdv}</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="TRY">${lineTotal}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="TRY">${lineKdv}</cbc:TaxAmount>
        <cbc:Percent>${kdvRate}</cbc:Percent>
        <cac:TaxCategory>
          <cac:TaxScheme>
            <cbc:Name>KDV</cbc:Name>
            <cbc:TaxTypeCode>0015</cbc:TaxTypeCode>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Name>${name}</cbc:Name>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="TRY">${unitPrice}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
         xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>TR1.2</cbc:CustomizationID>
  <cbc:ProfileID>${profileId}</cbc:ProfileID>
  <cbc:ID>${invoiceNo}</cbc:ID>
  <cbc:CopyIndicator>false</cbc:CopyIndicator>
  <cbc:UUID>${uuid}</cbc:UUID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode>${invoiceTypeCode}</cbc:InvoiceTypeCode>
  <cbc:Note>${turkishNumberToWords(inv.totalAmount)}</cbc:Note>
  <cbc:Note>Bu fatura 213 sayılı VUK hükümlerine göre düzenlenmiştir.</cbc:Note>
  <cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode>
  <cbc:LineCountNumeric>${lines.length}</cbc:LineCountNumeric>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="VKN">${sellerVkn}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${sellerTitle}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${sellerAddress}</cbc:StreetName>
        <cbc:CityName>İstanbul</cbc:CityName>
        <cac:Country><cbc:Name>Türkiye</cbc:Name></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cac:TaxScheme><cbc:Name>${taxOffice}</cbc:Name></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:Contact>
        <cbc:Telephone>${sellerPhone}</cbc:Telephone>
        <cbc:ElectronicMail>${sellerEmail}</cbc:ElectronicMail>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="${buyerScheme}">${buyerVkn}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${buyerName}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${buyerAddress}</cbc:StreetName>
        <cac:Country><cbc:Name>Türkiye</cbc:Name></cac:Country>
      </cac:PostalAddress>
      ${buyerTaxOffice ? `<cac:PartyTaxScheme><cac:TaxScheme><cbc:Name>${buyerTaxOffice}</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme>` : ''}
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>10</cbc:PaymentMeansCode>
    <cbc:PaymentDueDate>${issueDate}</cbc:PaymentDueDate>
  </cac:PaymentMeans>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="TRY">${kdvTotal}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="TRY">${subtotal}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="TRY">${kdvTotal}</cbc:TaxAmount>
      <cbc:Percent>${inv.kdvRate || 20}</cbc:Percent>
      <cac:TaxCategory>
        <cac:TaxScheme>
          <cbc:Name>KDV</cbc:Name>
          <cbc:TaxTypeCode>0015</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="TRY">${subtotal}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="TRY">${subtotal}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="TRY">${grandTotal}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="TRY">${grandTotal}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${linesXml}
</Invoice>`;
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Dosya indirme tetikleyici
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
