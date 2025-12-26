/// <reference types="@cloudflare/workers-types" />
import { ImageResponse } from "@cloudflare/pages-plugin-vercel-og/api";
// biome-ignore lint/correctness/noUnusedImports: React is needed for JSX transform
import React from "react";

interface Env {
  API_ENDPOINT: string;
}

interface ProjectData {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

async function fetchProjectData(eventId: string, apiEndpoint: string): Promise<ProjectData | null> {
  try {
    const response = await fetch(`${apiEndpoint}/projects/${eventId}`);
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch project data:", error);
    return null;
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tokyo",
  })
    .format(date)
    .replace(/-/g, "/");
}

function truncateByWidth(text: string, maxWidth = 60): string {
  let width = 0;
  let result = "";

  for (const char of text) {
    // ASCII なら 1、それ以外は 2
    const charWidth = char.charCodeAt(0) < 128 ? 1 : 2;

    if (width + charWidth > maxWidth) {
      break;
    }

    width += charWidth;
    result += char;
  }

  if (result.length < text.length) {
    result += "…";
  }

  return result;
}

export const onRequestGet: PagesFunction<Env, "eventId"> = async (context) => {
  const { env, params } = context;
  const eventId = params.eventId;

  if (typeof eventId !== "string") {
    console.error("eventId is not a string");
    return new Response("Invalid event ID", { status: 400 });
  }

  if (!eventId || !/^[A-Za-z0-9_-]{21}$/.test(eventId)) {
    return new Response("Invalid event ID", { status: 400 });
  }

  const projectData = await fetchProjectData(eventId, env.API_ENDPOINT);

  if (!projectData) {
    // プロジェクトがない場合はデフォルト画像にリダイレクト
    const url = new URL(context.request.url);
    return Response.redirect(`${url.origin}/og-image.jpg`, 302);
  }

  const fontData = await fetch(
    "https://unpkg.com/@fontsource/m-plus-1p@5.2.8/files/m-plus-1p-japanese-700-normal.woff",
  ).then((res) => res.arrayBuffer());

  const projectName = truncateByWidth(projectData.name, 72);

  const startDate = formatDate(projectData.startDate);
  const endDate = formatDate(projectData.endDate);
  const dateRange = startDate === endDate ? startDate : `${startDate} 〜 ${endDate}`;

  const response = new ImageResponse(
    <div
      style={{
        display: "flex",
        backgroundColor: "#0f82b1",
        padding: "48px 56px",
        width: "100%",
        height: "100%",
        fontFamily: "M PLUS 1p",
        fontWeight: 700,
      }}
    >
      <div
        style={{
          display: "flex",
          backgroundColor: "#fff",
          color: "#555",
          flexDirection: "column",
          borderRadius: "32px",
          flex: 1,
          alignItems: "center",
          padding: "40px",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "24px",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: "64px",
              textAlign: "center",
              wordBreak: "break-word",
            }}
          >
            {projectName}
          </span>
          <span
            style={{
              fontSize: "40px",
              textAlign: "center",
            }}
          >
            {dateRange}
          </span>
        </div>
        <div
          style={{
            color: "#0f82b1",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "40px",
          }}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 50 50"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-hidden="true"
          >
            <rect x="34" width="16" height="33" rx="2" fill="#0F82B1" />
            <rect y="17" width="33" height="16" rx="2" fill="#0F82B1" />
            <rect x="17" y="34" width="16" height="16" rx="2" fill="#0F82B1" />
          </svg>
          <div>イツヒマ</div>
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "M PLUS 1p",
          data: fontData,
          weight: 700,
          style: "normal",
        },
      ],
    },
  );

  return response;
};
