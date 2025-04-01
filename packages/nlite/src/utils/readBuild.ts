import { parse } from "path";

export const getFileName = (path: string) => {
  const file = parse(path).name;
  const name = file.split("]")[0].replace("[", "");
  return name;
};
