import type { APIRoute, GetStaticPaths } from "astro";
import { AGENT_SKILLS, findSkill, skillBody } from "../../../../lib/agent-skills";
import { getCatalog } from "../../../../lib/catalog";

/**
 * /.well-known/agent-skills/<name>/SKILL.md
 *
 * One route for both skills, so neither can be added to the index without
 * something to serve at the URL the index advertises.
 *
 * The bytes must match what `index.json.ts` hashed, which is why both go
 * through `skillBody()` with the same catalog rather than each assembling
 * their own copy.
 */
export const getStaticPaths: GetStaticPaths = () =>
  AGENT_SKILLS.map((skill) => ({ params: { skill: skill.name } }));

export const GET: APIRoute = async ({ params }) => {
  const skill = findSkill(String(params.skill));
  if (!skill) return new Response("Not found", { status: 404 });

  const catalog = await getCatalog();
  return new Response(skillBody(skill, catalog), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
};
