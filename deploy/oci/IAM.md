# OCI least-privilege prerequisites

The existing `Default/plenum-deployers` policy is sufficient for the functional-free infrastructure plan when it can manage `instance-family`, `volume-family`, `virtual-network-family`, `load-balancers`, and `object-family` only in `plenum-staging`. Private image pulls additionally require the runtime identity below; the deployer does not read the secret value.

Create a dynamic group named `plenum-staging-vms` for the functional-free VM:

```text
ALL {instance.compartment.id='<PLENUM_STAGING_COMPARTMENT_OCID>'}
```

Grant that group access to only the private-registry credential:

```text
Allow dynamic-group 'Default'/'plenum-staging-vms' to read secret-bundles in compartment plenum-staging where target.secret.id='<IMAGE_PULL_SECRET_OCID>'
```

This compartment match is intentionally paired with a single-secret policy. Do not grant the VM group general access to `secret-family`, vaults, keys, or the application runtime secret.

Production parity is a separate, billable approval boundary. A tenancy administrator must add only these staging-scoped permissions before that profile can be planned or deployed:

```text
Allow group 'Default'/'plenum-deployers' to manage compute-container-family in compartment plenum-staging
Allow group 'Default'/'plenum-deployers' to manage postgres-db-systems in compartment plenum-staging
Allow group 'Default'/'plenum-deployers' to manage postgres-backups in compartment plenum-staging
Allow group 'Default'/'plenum-deployers' to read postgres-work-requests in compartment plenum-staging
Allow group 'Default'/'plenum-deployers' to read secret-family in compartment plenum-staging
Allow group 'Default'/'plenum-deployers' to read vaults in compartment plenum-staging
Allow group 'Default'/'plenum-deployers' to use leaf-certificates in compartment plenum-staging
```

For private GHCR, the production deployer needs the existing staging-scoped `read secret-family` permission so OCI can validate the referenced Vault secret. No OCIR repository permission is required.

For application runtime access, create a dynamic group named `plenum-staging-containers` with this rule, replacing the placeholder:

```text
ALL {resource.type='computecontainerinstance', resource.compartment.id='<PLENUM_STAGING_COMPARTMENT_OCID>'}
```

Then grant only the application runtime secret and private-image credential:

```text
Allow dynamic-group plenum-staging-containers to read secret-bundles in compartment plenum-staging where target.secret.id='<RUNTIME_SECRET_OCID>'
Allow dynamic-group plenum-staging-containers to read secret-bundles in compartment plenum-staging where target.secret.id='<IMAGE_PULL_SECRET_OCID>'
```

Do not add either identity to Administrators or grant `manage all-resources`. OCI policy changes are deliberately outside this package because the deployment identity must not be able to widen its own privileges.
