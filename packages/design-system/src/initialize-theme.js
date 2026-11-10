try {
  const storedTheme = localStorage.getItem("plenum.theme");
  document.documentElement.dataset.theme = ["dark", "light"].includes(storedTheme)
    ? storedTheme : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
} catch {
  document.documentElement.dataset.theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
