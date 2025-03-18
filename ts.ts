const ab = {
  inputs: {
    "src/App.css": {
      bytes: 578,
      imports: []
    },
    "src/index.css": {
      bytes: 1195,
      imports: []
    },
    "src/assets/react.svg": {
      bytes: 4126,
      imports: []
    },
    "src/compoents/Card.tsx": {
      bytes: 333,
      imports: [
        {
          path: "react",
          kind: "import-statement",
          external: true
        },
        {
          path: "react/jsx-runtime",
          kind: "import-statement",
          external: true
        }
      ],
      format: "esm"
    },
    "src/home.tsx": {
      bytes: 1094,
      imports: [
        {
          path: "react",
          kind: "import-statement",
          external: true
        },
        {
          path: "src/App.css",
          kind: "import-statement",
          original: "./App.css"
        },
        {
          path: "src/index.css",
          kind: "import-statement",
          original: "./index.css"
        },
        {
          path: "src/assets/react.svg",
          kind: "import-statement",
          original: "./assets/react.svg"
        },
        {
          path: "src/compoents/Card.tsx",
          kind: "import-statement",
          original: "./compoents/Card"
        },
        {
          path: "react/jsx-runtime",
          kind: "import-statement",
          external: true
        }
      ],
      format: "esm"
    },
    "src/about.tsx": {
      bytes: 588,
      imports: [
        {
          path: "react",
          kind: "import-statement",
          external: true
        },
        {
          path: "react/jsx-runtime",
          kind: "import-statement",
          external: true
        }
      ],
      format: "esm"
    },
    "src/layout.tsx": {
      bytes: 213,
      imports: [
        {
          path: "react",
          kind: "import-statement",
          external: true
        },
        {
          path: "react/jsx-runtime",
          kind: "import-statement",
          external: true
        }
      ],
      format: "esm"
    },
    "src/company.tsx": {
      bytes: 109,
      imports: [
        {
          path: "react",
          kind: "import-statement",
          external: true
        },
        {
          path: "react/jsx-runtime",
          kind: "import-statement",
          external: true
        }
      ],
      format: "esm"
    }
  },
  outputs: {
    ".nlite/static/media/react-HMCELI6U.svg": {
      imports: [],
      exports: [],
      inputs: {
        "src/assets/react.svg": {
          bytesInOutput: 4126
        }
      },
      bytes: 4126
    },
    ".nlite/server/home-LM3NHRDH.js": {
      imports: [
        {
          path: "react",
          kind: "import-statement",
          external: true
        },
        {
          path: ".nlite/static/media/react-HMCELI6U.svg",
          kind: "file-loader"
        },
        {
          path: "react/jsx-runtime",
          kind: "import-statement",
          external: true
        },
        {
          path: "react/jsx-runtime",
          kind: "import-statement",
          external: true
        }
      ],
      exports: ["default", "layout"],
      entryPoint: "src/home.tsx",
      cssBundle: ".nlite/server/home-YFJYXNX5.css",
      inputs: {
        "src/home.tsx": {
          bytesInOutput: 793
        },
        "src/App.css": {
          bytesInOutput: 0
        },
        "src/index.css": {
          bytesInOutput: 0
        },
        "src/assets/react.svg": {
          bytesInOutput: 48
        },
        "src/compoents/Card.tsx": {
          bytesInOutput: 292
        }
      },
      bytes: 1167
    },
    ".nlite/server/about-N76UHA5C.js": {
      imports: [
        {
          path: "react/jsx-runtime",
          kind: "import-statement",
          external: true
        }
      ],
      exports: ["default", "layout", "loading"],
      entryPoint: "src/about.tsx",
      inputs: {
        "src/about.tsx": {
          bytesInOutput: 426
        }
      },
      bytes: 473
    },
    ".nlite/server/layout-Q4K2IA3R.js": {
      imports: [
        {
          path: "react/jsx-runtime",
          kind: "import-statement",
          external: true
        }
      ],
      exports: ["default"],
      entryPoint: "src/layout.tsx",
      inputs: {
        "src/layout.tsx": {
          bytesInOutput: 133
        }
      },
      bytes: 155
    },
    ".nlite/server/company-V2UB3HIR.js": {
      imports: [
        {
          path: "react/jsx-runtime",
          kind: "import-statement",
          external: true
        }
      ],
      exports: ["default"],
      entryPoint: "src/company.tsx",
      inputs: {
        "src/company.tsx": {
          bytesInOutput: 84
        }
      },
      bytes: 106
    },
    ".nlite/server/home-YFJYXNX5.css": {
      imports: [],
      inputs: {
        "src/App.css": {
          bytesInOutput: 452
        },
        "src/index.css": {
          bytesInOutput: 946
        }
      },
      bytes: 1399
    }
  }
};
