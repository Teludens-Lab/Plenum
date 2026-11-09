import { bootstrapBlank } from "../golden-journey/bootstrap.mjs";

export default async function bootstrap() {
  await bootstrapBlank({ databasePattern: /^\/plenum_ps840_browser[0-9]+$/u,
    evidenceDirectory: "test-results/uat", organizationName: "PS-840 synthetic UAT Organization", identityPrefix: "ps840" });
}
