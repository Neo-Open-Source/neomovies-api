import React from "react";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import Heading from "@theme/Heading";
import styles from "./graphql.module.css";

const DEFAULT_API_URL = "https://neowatch-api-ts.vercel.app";

function resolveGraphqlEndpoint(): string {
  return `${DEFAULT_API_URL}/graphql`;
}

export default function GraphQLPlaygroundPage(): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  const endpoint = resolveGraphqlEndpoint();

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
