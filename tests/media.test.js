import { describe, expect, it } from "vitest";
import { sanitizeSvgText } from "../js/features/media.js";

describe("sanitizeSvgText", () => {
  it("removes executable and external SVG content", () => {
    const sanitized = sanitizeSvgText(`
      <svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">
        <script>alert(1)</script>
        <foreignObject><iframe src="https://example.com"></iframe></foreignObject>
        <path d="M0 0" onclick="alert(2)" fill="url(javascript:alert(3))" />
        <path d="M1 1" fill="#fff" />
      </svg>
    `);

    expect(sanitized).toContain('d="M1 1"');
    expect(sanitized).not.toMatch(
      /script|foreignObject|iframe|onload|onclick|javascript/i,
    );
  });

  it("rejects malformed or non-SVG documents", () => {
    expect(sanitizeSvgText("<html><body>bad</body></html>")).toBeNull();
    expect(sanitizeSvgText("<svg>")).toBeNull();
  });
});
