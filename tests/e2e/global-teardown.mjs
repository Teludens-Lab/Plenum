export default async function globalTeardown() {
  try {
    const port = Number(process.env.PLENUM_E2E_PORT ?? 4173);
    const response = await fetch(`http://127.0.0.1:${port}/__test__/shutdown`, {
      method: "POST",
      signal: AbortSignal.timeout(5_000)
    });
    if (response.status !== 204) throw new Error(`E2E fixture shutdown returned ${response.status}`);
  } catch (error) {
    if (error?.cause?.code === "ECONNREFUSED") return;
    throw error;
  }
}
