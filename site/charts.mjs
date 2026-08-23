/**
 * SVG chart primitives for the site. D58.
 *
 * Inline SVG, no library, no script. Three reasons rather than minimalism for its
 * own sake: a chart that needs JavaScript is a chart that does not exist in a
 * feed reader or a printout, the data is generated at build time so there is
 * nothing to animate, and a dependency here would be the only one in the project.
 *
 * The palette is the constraint that shapes everything else. Black and white means
 * series cannot be told apart by hue, so they are told apart the way a printed
 * paper does it: solid against dashed, filled against hollow, and a direct label
 * on the line instead of a legend the eye has to travel to.
 */

const FONT = 'font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif"';

const escape = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Round to 2dp so the emitted markup does not carry float noise. */
const n = (value) => Math.round(value * 100) / 100;

/**
 * A line chart with one or more series over a shared x axis.
 *
 * `series[].dash` distinguishes lines; `series[].label` is placed at the line's own
 * end point, which is what removes the need for a legend.
 */
export function lineChart({
  width = 640,
  height = 260,
  pad = { top: 18, right: 96, bottom: 34, left: 44 },
  xLabel = '',
  yLabel = '',
  xTicks = [],
  yTicks = [],
  domain,
  range,
  series = [],
  bands = [],
  title = '',
}) {
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const [x0, x1] = domain;
  const [y0, y1] = range;
  const sx = (value) => pad.left + ((value - x0) / (x1 - x0)) * plotW;
  const sy = (value) => pad.top + plotH - ((value - y0) / (y1 - y0)) * plotH;

  const parts = [];

  // Horizontal band shading, for the decision bands. Hatching rather than fill,
  // so a band never competes with a data line for attention.
  for (const band of bands) {
    const top = sy(band.to);
    const bottom = sy(band.from);
    parts.push(
      `<rect x="${n(pad.left)}" y="${n(top)}" width="${n(plotW)}" height="${n(bottom - top)}" fill="url(#hatch)" opacity="${band.opacity ?? 0.5}"/>`,
    );
    if (band.label) {
      parts.push(
        `<text x="${n(pad.left + plotW - 4)}" y="${n(top + (bottom - top) / 2 + 3)}" text-anchor="end" class="c-band" ${FONT}>${escape(band.label)}</text>`,
      );
    }
  }

  // Axes. Only two lines: a grid dense enough to read values off is a grid that
  // makes the data harder to see.
  parts.push(
    `<line x1="${n(pad.left)}" y1="${n(pad.top)}" x2="${n(pad.left)}" y2="${n(pad.top + plotH)}" class="c-axis"/>`,
    `<line x1="${n(pad.left)}" y1="${n(pad.top + plotH)}" x2="${n(pad.left + plotW)}" y2="${n(pad.top + plotH)}" class="c-axis"/>`,
  );

  for (const tick of yTicks) {
    const y = sy(tick.at ?? tick);
    parts.push(
      `<line x1="${n(pad.left - 4)}" y1="${n(y)}" x2="${n(pad.left)}" y2="${n(y)}" class="c-axis"/>`,
      `<text x="${n(pad.left - 8)}" y="${n(y + 3.5)}" text-anchor="end" class="c-tick" ${FONT}>${escape(tick.label ?? tick)}</text>`,
    );
  }
  for (const tick of xTicks) {
    const x = sx(tick.at ?? tick);
    parts.push(
      `<line x1="${n(x)}" y1="${n(pad.top + plotH)}" x2="${n(x)}" y2="${n(pad.top + plotH + 4)}" class="c-axis"/>`,
      `<text x="${n(x)}" y="${n(pad.top + plotH + 16)}" text-anchor="middle" class="c-tick" ${FONT}>${escape(tick.label ?? tick)}</text>`,
    );
  }

  if (yLabel) {
    parts.push(
      `<text x="${n(pad.left)}" y="${n(pad.top - 6)}" class="c-tick" ${FONT}>${escape(yLabel)}</text>`,
    );
  }
  if (xLabel) {
    parts.push(
      `<text x="${n(pad.left + plotW)}" y="${n(height - 4)}" text-anchor="end" class="c-tick" ${FONT}>${escape(xLabel)}</text>`,
    );
  }

  for (const line of series) {
    const points = line.points.map(([x, y]) => `${n(sx(x))},${n(sy(y))}`).join(' ');
    parts.push(
      `<polyline points="${points}" fill="none" class="c-line" stroke-width="${line.weight ?? 1.6}"${line.dash ? ` stroke-dasharray="${line.dash}"` : ''}/>`,
    );
    if (line.marks) {
      for (const [x, y] of line.points) {
        parts.push(
          `<circle cx="${n(sx(x))}" cy="${n(sy(y))}" r="2" class="${line.hollow ? 'c-dot-hollow' : 'c-dot'}"/>`,
        );
      }
    }
    const last = line.points.at(-1);
    if (line.label && last) {
      parts.push(
        `<text x="${n(sx(last[0]) + 6)}" y="${n(sy(last[1]) + 3.5)}" class="c-series" ${FONT}>${escape(line.label)}</text>`,
      );
    }
  }

  return frame({ width, height, title, body: parts.join('\n    ') });
}

/**
 * A horizontal bar chart. Used where the x axis is a category rather than a
 * quantity — abuse calls per farm interval, requests per client.
 */
export function barChart({
  width = 640,
  rowHeight = 24,
  pad = { top: 16, right: 56, bottom: 26, left: 150 },
  max,
  rows = [],
  xLabel = '',
  xTicks = [],
  title = '',
}) {
  const height = pad.top + rows.length * rowHeight + pad.bottom;
  const plotW = width - pad.left - pad.right;
  const sx = (value) => pad.left + (value / max) * plotW;
  const parts = [];

  for (const tick of xTicks) {
    const x = sx(tick.at ?? tick);
    parts.push(
      `<line x1="${n(x)}" y1="${n(pad.top - 4)}" x2="${n(x)}" y2="${n(pad.top + rows.length * rowHeight)}" class="c-grid"/>`,
      `<text x="${n(x)}" y="${n(pad.top + rows.length * rowHeight + 14)}" text-anchor="middle" class="c-tick" ${FONT}>${escape(tick.label ?? tick)}</text>`,
    );
  }

  rows.forEach((row, index) => {
    const y = pad.top + index * rowHeight;
    const barH = rowHeight - 9;
    parts.push(
      `<text x="${n(pad.left - 8)}" y="${n(y + barH - 1)}" text-anchor="end" class="c-tick" ${FONT}>${escape(row.label)}</text>`,
    );
    // A hollow bar is the "before" reading and a solid one the "after", so a pair
    // reads as a change without needing two colours.
    parts.push(
      `<rect x="${n(pad.left)}" y="${n(y)}" width="${n(Math.max(1, sx(row.value) - pad.left))}" height="${barH}" class="${row.hollow ? 'c-bar-hollow' : 'c-bar'}"/>`,
    );
    parts.push(
      `<text x="${n(sx(row.value) + 6)}" y="${n(y + barH - 1)}" class="c-value" ${FONT}>${escape(row.value_label ?? row.value)}</text>`,
    );
  });

  if (xLabel) {
    parts.push(
      `<text x="${n(width - pad.right)}" y="${n(height - 4)}" text-anchor="end" class="c-tick" ${FONT}>${escape(xLabel)}</text>`,
    );
  }

  return frame({ width, height, title, body: parts.join('\n    ') });
}

/**
 * A stepped chart for the decision spectrum: five rungs, drawn as the staircase
 * the model actually is rather than as a smooth curve it is not.
 */
export function stepChart({
  width = 640,
  height = 200,
  pad = { top: 18, right: 96, bottom: 34, left: 132 },
  rungs = [],
  domain,
  series = [],
  xLabel = '',
  xTicks = [],
  title = '',
}) {
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const [x0, x1] = domain;
  const sx = (value) => pad.left + ((value - x0) / (x1 - x0)) * plotW;
  const step = plotH / Math.max(1, rungs.length - 1);
  const sy = (index) => pad.top + plotH - index * step;
  const parts = [];

  rungs.forEach((rung, index) => {
    const y = sy(index);
    parts.push(
      `<line x1="${n(pad.left)}" y1="${n(y)}" x2="${n(pad.left + plotW)}" y2="${n(y)}" class="c-grid"/>`,
      `<text x="${n(pad.left - 8)}" y="${n(y + 3.5)}" text-anchor="end" class="c-tick" ${FONT}>${escape(rung)}</text>`,
    );
  });

  for (const tick of xTicks) {
    const x = sx(tick.at ?? tick);
    parts.push(
      `<text x="${n(x)}" y="${n(pad.top + plotH + 16)}" text-anchor="middle" class="c-tick" ${FONT}>${escape(tick.label ?? tick)}</text>`,
    );
  }

  for (const line of series) {
    const path = [];
    line.points.forEach(([x, rung], index) => {
      const px = sx(x);
      const py = sy(rung);
      if (index === 0) path.push(`M ${n(px)} ${n(py)}`);
      else {
        const [, prevRung] = line.points[index - 1];
        path.push(`L ${n(px)} ${n(sy(prevRung))}`, `L ${n(px)} ${n(py)}`);
      }
    });
    parts.push(
      `<path d="${path.join(' ')}" fill="none" class="c-line" stroke-width="${line.weight ?? 1.6}"${line.dash ? ` stroke-dasharray="${line.dash}"` : ''}/>`,
    );
    const last = line.points.at(-1);
    if (line.label && last) {
      parts.push(
        `<text x="${n(sx(last[0]) + 6)}" y="${n(sy(last[1]) + 3.5)}" class="c-series" ${FONT}>${escape(line.label)}</text>`,
      );
    }
  }

  if (xLabel) {
    parts.push(
      `<text x="${n(pad.left + plotW)}" y="${n(height - 4)}" text-anchor="end" class="c-tick" ${FONT}>${escape(xLabel)}</text>`,
    );
  }

  return frame({ width, height, title, body: parts.join('\n    ') });
}

function frame({ width, height, title, body }) {
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img"${title ? ` aria-label="${escape(title)}"` : ' aria-hidden="true"'} preserveAspectRatio="xMidYMid meet">
    <defs>
      <pattern id="hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="0" y2="6" class="c-hatch"/>
      </pattern>
    </defs>
    ${body}
  </svg>`;
}
