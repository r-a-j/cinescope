import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebar: SidebarsConfig = {
  apisidebar: [
    {
      type: "doc",
      id: "api/cinescope-serverless-api",
    },
    {
      type: "category",
      label: "UNTAGGED",
      items: [
        {
          type: "doc",
          id: "api/extract-movie-titles",
          label: "Extract Movie Titles",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/ai-smart-search",
          label: "AI Smart Search",
          className: "api-method post",
        },
      ],
    },
  ],
};

export default sidebar.apisidebar;
