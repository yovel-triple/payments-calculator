/**
 * payments-fee.mjs — מימוש הייחוס של תוספת התשלומים.
 *
 * זהו הנוסח שממנו יש לגזור כל מימוש אחר, כדי שכולם יחזירו את אותו
 * מספר בדיוק. הכלל, כלשון המייל מ-06.09.2026:
 *
 *   "להכפיל את סכום התשלום באחוז שמתאים למספר התשלומים המבוקש
 *    ולעגל את התוצאה כלפי מעלה למספר עגול בעשרות שקלים."
 *
 * 🔴 החישוב כולו בשלמים, ואין בו ולו פעולה אחת בנקודה צפה.
 *    הסכום מומר לאגורות והאחוז שמור כמאיות האחוז, ולכן שתי המכפלות
 *    הן מספרים שלמים. זה לא קישוט: `Math.ceil` על מכפלה בנקודה צפה
 *    שנופלת בדיוק על עשרת עלול לקפוץ עשרת שלמה בגלל שארית של 1e-15,
 *    בלי שום שגיאה ובלי שום רמז.
 *
 * ⚠️ העיגול הוא כלפי מעלה, תמיד, וגם על שארית זעירה. סכום שמכפלתו
 *    היא 10.0035 מקבל תוספת של 20 ולא של 10. זה מה שהכלל אומר, וזה
 *    גם מה ש-ROUNDUP באקסל מחזיר. ראה SPEC.md, סעיף "המדרגה".
 */

import feeTable from './data/fee-table.json' with { type: 'json' };

/** האחוז ביחידות של מאית האחוז. 2250 = 2.250%. */
export const PCT = Object.freeze(
  Object.fromEntries(Object.entries(feeTable.table).map(([n, v]) => [Number(n), v])),
);

export const MIN_PAYMENTS = Math.min(...Object.keys(PCT).map(Number));
export const MAX_PAYMENTS = Math.max(...Object.keys(PCT).map(Number));

/**
 * מחשב את תוספת התשלומים.
 *
 * @param {number} amount   סכום העסקה בשקלים. אגורות מותרות.
 * @param {number} payments מספר התשלומים.
 * @returns {{ fee:number, pct:number|null, reason:string|null }}
 *          `fee` בשקלים שלמים. `reason` מוחזר רק כשאין תוספת או כשהקלט פסול.
 */
export function paymentsFee(amount, payments) {
  const n = Number(payments);
  const a = Number(amount);

  if (!Number.isFinite(a) || a < 0) return { fee: 0, pct: null, reason: 'סכום לא תקין' };
  if (!Number.isInteger(n) || n < 1) return { fee: 0, pct: null, reason: 'מספר תשלומים לא תקין' };

  /* 1 עד 3 תשלומים אינם בטבלה. ההנחה כאן היא שאין עליהם תוספת.
     🔴 טעונה אישור של יובל, ראה TASKS.md. */
  if (n < MIN_PAYMENTS) return { fee: 0, pct: null, reason: 'אין תוספת עד 3 תשלומים' };

  if (n > MAX_PAYMENTS) {
    return { fee: 0, pct: null, reason: `הטבלה מגיעה עד ${MAX_PAYMENTS} תשלומים` };
  }

  const pct5 = PCT[n];

  /* אגורות ⟵ שלם. מכפלה באחוז ⟵ שלם ביחידות של 1e-7 שקל.
     עשרה שקלים הם 1e8 יחידות כאלה, ומכאן העיגול. */
  const agorot = Math.round(a * 100);
  const fee = Math.ceil((agorot * pct5) / 1e8) * 10;

  return { fee, pct: pct5 / 1000, reason: null };
}

/**
 * הפירוט המלא שהמוכר מציג ללקוח.
 *
 * 🔴 התוספת מתחלקת שווה בשווה על כל התשלומים, הכרעת יובל 06.09.2026.
 *    אין תשלום ראשון גדול יותר, ואין חישוב שארית.
 *
 * `pct` הוא **אחוז התוספת בפועל**, ולא האחוז שבטבלה. הם נבדלים בגלל
 * העיגול כלפי מעלה לעשרות: על 4,000 ש"ח ב-12 תשלומים הטבלה אומרת
 * 3.782% והתוספת בפועל היא 160, כלומר 4.00%.
 */
export function quote(amount, payments) {
  const { fee, pct: tablePct, reason } = paymentsFee(amount, payments);
  const n = Number(payments);
  const base = Number(amount);
  const total = base + fee;

  return {
    amount: base,
    payments: n,
    tablePct,
    fee,
    total,
    reason,
    monthly: n > 0 ? total / n : 0,
    pct: base > 0 ? (fee / base) * 100 : 0,
  };
}
