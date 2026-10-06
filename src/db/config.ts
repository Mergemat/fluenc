function requireEnvironmentVariable(
  name: "TURSO_DATABASE_URL" | "TURSO_AUTH_TOKEN"
) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export function getTursoCredentials() {
  return {
    url: requireEnvironmentVariable("TURSO_DATABASE_URL"),
    authToken: requireEnvironmentVariable("TURSO_AUTH_TOKEN"),
  };
}
