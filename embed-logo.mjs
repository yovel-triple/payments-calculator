#!/usr/bin/env node
/**
 * embed-logo.mjs — מושך את הלוגו מהחנות החיה ומטמיע אותו ב-index.html.
 *
 *   node embed-logo.mjs          מושך מהחנות ומטמיע
 *   node embed-logo.mjs --local  מטמיע מ-assets/logo.png שכבר קיים
 *
 * 🔴 למה מוטמע ולא מקושר: קישור אל ה-CDN של שופיפיי נחסם בכל הקשר
 *    שמגביל מקורות, ושובר את הדף בפתיחה מהדיסק בלי אינטרנט. ההטמעה
 *    היא מה שמאפשר לדף להישאר קובץ אחד שעובד בכל מקום.
 *
 * 🔴 למה יש סקריפט ולא סתם קובץ בגיט: `assets/` מוחרג, כי גיט אינו דוחס
 *    בינאריים בין גרסאות והמשקל נשאר בהיסטוריה לנצח (‏TY-HYG-001).
 *    הלוגו ניתן למשיכה מחדש בכל רגע, ולכן המקור הוא החנות ולא הריפו.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const SRC = 'https://www.tripley.co.il/cdn/shop/files/Logo.png?v=1785768093&width=420';
const PNG = new URL('./assets/logo.png', import.meta.url);
const PAGE = new URL('./index.html', import.meta.url);

const local = process.argv.includes('--local');

if (!local) {
  const res = await fetch(SRC);
  if (!res.ok) throw new Error(`הלוגו לא נמשך: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(new URL('./assets/', import.meta.url), { recursive: true });
  writeFileSync(PNG, buf);
  console.log(`נמשך מהחנות: ${(buf.length / 1024).toFixed(1)}KB`);
}

if (!existsSync(PNG)) throw new Error('אין assets/logo.png. להריץ בלי --local.');
const png = readFileSync(PNG);

/* שער: הקובץ חייב להיות PNG עם ערוץ אלפא. לוגו עם רקע לבן אטום
   ייראה כמלבן על הדף, וזה מתגלה רק בעין. */
if (png.readUInt32BE(0) !== 0x89504e47) throw new Error('הקובץ אינו PNG');
const colorType = png[25];
if (colorType !== 6 && colorType !== 4 && colorType !== 3) {
  throw new Error(`ל-PNG אין ערוץ אלפא (color type ${colorType}). הלוגו ייראה כמלבן.`);
}
console.log(`מידות: ${png.readUInt32BE(16)}x${png.readUInt32BE(20)}, עם ערוץ אלפא`);

const uri = 'data:image/png;base64,' + png.toString('base64');
const page = readFileSync(PAGE, 'utf8');

/* מחליף את ה-src של תגית הלוגו, ולא מציין מקום חד-פעמי,
   כדי שהסקריפט יהיה אידמפוטנטי וניתן להרצה חוזרת. */
const re = /(<img\s+src=")(?:data:image\/png;base64,[^"]*|__LOGO__)(")/;
if (!re.test(page)) throw new Error('לא נמצאה תגית הלוגו ב-index.html');

writeFileSync(PAGE, page.replace(re, `$1${uri}$2`));
console.log(`הוטמע. index.html עכשיו ${(Buffer.byteLength(readFileSync(PAGE, 'utf8')) / 1024).toFixed(1)}KB`);
