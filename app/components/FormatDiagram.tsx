"use client";

import { useId } from "react";

export type DiagramNode = {
  title: string;
  detail?: string;
};

export type DiagramStep = {
  nodes: DiagramNode[];
};

type Box = DiagramNode & {
  x: number;
  y: number;
  width: number;
  height: number;
};

const TITLE_COLOR = "#e2e8f0";
const DETAIL_COLOR = "#94a3b8";
const TITLE_LINE_HEIGHT = 15;
const DETAIL_LINE_HEIGHT = 13;

function wrapText(text: string, maxChars: number, maxLines: number) {
  const lines: string[] = [];
  let line = "";

  for (const word of text.split(" ")) {
    const candidate = line ? `${line} ${word}` : word;

    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines.slice(0, maxLines);
}

function boxLines(box: Box) {
  const titleLines = wrapText(
    box.title,
    Math.floor((box.width - 14) / 6.4),
    2
  );

  const detailLines = box.detail
    ? wrapText(box.detail, Math.floor((box.width - 14) / 5.1), 3)
    : [];

  const textHeight =
    titleLines.length * TITLE_LINE_HEIGHT +
    (detailLines.length ? 3 + detailLines.length * DETAIL_LINE_HEIGHT : 0);

  return {
    titleLines,
    detailLines,
    top: box.y + (box.height - textHeight) / 2 + 12,
  };
}

/*
 * Connect every output of one step to the inputs of the next.
 * Equal counts stay on their own track so parallel pools never cross.
 */
function connect(from: Box[], to: Box[]) {
  if (from.length === to.length) {
    return from.map((source, index) => ({ source, target: to[index] }));
  }

  return from.flatMap((source) =>
    to.map((target) => ({ source, target }))
  );
}

function BoxText({ box }: { box: Box }) {
  const { titleLines, detailLines, top } = boxLines(box);
  const centerX = box.x + box.width / 2;
  const detailTop = top + titleLines.length * TITLE_LINE_HEIGHT + 3;

  return (
    <>
      {titleLines.map((line, index) => {
        const y = top + index * TITLE_LINE_HEIGHT;

        return (
          <text
            key={`title-${line}-${y}`}
            x={centerX}
            y={y}
            textAnchor="middle"
            fontSize={12.5}
            fontWeight={700}
            fill={TITLE_COLOR}
          >
            {line}
          </text>
        );
      })}

      {detailLines.map((line, index) => {
        const y = detailTop + index * DETAIL_LINE_HEIGHT;

        return (
          <text
            key={`detail-${line}-${y}`}
            x={centerX}
            y={y}
            textAnchor="middle"
            fontSize={10.5}
            fill={DETAIL_COLOR}
          >
            {line}
          </text>
        );
      })}
    </>
  );
}

/*
 * Line drawing of a tournament lifecycle. Steps with two nodes are drawn
 * as parallel tracks, which is how the split-pair pools and the team
 * group stage actually run.
 */
export default function FormatDiagram({
  steps,
  accent = "#34d399",
  label,
}: {
  steps: DiagramStep[];
  accent?: string;
  label: string;
}) {
  const markerId = `format-arrow-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  const wide = steps.length >= 6;
  const boxWidth = wide ? 132 : 150;
  const columnGap = wide ? 34 : 44;
  const rowHeight = 200;

  const horizontalBoxes = steps.map((step, index) => {
    const x = index * (boxWidth + columnGap);

    if (step.nodes.length === 1) {
      return [{ ...step.nodes[0], x, y: 58, width: boxWidth, height: 84 }];
    }

    return step.nodes.map((node, nodeIndex) => ({
      ...node,
      x,
      y: nodeIndex === 0 ? 12 : 104,
      width: boxWidth,
      height: 84,
    }));
  });

  const horizontalWidth =
    steps.length * boxWidth + (steps.length - 1) * columnGap;

  const verticalWidth = 300;
  const verticalRowHeight = 88;
  const verticalGap = 46;

  const verticalBoxes = steps.map((step, index) => {
    const y = index * (verticalRowHeight + verticalGap);

    if (step.nodes.length === 1) {
      return [
        {
          ...step.nodes[0],
          x: 20,
          y,
          width: 260,
          height: verticalRowHeight,
        },
      ];
    }

    return step.nodes.map((node, nodeIndex) => ({
      ...node,
      x: nodeIndex === 0 ? 0 : 158,
      y,
      width: 142,
      height: verticalRowHeight,
    }));
  });

  const verticalHeight =
    steps.length * verticalRowHeight + (steps.length - 1) * verticalGap;

  const arrowMarker = (
    <defs>
      <marker
        id={markerId}
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill={accent} />
      </marker>
    </defs>
  );

  const renderBoxes = (boxes: Box[]) =>
    boxes.map((box) => (
      <g key={`${box.title}-${box.x}-${box.y}`}>
        <rect
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          rx={12}
          fill="none"
          stroke={accent}
          strokeWidth={1.5}
          strokeOpacity={0.85}
        />
        <BoxText box={box} />
      </g>
    ));

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <svg
        viewBox={`0 0 ${horizontalWidth} ${rowHeight}`}
        width="100%"
        role="img"
        aria-label={label}
        className="hidden sm:block"
      >
        {arrowMarker}

        {horizontalBoxes.slice(0, -1).flatMap((boxes, index) =>
          connect(boxes, horizontalBoxes[index + 1]).map(
            ({ source, target }) => {
              const x1 = source.x + source.width;
              const y1 = source.y + source.height / 2;
              const x2 = target.x - 1;
              const y2 = target.y + target.height / 2;

              return (
                <path
                  key={`h-${x1}-${y1}-${x2}-${y2}`}
                  d={`M ${x1} ${y1} C ${x1 + 18} ${y1}, ${x2 - 18} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={accent}
                  strokeWidth={1.5}
                  strokeOpacity={0.55}
                  markerEnd={`url(#${markerId})`}
                />
              );
            }
          )
        )}

        {horizontalBoxes.flatMap(renderBoxes)}
      </svg>

      <svg
        viewBox={`0 0 ${verticalWidth} ${verticalHeight}`}
        width="100%"
        role="img"
        aria-label={label}
        className="sm:hidden"
      >
        {arrowMarker}

        {verticalBoxes.slice(0, -1).flatMap((boxes, index) =>
          connect(boxes, verticalBoxes[index + 1]).map(
            ({ source, target }) => {
              const x1 = source.x + source.width / 2;
              const y1 = source.y + source.height;
              const x2 = target.x + target.width / 2;
              const y2 = target.y - 1;

              return (
                <path
                  key={`v-${x1}-${y1}-${x2}-${y2}`}
                  d={`M ${x1} ${y1} C ${x1} ${y1 + 20}, ${x2} ${y2 - 20}, ${x2} ${y2}`}
                  fill="none"
                  stroke={accent}
                  strokeWidth={1.5}
                  strokeOpacity={0.55}
                  markerEnd={`url(#${markerId})`}
                />
              );
            }
          )
        )}

        {verticalBoxes.flatMap(renderBoxes)}
      </svg>
    </div>
  );
}
