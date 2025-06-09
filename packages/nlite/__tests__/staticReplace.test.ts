import {
  staticAssignementReplace,
  convertNliteToStatic,
  getStaticImports
} from "../src/utils";

describe("staticReplace", () => {
  it("staticReplace", () => {
    const inputs = [
      {
        out: `import{a as t}from "../static/utils.js";`,
        in: `import{a as t}from"/_nlite/utils.js";`
      },
      {
        out: `import p from "../static/components/Button.js";`,
        in: `import p from "/_nlite/components/Button.js";`
      },
      {
        out: `import{a}from "../static/a.js";import b from "../static/b.js";`,
        in: `import{a}from"/_nlite/a.js";import b from '/_nlite/b.js';`
      },
      {
        out: `asdf sdf import p from "../static/components/Button.js";`,
        in: `asdf sdf import p from'/_nlite/components/Button.js';`
      },
      {
        out: `import{a as t,c as r,d as e}from"./chunks/[chunk]-FKJSE54G.js";import p from "../static/Counter.js"`,
        in: `import{a as t,c as r,d as e}from"./chunks/[chunk]-FKJSE54G.js";import p from "/_nlite/Counter.js"`
      }
    ];

    inputs.forEach((input) => {
      const output = convertNliteToStatic(input.in);
      expect(output).toBe(input.out);
    });
  });
});

describe("static assignement replace", () => {
  it("static assignement replace", () => {
    const inputs = [
      {
        in: `om"react";var r ="../static/media/[react]-HMCELI6U.svg";"react";var r ="../static/me"`,
        out: `om"react";var r = "/_nlite/media/[react]-HMCELI6U.svg";"react";var r = "/_nlite/me"`
      },
      {
        in: `om"react";const r= "../static/media/[react]-HMCELI6U.svg";`,
        out: `om"react";const r = "/_nlite/media/[react]-HMCELI6U.svg";`
      },
      {
        in: `om"react";let r= "../static/media/[react]-HMCELI6U.svg";`,
        out: `om"react";let r = "/_nlite/media/[react]-HMCELI6U.svg";`
      },
      {
        in: `om"react";let r= "../static/media/[react]-HMCELI6U.svg"asdfj`,
        out: `om"react";let r = "/_nlite/media/[react]-HMCELI6U.svg"asdfj`
      }
    ];
    inputs.forEach((input) => {
      const output = staticAssignementReplace(input.in);
      expect(output).toBe(input.out);
    });

    const staticInputs = [
      {
        in: `var react_default = "./media/react-HMCELI6U.svg";`,
        out: `var react_default = "/_nlite/media/react-HMCELI6U.svg";`
      },
      {
        in: `var react_default = "../media/react-HMCELI6U.svg";`,
        out: `var react_default = "/_nlite/media/react-HMCELI6U.svg";`
      }
    ];

    staticInputs.forEach((input) => {
      const output = staticAssignementReplace(input.in, "static");
      expect(output).toBe(input.out);
    });
  });
});

describe("Get static imports", () => {
  it("Get static imports", () => {
    const inputs = [
      {
        in: `import { a } from"/_nlite/a.js";`,
        out: ["/_nlite/a.js"]
      },
      {
        in: `import { a } from "/_nlite/a.js";import { b } from"/_nlite/b.js";`,
        out: ["/_nlite/a.js", "/_nlite/b.js"]
      },
      {
        in: `import { a } from"/_nlite/a.js";
         import { b }from "/_nlite/b.js";import { c } from"/_nlite/c.js";`,
        out: ["/_nlite/a.js", "/_nlite/b.js", "/_nlite/c.js"]
      },
      {
        in: `import { a } from "/_nlite/a.js";import { b } from "/_nlite/b.js";import { c } from "/_nlite/c.js";import { d } from "/_nlite/d.js";`,
        out: ["/_nlite/a.js", "/_nlite/b.js", "/_nlite/c.js", "/_nlite/d.js"]
      },
      {
        in: `import { a } from "/_nlite/a.js";import { b } from "/_nlite/b.js";import { c } from "/_nlite/c.js";import { d } from "/_nlite/d.js";import { e } from "/_nlite/e.js";`,
        out: [
          "/_nlite/a.js",
          "/_nlite/b.js",
          "/_nlite/c.js",
          "/_nlite/d.js",
          "/_nlite/e.js"
        ]
      },
      {
        in: `import { a }from"/_nlite/a.js";import { b } from"/_nlite/b.js";import { c } from '/_nlite/c.js';import { d } from'/_nlite/d.js';import { e } from "/_nlite/e.js";import { f } from "/_nlite/f.js";`,
        out: [
          "/_nlite/a.js",
          "/_nlite/b.js",
          "/_nlite/c.js",
          "/_nlite/d.js",
          "/_nlite/e.js",
          "/_nlite/f.js"
        ]
      }
    ];
    inputs.forEach((input) => {
      const output = getStaticImports(input.in);
      expect(output).toEqual(input.out);
    });
  });
});
