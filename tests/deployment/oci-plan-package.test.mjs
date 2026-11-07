import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const root = join(import.meta.dirname, "..", "..");
const read = (path) => readFile(join(root, path), "utf8");

test("OCI package exposes plan-only operator commands", async () => {
  const [readme, init, validate, plan] = await Promise.all([
    read("deploy/oci/README.md"),
    read("deploy/oci/scripts/init.ps1"),
    read("deploy/oci/scripts/validate.ps1"),
    read("deploy/oci/scripts/plan.ps1")
  ]);
  assert.match(readme, /plan-only/iu);
  assert.match(init, /terraform.+init/isu);
  assert.match(validate, /fmt.+validate/isu);
  assert.match(plan, /terraform.+plan/isu);
  assert.match(plan, /"-var-file=\$resolvedVarFile"/u);
  assert.match(plan, /"-out=\$planPath"/u);
  assert.doesNotMatch(`${init}\n${validate}\n${plan}`, /terraform(?:\.Source)?[^\n]*\sapply(?:\s|$)/iu);
});

test("both profiles share one immutable multi-platform release contract", async () => {
  const [variables, free, production, compose, plan] = await Promise.all([
    read("deploy/oci/variables.tf"),
    read("deploy/oci/functional-free.tf"),
    read("deploy/oci/production-parity.tf"),
    read("deploy/oci/runtime/compose.functional-free.yaml.tftpl"),
    read("deploy/oci/scripts/plan.ps1")
  ]);
  assert.match(variables, /@sha256:\[0-9a-f\]\{64\}/u);
  assert.match(variables, /linux\/amd64/u);
  assert.match(variables, /linux\/arm64/u);
  assert.match(variables, /application_contract\.deployment_id/u);
  assert.match(free, /application_image\s+=\s+var\.application_image/u);
  assert.match(production, /image_url\s+=\s+var\.application_image/u);
  assert.match(compose, /image: \$\{application_image\}/u);
  assert.match(plan, /imagetools inspect/u);
});

test("free and production cost controls fail closed", async () => {
  const [variables, free, production] = await Promise.all([
    read("deploy/oci/variables.tf"),
    read("deploy/oci/functional-free.tf"),
    read("deploy/oci/production-parity.tf")
  ]);
  assert.match(variables, /default\s+=\s+"VM\.Standard\.A1\.Flex"/u);
  assert.match(variables, /contains\(\[0, 1, 2\], var\.free_availability_domain_index\)/u);
  assert.match(free, /availability_domains\[var\.free_availability_domain_index\]\.name/u);
  assert.match(variables, /var\.free_ocpus > 0 && var\.free_ocpus <= 2/u);
  assert.match(variables, /var\.free_memory_gbs > 0 && var\.free_memory_gbs <= 12/u);
  assert.match(variables, /var\.free_boot_volume_gbs >= 50 && var\.free_boot_volume_gbs <= 200/u);
  assert.match(variables, /variable "allow_billable_resources"[\s\S]*?default\s+=\s+false/u);
  assert.match(free, /always-free-target/u);
  assert.match(production, /allow_billable_resources/u);
  assert.match(production, /prevent_destroy\s+=\s+true/u);
});

test("OCI free-form tag keys avoid forbidden periods and spaces", async () => {
  const files = await Promise.all([
    "deploy/oci/locals.tf",
    "deploy/oci/functional-free.tf",
    "deploy/oci/networking.tf",
    "deploy/oci/production-parity.tf"
  ].map(read));
  const combined = files.join("\n");
  assert.match(combined, /"plenum-managed-by"\s+=\s+"terraform"/u);
  assert.match(combined, /"plenum-cost-class"\s+=\s+"always-free-target"/u);
  assert.doesNotMatch(combined, /"plenum\./u);
});

test("Object Storage namespace lookup uses the caller tenancy without broader IAM", async () => {
  const storage = await read("deploy/oci/storage.tf");
  assert.match(storage, /data "oci_objectstorage_namespace" "current" \{\}/u);
});

test("networking exposes HTTPS, restricted SSH, and no public production data plane", async () => {
  const [network, production] = await Promise.all([
    read("deploy/oci/networking.tf"),
    read("deploy/oci/production-parity.tf")
  ]);
  assert.match(network, /destination_port_range\s*\{[^}]*min\s*=\s*443/isu);
  assert.match(network, /source\s+=\s+var\.admin_cidr/u);
  assert.doesNotMatch(network, /description\s+=\s+"Restricted staging administration"[\s\S]{0,300}source\s+=\s+"0\.0\.0\.0\/0"/u);
  assert.match(production, /is_public_ip_assigned\s+=\s+false/u);
  assert.match(production, /certificate_ids\s+=\s+\[var\.https_certificate_ocid\]/u);
  assert.match(production, /protocols\s+=\s+\["TLSv1\.2"\]/u);
});

test("functional-free routes only governed notification paths on the dedicated hostname", async () => {
  const [variables, free, caddy] = await Promise.all([
    read("deploy/oci/variables.tf"),
    read("deploy/oci/functional-free.tf"),
    read("deploy/oci/runtime/Caddyfile.tftpl")
  ]);
  assert.match(variables, /variable "notifications_hostname"/u);
  assert.match(variables, /invitation_delivery_endpoint must use notifications_hostname/u);
  assert.match(free, /notifications_hostname\s+=\s+var\.notifications_hostname/u);
  assert.match(caddy, /\$\{notifications_hostname\}[\s\S]*handle \/v1\/messages[\s\S]*handle \/v1\/events\/postmark[\s\S]*respond "Not Found" 404/u);
});

test("secret content remains outside Terraform and committed examples", async () => {
  const files = await Promise.all([
    "deploy/oci/variables.tf",
    "deploy/oci/locals.tf",
    "deploy/oci/functional-free.tf",
    "deploy/oci/production-parity.tf",
    "deploy/oci/profiles/functional-free.tfvars.example",
    "deploy/oci/profiles/production-parity.tfvars.example"
  ].map(read));
  const combined = files.join("\n");
  assert.doesNotMatch(combined, /(?:password|secret|token)\s*=\s*"(?!<|ocid1\.|REPLACE)[^"\n]+"/iu);
  assert.match(combined, /PLENUM_SECRET_BUNDLE_OCID/u);
  assert.doesNotMatch(combined, /S3_SECRET_ACCESS_KEY\s*=/u);
});

test("private GHCR pulls use one OCI Vault reference without persisting credentials", async () => {
  const [variables, free, cloudInit, helper, production, iam, freeExample, productionExample] = await Promise.all([
    read("deploy/oci/variables.tf"),
    read("deploy/oci/functional-free.tf"),
    read("deploy/oci/cloud-init/functional-free.yaml.tftpl"),
    read("deploy/oci/runtime/private-image-pull.py"),
    read("deploy/oci/production-parity.tf"),
    read("deploy/oci/IAM.md"),
    read("deploy/oci/profiles/functional-free.tfvars.example"),
    read("deploy/oci/profiles/production-parity.tfvars.example")
  ]);

  assert.match(variables, /variable "image_pull_secret_ocid"/u);
  assert.match(variables, /image_pull_secret_ocid must identify an OCI Vault secret/u);
  assert.match(free, /image_pull_secret_ocid\s+=\s+var\.image_pull_secret_ocid/u);
  assert.match(cloudInit, /ExecStartPre=.*plenum-private-image-pull \$\{image_pull_secret_ocid\} \$\{application_image\}/u);
  assert.match(helper, /--auth[\s\S]*instance_principal/u);
  assert.match(helper, /docker", "login", "ghcr\.io"[\s\S]*--password-stdin/u);
  assert.match(helper, /docker", "pull", image/u);
  assert.match(helper, /shutil\.rmtree\(docker_config, ignore_errors=True\)/u);
  assert.match(production, /image_pull_secrets\s*\{[\s\S]*secret_type\s*=\s*"VAULT"[\s\S]*secret_id\s*=\s*var\.image_pull_secret_ocid/u);
  assert.match(iam, /target\.secret\.id='<IMAGE_PULL_SECRET_OCID>'/u);

  const examples = `${freeExample}\n${productionExample}`;
  assert.match(examples, /image_pull_secret_ocid\s*=\s*"ocid1\.vaultsecret\./u);
  assert.doesNotMatch(examples, /(?:registry_username|registry_password|github_token)\s*=/iu);
});
