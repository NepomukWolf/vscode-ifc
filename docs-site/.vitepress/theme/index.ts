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
    });
  },
};
