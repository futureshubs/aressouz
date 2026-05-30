import { describe, expect, it } from "vitest";
import {
  chatImageFallbackLabel,
  chatMessagePreviewText,
  isChatImageMessage,
} from "./chatMessageDisplay";

describe("chatMessageDisplay", () => {
  it("detects image by URL", () => {
    expect(isChatImageMessage("text", "https://cdn.example/a.jpg")).toBe(true);
  });

  it("preview text for image with caption", () => {
    expect(
      chatMessagePreviewText("https://x/y.png", "image", "Salom"),
    ).toBe("📷 Salom");
  });

  it("preview text for plain message", () => {
    expect(chatMessagePreviewText("Assalomu alaykum", "text")).toBe(
      "Assalomu alaykum",
    );
  });

  it("image fallback labels", () => {
    expect(chatImageFallbackLabel(true)).toBe("To'lov cheki (rasm)");
    expect(chatImageFallbackLabel(false, "Savol")).toBe("Savol");
  });
});
