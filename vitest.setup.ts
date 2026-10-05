import "@testing-library/jest-dom/vitest";

// jsdom does not implement Element.scrollTo; the Drawer scrolls its body to
// the top on open. A no-op keeps component tests focused on behavior.
if (typeof Element !== "undefined" && typeof Element.prototype.scrollTo !== "function") {
  Element.prototype.scrollTo = () => {};
}
