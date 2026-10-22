import { describe, expect, test } from "vitest";
import { type Browser, createBrowser, createProject, projectInput, slotOnNov2, submissionInput } from "./helpers.js";

const missingProjectId = "a".repeat(21);

async function getProject(browser: Browser, projectId: string) {
  const res = await browser.get(`/projects/${projectId}`);
  expect(res.status).toBe(200);
  // biome-ignore lint/suspicious/noExplicitAny: レスポンスの形そのものを検証するため
  return (await res.json()) as any;
}

async function submit(guest: Browser, projectId: string, optionId: string, overrides: Record<string, unknown> = {}) {
  const res = await guest.post(`/projects/${projectId}/submissions`, submissionInput(projectId, optionId, overrides));
  expect(res.status).toBe(201);
}

describe("POST /projects", () => {
  test("作成すると 201 で id と name を返し、作成者がホストになる", async () => {
    const host = createBrowser();
    const input = projectInput({ description: "  説明  " });

    const res = await host.post("/projects", input);

    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; name: string };
    expect(body).toEqual({ id: expect.stringMatching(/^[0-9A-Za-z]{21}$/), name: "テストイベント" });

    const project = await getProject(host, body.id);
    expect(project).toEqual({
      id: body.id,
      name: "テストイベント",
      description: "説明",
      startDate: "2026-11-01T15:00:00.000Z",
      endDate: "2026-11-04T14:59:59.999Z",
      allowedRanges: [
        {
          id: expect.any(String),
          projectId: body.id,
          startTime: "08:00",
          endTime: "23:00",
        },
      ],
      participationOptions: [{ ...input.participationOptions[0], projectId: body.id }],
      hosts: [{ id: expect.any(String), projectId: body.id }],
      guests: [],
      isHost: true,
      meAsGuest: null,
    });
  });

  test("空白だけの説明は空文字として返す", async () => {
    const host = createBrowser();
    const { id } = await createProject(host, { description: "   " });

    expect((await getProject(host, id)).description).toBe("");
  });

  test("名前が空なら 400", async () => {
    const res = await createBrowser().post("/projects", projectInput({ name: "" }));

    expect(res.status).toBe(400);
  });

  test("開始日が終了日より後なら 400", async () => {
    const res = await createBrowser().post(
      "/projects",
      projectInput({ startDate: "2026-11-05T15:00:00.000Z", endDate: "2026-11-04T14:59:59.999Z" }),
    );

    expect(res.status).toBe(400);
  });

  test("参加形態が 0 件なら 400", async () => {
    const res = await createBrowser().post("/projects", projectInput({ participationOptions: [] }));

    expect(res.status).toBe(400);
  });

  test("日付が ISO 8601 の日時でなければ 400", async () => {
    const res = await createBrowser().post("/projects", projectInput({ startDate: "2026-11-02" }));

    expect(res.status).toBe(400);
  });

  test("時間帯が HH:mm の形式でなければ 400", async () => {
    const res = await createBrowser().post(
      "/projects",
      projectInput({ allowedRanges: [{ startTime: "2026-11-01T23:00:00.000Z", endTime: "2026-11-04T14:00:00.000Z" }] }),
    );

    expect(res.status).toBe(400);
  });

  test("時間帯が 15 分単位でなければ 400", async () => {
    const res = await createBrowser().post(
      "/projects",
      projectInput({ allowedRanges: [{ startTime: "08:10", endTime: "23:00" }] }),
    );

    expect(res.status).toBe(400);
  });

  test("時間帯の開始が終了より後なら 400", async () => {
    const res = await createBrowser().post(
      "/projects",
      projectInput({ allowedRanges: [{ startTime: "23:00", endTime: "08:00" }] }),
    );

    expect(res.status).toBe(400);
  });

  test("時間帯の終了は 24:00 にできる", async () => {
    const host = createBrowser();
    const { id } = await createProject(host, { allowedRanges: [{ startTime: "00:00", endTime: "24:00" }] });

    expect((await getProject(host, id)).allowedRanges).toMatchObject([{ startTime: "00:00", endTime: "24:00" }]);
  });

  test("24:00 より後の時刻は 400", async () => {
    const res = await createBrowser().post(
      "/projects",
      projectInput({ allowedRanges: [{ startTime: "08:00", endTime: "24:15" }] }),
    );

    expect(res.status).toBe(400);
  });
});

describe("GET /projects/mine", () => {
  test("ホストまたはゲストとして関わるイベントだけを返す", async () => {
    const me = createBrowser();
    const other = createBrowser();
    const hosted = await createProject(me, { name: "主催" });
    const joined = await createProject(other, { name: "参加" });
    await createProject(other, { name: "無関係" });
    await submit(me, joined.id, joined.optionId);

    const res = await me.get("/projects/mine");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string }[];
    expect(body.sort((a, b) => a.name.localeCompare(b.name))).toEqual([
      {
        id: hosted.id,
        name: "主催",
        description: "説明",
        startDate: "2026-11-01T15:00:00.000Z",
        endDate: "2026-11-04T14:59:59.999Z",
        isHost: true,
      },
      {
        id: joined.id,
        name: "参加",
        description: "説明",
        startDate: "2026-11-01T15:00:00.000Z",
        endDate: "2026-11-04T14:59:59.999Z",
        isHost: false,
      },
    ]);
  });

  test("関わるイベントが無ければ空配列", async () => {
    const res = await createBrowser().get("/projects/mine");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

describe("GET /projects/:projectId", () => {
  test("存在しなければ 404", async () => {
    const res = await createBrowser().get(`/projects/${missingProjectId}`);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "イベントが見つかりません。" });
  });

  test("id が 21 文字でなければ 400", async () => {
    const res = await createBrowser().get("/projects/short");

    expect(res.status).toBe(400);
  });

  test("ゲストから見ると isHost は false で、自分の回答が meAsGuest に入る", async () => {
    const host = createBrowser();
    const guest = createBrowser();
    const { id, optionId } = await createProject(host);
    await submit(guest, id, optionId, { comment: "  よろしく  " });

    const project = await getProject(guest, id);

    const expectedGuest = {
      id: expect.any(String),
      name: "ゲスト",
      comment: "よろしく",
      projectId: id,
      slots: [
        {
          id: expect.any(String),
          from: slotOnNov2.start,
          to: slotOnNov2.end,
          projectId: id,
          guestId: expect.any(String),
          participationOptionId: optionId,
        },
      ],
    };
    expect(project.isHost).toBe(false);
    expect(project.meAsGuest).toEqual(expectedGuest);
    expect(project.guests).toEqual([expectedGuest]);
    expect(project.meAsGuest.slots[0].guestId).toBe(project.meAsGuest.id);
  });

  test("回答していない人から見ると meAsGuest は null", async () => {
    const host = createBrowser();
    const { id, optionId } = await createProject(host);
    await submit(createBrowser(), id, optionId);

    const project = await getProject(createBrowser(), id);

    expect(project.isHost).toBe(false);
    expect(project.meAsGuest).toBeNull();
    expect(project.guests).toHaveLength(1);
  });

  test("ホストとゲストの browserId をレスポンスに含めない", async () => {
    const host = createBrowser();
    const guest = createBrowser();
    const { id, optionId } = await createProject(host);
    await submit(guest, id, optionId);

    const res = await guest.get(`/projects/${id}`);
    const text = await res.text();

    expect(text).not.toContain("browserId");
    expect(text).not.toContain(host.browserId);
    expect(text).not.toContain(guest.browserId);
  });
});

describe("PUT /projects/:projectId", () => {
  test("ホスト以外は 403", async () => {
    const { id } = await createProject(createBrowser());

    const res = await createBrowser().put(`/projects/${id}`, { name: "乗っ取り" });

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ message: "アクセス権限がありません。" });
  });

  test("存在しないイベントは 403", async () => {
    const res = await createBrowser().put(`/projects/${missingProjectId}`, { name: "x" });

    expect(res.status).toBe(403);
  });

  test("時間帯が HH:mm の形式でなければ 400", async () => {
    const host = createBrowser();
    const { id } = await createProject(host);

    const res = await host.put(`/projects/${id}`, {
      allowedRanges: [{ startTime: "2026-11-10T00:00:00.000Z", endTime: "2026-11-10T09:00:00.000Z" }],
    });

    expect(res.status).toBe(400);
  });

  test("ゲストがいなければ、名前・説明・日程・時間帯を更新できる", async () => {
    const host = createBrowser();
    const { id } = await createProject(host);

    const res = await host.put(`/projects/${id}`, {
      name: "新しい名前",
      description: "  新しい説明  ",
      startDate: "2026-11-09T15:00:00.000Z",
      endDate: "2026-11-10T14:59:59.999Z",
      allowedRanges: [{ startTime: "09:00", endTime: "18:00" }],
    });

    expect(res.status).toBe(200);
    // biome-ignore lint/suspicious/noExplicitAny: レスポンスの形そのものを検証するため
    const { event } = (await res.json()) as any;
    expect(event).toEqual({
      id,
      name: "新しい名前",
      description: "新しい説明",
      startDate: "2026-11-09T15:00:00.000Z",
      endDate: "2026-11-10T14:59:59.999Z",
      allowedRanges: [
        {
          id: expect.any(String),
          projectId: id,
          startTime: "09:00",
          endTime: "18:00",
        },
      ],
      participationOptions: [{ id: expect.any(String), label: "参加", color: "#0F82B1", projectId: id }],
    });
  });

  test("ゲストがいると、名前と説明だけ更新し、日程と時間帯は変えない", async () => {
    const host = createBrowser();
    const { id, optionId } = await createProject(host);
    await submit(createBrowser(), id, optionId);

    const res = await host.put(`/projects/${id}`, {
      name: "新しい名前",
      startDate: "2026-11-09T15:00:00.000Z",
      endDate: "2026-11-10T14:59:59.999Z",
      allowedRanges: [{ startTime: "09:00", endTime: "18:00" }],
    });

    expect(res.status).toBe(200);
    const project = await getProject(host, id);
    expect(project).toMatchObject({
      name: "新しい名前",
      startDate: "2026-11-01T15:00:00.000Z",
      endDate: "2026-11-04T14:59:59.999Z",
      allowedRanges: [{ startTime: "08:00", endTime: "23:00" }],
    });
  });

  // 現状の挙動: 省略したフィールドは「変更しない」ではなく、消える
  test("description を省略すると、説明が消える", async () => {
    const host = createBrowser();
    const { id } = await createProject(host);

    await host.put(`/projects/${id}`, { name: "新しい名前" });

    expect((await getProject(host, id)).description).toBe("");
  });

  // 現状の挙動: 省略したフィールドは「変更しない」ではなく、消える
  test("ゲストがいないときに allowedRanges を省略すると、時間帯が消える", async () => {
    const host = createBrowser();
    const { id } = await createProject(host);

    await host.put(`/projects/${id}`, { name: "新しい名前" });

    expect((await getProject(host, id)).allowedRanges).toEqual([]);
  });

  test("参加形態を追加・変更・削除できる", async () => {
    const host = createBrowser();
    const { id } = await createProject(host, {
      participationOptions: [
        { id: crypto.randomUUID(), label: "参加", color: "#0F82B1" },
        { id: crypto.randomUUID(), label: "消す", color: "#000000" },
      ],
    });
    const [kept] = (await getProject(host, id)).participationOptions.filter(
      (o: { label: string }) => o.label === "参加",
    );
    const added = { id: crypto.randomUUID(), label: "オンライン", color: "#FF0000" };

    const res = await host.put(`/projects/${id}`, {
      participationOptions: [{ id: kept.id, label: "対面", color: "#00FF00" }, added],
    });

    expect(res.status).toBe(200);
    const options = (await getProject(host, id)).participationOptions;
    expect(options.sort((a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label))).toEqual([
      { ...added, projectId: id },
      { id: kept.id, label: "対面", color: "#00FF00", projectId: id },
    ]);
  });

  test("Slot が紐づく参加形態は削除できない", async () => {
    const host = createBrowser();
    const { id, optionId } = await createProject(host);
    await submit(createBrowser(), id, optionId);

    const res = await host.put(`/projects/${id}`, {
      participationOptions: [{ id: crypto.randomUUID(), label: "別", color: "#000000" }],
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "以下の参加形態は日程が登録されているため削除できません: 参加" });
    expect((await getProject(host, id)).participationOptions).toHaveLength(1);
  });

  test("参加形態を 0 件にはできない", async () => {
    const host = createBrowser();
    const { id } = await createProject(host);

    const res = await host.put(`/projects/${id}`, { participationOptions: [] });

    expect(res.status).toBe(400);
  });
});

describe("DELETE /projects/:projectId", () => {
  test("ホスト以外は 403", async () => {
    const { id } = await createProject(createBrowser());

    const res = await createBrowser().delete(`/projects/${id}`);

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ message: "削除権限がありません。" });
  });

  // 現状の挙動: `c.json(204)` なので、ステータスは 200 で本文が 204 になる
  test("ホストは、ゲストの回答ごと削除できる", async () => {
    const host = createBrowser();
    const { id, optionId } = await createProject(host);
    await submit(createBrowser(), id, optionId);

    const res = await host.delete(`/projects/${id}`);

    expect(res.status).toBe(200);
    expect(await res.json()).toBe(204);
    expect((await host.get(`/projects/${id}`)).status).toBe(404);
  });
});

describe("POST /projects/:projectId/submissions", () => {
  test("回答すると 201", async () => {
    const { id, optionId } = await createProject(createBrowser());
    const guest = createBrowser();

    const res = await guest.post(`/projects/${id}/submissions`, submissionInput(id, optionId));

    expect(res.status).toBe(201);
    expect(await res.json()).toBe("日程が提出されました。");
    expect((await getProject(guest, id)).meAsGuest).toMatchObject({ name: "ゲスト", comment: "コメント" });
  });

  test("空白だけのコメントは null になる", async () => {
    const { id, optionId } = await createProject(createBrowser());
    const guest = createBrowser();

    await submit(guest, id, optionId, { comment: "  " });

    expect((await getProject(guest, id)).meAsGuest.comment).toBeNull();
  });

  test("同じブラウザから 2 回目は 409", async () => {
    const { id, optionId } = await createProject(createBrowser());
    const guest = createBrowser();
    await submit(guest, id, optionId);

    const res = await guest.post(`/projects/${id}/submissions`, submissionInput(id, optionId));

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ message: "提出済みです。" });
  });

  test("ホストも回答できる", async () => {
    const host = createBrowser();
    const { id, optionId } = await createProject(host);

    await submit(host, id, optionId);

    const project = await getProject(host, id);
    expect(project.isHost).toBe(true);
    expect(project.meAsGuest).not.toBeNull();
    expect(project.hosts).toEqual([{ id: expect.any(String), projectId: id }]);
    expect(project.guests).toEqual([project.meAsGuest]);
  });

  test("回答したホストの /projects/mine は、ホストとして 1 件だけ返す", async () => {
    const host = createBrowser();
    const { id, optionId } = await createProject(host);
    await submit(host, id, optionId);

    const res = await host.get("/projects/mine");

    expect(await res.json()).toEqual([expect.objectContaining({ id, isHost: true })]);
  });

  test("名前が空なら 400", async () => {
    const { id, optionId } = await createProject(createBrowser());

    const res = await createBrowser().post(`/projects/${id}/submissions`, submissionInput(id, optionId, { name: "" }));

    expect(res.status).toBe(400);
  });

  test("存在しないイベントに回答すると 404", async () => {
    const res = await createBrowser().post(
      `/projects/${missingProjectId}/submissions`,
      submissionInput(missingProjectId, crypto.randomUUID(), { slots: [] }),
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "イベントが見つかりません。" });
  });
});

// 検証の中身は slots.test.ts で確かめる。ここでは、提出と更新で検証が効いていることだけを確かめる
describe("日程の提出・更新での Slot の検証", () => {
  test("イベントの期間外なら 400", async () => {
    const { id, optionId } = await createProject(createBrowser());

    const res = await createBrowser().post(
      `/projects/${id}/submissions`,
      submissionInput(id, optionId, {
        // 11/01 10:00〜12:00
        slots: [
          { start: "2026-11-01T01:00:00.000Z", end: "2026-11-01T03:00:00.000Z", participationOptionId: optionId },
        ],
      }),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: expect.stringContaining("日程の範囲") });
  });

  test("別のイベントの参加形態なら 400", async () => {
    const { id } = await createProject(createBrowser());
    const other = await createProject(createBrowser());

    const res = await createBrowser().post(`/projects/${id}/submissions`, submissionInput(id, other.optionId));

    expect(res.status).toBe(400);
  });

  test("回答の更新でも検証し、弾いたときは元の回答を変えない", async () => {
    const { id, optionId } = await createProject(createBrowser());
    const guest = createBrowser();
    await submit(guest, id, optionId);

    const res = await guest.put(
      `/projects/${id}/submissions/mine`,
      submissionInput(id, optionId, {
        name: "新しい名前",
        // 11/01 10:00〜12:00
        slots: [
          { start: "2026-11-01T01:00:00.000Z", end: "2026-11-01T03:00:00.000Z", participationOptionId: optionId },
        ],
      }),
    );

    expect(res.status).toBe(400);
    const { meAsGuest } = await getProject(guest, id);
    expect(meAsGuest).toMatchObject({ name: "ゲスト", slots: [{ from: slotOnNov2.start, to: slotOnNov2.end }] });
  });
});

describe("PUT /projects/:projectId/submissions/mine", () => {
  test("回答していなければ 404", async () => {
    const { id, optionId } = await createProject(createBrowser());

    const res = await createBrowser().put(`/projects/${id}/submissions/mine`, submissionInput(id, optionId));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "既存の日程が見つかりません。" });
  });

  test("名前・コメント・Slot を置き換える", async () => {
    const { id, optionId } = await createProject(createBrowser());
    const guest = createBrowser();
    await submit(guest, id, optionId);
    const newSlot = {
      start: "2026-11-03T05:00:00.000Z",
      end: "2026-11-03T06:00:00.000Z",
      participationOptionId: optionId,
    };

    const res = await guest.put(
      `/projects/${id}/submissions/mine`,
      submissionInput(id, optionId, { name: "新しい名前", comment: "", slots: [newSlot] }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      message: "日程が更新されました。",
      guest: {
        id: expect.any(String),
        name: "新しい名前",
        comment: null,
        projectId: id,
        slots: [
          {
            id: expect.any(String),
            from: newSlot.start,
            to: newSlot.end,
            projectId: id,
            guestId: expect.any(String),
            participationOptionId: optionId,
          },
        ],
      },
    });
    const { meAsGuest } = await getProject(guest, id);
    expect(meAsGuest.slots).toEqual([expect.objectContaining({ from: newSlot.start, to: newSlot.end })]);
  });

  // D1 は 1 つの文のバインド変数が 100 個まで (Slot 1 行で 6 個)。ローカルの D1 はこの上限を強制しないので、
  // ここで確かめられるのは、分割した INSERT で全件が入ることまで
  test("1 つの文に収まらない数の Slot も保存できる", async () => {
    const { id, optionId } = await createProject(createBrowser());
    const guest = createBrowser();
    await submit(guest, id, optionId);
    // 11/02〜11/04 の 08:00〜23:00 を 1 時間ずつ、45 件
    const slots = [1, 2, 3].flatMap((day) =>
      Array.from({ length: 15 }, (_, hour) => {
        const start = new Date(Date.UTC(2026, 10, day, 23 + hour));
        return {
          start: start.toISOString(),
          end: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
          participationOptionId: optionId,
        };
      }),
    );

    const res = await guest.put(`/projects/${id}/submissions/mine`, submissionInput(id, optionId, { slots }));

    expect(res.status).toBe(200);
    expect((await getProject(guest, id)).meAsGuest.slots).toHaveLength(45);
  });

  test("他のゲストの回答は変えない", async () => {
    const { id, optionId } = await createProject(createBrowser());
    const guest = createBrowser();
    const other = createBrowser();
    await submit(guest, id, optionId);
    await submit(other, id, optionId, { name: "他の人" });

    await guest.put(`/projects/${id}/submissions/mine`, submissionInput(id, optionId, { slots: [] }));

    const { meAsGuest } = await getProject(other, id);
    expect(meAsGuest).toMatchObject({ name: "他の人", slots: [expect.anything()] });
  });
});
