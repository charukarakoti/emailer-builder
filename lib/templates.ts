// =============================================================================
// v3 starter templates (schema: sections > columns > blocks, Padding objects,
// alignment, border, borderRadius).
// =============================================================================

import { EmailDocument, uid, p, noBorder } from "./types";

export const templates: { name: string; doc: EmailDocument }[] = [
  // -------------------------------------------------------------------------
  // Welcome — simple centered template
  // -------------------------------------------------------------------------
  {
    name: "Welcome",
    doc: {
      meta: {
        subject: "Welcome to Acme",
        preheader: "Thanks for signing up — here's how to get started.",
        backgroundColor: "#f3f4f6",
        contentBackground: "#ffffff",
        contentWidth: 600,
        alignment: "center",
        border: noBorder(),
        borderRadius: "0",
      },
      sections: [
        {
          id: uid("sec"),
          style: {
            backgroundColor: "#111827",
            padding: p("24px"),
            paddingMode: "unified",
            columnLayout: "1",
            stackOnMobile: true,
            gutter: "10px",
            border: noBorder(),
            borderRadius: "0",
            verticalAlign: "top",
          },
          columns: [
            {
              blocks: [
                {
                  id: uid("txt"),
                  type: "text",
                  content: "ACME",
                  style: {
                    fontSize: "22px",
                    color: "#ffffff",
                    lineHeight: "1.2",
                    fontFamily: "Arial, Helvetica, sans-serif",
                    fontWeight: "700",
                    textAlign: "center",
                    padding: p("0"),
                    linkColor: "#93c5fd",
                  },
                },
              ],
            },
          ],
        },
        {
          id: uid("sec"),
          style: {
            backgroundColor: "#ffffff",
            padding: p("32px", "24px"),
            paddingMode: "trbl",
            columnLayout: "1",
            stackOnMobile: true,
            gutter: "10px",
            border: noBorder(),
            borderRadius: "0",
            verticalAlign: "top",
          },
          columns: [
            {
              blocks: [
                {
                  id: uid("txt"),
                  type: "text",
                  content: "Welcome aboard",
                  style: {
                    fontSize: "28px",
                    color: "#111111",
                    lineHeight: "1.3",
                    fontFamily: "Arial, Helvetica, sans-serif",
                    fontWeight: "700",
                    textAlign: "left",
                    padding: p("0", "0", "12px", "0"),
                    linkColor: "#2563eb",
                  },
                },
                {
                  id: uid("txt"),
                  type: "text",
                  content:
                    "Thanks for creating an account. Here are the first things to try:<ul><li>Complete your <strong>profile</strong></li><li>Invite a teammate</li><li>Read our <a href='https://example.com/docs'>getting-started guide</a></li></ul>",
                  style: {
                    fontSize: "16px",
                    color: "#374151",
                    lineHeight: "1.6",
                    fontFamily: "Arial, Helvetica, sans-serif",
                    fontWeight: "400",
                    textAlign: "left",
                    padding: p("0", "0", "20px", "0"),
                    linkColor: "#2563eb",
                  },
                },
                {
                  id: uid("btn"),
                  type: "button",
                  content: "Complete your profile",
                  href: "https://example.com/onboarding",
                  style: {
                    backgroundColor: "#2563eb",
                    color: "#ffffff",
                    fontSize: "16px",
                    fontWeight: "700",
                    paddingY: "14px",
                    paddingX: "28px",
                    borderRadius: "6px",
                    align: "left",
                    containerPadding: p("0"),
                  },
                },
              ],
            },
          ],
        },
        {
          id: uid("sec"),
          style: {
            backgroundColor: "#f9fafb",
            padding: p("20px"),
            paddingMode: "unified",
            columnLayout: "1",
            stackOnMobile: true,
            gutter: "10px",
            border: noBorder(),
            borderRadius: "0",
            verticalAlign: "top",
          },
          columns: [
            {
              blocks: [
                {
                  id: uid("txt"),
                  type: "text",
                  content:
                    "© 2026 Acme Inc. · <a href='https://example.com/unsubscribe'>Unsubscribe</a>",
                  style: {
                    fontSize: "12px",
                    color: "#6b7280",
                    lineHeight: "1.5",
                    fontFamily: "Arial, Helvetica, sans-serif",
                    fontWeight: "400",
                    textAlign: "center",
                    padding: p("0"),
                    linkColor: "#6b7280",
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  },

  // -------------------------------------------------------------------------
  // Newsletter — 60/40 split + rounded frame + left alignment demo
  // -------------------------------------------------------------------------
  {
    name: "Newsletter (60/40)",
    doc: {
      meta: {
        subject: "This week at Acme",
        preheader: "Product shipped, customer stories, what's next.",
        backgroundColor: "#eef2ff",
        contentBackground: "#ffffff",
        contentWidth: 600,
        alignment: "center",
        border: { width: "1px", style: "solid", color: "#c7d2fe" },
        borderRadius: "6",
      },
      sections: [
        {
          id: uid("sec"),
          style: {
            backgroundColor: "#ffffff",
            padding: p("24px"),
            paddingMode: "unified",
            columnLayout: "60-40",
            stackOnMobile: true,
            gutter: "16px",
            border: noBorder(),
            borderRadius: "0",
            verticalAlign: "top",
          },
          columns: [
            {
              blocks: [
                {
                  id: uid("txt"),
                  type: "text",
                  content:
                    "<strong>Weekly digest</strong><br/>We shipped dark mode, a new billing page, and <a href='https://example.com/changelog'>seven fixes</a>.",
                  style: {
                    fontSize: "16px",
                    color: "#111827",
                    lineHeight: "1.6",
                    fontFamily: "Arial, Helvetica, sans-serif",
                    fontWeight: "400",
                    textAlign: "left",
                    padding: p("0"),
                    linkColor: "#4338ca",
                  },
                },
              ],
            },
            {
              blocks: [
                {
                  id: uid("img"),
                  type: "image",
                  src: "https://via.placeholder.com/240x160.png?text=Hero",
                  alt: "This week's hero",
                  style: {
                    width: "240",
                    align: "right",
                    padding: p("0"),
                    border: { width: "0", style: "none", color: "#000000" },
                    borderRadius: "0px",
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  },
];
