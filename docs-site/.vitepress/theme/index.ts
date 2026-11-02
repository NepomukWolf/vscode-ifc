import DefaultTheme from "vitepress/theme";
import { h } from "vue";
import "./custom.css";

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      "aside-outline-after": () =>
        h("div", { class: "aside-logo" }, [
          h("img", {
            src: "/vscode-ifc/assets/logo.svg",
            alt: "IFC Language Tools logo",
          }),
        ]),
      "layout-bottom": () =>
        h("footer", { class: "site-footer" }, [
          h("span", `© ${new Date().getFullYear()} Nepomuk Wolf`),
          h("a", { href: "/vscode-ifc/licenses" }, "Licenses"),
          h("a", { href: "/vscode-ifc/imprint" }, "Imprint"),
        ]),
    });
  },
};
