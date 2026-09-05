import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { editReqSchema, projectReqSchema, submitReqSchema } from "../../../common/validators.js";
import type { AppVariables } from "../main.js";
import {
  createProject,
  deleteProject,
  getProjectDetail,
  listMyProjects,
  submitAvailability,
  updateMyAvailability,
  updateProject,
} from "../usecases/projects.js";
import { webActor } from "../usecases/types.js";

const projectIdParamsSchema = z.object({ projectId: z.string().length(21) });

const router = new Hono<{ Variables: AppVariables }>()
  // プロジェクト作成
  .post("/", zValidator("json", projectReqSchema), async (c) => {
    const project = await createProject(webActor(c.get("browserId")), c.req.valid("json"));
    return c.json({ id: project.id, name: project.name }, 201);
  })

  // 自分が関連するプロジェクト取得
  .get("/mine", async (c) => {
    const projects = await listMyProjects(webActor(c.get("browserId")));
    return c.json(projects, 200);
  })

  // プロジェクト取得
  .get("/:projectId", zValidator("param", projectIdParamsSchema), async (c) => {
    const { projectId } = c.req.valid("param");
    const project = await getProjectDetail(webActor(c.get("browserId")), projectId);
    return c.json(project, 200);
  })

  // プロジェクト編集
  .put("/:projectId", zValidator("param", projectIdParamsSchema), zValidator("json", editReqSchema), async (c) => {
    const { projectId } = c.req.valid("param");
    const event = await updateProject(webActor(c.get("browserId")), projectId, c.req.valid("json"));
    return c.json({ event }, 200);
  })

  // プロジェクト削除
  .delete("/:projectId", zValidator("param", projectIdParamsSchema), async (c) => {
    const { projectId } = c.req.valid("param");
    await deleteProject(webActor(c.get("browserId")), projectId);
    return c.json(204);
  })

  // 日程の提出。
  .post(
    "/:projectId/submissions",
    zValidator("param", projectIdParamsSchema),
    zValidator("json", submitReqSchema),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const { name, comment, slots } = c.req.valid("json");
      await submitAvailability(webActor(c.get("browserId")), projectId, { name, comment, slots });
      return c.json("日程が提出されました。", 201);
    },
  )

  // 日程の更新。
  .put(
    "/:projectId/submissions/mine",
    zValidator("param", projectIdParamsSchema),
    zValidator("json", submitReqSchema),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const { name, comment, slots } = c.req.valid("json");
      const guest = await updateMyAvailability(webActor(c.get("browserId")), projectId, { name, comment, slots });
      return c.json({ message: "日程が更新されました。", guest }, 200);
    },
  );

export default router;
