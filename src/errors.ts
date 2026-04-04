/** Error when an RDS file is malformed or has an unsupported header. */
export class RdsError extends Error {
  override readonly name = "RdsError";
}

/** Error when the parser encounters an R type it does not support. */
export class UnsupportedTypeError extends Error {
  override readonly name = "UnsupportedTypeError";

  constructor(
    message: string,
    readonly sexpType: number,
  ) {
    super(message);
  }
}
