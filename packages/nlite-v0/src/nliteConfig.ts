import { Plugin } from "esbuild";

export type NliteConfig = {
  plugins?: Plugin[];
};

export const nliteConfig = (config: NliteConfig) => {
  return {
    ...config,
    envPrefix: "NLITE_"
  };
};
