// @ts-check
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");

module.exports = tseslint.config(
  {
    files: ["**/*.ts"],
    ignores: ["projects/**/*"],
    extends: [...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      "@angular-eslint/prefer-standalone": "off",
      // shortcut: injecao via constructor e *ngIf/*ngFor mantidos (mesma estilistica
      // do template base); migrar para inject() + @if/@for quando estabilizar em dispositivo real
      "@angular-eslint/prefer-inject": "off",
      "@angular-eslint/prefer-control-flow": "off",
      "@angular-eslint/component-class-suffix": [
        "error",
        { suffixes: ["Page", "Component"] },
      ],
      "@angular-eslint/component-selector": [
        "error",
        { type: "element", prefix: "app", style: "kebab-case" },
      ],
      "@angular-eslint/directive-selector": [
        "error",
        { type: "attribute", prefix: "app", style: "camelCase" },
      ],
    },
  },
  {
    files: ["**/*.html"],
    extends: [...angular.configs.templateRecommended],
    rules: {
      // ver comentario no bloco TS: *ngIf/*ngFor mantidos de proposito
      "@angular-eslint/template/prefer-control-flow": "off",
    },
  }
);
