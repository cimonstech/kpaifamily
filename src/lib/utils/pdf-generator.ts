/**
 * Supabase Storage setup (Dashboard → Storage):
 * - Create a bucket named `reports`.
 * - Set the bucket to public (or add a storage policy allowing public read)
 *   so `getPublicUrl()` works for admin "Download PDF" links.
 * - Upload path used by the API: `reports/[YYYY-MM].pdf` (see reports/generate).
 */

import { DEFAULT_MONTHLY_RATE } from "@/lib/constants";
import type { ReportData } from "@/lib/types";
import { formatGhsCurrency } from "@/lib/utils/currency";
import type { PDFFont, PDFPage } from "pdf-lib";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const MARGIN = 50;
const PAGE_W = 595;
const PAGE_H = 842;
const A4_W = 595.28;
const A4_H = 841.89;

const BLACK = rgb(0.1, 0.1, 0.12);
const GRAY = rgb(0.45, 0.45, 0.45);
/** Chart theme */
const GOLD = rgb(232 / 255, 184 / 255, 75 / 255);
const NAVY = rgb(26 / 255, 26 / 255, 46 / 255);
const NAVY_DARK = rgb(0.05, 0.05, 0.1);
const AXIS_GRAY = rgb(0.7, 0.7, 0.7);
const GRID_GRAY = rgb(0.88, 0.88, 0.88);

function formatCedis(n: number) {
  return formatGhsCurrency(n);
}

function monthTitle(d: Date) {
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}

/** `yTop` is the top edge of the chart bbox (PDF coords, y up). */
function drawCollectedVsOutstandingChart(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  x: number,
  yTop: number,
  width: number,
  height: number,
  totalCollected: number,
  totalOutstanding: number
) {
  const yBottom = yTop - height;
  const titleSize = 12;
  page.drawText("Collections Overview", {
    x,
    y: yTop - titleSize - 2,
    size: titleSize,
    font: fontBold,
    color: NAVY,
  });

  const axisY = yBottom + 52;
  const plotTop = yTop - 28;
  const maxBarH = Math.max(24, plotTop - axisY - 22);
  const maxVal = Math.max(totalCollected, totalOutstanding, 1);
  const hCol = (totalCollected / maxVal) * maxBarH;
  const hOut = (totalOutstanding / maxVal) * maxBarH;

  const axisX0 = x + 28;
  const innerRight = x + width - 8;
  page.drawLine({
    start: { x: axisX0, y: axisY },
    end: { x: axisX0, y: plotTop + 4 },
    color: AXIS_GRAY,
    thickness: 0.6,
  });
  page.drawLine({
    start: { x: axisX0, y: axisY },
    end: { x: innerRight, y: axisY },
    color: AXIS_GRAY,
    thickness: 0.6,
  });

  const centerX = x + width / 2;
  const barW = 40;
  const gap = 20;
  const cx1 = centerX - (barW + gap / 2);
  const cx2 = centerX + (barW + gap / 2);

  const drawBar = (
    center: number,
    barHeight: number,
    color: ReturnType<typeof rgb>,
    valLabel: string,
    catLabel: string
  ) => {
    const left = center - barW / 2;
    page.drawRectangle({
      x: left,
      y: axisY,
      width: barW,
      height: barHeight,
      color,
    });
    const vSize = 9;
    const vw = font.widthOfTextAtSize(valLabel, vSize);
    page.drawText(valLabel, {
      x: center - vw / 2,
      y: axisY + barHeight + 4,
      size: vSize,
      font,
      color: NAVY,
    });
    const cw = font.widthOfTextAtSize(catLabel, vSize);
    page.drawText(catLabel, {
      x: center - cw / 2,
      y: axisY - 16,
      size: vSize,
      font,
      color: NAVY,
    });
  };

  drawBar(
    cx1,
    hCol,
    GOLD,
    formatCedis(totalCollected),
    "Collected"
  );
  drawBar(
    cx2,
    hOut,
    NAVY,
    formatCedis(totalOutstanding),
    "Outstanding"
  );

  const legY = yBottom + 10;
  const sq = 6;
  page.drawRectangle({ x, y: legY, width: sq, height: sq, color: GOLD });
  page.drawText("Collected", {
    x: x + sq + 4,
    y: legY - 1,
    size: 8,
    font,
    color: NAVY,
  });
  const leg2x = x + 78;
  page.drawRectangle({ x: leg2x, y: legY, width: sq, height: sq, color: NAVY });
  page.drawText("Outstanding", {
    x: leg2x + sq + 4,
    y: legY - 1,
    size: 8,
    font,
    color: NAVY,
  });
}

function drawPaidVsUnpaidPieChart(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  x: number,
  yTop: number,
  width: number,
  height: number,
  paidCount: number,
  unpaidCount: number,
  totalCount: number
) {
  const yBottom = yTop - height;
  const titleSize = 12;
  page.drawText("Payment Status", {
    x,
    y: yTop - titleSize - 2,
    size: titleSize,
    font: fontBold,
    color: NAVY,
  });

  const cx = x + width / 2;
  const cy = yTop - height / 2 - 6;
  const r = Math.max(28, Math.min(width, height) / 2 - 28);

  if (totalCount <= 0) {
    page.drawText("No member data", {
      x,
      y: cy,
      size: 10,
      font,
      color: GRAY,
    });
    return;
  }

  page.drawEllipse({
    x: cx - r,
    y: cy - r,
    xScale: r,
    yScale: r,
    color: NAVY,
    borderColor: NAVY,
    borderWidth: 0.3,
  });

  const paidFrac = paidCount / totalCount;
  const paidAngle = paidFrac * 2 * Math.PI;
  const steps = 60;
  if (paidAngle > 0.001) {
    const anglePerStep = paidAngle / steps;
    for (let i = 0; i < steps; i++) {
      const a1 = -Math.PI / 2 + i * anglePerStep;
      const a2 = -Math.PI / 2 + (i + 1) * anglePerStep;
      const x1 = cx + r * Math.cos(a1);
      const y1 = cy + r * Math.sin(a1);
      const x2 = cx + r * Math.cos(a2);
      const y2 = cy + r * Math.sin(a2);
      const d = `M ${cx} ${cy} L ${x1} ${y1} L ${x2} ${y2} Z`;
      page.drawSvgPath(d, { color: GOLD, borderWidth: 0 });
    }
  }

  const pct = Math.round(paidFrac * 100);
  const mid = `${pct}% paid`;
  const midSize = 11;
  const mw = fontBold.widthOfTextAtSize(mid, midSize);
  page.drawText(mid, {
    x: cx - mw / 2,
    y: cy - midSize / 3,
    size: midSize,
    font: fontBold,
    color: paidFrac > 0.5 ? NAVY : GOLD,
  });

  const legY = yBottom + 12;
  const sq = 6;
  page.drawRectangle({ x, y: legY, width: sq, height: sq, color: GOLD });
  page.drawText(`Paid (${paidCount} members)`, {
    x: x + sq + 4,
    y: legY - 1,
    size: 8,
    font,
    color: NAVY,
  });
  const row2y = legY - 14;
  page.drawRectangle({ x, y: row2y, width: sq, height: sq, color: NAVY });
  page.drawText(`Yet to pay (${unpaidCount} members)`, {
    x: x + sq + 4,
    y: row2y - 1,
    size: 8,
    font,
    color: NAVY,
  });
}

function drawDashedHLine(
  page: PDFPage,
  x0: number,
  x1: number,
  y: number,
  dashLen: number,
  gapLen: number
) {
  let xp = x0;
  while (xp < x1) {
    const xe = Math.min(xp + dashLen, x1);
    page.drawLine({
      start: { x: xp, y },
      end: { x: xe, y },
      color: GRID_GRAY,
      thickness: 0.4,
    });
    xp = xe + gapLen;
  }
}

function drawMonthlyTrendChart(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  x: number,
  yTop: number,
  width: number,
  height: number,
  monthlyData: Array<{ month: string; amount: number }>
) {
  const yBottom = yTop - height;
  page.drawText("Monthly Collections (12 months)", {
    x,
    y: yTop - 14,
    size: 12,
    font: fontBold,
    color: NAVY,
  });

  const padL = 44;
  const padB = 42;
  const padT = 36;
  const axisX0 = x + padL;
  const axisX1 = x + width - 6;
  const axisY0 = yBottom + padB;
  const axisY1 = yTop - padT;
  if (axisY1 <= axisY0) return;

  const amounts = monthlyData.map((d) => d.amount);
  const maxAmt = Math.max(...amounts, 1);
  const gridSteps = 4;
  for (let g = 0; g <= gridSteps; g++) {
    const t = g / gridSteps;
    const yL = axisY0 + t * (axisY1 - axisY0);
    const val = maxAmt * t;
    drawDashedHLine(page, axisX0, axisX1, yL, 4, 3);
    const lab = formatGhsCurrency(val);
    const lw = font.widthOfTextAtSize(lab, 8);
    page.drawText(lab, {
      x: axisX0 - lw - 6,
      y: yL - 3,
      size: 8,
      font,
      color: GRAY,
    });
  }

  page.drawLine({
    start: { x: axisX0, y: axisY0 },
    end: { x: axisX0, y: axisY1 },
    color: AXIS_GRAY,
    thickness: 0.6,
  });
  page.drawLine({
    start: { x: axisX0, y: axisY0 },
    end: { x: axisX1, y: axisY0 },
    color: AXIS_GRAY,
    thickness: 0.6,
  });

  const n = Math.max(1, monthlyData.length);
  const stepX = n > 1 ? (axisX1 - axisX0) / (n - 1) : 0;
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const px = n === 1 ? (axisX0 + axisX1) / 2 : axisX0 + i * stepX;
    const amt = monthlyData[i]?.amount ?? 0;
    const py = axisY0 + (amt / maxAmt) * (axisY1 - axisY0);
    points.push({ x: px, y: py });
  }

  for (let i = 0; i < points.length - 1; i++) {
    page.drawLine({
      start: points[i]!,
      end: points[i + 1]!,
      color: GOLD,
      thickness: 2,
    });
  }

  for (const p of points) {
    page.drawEllipse({
      x: p.x - 3,
      y: p.y - 3,
      xScale: 3,
      yScale: 3,
      color: GOLD,
      borderColor: NAVY,
      borderWidth: 0.4,
    });
  }

  for (let i = 0; i < n; i++) {
    if (i % 2 === 1 && n > 6) continue;
    const lab = monthlyData[i]?.month ?? "";
    const px = n === 1 ? (axisX0 + axisX1) / 2 : axisX0 + i * stepX;
    const tw = font.widthOfTextAtSize(lab, 8);
    page.drawText(lab, {
      x: px - tw / 2,
      y: axisY0 - 14,
      size: 8,
      font,
      color: NAVY,
    });
  }
}

function truncateLabel(s: string, maxLen: number) {
  const t = s.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}

function drawTopBehindChart(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  x: number,
  yTop: number,
  width: number,
  height: number,
  members: Array<{
    displayName: string;
    amountBehind: number;
    monthsBehind: number;
  }>
) {
  const yBottom = yTop - height;
  page.drawText("Most Behind (Top 10)", {
    x,
    y: yTop - 14,
    size: 12,
    font: fontBold,
    color: NAVY,
  });

  if (members.length === 0) {
    page.drawText("No members behind", {
      x,
      y: yTop - height / 2,
      size: 10,
      font,
      color: GRAY,
    });
    return;
  }

  const titleArea = 28;
  const innerH = height - titleArea;
  const gap = 4;
  const barH = Math.max(
    8,
    (innerH - gap * Math.max(0, members.length - 1)) / members.length - gap
  );
  const labelW = 80;
  const valueReserve = 72;
  const barMaxW = Math.max(24, width - labelW - valueReserve - 8);

  let rowBottom = yTop - titleArea;
  const maxBehind = Math.max(...members.map((m) => m.amountBehind), 1);

  for (const m of members) {
    rowBottom -= barH + gap;
    const barW = (m.amountBehind / maxBehind) * barMaxW;
    const barColor =
      m.monthsBehind > 6 ? NAVY_DARK : m.monthsBehind <= 3 ? GOLD : NAVY;
    const name = truncateLabel(m.displayName, 15);
    const barX = x + labelW;
    const textBaseline = rowBottom + (barH * 2) / 5;
    page.drawText(name, {
      x,
      y: textBaseline,
      size: 8,
      font,
      color: NAVY,
    });
    page.drawRectangle({
      x: barX,
      y: rowBottom,
      width: Math.max(2, barW),
      height: Math.max(4, barH - 1),
      color: barColor,
    });
    const amt = formatCedis(m.amountBehind);
    const aw = font.widthOfTextAtSize(amt, 8);
    page.drawText(amt, {
      x: x + width - aw - 4,
      y: textBaseline,
      size: 8,
      font,
      color: NAVY,
    });
  }
}

function addChartFooter(page: PDFPage, font: PDFFont) {
  const foot = "Generated by Kpai Family Contributions Tracker";
  const foot2 = "Powered by Cimons Technologies";
  const s8 = 8;
  page.drawText(foot, { x: MARGIN, y: 30, size: s8, font, color: GRAY });
  const w2 = font.widthOfTextAtSize(foot2, s8);
  page.drawText(foot2, {
    x: A4_W - MARGIN - w2,
    y: 30,
    size: s8,
    font,
    color: GRAY,
  });
}

export async function generatePDF(reportData: ReportData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const line = (spacing = 14) => {
    y -= spacing;
    if (y < MARGIN + 72) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  const text = (
    t: string,
    opts: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> } = {}
  ) => {
    const size = opts.size ?? 11;
    const f = opts.bold ? fontBold : font;
    const color = opts.color ?? BLACK;
    page.drawText(t, { x: MARGIN, y, size, font: f, color });
    line(size + 4);
  };

  const hr = () => {
    line(8);
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_W - MARGIN, y },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    line(16);
  };

  text("KPAI FAMILY CONTRIBUTIONS", { bold: true, size: 18 });
  line(4);
  text(`Monthly Report — ${monthTitle(reportData.month)}`, { size: 13 });
  text(
    `Generated: ${reportData.generatedAt.toLocaleString("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    })}`,
    { size: 10, color: GRAY }
  );
  hr();

  const paidList = reportData.members.filter((m) => m.paidThisMonth);
  const memberCount = reportData.members.length;

  text("Summary", { bold: true, size: 12 });
  text(`Total Collected This Month: ${formatCedis(reportData.totalCollectedThisMonth)}`);
  text(`Total Collected All Time: ${formatCedis(reportData.totalCollectedAllTime)}`);
  text(`Total Outstanding: ${formatCedis(reportData.totalOutstanding)}`);
  text(`Members Paid This Month: ${paidList.length} of ${memberCount}`);
  hr();

  text("MEMBERS WHO PAID THIS MONTH", { bold: true, size: 12 });
  line(6);
  text("Name | Amount Paid | Status", { bold: true, size: 9, color: GRAY });
  for (const m of paidList) {
    text(
      `✓ ${m.displayName}  |  ${formatCedis(m.amountPaidThisMonth)}  |  ${m.status}`,
      { size: 10 }
    );
  }
  if (paidList.length === 0) {
    text("— None —", { size: 10, color: GRAY });
  }
  line(12);
  hr();

  const unpaid = reportData.members
    .filter((m) => !m.paidThisMonth && m.balance > 0.01)
    .sort((a, b) => b.balance - a.balance);

  text("MEMBERS YET TO PAY", { bold: true, size: 12 });
  line(6);
  text("Name | Amount Behind | Months Behind", { bold: true, size: 9, color: GRAY });
  for (const m of unpaid) {
    const monthsBehind = Math.max(
      1,
      Math.ceil(m.balance / DEFAULT_MONTHLY_RATE)
    );
    text(
      `${m.displayName}  |  ${formatCedis(m.balance)}  |  ${monthsBehind}`,
      { size: 10 }
    );
  }
  if (unpaid.length === 0) {
    text("— None in this category —", { size: 10, color: GRAY });
  }

  line(24);
  text("Generated by Kpai Family Contributions Tracker", {
    size: 9,
    color: GRAY,
  });
  text("Powered by Cimons Technologies", { size: 9, color: GRAY });

  const paidCount = reportData.members.filter((m) => m.paidThisMonth).length;
  const totalCount = reportData.members.length;
  const unpaidCount = Math.max(0, totalCount - paidCount);
  const monthName = monthTitle(reportData.month);
  const chartAreaWidth = (A4_W - MARGIN * 3) / 2;
  const chartAreaHeight = 320;
  const chartYTop = 750;

  const chartPage1 = doc.addPage([A4_W, A4_H]);
  chartPage1.drawText("Kpai Family Contributions — Visual Summary", {
    x: MARGIN,
    y: 800,
    size: 13,
    font: fontBold,
    color: NAVY,
  });
  chartPage1.drawText(`Report: ${monthName}`, {
    x: MARGIN,
    y: 782,
    size: 10,
    font,
    color: GRAY,
  });
  chartPage1.drawLine({
    start: { x: MARGIN, y: 775 },
    end: { x: A4_W - MARGIN, y: 775 },
    color: AXIS_GRAY,
    thickness: 0.5,
  });

  drawCollectedVsOutstandingChart(
    chartPage1,
    font,
    fontBold,
    MARGIN,
    chartYTop,
    chartAreaWidth,
    chartAreaHeight,
    reportData.totalCollectedAllTime,
    reportData.totalOutstanding
  );
  drawPaidVsUnpaidPieChart(
    chartPage1,
    font,
    fontBold,
    MARGIN * 2 + chartAreaWidth,
    chartYTop,
    chartAreaWidth,
    chartAreaHeight,
    paidCount,
    unpaidCount,
    totalCount
  );
  addChartFooter(chartPage1, font);

  const chartPage2 = doc.addPage([A4_W, A4_H]);
  chartPage2.drawText("Kpai Family Contributions — Visual Summary", {
    x: MARGIN,
    y: 800,
    size: 13,
    font: fontBold,
    color: NAVY,
  });
  chartPage2.drawText(`Report: ${monthName} (continued)`, {
    x: MARGIN,
    y: 782,
    size: 10,
    font,
    color: GRAY,
  });
  chartPage2.drawLine({
    start: { x: MARGIN, y: 775 },
    end: { x: A4_W - MARGIN, y: 775 },
    color: AXIS_GRAY,
    thickness: 0.5,
  });

  drawMonthlyTrendChart(
    chartPage2,
    font,
    fontBold,
    MARGIN,
    chartYTop,
    chartAreaWidth,
    chartAreaHeight,
    reportData.monthlyTrend
  );
  drawTopBehindChart(
    chartPage2,
    font,
    fontBold,
    MARGIN * 2 + chartAreaWidth,
    chartYTop,
    chartAreaWidth,
    chartAreaHeight,
    reportData.topBehindMembers
  );
  addChartFooter(chartPage2, font);

  return doc.save();
}