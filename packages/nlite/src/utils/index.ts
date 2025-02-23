export const parseValidPositiveInteger = (value: string) => {
  const parsedValue = parseInt(value, 10);

  if (isNaN(parsedValue) || !isFinite(parsedValue) || parsedValue < 0) {
    throw new Error(`'${value}' is not a non-negative number.`);
  }
  return parsedValue;
};

export const printAndExit = (message: string, code = 1) => {
  if (code === 0) {
    console.log(message);
  } else {
    console.error(message);
  }

  return process.exit(code);
};
