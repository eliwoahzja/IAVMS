export type AppointmentEmailHtml = {
  heading: string
  preheader: string
  message: string
  reference: string
  office: string
  date: string
  time: string
  status: 'pending' | 'approved' | 'rejected' | 'rescheduled' | 'cancelled' | 'updated'
  greeting?: string
  actionText?: string
}

const colors: Record<AppointmentEmailHtml['status'], { label: string; ink: string; fill: string }> = {
  pending: { label: 'Pending review', ink: '#8b5b18', fill: '#fff1d6' },
  approved: { label: 'Approved', ink: '#14634b', fill: '#ddf5eb' },
  rejected: { label: 'Declined', ink: '#983c3c', fill: '#fde7e7' },
  rescheduled: { label: 'Rescheduled', ink: '#514c96', fill: '#eae9fd' },
  cancelled: { label: 'Cancelled', ink: '#7b5260', fill: '#f7e7ee' },
  updated: { label: 'Updated', ink: '#345b93', fill: '#e6efff' },
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => {
  const replacements: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }
  return replacements[char]
})

export function appointmentEmailHtml(input: AppointmentEmailHtml): string {
  const status = colors[input.status]
  const fields = [
    ['Reference number', input.reference],
    ['Office', input.office],
    ['Date', input.date],
    ['Time', input.time],
  ]
  const rows = fields.map(([label, value], index) =>
    `<tr>
      <td style="padding:14px 16px; width:39%; border-bottom:${index === fields.length - 1 ? '0' : '1px solid #e9ecf2'}; vertical-align:top; color:#657086; font-size:13px; line-height:19px;">${escapeHtml(label)}</td>
      <td style="padding:14px 16px; border-bottom:${index === fields.length - 1 ? '0' : '1px solid #e9ecf2'}; vertical-align:top; color:#17233c; font-size:14px; font-weight:600; line-height:20px; overflow-wrap:anywhere;">${escapeHtml(value)}</td>
    </tr>`
  ).join('')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(input.heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f2f4f8;color:#17233c;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(input.preheader)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;background-color:#f2f4f8;">
    <tr>
      <td align="center" style="padding:32px 14px 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:600px;border-collapse:separate;border-spacing:0;background-color:#ffffff;border:1px solid #e2e7ef;border-radius:12px;">
          <tr>
            <td style="background-color:#101953;border-top:5px solid #e5ac1d;border-radius:11px 11px 0 0;padding:25px 30px;">
              <div style="color:#eac15b;font-size:11px;font-weight:700;letter-spacing:2px;line-height:16px;">SYSTEMS PLUS COMPUTER COLLEGE</div>
              <div style="color:#ffffff;font-size:22px;font-weight:700;line-height:29px;margin-top:7px;">IAVMS</div>
              <div style="color:#c7d0eb;font-size:12px;line-height:19px;margin-top:3px;">Appointment &amp; Visitor Management · Caloocan Campus</div>
            </td>
          </tr>
          <tr>
            <td style="padding:30px 30px 14px;">
              <div style="margin-bottom:19px;"><span style="display:inline-block;border-radius:5px;background-color:${status.fill};color:${status.ink};padding:7px 11px;font-size:12px;line-height:16px;font-weight:700;">${status.label}</span></div>
              <h1 style="color:#101953;font-size:25px;font-weight:700;line-height:32px;margin:0 0 16px;">${escapeHtml(input.heading)}</h1>
              ${input.greeting ? `<p style="color:#263450;font-size:15px;line-height:24px;margin:0 0 12px;">${escapeHtml(input.greeting)}</p>` : ''}
              <p style="color:#47536b;font-size:15px;line-height:24px;margin:0;">${escapeHtml(input.message)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:13px 30px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border:1px solid #e6eaf2;border-radius:8px;">
                <tr><td colspan="2" style="background:#f5f7fb;padding:13px 16px;color:#263450;font-size:12px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;border-bottom:1px solid #e6eaf2;">Appointment details</td></tr>
                ${rows}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 30px 30px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#fff9e9;border-left:3px solid #e5ac1d;border-collapse:collapse;">
                <tr><td style="color:#5c4b28;font-size:13px;line-height:21px;padding:14px 16px;">${escapeHtml(input.actionText ?? 'Sign in to IAVMS to review the latest details of your appointment.')}</td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8f9fc;border-top:1px solid #e6eaf2;border-radius:0 0 11px 11px;padding:21px 30px;">
              <p style="margin:0;color:#526077;font-size:12px;line-height:19px;">Systems Plus Computer College · Caloocan Campus</p>
              <p style="margin:7px 0 0;color:#7a8498;font-size:11px;line-height:18px;">Automated IAVMS notification. This inbox is not monitored for appointment replies.</p>
            </td>
          </tr>
        </table>
        <p style="margin:19px 0 0;font-size:11px;line-height:18px;color:#79849a;text-align:center;">SPCC Institutional Appointment &amp; Visitor Management System</p>
      </td>
    </tr>
  </table>
</body>
</html>`
}
