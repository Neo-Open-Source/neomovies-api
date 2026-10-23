import React from "react";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import Heading from "@theme/Heading";
import styles from "./graphql-playground.module.css";

// In production the docs and API share an origin, so a relative URL works and
// survives custom domains. Locally, the docs dev server runs on :3000 while the
// API runs on its own port — set DOCS_GRAPHQL_URL to point at it.
const DEFAULT_ENDPOINT = "/graphql";

function resolveGraphqlEndpoint(value: unknown): string {
  return typeof value === "string" && value.length > 0 ? value : DEFAULT_ENDPOINT;
}

export default function GraphQLPlaygroundPage(): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  const endpoint = resolveGraphqlEndpoint(siteConfig.customFields?.graphqlEndpoint);

  return (
    <Layout
      title="GraphQL Playground"
      description="Interactive GraphiQL playground for the NeoWatch GraphQL API"
    >
      <div className={styles.page}>
        <div className={styles.toolbar}>
          <Heading as="h1" className={styles.title}>
            GraphQL Playground
          </Heading>
          <p className={styles.endpoint}>
            Endpoint: <code>{endpoint}</code>
          </p>
          <a
            className={styles.openLink}
            href={endpoint}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in new tab
          </a>
        </div>
        {/* A plain anchor is not enough: this page must never be reached by
            Docusaurus client-side routing, which is why it lives at
            /graphql-playground instead of /graphql (the API route). */}
        <iframe
          className={styles.frame}
          src={endpoint}
          title={`${siteConfig.title} GraphQL Playground`}
          allow="clipboard-write"
        />
      </div>
    </Layout>
  );
}
