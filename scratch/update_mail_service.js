const fs = require('fs');
const path = 'C:/Users/dogan/Documents/Private/Project/OdivonMainApi/src/shared/mail/mail.service.ts';
let code = fs.readFileSync(path, 'utf8');

const target1 = `export interface SendWelcomeGymOwnerInput {
  to: string;
  displayName?: string | null;
  tenantName: string;
}`;

const replace1 = `export interface SendWelcomeGymOwnerInput {
  to: string;
  displayName?: string | null;
  tenantName: string;
}

export interface SendDailyCloseEmailInput {
  to: string;
  recipientName?: string;
  closingNumber: string;
  date: string;
  closedByStaffName: string;
  openingCash: number;
  actualCashCounted: number;
  expectedCash: number;
  cashDifference: number;
  actualPosCounted: number;
  expectedPos: number;
  posDifference: number;
  retainedCashForNextDay?: number;
  bankDepositAmount?: number;
  notes?: string;
  branchName?: string | null;
  gymName?: string;
}`;

// Normalize CRLF for matching
let normCode = code.replace(/\r\n/g, '\n');
if (!normCode.includes(target1)) {
  console.error('Target 1 not found!');
  process.exit(1);
}

const methodTargetMarker = `this.logger.error(\`APM durum e-postası gönderilemedi (\${input.to})\`, error as Error);
      return false;
    }
  }`;

if (!normCode.includes(methodTargetMarker)) {
  console.error('methodTargetMarker not found!');
  process.exit(1);
}

const methodAdd = `
  sendDailyCloseEmail(input: SendDailyCloseEmailInput): Promise<boolean> {
    return runInBackground(this.deliverDailyCloseEmail(input));
  }

  private async deliverDailyCloseEmail(input: SendDailyCloseEmailInput): Promise<boolean> {
    if (!this.transporter && !this.hostingerApiConfigured()) {
      await this.initTransporter();
      if (!this.transporter) {
        this.logger.warn(\`Gün sonu bildirim maili gönderilemedi (\${input.to}): e-posta sağlayıcısı yapılandırılmamış.\`);
        return false;
      }
    }

    const appUrl = process.env.APP_URL_GYM || process.env.APP_URL || 'https://gym.odivon.com';
    const reportUrl = \`\${appUrl.replace(/\\/+$/, '')}/admin/accounting?tab=daily-close\`;
    const recipientName = input.recipientName?.trim() || 'Salon Sahibi / Yöneticisi';
    const gymName = input.gymName?.trim() || 'OdivonGYM';
    const cashDiff = Number(input.cashDifference || 0);

    let diffBadgeColor = '#10b981';
    let diffBadgeBg = '#ecfdf5';
    let diffBadgeBorder = '#a7f3d0';
    let diffBadgeText = '0,00 ₺ (Kasa Tam - Mutabık)';

    if (cashDiff < 0) {
      diffBadgeColor = '#ef4444';
      diffBadgeBg = '#fef2f2';
      diffBadgeBorder = '#fecaca';
      diffBadgeText = \`\${cashDiff.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺ (Kasa Eksiği)\`;
    } else if (cashDiff > 0) {
      diffBadgeColor = '#3b82f6';
      diffBadgeBg = '#eff6ff';
      diffBadgeBorder = '#bfdbfe';
      diffBadgeText = \`+\${cashDiff.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺ (Kasa Fazlası)\`;
    }

    const fmtMoney = (val) => (Number(val || 0)).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';

    const subject = \`[Z Raporu] \${input.date} Gün Sonu Kasa Raporu (\${input.closingNumber})\`;

    const html = \`
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gün Sonu Kasa Kapanış Raporu</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0b1120; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 620px; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #db2777 100%); padding: 32px 28px; text-align: left;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <div style="display: inline-block; background-color: rgba(255,255,255,0.2); padding: 5px 12px; border-radius: 16px; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #ffffff; margin-bottom: 10px;">
                      ODIVONGYM GÜN SONU BİLDİRİMİ
                    </div>
                    <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; line-height: 1.2;">
                      Gün Sonu Kapanışı (Z Raporu) 📊
                    </h1>
                    <div style="margin-top: 6px; font-size: 13px; color: #e0e7ff; font-weight: 600;">
                      Rapor No: \${input.closingNumber} | Tarih: \${input.date}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 28px;">
              <p style="margin: 0 0 14px; font-size: 15px; font-weight: 700; color: #f8fafc;">
                Sayın \${recipientName},
              </p>
              <p style="margin: 0 0 24px; font-size: 14px; color: #94a3b8; line-height: 1.6;">
                <strong style="color: #818cf8;">\${gymName}</strong> salonunuzda <strong style="color: #ffffff;">\${input.date}</strong> tarihli kasa sayımı ve gün sonu kapanışı <strong>\${input.closedByStaffName}</strong> tarafından tamamlanmıştır.
              </p>

              <!-- Kasa Mutabakat Özeti Tablosu -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #1e293b; border: 1px solid #334155; border-radius: 16px; margin-bottom: 24px; padding: 20px;">
                <tr>
                  <td>
                    <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #818cf8; margin-bottom: 14px;">
                      KASA VE POS SAYIM ÖZETİ
                    </div>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 13px; color: #cbd5e1;">
                      <tr>
                        <td style="padding: 7px 0; color: #94a3b8;">Fiziki Sayılan Nakit Kasa:</td>
                        <td style="padding: 7px 0; font-weight: 800; color: #ffffff; text-align: right; font-size: 14px;">\${fmtMoney(input.actualCashCounted)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 7px 0; color: #94a3b8;">Sistemde Beklenen Nakit Kasa:</td>
                        <td style="padding: 7px 0; font-weight: 700; color: #94a3b8; text-align: right;">\${fmtMoney(input.expectedCash)}</td>
                      </tr>
                      <tr style="border-top: 1px dashed #334155;">
                        <td style="padding: 10px 0; font-weight: 700; color: #ffffff;">Kasa Farkı / Mutabakat:</td>
                        <td style="padding: 10px 0; text-align: right;">
                          <span style="display: inline-block; background-color: \${diffBadgeBg}; color: \${diffBadgeColor}; border: 1px solid \${diffBadgeBorder}; padding: 4px 10px; border-radius: 8px; font-weight: 800; font-size: 12px;">
                            \${diffBadgeText}
                          </span>
                        </td>
                      </tr>
                      <tr style="border-top: 1px solid #334155;">
                        <td style="padding: 8px 0; color: #94a3b8;">Fiziki POS Toplamı:</td>
                        <td style="padding: 8px 0; font-weight: 800; color: #38bdf8; text-align: right; font-size: 14px;">\${fmtMoney(input.actualPosCounted)}</td>
                      </tr>
                      \${input.retainedCashForNextDay !== undefined ? \`
                      <tr>
                        <td style="padding: 7px 0; color: #94a3b8;">Ertesi Güne Devreden Nakit:</td>
                        <td style="padding: 7px 0; font-weight: 700; color: #cbd5e1; text-align: right;">\${fmtMoney(input.retainedCashForNextDay)}</td>
                      </tr>\` : ''}
                      \${input.bankDepositAmount !== undefined && input.bankDepositAmount > 0 ? \`
                      <tr>
                        <td style="padding: 7px 0; color: #94a3b8;">Bankaya Yatırılacak Tutar:</td>
                        <td style="padding: 7px 0; font-weight: 700; color: #34d399; text-align: right;">\${fmtMoney(input.bankDepositAmount)}</td>
                      </tr>\` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              \${input.notes ? \`
              <div style="background-color: #0b1120; border-left: 3px solid #818cf8; padding: 12px 16px; border-radius: 0 10px 10px 0; margin-bottom: 24px; font-size: 13px; color: #94a3b8;">
                <strong style="color: #cbd5e1;">Kapanış Notu:</strong> \${input.notes}
              </div>\` : ''}

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 20px;">
                <tr>
                  <td align="center">
                    <a href="\${reportUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; font-size: 14px; font-weight: 800; text-decoration: none; padding: 14px 32px; border-radius: 12px; box-shadow: 0 10px 25px rgba(99,102,241,0.4);">
                      Z Raporunu ve Kasa Detaylarını İncele →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0; font-size: 11px; color: #64748b; text-align: center; line-height: 1.5;">
                Bu e-posta, \${gymName} bünyesinde gün sonu kasa işlemi tamamlandığında Patron yetkisine sahip yöneticilere bilgilendirme amaçlı otomatik olarak iletilir.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
\`;

    try {
      await this.sendMessage({
        from: { name: \`\${gymName} Kasa\`, address: fromAddress() },
        to: input.to,
        subject,
        html,
      });
      this.logger.log(\`Gün sonu bildirim maili gönderildi: \${input.to} (\${input.closingNumber})\`);
      return true;
    } catch (error) {
      this.logger.error(\`Gün sonu bildirim maili gönderilemedi (\${input.to})\`, error as Error);
      return false;
    }
  }`;

let newCode = normCode.replace(target1, replace1);
newCode = newCode.replace(methodTargetMarker, methodTargetMarker + '\n' + methodAdd);

fs.writeFileSync(path, newCode.replace(/\n/g, '\r\n'), 'utf8');
console.log('Successfully updated mail.service.ts!');
