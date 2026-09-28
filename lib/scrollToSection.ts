export function scrollToSection(id: string) {
  const node = document.getElementById(id);

  if (!node) {
    return;
  }

  const top = node.getBoundingClientRect().top;
  const alreadyInView = top >= 0 && top < window.innerHeight * 0.35;

  if (alreadyInView) {
    return;
  }

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  window.requestAnimationFrame(() => {
    node.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  });
}
