import { auth, defineMcp } from "@lovable.dev/mcp-js";
import createNews from "./tools/create-news";
import listNews from "./tools/list-news";
import listOpportunities from "./tools/list-opportunities";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "mugec-ci-mcp",
  title: "MUGEC-CI",
  version: "0.2.0",
  instructions:
    "Outils MCP MUGEC-CI protégés par Supabase OAuth. Chaque appel agit comme l'utilisateur connecté et respecte strictement les politiques RLS.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listNews, listOpportunities, createNews],
});
