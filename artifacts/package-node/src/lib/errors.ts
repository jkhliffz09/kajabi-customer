export function describeUnknownError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  try {
    const serialized = JSON.stringify(error);
    return serialized ?? String(error);
  } catch {
    return String(error);
  }
}
