// Briques communes pour la génération des documents Word (docx).
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType,
  BorderStyle, PageBreak, ShadingType, Footer, PageNumber, VerticalAlign, TableLayoutType,
} from 'docx';

export const FONT = 'Arial';
export const COLORS = { ink: '1F2937', muted: '6B7280', line: 'BFC5CD', head: 'E8EEF5', accent: '1F4E79', warn: 'FDECEA', ok: 'E8F5E9', note: 'FFF8E1' };

const SZ = 21; // 10.5 pt

export function run(text, o = {}) {
  return new TextRun({ text: String(text ?? ''), font: FONT, size: o.size ?? SZ, bold: o.bold, italics: o.italics, color: o.color, underline: o.underline ? {} : undefined, allCaps: o.caps, break: o.break });
}

/** Découpe « **gras** » dans un texte. */
function runs(text, o = {}) {
  const out = [];
  String(text ?? '').split(/(\*\*[^*]+\*\*)/g).forEach(part => {
    if (!part) return;
    out.push(part.startsWith('**') ? run(part.slice(2, -2), { ...o, bold: true }) : run(part, o));
  });
  return out;
}

export function p(text = '', o = {}) {
  return new Paragraph({
    children: Array.isArray(text) ? text : runs(text, o),
    alignment: o.align ?? AlignmentType.LEFT,
    spacing: { before: o.before ?? 0, after: o.after ?? 100, line: o.line ?? 276 },
    indent: o.indent ? { left: o.indent, hanging: o.hanging } : undefined,
    keepNext: o.keepNext,
    pageBreakBefore: o.pageBreakBefore,
    border: o.border,
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined,
  });
}

export const center = (text, o = {}) => p(text, { ...o, align: AlignmentType.CENTER });

export function title(text, o = {}) {
  return p(text, { size: o.size ?? 30, bold: true, align: AlignmentType.CENTER, after: o.after ?? 200, before: o.before ?? 0, color: o.color ?? COLORS.accent, caps: o.caps });
}

export function h1(text) {
  return new Paragraph({
    children: [run(text, { bold: true, size: 26, color: 'FFFFFF' })],
    shading: { type: ShadingType.CLEAR, fill: COLORS.accent, color: 'auto' },
    spacing: { before: 280, after: 140 },
    keepNext: true,
  });
}

export function h2(text) {
  return new Paragraph({
    children: [run(text, { bold: true, size: 23, color: COLORS.accent })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.accent, space: 2 } },
    spacing: { before: 220, after: 100 },
    keepNext: true,
  });
}

export const bullet = (text, o = {}) => new Paragraph({
  children: runs(text, o),
  bullet: { level: o.level ?? 0 },
  spacing: { after: 60, line: 270 },
});

export const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

const side = (color = COLORS.line, size = 4) => ({ style: BorderStyle.SINGLE, size, color });
const boxBorders = color => ({ top: side(color), bottom: side(color), left: side(color), right: side(color) });
const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
export const noBorders = () => ({ top: none, bottom: none, left: none, right: none });

export function cell(content, o = {}) {
  const paras = (Array.isArray(content) ? content : [content]).map(c =>
    typeof c === 'string' || typeof c === 'number' || c == null
      ? p(c ?? '', { size: o.size ?? 19, bold: o.bold, align: o.align, after: 40, color: o.color })
      : c);
  return new TableCell({
    children: paras,
    width: o.width ? { size: o.width, type: WidthType.DXA } : undefined,
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined,
    verticalAlign: o.valign ?? VerticalAlign.TOP,
    columnSpan: o.span,
    borders: boxBorders(o.borderColor),
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
  });
}

/**
 * Tableau simple. `widths` en DXA (somme ≈ 9900 pour A4 portrait, marges 1,5 cm).
 * rows : tableau de tableaux de (string | {text, fill, bold, align, span} | Paragraph[]).
 */
export function table(headers, rows, widths, o = {}) {
  const mk = (v, i, head) => {
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Paragraph)) {
      return cell(v.text ?? '', { width: widths[i], fill: v.fill ?? (head ? COLORS.head : undefined), bold: v.bold ?? head, align: v.align, span: v.span, size: v.size ?? o.size });
    }
    return cell(v, { width: widths[i], fill: head ? COLORS.head : undefined, bold: head, size: o.size });
  };
  const trs = [];
  if (headers) trs.push(new TableRow({ children: headers.map((h, i) => mk(h, i, true)), tableHeader: true, cantSplit: true }));
  rows.forEach(r => trs.push(new TableRow({ children: r.map((v, i) => mk(v, i, false)), cantSplit: o.cantSplit ?? true })));
  return new Table({ rows: trs, width: { size: widths.reduce((a, c) => a + c, 0), type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED });
}

/** Tableau « libellé : valeur » sans bordures visibles. */
export function fields(pairs, labelW = 3600, valueW = 6300) {
  return new Table({
    width: { size: labelW + valueW, type: WidthType.DXA }, columnWidths: [labelW, valueW], layout: TableLayoutType.FIXED,
    rows: pairs.map(([k, v]) => new TableRow({
      children: [
        new TableCell({ width: { size: labelW, type: WidthType.DXA }, children: [p(k, { size: 20, after: 30 })], borders: noBorders(), margins: { top: 20, bottom: 20, left: 0, right: 60 } }),
        new TableCell({ width: { size: valueW, type: WidthType.DXA }, children: [p(v || '………………………………………………', { size: 20, bold: !!v, after: 30 })], borders: noBorders(), margins: { top: 20, bottom: 20, left: 60, right: 0 } }),
      ],
    })),
  });
}

/** Bloc date + signature. */
export function signature(ville, dateStr, who = 'Signature et cachet du concurrent') {
  return [
    p('', { after: 200 }),
    p(`Fait à ${ville || '…………………'}, le ${dateStr || '……………………'}`, { align: AlignmentType.RIGHT, after: 60 }),
    p(who, { align: AlignmentType.RIGHT, bold: true, after: 700 }),
  ];
}

export function note(text, fill = COLORS.note) {
  return new Table({
    width: { size: 9900, type: WidthType.DXA }, columnWidths: [9900], layout: TableLayoutType.FIXED,
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: 9900, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill, color: 'auto' }, borders: boxBorders('E5D9A8'),
        margins: { top: 80, bottom: 80, left: 140, right: 140 },
        children: (Array.isArray(text) ? text : [text]).map(t => (typeof t === 'string' ? p(t, { size: 19, after: 40 }) : t)),
      })],
    })],
  });
}

export function makeDoc(children, { footer = '', landscape = false, margin = 850 } = {}) {
  const grey = { size: 15, color: COLORS.muted };
  return new Document({
    creator: 'Générateur de dossier AO',
    styles: { default: { document: { run: { font: FONT, size: SZ } } } },
    sections: [{
      properties: { page: { size: { orientation: landscape ? 'landscape' : 'portrait', width: 11906, height: 16838 }, margin: { top: margin, bottom: margin, left: margin, right: margin } } },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [run(footer ? `${footer}  —  Page ` : 'Page ', grey), new TextRun({ children: [PageNumber.CURRENT], font: FONT, ...grey }), run(' / ', grey), new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, ...grey })],
          })],
        }),
      },
      children,
    }],
  });
}

export const toBuffer = doc => Packer.toBuffer(doc);
export { AlignmentType };
