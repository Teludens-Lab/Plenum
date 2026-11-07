import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const root = join(import.meta.dirname, "..", "..");
const read = (path) => readFile(join(root, path), "utf8");

test("AWS package is plan-only and region-locked to the Free-plan project", async () => {
  const [readme, variables, init, validate, plan] = await Promise.all([
    read("deploy/aws/README.md"),
    read("deploy/aws/variables.tf"),
    read("deploy/aws/scripts/init.ps1"),
    read("deploy/aws/scripts/validate.ps1"),
    read("deploy/aws/scripts/plan.ps1")
  ]);
  assert.match(readme, /plan-only/iu);
  assert.match(variables, /var\.region == "us-east-2"/u);
  assert.match(variables, /acknowledge_credit_funded_resources/u);
  assert.match(variables, /application_contract\.deployment_id/u);
  assert.match(init, /terraform.+init/isu);
  assert.match(validate, /fmt.+validate.+test/isu);
  assert.match(plan, /terraform.+plan/isu);
  assert.doesNotMatch(`${init}\n${validate}\n${plan}`, /terraform(?:\.Source)?[^\n]*\sapply(?:\s|$)/iu);
});

test("AWS staging uses one hardened fixed-performance host without SSH", async () => {
  const [variables, compute, network, cloudInit] = await Promise.all([
    read("deploy/aws/variables.tf"),
    read("deploy/aws/compute.tf"),
    read("deploy/aws/networking.tf"),
    read("deploy/aws/cloud-init/staging.yaml.tftpl")
  ]);
  assert.match(variables, /default\s+=\s+"m7i-flex\.large"/u);
  assert.match(compute, /http_tokens\s+=\s+"required"/u);
  assert.match(compute, /http_put_response_hop_limit\s+=\s+2/u);
  assert.match(compute, /encrypted\s+=\s+true/u);
  assert.match(compute, /monitoring\s+=\s+false/u);
  assert.match(network, /from_port\s+=\s+443/u);
  assert.match(network, /from_port\s+=\s+50000/u);
  assert.doesNotMatch(network, /from_port\s+=\s+22/u);
  assert.match(cloudInit, /amazon-ssm-agent/u);
  assert.match(compute, /user_data_replace_on_change\s+=\s+false/u);
  assert.match(compute, /user_data_base64\s+=\s+base64gzip\(local\.user_data\)/u);
  assert.match(compute, /ignore_changes\s+=\s+\[[\s\S]*associate_public_ip_address,[\s\S]*user_data,[\s\S]*user_data_base64[\s\S]*\]/u);
});

test("AWS staging owns a private encrypted regional S3 bucket for the runtime role", async () => {
  const [storage, locals, variables, example] = await Promise.all([
    read("deploy/aws/storage.tf"),
    read("deploy/aws/locals.tf"),
    read("deploy/aws/variables.tf"),
    read("deploy/aws/profiles/staging.tfvars.example")
  ]);
  assert.match(storage, /resource "aws_s3_bucket" "objects"/u);
  assert.match(storage, /force_destroy\s+=\s+false/u);
  assert.match(storage, /block_public_acls\s+=\s+true/u);
  assert.match(storage, /object_ownership\s+=\s+"BucketOwnerEnforced"/u);
  assert.match(storage, /sse_algorithm\s+=\s+"AES256"/u);
  assert.match(storage, /status\s+=\s+"Enabled"/u);
  assert.match(storage, /id\s+=\s+"expire-noncurrent-versions-after-30-days"[\s\S]*noncurrent_days\s+=\s+30/u);
  assert.match(storage, /id\s+=\s+"expire-transient-audio-after-one-day"[\s\S]*prefix\s+=\s+"transient-audio\/"[\s\S]*days\s+=\s+1/u);
  assert.match(storage, /data\.aws_iam_role\.runtime\.arn/u);
  for (const action of ["ListBucket", "PutObject", "GetObject", "DeleteObject"]) {
    assert.match(storage, new RegExp(`s3:${action}`, "u"));
  }
  assert.match(locals, /S3_REGION\s+=\s+var\.region/u);
  assert.match(locals, /S3_FORCE_PATH_STYLE\s+=\s+"0"/u);
  assert.match(locals, /S3_BUCKET\s+=\s+aws_s3_bucket\.objects\.id/u);
  assert.doesNotMatch(locals, /S3_ENDPOINT/u);
  assert.doesNotMatch(`${variables}\n${example}`, /s3_(?:endpoint|region|bucket)/u);
});

test("AWS runtime secrets stay in scoped SSM SecureString parameters", async () => {
  const [variables, fetch, pull, example, outputs] = await Promise.all([
    read("deploy/aws/variables.tf"),
    read("deploy/aws/runtime/fetch-secrets.sh.tftpl"),
    read("deploy/aws/runtime/private-image-pull.sh.tftpl"),
    read("deploy/aws/profiles/staging.tfvars.example"),
    read("deploy/aws/outputs.tf")
  ]);
  assert.match(variables, /default\s+=\s+"\/plenum\/staging"/u);
  assert.match(fetch, /ssm get-parameter[\s\S]*--with-decryption/u);
  assert.match(fetch, /ssm get-parameter[\s\S]*--no-cli-pager/u);
  assert.match(pull, /ssm get-parameter[\s\S]*--with-decryption/u);
  assert.match(pull, /--password-stdin/u);
  assert.match(outputs, /required_parameter_names/u);
  assert.match(fetch, /operations\.json/u);
  assert.match(outputs, /\/operations/u);
  assert.doesNotMatch(example, /(?:password|token|secret)\s*=\s*"[^<R][^"\n]+"/iu);
});

test("AWS bootstrap installs a service-visible AWS CLI v2", async () => {
  const cloudInit = await read("deploy/aws/cloud-init/staging.yaml.tftpl");
  assert.match(cloudInit, /snap install aws-cli --classic/u);
  assert.match(cloudInit, /Environment=PATH=.*:\/snap\/bin/u);
  assert.doesNotMatch(cloudInit, /^\s+- awscli\s*$/mu);
});

test("shared Compose supports PostgreSQL 18 and preserves migration shell variables", async () => {
  const compose = await read("deploy/oci/runtime/compose.functional-free.yaml.tftpl");
  assert.match(compose, /postgres-data:\/var\/lib\/postgresql\]/u);
  assert.doesNotMatch(compose, /postgres-data:\/var\/lib\/postgresql\/data/u);
  assert.match(compose, /\$\$\$\{migration\}/u);
  assert.match(compose, /\$\$\$\{name\}/u);
  assert.match(compose, /\$\$\$\{applied\}/u);
  assert.doesNotMatch(compose, /\$\$\$\$\{(?:migration|name|applied)\}/u);
  assert.match(compose, /temporary_home="\$\$\(mktemp -d\)"[\s\S]*set-password -r plenum/u);
  assert.doesNotMatch(compose, /set-password --server/u);
});

test("runtime secrets remain host-private and readable by non-root containers", async () => {
  const [fetch, cloudInit, compose] = await Promise.all([
    read("deploy/aws/runtime/fetch-secrets.sh.tftpl"),
    read("deploy/aws/cloud-init/staging.yaml.tftpl"),
    read("deploy/oci/runtime/compose.functional-free.yaml.tftpl")
  ]);
  assert.match(fetch, /secret_group_id="2000"/u);
  assert.match(fetch, /-g "\$secret_group_id" -m 0640/u);
  assert.match(fetch, /head -n 1 \/etc\/plenum\/secrets\/livekit-keys\.yaml/u);
  assert.match(fetch, /tail -n \+2 \/etc\/plenum\/secrets\/livekit-keys\.yaml/u);
  assert.match(cloudInit, /groupadd --system --gid 2000 plenum-secrets/u);
  assert.equal((compose.match(/group_add: \["2000"\]/gu) ?? []).length, 9);
  assert.match(compose, /source: livekit-keys\s+target: livekit-keys\.yaml/u);
  assert.match(compose, /source: operations\s+target: operations\.json/u);
});

test("AWS staging connects the scanner and independent operations collector", async () => {
  const [compose, readerBootstrap] = await Promise.all([
    read("deploy/oci/runtime/compose.functional-free.yaml.tftpl"),
    read("deploy/compose/operations-reader-bootstrap.mjs")
  ]);
  assert.match(compose, /malware-scanner:[\s\S]*clamav\/clamav-debian:1\.4\.6@sha256:[0-9a-f]{64}/u);
  assert.match(compose, /malware-scanner:\s*\n\s+condition: service_healthy/u);
  assert.match(compose, /operations-reader-bootstrap:[\s\S]*operations-reader-bootstrap\.mjs/u);
  assert.match(compose, /operations-agent:[\s\S]*operations-agent\.mjs/u);
  assert.match(compose, /APPLICATION_METRICS_URL: http:\/\/application:9090\/metrics/u);
  assert.match(compose, /operations-agent:[\s\S]*read_only: true[\s\S]*cap_drop: \[ALL\][\s\S]*no-new-privileges:true/u);
  assert.match(compose, /tmpfs: \["\/tmp:rw,noexec,nosuid,nodev,size=16m"\]/u);
  assert.match(readerBootstrap, /format\('[^']+', \$1::text\)/u);
});

test("AWS package reuses the approved runtime and immutable release", async () => {
  const [locals, variables, plan, compose] = await Promise.all([
    read("deploy/aws/locals.tf"),
    read("deploy/aws/variables.tf"),
    read("deploy/aws/scripts/plan.ps1"),
    read("deploy/oci/runtime/compose.functional-free.yaml.tftpl")
  ]);
  assert.match(locals, /compose\.functional-free\.yaml\.tftpl/u);
  assert.match(locals, /Caddyfile\.tftpl/u);
  assert.match(variables, /@sha256:\[0-9a-f\]\{64\}/u);
  assert.match(plan, /imagetools inspect/u);
  assert.match(plan, /linux\/amd64/u);
  assert.match(plan, /linux\/arm64/u);
  assert.match(locals, /MEDIA_API_URL\s+=\s+replace\(local\.media_url, "wss:\/\/", "https:\/\/"\)/u);
  assert.match(compose, /aliases:\s*\n\s+- \$\{application_hostname\}[\s\S]*\$\{media_hostname\}/u);
});
