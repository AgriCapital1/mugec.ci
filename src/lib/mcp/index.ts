import { defineMcp } from "@lovable.dev/mcp-js";
import listNews from "./tools/list-news";
import listOpportunities from "./tools/list-opportunities";

export default defineMcp({
  name: "mugec-ci-mcp",
  title: "MUGEC-CI",
  version: "0.1.0",
  instructions:
    "Outils publics MUGEC-CI : consulter les actualités et opportunités (emploi, formation, marchés publics) publiées par la mutuelle.",
  tools: [listNews, listOpportunities],
});
