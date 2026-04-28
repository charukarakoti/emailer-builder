"use client";
import { SpacerBlock } from "@/lib/types";

export default function SpacerBlockView({ block }: { block: SpacerBlock }) {
  return (
    <div
      style={{
        height: block.style.height,
        backgroundColor: block.style.backgroundColor || "transparent",
      }}
    />
  );
}
