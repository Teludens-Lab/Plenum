FROM node:24.22.0-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f AS node
FROM postgres:18.6-alpine@sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873

COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/lib/libstdc++.so.6 /usr/lib/libstdc++.so.6
COPY --from=node /usr/lib/libgcc_s.so.1 /usr/lib/libgcc_s.so.1
WORKDIR /app
COPY --chown=65532:65532 . .
RUN rm -rf node_modules/@plenum && mkdir -p node_modules/@plenum \
 && for package in event-contracts extension-host media-adapter plugin-sdk policy-engine release-compiler simulation-schema sync-client validation-engine workflow-engine; do \
      ln -s ../../packages/$package node_modules/@plenum/$package; \
    done \
 && ln -s ../../apps/server node_modules/@plenum/server \
 && ln -s ../../apps/runtime-web node_modules/@plenum/runtime-web \
 && ln -s ../../apps/studio node_modules/@plenum/studio
USER 65532:65532
ENV NODE_ENV=production
ENTRYPOINT ["node"]
CMD ["deploy/compose/secret-entrypoint.mjs"]

